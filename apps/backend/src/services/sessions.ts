/**
 * 历史记录 CRUD + 旧数据迁移
 * 对接前端 HistoryPage 的增删改查，以及首次连接的本地→后端迁移
 */
import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { ActivitySession } from '@study-analytics/shared';
import { ActivityType, activityTypeFromValue } from '@study-analytics/shared';
import type { SessionRow } from '../session-row';

/** 把 DB 行映射为 ActivitySession（camelCase） */
function toSession(row: SessionRow): ActivitySession {
  return {
    id: row.id,
    type: row.type as ActivityType,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    content: row.content,
  };
}

/**
 * 历史记录服务
 */
export class SessionsService {
  constructor(private readonly db: Database) {}

  /**
   * 列表查询：按 type 过滤，按 start_time 倒序
   * @param type 活动类型过滤，不传则返回全部
   */
  list(type?: ActivityType): ActivitySession[] {
    if (type) {
      activityTypeFromValue(type);
      const rows = this.db
        .prepare('SELECT * FROM sessions WHERE type = ? ORDER BY start_time DESC')
        .all(type) as SessionRow[];
      return rows.map(toSession);
    }
    const rows = this.db.prepare('SELECT * FROM sessions ORDER BY start_time DESC').all() as SessionRow[];
    return rows.map(toSession);
  }

  /** 单条查询 */
  get(id: string): ActivitySession | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
    return row ? toSession(row) : null;
  }

  /**
   * 手动添加（HistoryPage "手动添加"按钮）
   * 缺 id 时生成
   */
  create(input: {
    id?: string;
    type: ActivityType;
    date: string;
    startTime: number;
    endTime: number;
    duration: number;
    content: string;
  }): ActivitySession {
    activityTypeFromValue(input.type);
    const id = input.id ?? randomUUID();
    this.db
      .prepare(
        `INSERT INTO sessions (id, type, date, start_time, end_time, duration, content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.type, input.date, input.startTime, input.endTime, input.duration, input.content);
    return { ...input, id };
  }

  /**
   * 编辑
   * @returns 更新后的记录，不存在返回 null
   */
  update(id: string, patch: Partial<Omit<ActivitySession, 'id'>>): ActivitySession | null {
    if (patch.type) activityTypeFromValue(patch.type);
    const existing = this.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch };
    this.db
      .prepare(
        `UPDATE sessions SET type=?, date=?, start_time=?, end_time=?, duration=?, content=? WHERE id=?`,
      )
      .run(merged.type, merged.date, merged.startTime, merged.endTime, merged.duration, merged.content, id);
    return merged;
  }

  /** 批量删除，返回实际删除条数 */
  deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0;
    // 动态 in 占位
    const placeholders = ids.map(() => '?').join(',');
    const result = this.db
      .prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`)
      .run(...ids);
    return result.changes;
  }

  /**
   * 旧数据迁移：按 id 去重合并（INSERT OR IGNORE）
   * 幂等：重复上传无副作用
   * @returns 实际新合并入后端的条数
   */
  migrate(sessions: ActivitySession[], currentType?: ActivityType): number {
    if (sessions.length === 0) return 0;
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO sessions (id, type, date, start_time, end_time, duration, content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    let merged = 0;
    // 事务批量插入，提升性能
    const tx = this.db.transaction(() => {
      for (const s of sessions) {
        // 旧记录 type 缺失/非法时归 STUDY（见 CONTEXT.md 旧数据迁移），normalizeType 容错
        const type = normalizeType(String(s.type ?? ''));
        const r = stmt.run(s.id, type, s.date, s.startTime, s.endTime, s.duration, s.content);
        if (r.changes > 0) merged++;
      }
    });
    tx();
    // currentType 仅前端同步用，后端无需持久化（前端独立存 localStorage）
    void currentType;
    return merged;
  }
}

/** 校验并返回有效 ActivityType（非法值归 STUDY，迁移容错） */
function normalizeType(value: string): ActivityType {
  try {
    return activityTypeFromValue(value);
  } catch {
    // 迁移场景下非法 type 不应阻断整批，归 STUDY 容错
    return ActivityType.STUDY;
  }
}
