/**
 * 计时业务逻辑测试 —— :memory: SQLite + 伪时钟
 * 精确复现 90s 超时结算 / 15s 心跳 / 抢占结算，见 backend-refactor-plan 测试约定
 */
import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db';
import { TimerService } from '../src/services/timer';
import { FakeClock } from '../src/clock';
import { ActivityType } from '@study-analytics/shared';
import { HEARTBEAT_TIMEOUT_MS } from '@study-analytics/shared';

const BASE_TIME = 1_700_000_000_000; // 固定起点，避免依赖系统时钟

function setup() {
  const db = createDb(':memory:');
  const clock = new FakeClock(BASE_TIME);
  const service = new TimerService(db, clock);
  return { db, clock, service };
}

describe('TimerService - 开始', () => {
  it('创建活跃会话，返回后端权威 serverStartTime', () => {
    const { service, clock } = setup();
    const res = service.start({ type: ActivityType.STUDY, clientStartTime: BASE_TIME - 1000 });
    expect(res.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    // serverStartTime 用后端时钟，不是前端 clientStartTime
    expect(res.serverStartTime).toBe(BASE_TIME);
    expect(res.serverTime).toBe(BASE_TIME);
    expect(clock.now()).toBe(BASE_TIME);
  });

  it('非法活动类型抛异常', () => {
    const { service } = setup();
    expect(() =>
      service.start({ type: 'INVALID' as never, clientStartTime: BASE_TIME }),
    ).toThrow(/无效的活动类型/);
  });
});

describe('TimerService - 心跳', () => {
  it('心跳续命：更新 last_heartbeat_at 为后端 now', () => {
    const { service, clock } = setup();
    const { sessionId } = service.start({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    // 推进 30s 后心跳
    clock.advance(30_000);
    const res = service.heartbeat(sessionId);
    expect(res.settled).toBe(false);
    // getActive 能查到更新后的心跳
    const active = service.getActive();
    expect(active.active).toBe(true);
    expect(active.session!.lastHeartbeatAt).toBe(BASE_TIME + 30_000);
  });

  it('心跳对已结算会话返回 settled=preempted', () => {
    const { service } = setup();
    const { sessionId } = service.start({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    service.stop(sessionId);
    const res = service.heartbeat(sessionId);
    expect(res.settled).toBe(true);
    expect(res.reason).toBe('preempted');
  });

  it('心跳对不存在的 sessionId 返回 settled=preempted', () => {
    const { service } = setup();
    const res = service.heartbeat('不存在的id');
    expect(res.settled).toBe(true);
    expect(res.reason).toBe('preempted');
  });

  it('心跳超时（>90s 未心跳）返回 settled=timeout 并结算', () => {
    const { service, clock } = setup();
    const { sessionId } = service.start({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    // 推进超过超时阈值
    clock.advance(HEARTBEAT_TIMEOUT_MS + 1);
    const res = service.heartbeat(sessionId);
    expect(res.settled).toBe(true);
    expect(res.reason).toBe('timeout');
    // 会话已结算，active 为空
    expect(service.getActive().active).toBe(false);
  });
});

describe('TimerService - 停止', () => {
  it('停止结算：duration = (now − start) / 1000，入库为 ActivitySession', () => {
    const { service, clock, db } = setup();
    const { sessionId } = service.start({ type: ActivityType.READING, clientStartTime: BASE_TIME });
    // 60s 处心跳，保持活跃窗口内
    clock.advance(60_000);
    service.heartbeat(sessionId);
    // 再过 60s 停止（最后心跳 60s 仍在 90s 窗口内），结算点=now=120s
    clock.advance(60_000);
    const res = service.stop(sessionId);
    expect(res).not.toBeNull();
    expect(res!.duration).toBe(120);
    expect(res!.endTime).toBe(BASE_TIME + 120_000);
    // 活跃会话已清空
    expect(service.getActive().active).toBe(false);
    // 归档表有一条记录
    const archived = db.prepare('SELECT * FROM sessions').all() as any[];
    expect(archived).toHaveLength(1);
    expect(archived[0].duration).toBe(120);
    expect(archived[0].type).toBe('READING');
  });

  it('停止时更新 content', () => {
    const { service, db } = setup();
    const { sessionId } = service.start({ type: ActivityType.STUDY, content: '旧', clientStartTime: BASE_TIME });
    service.stop(sessionId, '新内容');
    const archived = db.prepare('SELECT content FROM sessions').get() as any;
    expect(archived.content).toBe('新内容');
  });

  it('停止不存在的会话返回 null', () => {
    const { service } = setup();
    expect(service.stop('不存在')).toBeNull();
  });
});

describe('TimerService - 抢占结算', () => {
  it('开始新会话时，已有未超时会话被抢占结算（结算点=最后心跳）', () => {
    const { service, clock, db } = setup();
    const first = service.start({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    // 计时 60 秒后心跳一次（最后心跳 = BASE + 60s）
    clock.advance(60_000);
    service.heartbeat(first.sessionId);
    // 又过 30 秒，开始新会话（此时旧的未超时，应抢占结算）
    clock.advance(30_000);
    const second = service.start({ type: ActivityType.READING, clientStartTime: clock.now() });

    // 旧会话结算点应是最后心跳 BASE+60s，duration=60s
    const archived = db.prepare('SELECT * FROM sessions WHERE id = ?').get(first.sessionId) as any;
    expect(archived).toBeTruthy();
    expect(archived.duration).toBe(60);
    expect(archived.end_time).toBe(BASE_TIME + 60_000);

    // 新会话是当前活跃的
    const active = service.getActive();
    expect(active.active).toBe(true);
    expect(active.session!.id).toBe(second.sessionId);
    expect(active.session!.type).toBe(ActivityType.READING);
  });

  it('开始新会话时，已有超时会话被懒结算（结算点=最后心跳）', () => {
    const { service, clock, db } = setup();
    const first = service.start({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    clock.advance(60_000);
    service.heartbeat(first.sessionId); // 最后心跳 BASE+60s
    // 超过超时阈值后才开新的
    clock.advance(HEARTBEAT_TIMEOUT_MS + 5000);
    service.start({ type: ActivityType.READING, clientStartTime: clock.now() });

    // 旧会话仍按最后心跳结算（duration=60s），不会被算到超时时刻
    const archived = db.prepare('SELECT duration FROM sessions WHERE id = ?').get(first.sessionId) as any;
    expect(archived.duration).toBe(60);
  });
});

describe('TimerService - 懒结算', () => {
  it('settleIfStale：未超时返回 false 且不结算', () => {
    const { service, clock } = setup();
    service.start({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    clock.advance(30_000); // 远小于 90s
    expect(service.settleIfStale()).toBe(false);
    expect(service.getActive().active).toBe(true);
  });

  it('settleIfStale：超时返回 true 并结算', () => {
    const { service, clock, db } = setup();
    service.start({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    clock.advance(HEARTBEAT_TIMEOUT_MS + 1);
    expect(service.settleIfStale()).toBe(true);
    expect(service.getActive().active).toBe(false);
    expect((db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any).c).toBe(1);
  });

  it('settleIfStale：无活跃会话返回 false', () => {
    const { service } = setup();
    expect(service.settleIfStale()).toBe(false);
  });

  it('getActive 内部先懒结算：超时后 getActive 返回 active=false', () => {
    const { service, clock } = setup();
    service.start({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    clock.advance(HEARTBEAT_TIMEOUT_MS + 10_000);
    // getActive 内部应先 settleIfStale
    expect(service.getActive().active).toBe(false);
  });
});
