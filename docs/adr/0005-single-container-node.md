# 部署形态：单容器 Node 进程全包

引入 Express 后端后，从原"nginx 托管静态 dist 单镜像"改为"单容器 Node 进程同时提供 API + 托管静态资源"。

决定单容器、单 Node 进程：`/api/*` 走 Express 路由，其余路径 `express.static(dist)` + catch-all 回退 `index.html`。SQLite 数据库文件 `/app/data/study.db` 挂宿主卷持久化，容器重建不丢数据。端口对外行为不变（compose 仍 `47291:容器内端口`）。Node 版本 node:22-alpine（与 CI 对齐），构建期装 python3/make/g++ 以编译 better-sqlite3 native addon。

部署细节：
- 首次启动后端自动建表（`CREATE TABLE IF NOT EXISTS`）。
- 开发态：前端 vite dev（3001）+ 后端 tsx watch（3000），vite proxy `/api` → localhost:3000；生产态同源无跨域。
- 缓存策略从 nginx 配置搬到 Express 中间件：index.html no-cache，带 hash 静态资源 max-age=31536000 immutable。

理由：单用户自托管场景一个进程一个容器最省心，与原"单镜像 latest"部署心智一致；SQLite 挂卷即持久化无需外部 DB；nginx 在此场景是多余的中间层。双容器解耦要编排多服务、共享卷，对单用户无收益。

代价：单进程内 API 与静态托管耦合，但单用户流量极低，不构成瓶颈。
