/**
 * 后端启动入口
 * 端口默认 3002。生产态全包（SERVE_STATIC=1）时托管前端 dist，否则仅起 API。
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createDb } from './db';
import { createApp, createAppContext } from './routes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 后端监听端口（默认 3002，避开常用端口） */
const PORT = Number(process.env.PORT ?? 3002);
/**
 * 数据库文件路径（默认 <仓库根>/data/study.db，挂卷持久化；测试用 :memory:）
 * 用 __dirname 相对定位到仓库根，避免 dev（cwd=apps/backend）与生产（cwd=/app）路径漂移
 */
const DB_PATH = process.env.DB_PATH ?? path.resolve(__dirname, '../../../data/study.db');

const db = createDb(DB_PATH);
const ctx = createAppContext(db);
const app = createApp(ctx);

// ===== 阶段4：生产态静态托管前端 dist（SERVE_STATIC=1 开启） =====
// 设计见 ADR-0005：Node 单进程全包 API + 静态资源 + SPA 回退 + 缓存策略
if (process.env.SERVE_STATIC === '1') {
  // 前端构建产物路径：相对后端 dist，退两级到仓库根，再进 frontend/dist
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');

  // index.html 禁止缓存，确保每次部署后浏览器获取最新入口文件
  app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || req.path.endsWith('/index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // 静态资源托管：带 hash 的 JS/CSS/字体/图片长期缓存
  app.use(
    express.static(frontendDist, {
      setHeaders: (res, filePath) => {
        if (/\.(js|css|png|jpe?g|gif|ico|svg|woff2?|ttf|eot)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  // SPA 回退：非 /api 路径返回 index.html
  app.get('*', (req, res, next) => {
    // API 路径不拦截，交给已有的路由处理（含 404 JSON 兜底）
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console -- 启动日志必要
  console.log(`[后端] 监听 http://localhost:${PORT}（DB: ${DB_PATH}，静态托管: ${process.env.SERVE_STATIC === '1' ? '开启' : '关闭'}）`);
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
