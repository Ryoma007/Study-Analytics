/**
 * HTTP 契约测试 —— supertest + :memory: SQLite + FakeClock
 * 固化 API 契约：410 心跳、超时结算、抢占、迁移去重、非法参数
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createDb } from '../src/db';
import { createApp, type AppContext } from '../src/routes';
import { FakeClock } from '../src/clock';
import { TimerService } from '../src/services/timer';
import { SessionsService } from '../src/services/sessions';
import { StatisticsService } from '../src/services/statistics';
import { ActivityType, HEARTBEAT_TIMEOUT_MS } from '@study-analytics/shared';

const BASE_TIME = 1_700_000_000_000;

let ctx: AppContext;
let clock: FakeClock;

function makeApp() {
  const db = createDb(':memory:');
  clock = new FakeClock(BASE_TIME);
  ctx = {
    clock,
    timer: new TimerService(db, clock),
    sessions: new SessionsService(db),
    statistics: new StatisticsService(db),
  };
  return createApp(ctx);
}

describe('HTTP - 健康检查', () => {
  it('GET /api/health 返回 200 ok', async () => {
    const res = await request(makeApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('HTTP - 计时生命周期', () => {
  it('POST /start → 200，返回 sessionId/serverStartTime', async () => {
    const res = await request(makeApp())
      .post('/api/sessions/start')
      .send({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeTruthy();
    expect(res.body.serverStartTime).toBe(BASE_TIME);
    expect(res.body.serverTime).toBe(BASE_TIME);
  });

  it('POST /start 非法 type → 400', async () => {
    const res = await request(makeApp())
      .post('/api/sessions/start')
      .send({ type: 'GARBAGE', clientStartTime: BASE_TIME });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/无效的活动类型/);
  });

  it('心跳续命 → 200 active=true，serverTime 来自注入时钟', async () => {
    const app = makeApp();
    const start = await request(app).post('/api/sessions/start').send({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    clock.advance(20_000);
    const res = await request(app).post(`/api/sessions/${start.body.sessionId}/heartbeat`).send({ clientTime: clock.now() });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    // serverTime 用 FakeClock，可精确断言（证明时钟注入生效）
    expect(res.body.serverTime).toBe(BASE_TIME + 20_000);
  });

  it('心跳已结算会话 → 410 + reason', async () => {
    const app = makeApp();
    const start = await request(app).post('/api/sessions/start').send({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    await request(app).post(`/api/sessions/${start.body.sessionId}/stop`).send({});
    const res = await request(app).post(`/api/sessions/${start.body.sessionId}/heartbeat`).send({ clientTime: clock.now() });
    expect(res.status).toBe(410);
    expect(['preempted', 'timeout']).toContain(res.body.reason);
  });

  it('心跳超时 → 410 reason=timeout', async () => {
    const app = makeApp();
    const start = await request(app).post('/api/sessions/start').send({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    clock.advance(HEARTBEAT_TIMEOUT_MS + 1);
    const res = await request(app).post(`/api/sessions/${start.body.sessionId}/heartbeat`).send({ clientTime: clock.now() });
    expect(res.status).toBe(410);
    expect(res.body.reason).toBe('timeout');
  });

  it('停止 → 200 duration + endTime', async () => {
    const app = makeApp();
    const start = await request(app).post('/api/sessions/start').send({ type: ActivityType.READING, clientStartTime: BASE_TIME });
    clock.advance(60_000);
    // 60s 处心跳（保持在超时窗口内）
    await request(app).post(`/api/sessions/${start.body.sessionId}/heartbeat`).send({ clientTime: clock.now() });
    clock.advance(60_000);
    // 120s 处停止，最后心跳 60s（仍在 90s 窗口内），结算点=now=120s
    const res = await request(app).post(`/api/sessions/${start.body.sessionId}/stop`).send({ content: '读完了' });
    expect(res.status).toBe(200);
    expect(res.body.duration).toBe(120);
    expect(res.body.endTime).toBe(BASE_TIME + 120_000);
  });

  it('停止不存在会话 → 404', async () => {
    const res = await request(makeApp()).post('/api/sessions/不存在/stop').send({});
    expect(res.status).toBe(404);
  });

  it('GET /api/sessions/active 反映活跃态', async () => {
    const app = makeApp();
    let res = await request(app).get('/api/sessions/active');
    expect(res.body.active).toBe(false);

    await request(app).post('/api/sessions/start').send({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    res = await request(app).get('/api/sessions/active');
    expect(res.body.active).toBe(true);
    expect(res.body.session.type).toBe(ActivityType.STUDY);
  });

  it('请求入口懒结算：超时后 GET /active 触发结算', async () => {
    const app = makeApp();
    await request(app).post('/api/sessions/start').send({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    clock.advance(HEARTBEAT_TIMEOUT_MS + 5000);
    // 此时直接 GET active，应内部先懒结算，返回 active=false
    const res = await request(app).get('/api/sessions/active');
    expect(res.body.active).toBe(false);
  });
});

describe('HTTP - 抢占', () => {
  it('开始第二个会话时旧的被抢占结算', async () => {
    const app = makeApp();
    const first = await request(app).post('/api/sessions/start').send({ type: ActivityType.STUDY, clientStartTime: BASE_TIME });
    clock.advance(60_000);
    await request(app).post(`/api/sessions/${first.body.sessionId}/heartbeat`).send({ clientTime: clock.now() });
    clock.advance(30_000);
    await request(app).post('/api/sessions/start').send({ type: ActivityType.READING, clientStartTime: clock.now() });

    // 旧的已在 sessions 表（归档）
    const list = await request(app).get('/api/sessions').query({ type: ActivityType.STUDY });
    expect(list.body).toHaveLength(1);
    expect(list.body[0].duration).toBe(60);
  });
});

describe('HTTP - 历史 CRUD', () => {
  it('创建/查询/编辑/删除', async () => {
    const app = makeApp();
    const created = await request(app)
      .post('/api/sessions')
      .send({ type: ActivityType.STUDY, date: '2026-07-01', startTime: 1, endTime: 61, duration: 60, content: '学' });
    expect(created.status).toBe(201);

    const list = await request(app).get('/api/sessions').query({ type: ActivityType.STUDY });
    expect(list.body).toHaveLength(1);

    const updated = await request(app).patch(`/api/sessions/${created.body.id}`).send({ content: '改了' });
    expect(updated.status).toBe(200);
    expect(updated.body.content).toBe('改了');

    const del = await request(app).delete('/api/sessions').send({ ids: [created.body.id] });
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(1);

    const empty = await request(app).get('/api/sessions').query({ type: ActivityType.STUDY });
    expect(empty.body).toHaveLength(0);
  });

  it('非法 type 查询 → 400', async () => {
    const res = await request(makeApp()).get('/api/sessions').query({ type: 'BAD' });
    expect(res.status).toBe(400);
  });
});

describe('HTTP - 统计', () => {
  it('GET /api/statistics?range=7 返回完整结构', async () => {
    const app = makeApp();
    await request(app)
      .post('/api/sessions')
      .send({ type: ActivityType.STUDY, date: '2026-07-01', startTime: 1_700_000_000_000, endTime: 1_700_000_006_000, duration: 60, content: '' });
    const res = await request(app).get('/api/statistics').query({ range: '7' });
    expect(res.status).toBe(200);
    expect(res.body.chartData).toHaveLength(7);
    expect(res.body.totalDaysInRange).toBe(7);
    expect(['小时', '分钟', '秒']).toContain(res.body.chartUnit);
  });

  it('非法 range → 400', async () => {
    const res = await request(makeApp()).get('/api/statistics').query({ range: '999' });
    expect(res.status).toBe(400);
  });
});

describe('HTTP - 迁移', () => {
  it('迁移去重，返回 mergedCount', async () => {
    const app = makeApp();
    const sessions = [
      { id: 'm1', type: ActivityType.STUDY, date: '2026-07-01', startTime: 1, endTime: 61, duration: 60, content: '' },
      { id: 'm2', type: ActivityType.READING, date: '2026-07-02', startTime: 2, endTime: 62, duration: 60, content: '' },
    ];
    const res1 = await request(app).post('/api/sessions/migrate').send({ sessions, currentType: ActivityType.STUDY });
    expect(res1.status).toBe(200);
    expect(res1.body.mergedCount).toBe(2);

    // 再次迁移相同数据
    const res2 = await request(app).post('/api/sessions/migrate').send({ sessions });
    expect(res2.body.mergedCount).toBe(0);
  });

  it('迁移缺 type 旧记录归 STUDY', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/sessions/migrate').send({
      sessions: [{ id: 'old1', type: '', date: '2026-01-01', startTime: 1, endTime: 2, duration: 1, content: '' }],
    });
    expect(res.body.mergedCount).toBe(1);
    const list = await request(app).get('/api/sessions').query({ type: ActivityType.STUDY });
    expect(list.body).toHaveLength(1);
  });
});
