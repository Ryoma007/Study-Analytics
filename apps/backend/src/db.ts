/**
 * 数据库连接与 schema 初始化
 * better-sqlite3 同步驱动 —— 全局"禁同步 API"规则的项目级例外，见 ADR-0002
 * 仅限本数据访问层使用同步 API，其它文件 I/O 仍守禁同步规则
 */
import BetterSqlite3, { type Database } from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { HEARTBEAT_TIMEOUT_MS } from '@study-analytics/shared';

/**
 * 创建并返回一个 SQLite 数据库连接
 * @param dbPath 数据库文件路径，传 ":memory:" 用于测试（每个测试隔离）
 */
export function createDb(dbPath: string): Database {
  // better-sqlite3 不会自动建目录，需先确保父目录存在（建目录属开 DB 前置，纳入 ADR-0002 SQLite 数据层例外）
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  // eslint-disable-next-line new-cap -- better-sqlite3 默认导出为构造函数
  const db = new BetterSqlite3(dbPath);
  // 开启 WAL 以提升并发读（单用户收益有限，但顺带开启无害）
  db.pragma('journal_mode = WAL');
  initSchema(db);
  return db;
}

/**
 * 建表：sessions（已完成归档）+ active_session（运行中单行表，见 ADR-0004）
 */
export function initSchema(db: Database): void {
  db.exec(`
    -- 已完成记录（归档）
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,            -- "STUDY" | "READING"
      date TEXT NOT NULL,            -- YYYY-MM-DD（保留列，跨天记录由用户表单指定）
      start_time INTEGER NOT NULL,   -- epoch ms（后端权威）
      end_time INTEGER NOT NULL,
      duration INTEGER NOT NULL,     -- 秒
      content TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_type_start ON sessions(type, start_time);

    -- 运行中会话（始终最多一行，见 ADR-0004）
    CREATE TABLE IF NOT EXISTS active_session (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      last_heartbeat_at INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT ''
    );
  `);
}

/**
 * 判断活跃会话是否已超时（now − last_heartbeat_at > 阈值）
 * 懒结算入口用，见 ADR-0004 / backend-refactor-plan 决策5/8
 */
export function isStale(lastHeartbeatAt: number, now: number): boolean {
  return now - lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS;
}
