/**
 * 后端启动入口（阶段2：仅起 API）
 * 端口默认 3002（避开常用端口）。生产态静态托管前端见 ADR-0005，阶段4启用（SERVE_STATIC=1）
 */
import path from 'node:path';
import { createDb } from './db';
import { createApp, createAppContext } from './routes';

/** 后端监听端口（默认 3002，避开常用端口） */
const PORT = Number(process.env.PORT ?? 3002);
/** 数据库文件路径（默认 ./data/study.db，挂卷持久化；测试用 :memory:） */
const DB_PATH = process.env.DB_PATH ?? path.resolve(process.cwd(), 'data/study.db');

const db = createDb(DB_PATH);
const ctx = createAppContext(db);
const app = createApp(ctx);

// 阶段4 在此追加静态托管前端 dist（express.static + SPA 回退 + 缓存头），见 ADR-0005

app.listen(PORT, () => {
  // eslint-disable-next-line no-console -- 启动日志必要
  console.log(`[后端] 监听 http://localhost:${PORT}（DB: ${DB_PATH}）`);
});

/** 优雅退出：进程信号时关闭 DB 连接 */
function shutdown() {
  try {
    db.close();
  } catch {
    // 忽略关闭错误
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
