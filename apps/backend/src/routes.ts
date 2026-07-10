/**
 * Express 应用工厂 —— 组装所有路由与中间件
 * 与启动入口分离，便于 supertest 直接拿 app 实例测试
 */
import express, { type Express } from 'express';
import type { Database } from 'better-sqlite3';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import { TimerService } from './services/timer.js';
import { SessionsService } from './services/sessions.js';
import { StatisticsService } from './services/statistics.js';
import {
  activityTypeFromValue,
  RANGE_VALUES,
  SETTLE_REASON_PREEMPTED,
  type StartSessionRequest,
  type StopRequest,
  type CreateSessionRequest,
  type UpdateSessionRequest,
} from '@study-analytics/shared';

export interface AppContext {
  /** 注入时钟：路由层所有"当前时刻"取自它，便于测试用 FakeClock 精确控制 */
  clock: Clock;
  timer: TimerService;
  sessions: SessionsService;
  statistics: StatisticsService;
}

/**
 * 创建 Express 应用
 * @param ctx 业务服务上下文（由调用方注入，便于测试用伪服务）
 */
export function createApp(ctx: AppContext): Express {
  const app = express();
  app.use(express.json());

  // 注意：不设全局懒结算中间件。懒结算只在"读取/查询"类路由触发
  // （getActive/list/statistics），写入类路由（start/heartbeat/stop/migrate）
  // 各自处理过期语义——避免停止/心跳请求被中间件提前结算导致丢数据，见决策8

  // ===== 健康检查 =====
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: ctx.clock.now() });
  });

  // ===== 计时生命周期 =====

  /** 开始计时 */
  app.post('/api/sessions/start', (req, res) => {
    try {
      const body = req.body as StartSessionRequest;
      if (!body || typeof body.type !== 'string' || typeof body.clientStartTime !== 'number') {
        return res.status(400).json({ error: '请求参数无效' });
      }
      const result = ctx.timer.start({ type: body.type, content: body.content, clientStartTime: body.clientStartTime });
      return res.json(result);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
  });

  /** 心跳 */
  app.post('/api/sessions/:id/heartbeat', (req, res) => {
    const result = ctx.timer.heartbeat(req.params.id);
    if (result.settled) {
      return res.status(410).json({ reason: result.reason ?? SETTLE_REASON_PREEMPTED });
    }
    // serverTime 用注入时钟，测试可用 FakeClock 断言
    return res.json({ serverTime: ctx.clock.now(), active: true });
  });

  /** 停止 */
  app.post('/api/sessions/:id/stop', (req, res) => {
    const body = (req.body ?? {}) as StopRequest;
    const result = ctx.timer.stop(req.params.id, body.content);
    if (result === null) {
      return res.status(404).json({ error: '会话不存在或已结算' });
    }
    return res.json(result);
  });

  /** 查询当前活跃会话 */
  app.get('/api/sessions/active', (_req, res) => {
    res.json(ctx.timer.getActive());
  });

  // ===== 历史记录 CRUD =====

  /** 列表（按 type 过滤） */
  app.get('/api/sessions', (req, res) => {
    // 读取前懒结算，使已超时会话归档可见
    ctx.timer.settleIfStale();
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    try {
      if (type) {
        return res.json(ctx.sessions.list(activityTypeFromValue(type)));
      }
      return res.json(ctx.sessions.list());
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
  });

  /** 单条查询 */
  app.get('/api/sessions/:id', (req, res) => {
    const s = ctx.sessions.get(req.params.id);
    if (!s) return res.status(404).json({ error: '记录不存在' });
    return res.json(s);
  });

  /** 手动添加 */
  app.post('/api/sessions', (req, res) => {
    try {
      const body = req.body as CreateSessionRequest;
      if (!body || typeof body.type !== 'string') {
        return res.status(400).json({ error: '请求参数无效' });
      }
      const created = ctx.sessions.create(body);
      return res.status(201).json(created);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
  });

  /** 编辑 */
  app.patch('/api/sessions/:id', (req, res) => {
    try {
      const body = req.body as UpdateSessionRequest;
      const updated = ctx.sessions.update(req.params.id, body ?? {});
      if (!updated) return res.status(404).json({ error: '记录不存在' });
      return res.json(updated);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
  });

  /** 批量删除 */
  app.delete('/api/sessions', (req, res) => {
    const ids = (req.body?.ids ?? []) as string[];
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids 必须为数组' });
    const count = ctx.sessions.deleteMany(ids);
    return res.json({ deleted: count });
  });

  // ===== 统计 =====
  app.get('/api/statistics', (req, res) => {
    // 读取前懒结算
    ctx.timer.settleIfStale();
    const range = req.query.range ?? '7';
    // 用共享常量校验，避免字面量重复（CLAUDE.md 常量规则）
    if (typeof range !== 'string' || !RANGE_VALUES.includes(range as never)) {
      return res.status(400).json({ error: 'range 参数无效' });
    }
    // now 用注入时钟，HTTP 统计测试可用 FakeClock 控制范围窗口
    return res.json(ctx.statistics.getStatistics(range as never, ctx.clock.now()));
  });

  // ===== 旧数据迁移 =====
  app.post('/api/sessions/migrate', (req, res) => {
    const body = req.body ?? {};
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];
    const count = ctx.sessions.migrate(sessions, body.currentType);
    return res.json({ mergedCount: count });
  });

  // ===== 错误兜底 =====
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `未找到路由: ${req.method} ${req.path}` });
  });

  return app;
}

/**
 * 生产/开发态组装：用真实 DB + 系统时钟构建 AppContext
 * @param db SQLite 连接
 */
export function createAppContext(db: Database, clock: Clock = systemClock): AppContext {
  return {
    clock,
    timer: new TimerService(db, clock),
    sessions: new SessionsService(db),
    statistics: new StatisticsService(db),
  };
}
