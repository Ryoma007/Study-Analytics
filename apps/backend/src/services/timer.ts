/**
 * 计时业务逻辑 —— ActiveSession 生命周期管理
 * 见 ADR-0001（无暂停）/ADR-0004（ActiveSession 持久化）/决策2,3,5,8
 *
 * 核心规则：
 * - 单活跃槽：全局同一时刻最多一个 ActiveSession
 * - 结算点：显式停止=stop 时刻；抢占/超时=最后心跳时刻
 * - 懒结算：超时不靠后台定时器，下次请求入口检查并结算
 */
import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { ActiveSession, ActivityType } from '@study-analytics/shared';
import { activityTypeFromValue, SETTLE_REASON_PREEMPTED, SETTLE_REASON_TIMEOUT } from '@study-analytics/shared';
import { isStale } from '../db.js';
import type { Clock } from '../clock.js';

/** 当前活跃会话行（DB 映射，snake_case） */
interface ActiveRow {
  id: string;
  type: string;
  start_time: number;
  last_heartbeat_at: number;
  content: string;
}

/** 结算原因：用于 410 响应（取值来自共享常量，单一事实源） */
export type SettleReason = typeof SETTLE_REASON_PREEMPTED | typeof SETTLE_REASON_TIMEOUT;

/** 活跃会话读结果 */
export interface ActiveResult {
  active: boolean;
  session?: ActiveSession;
}

/** 心跳结果：settled 表示会话已结算（路由层转 410） */
export interface HeartbeatResult {
  settled: boolean;
  reason?: SettleReason;
}

/** 停止结果：duration 为后端权威时长（秒） */
export interface StopResult {
  sessionId: string;
  duration: number;
  endTime: number;
}

/**
 * 计时服务：所有方法注入 Clock，测试传 FakeClock 精确复现时间行为
 */
export class TimerService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  /** 读取当前活跃会话行（无则 null） */
  private getActiveRow(): ActiveRow | null {
    const row = this.db.prepare('SELECT * FROM active_session LIMIT 1').get() as ActiveRow | undefined;
    return row ?? null;
  }

  /** 把活跃行映射为 ActiveSession（camelCase） */
  private toActiveSession(row: ActiveRow): ActiveSession {
    return {
      id: row.id,
      type: row.type as ActivityType,
      startTime: row.start_time,
      lastHeartbeatAt: row.last_heartbeat_at,
      content: row.content,
    };
  }

  /**
   * 懒结算：若当前活跃会话已超时，结算它（结算点=最后心跳）
   * 在每个请求入口调用，见决策8
   * @returns 是否触发了结算
   */
  settleIfStale(): boolean {
    const row = this.getActiveRow();
    if (!row) return false;
    const now = this.clock.now();
    if (!isStale(row.last_heartbeat_at, now)) return false;
    this.settleActive(row.last_heartbeat_at);
    return true;
  }

  /**
   * 结算当前活跃会话为一条已完成 ActivitySession
   * @param settlementPoint 结算点（停止=now；抢占/超时=最后心跳）
   */
  settleActive(settlementPoint: number): void {
    const row = this.getActiveRow();
    if (!row) return;
    const durationSec = Math.max(0, Math.floor((settlementPoint - row.start_time) / 1000));
    const date = toDateLabel(row.start_time);
    // 事务：插入归档 + 删除活跃行
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO sessions (id, type, date, start_time, end_time, duration, content)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(row.id, row.type, date, row.start_time, settlementPoint, durationSec, row.content);
      this.db.prepare('DELETE FROM active_session WHERE id = ?').run(row.id);
    });
    tx();
  }

  /**
   * 开始计时：创建 ActiveSession
   * 若已有活跃会话：未超时则抢占结算（用最后心跳），超时则懒结算
   * @returns 后端权威 sessionId + serverStartTime + serverTime
   */
  start({ type, content, clientStartTime }: {
    type: ActivityType;
    content?: string;
    clientStartTime: number;
  }): { sessionId: string; serverStartTime: number; serverTime: number } {
    // 校验活动类型，非法抛异常（路由层转 400）
    activityTypeFromValue(type);

    const now = this.clock.now();
    const row = this.getActiveRow();
    if (row) {
      // 已有活跃会话：抢占结算（用最后心跳作结算点，见决策3）
      this.settleActive(row.last_heartbeat_at);
    }

    const sessionId = randomUUID();
    const serverStartTime = now;

    this.db
      .prepare(
        `INSERT INTO active_session (id, type, start_time, last_heartbeat_at, content)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(sessionId, type, serverStartTime, serverStartTime, content ?? '');

    // clientStartTime 由前端按 DTO 传入但后端不参与计算（后端用自己时钟作 startTime），显式标记未使用
    void clientStartTime;
    return { sessionId, serverStartTime, serverTime: now };
  }

  /**
   * 心跳：续命 + 校准
   * @returns settled=true 表示会话已结算（路由层转 410）
   */
  heartbeat(sessionId: string): HeartbeatResult {
    const row = this.db.prepare('SELECT * FROM active_session WHERE id = ?').get(sessionId) as
      | ActiveRow
      | undefined;
    if (!row) {
      // 会话不存在（已被结算/抢占/超时）
      return { settled: true, reason: 'preempted' };
    }
    // 先懒结算检查（该会话自己可能已超时）
    if (isStale(row.last_heartbeat_at, this.clock.now())) {
      this.settleActive(row.last_heartbeat_at);
      return { settled: true, reason: 'timeout' };
    }
    // 续命：更新 last_heartbeat_at 为后端 now
    this.db
      .prepare('UPDATE active_session SET last_heartbeat_at = ? WHERE id = ?')
      .run(this.clock.now(), sessionId);
    return { settled: false };
  }

  /**
   * 停止：显式结算
   * - 未超时：结算点 = 后端 now（正常停止）
   * - 已超时：结算点 = 最后心跳（会话早该结算，用户停止时已无法证明超时期间在计时）
   * @returns 后端权威 duration（秒），前端入库以此为准；会话不存在返回 null
   */
  stop(sessionId: string, content?: string): StopResult | null {
    const row = this.db.prepare('SELECT * FROM active_session WHERE id = ?').get(sessionId) as
      | ActiveRow
      | undefined;
    if (!row) return null;

    const now = this.clock.now();
    // 先更新 content（结算前持久化）
    if (content !== undefined) {
      this.db
        .prepare('UPDATE active_session SET content = ? WHERE id = ?')
        .run(content, sessionId);
      row.content = content;
    }

    // 超时则用最后心跳作结算点（诚实：超时期间不可证明在计时）
    const isExpired = isStale(row.last_heartbeat_at, now);
    const settlementPoint = isExpired ? row.last_heartbeat_at : now;
    this.settleActive(settlementPoint);
    const durationSec = Math.max(0, Math.floor((settlementPoint - row.start_time) / 1000));
    return { sessionId: row.id, duration: durationSec, endTime: settlementPoint };
  }

  /** 查询当前活跃会话（GET /api/sessions/active） */
  getActive(): ActiveResult {
    this.settleIfStale();
    const row = this.getActiveRow();
    if (!row) return { active: false };
    return { active: true, session: this.toActiveSession(row) };
  }
}

/**
 * 把 epoch ms 转为 YYYY-MM-DD（UTC 日期标签，仅用于 date 列）
 * 注：用 UTC 保持后端确定性，跨天由用户表单指定，不从 startTime 派生
 */
function toDateLabel(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
