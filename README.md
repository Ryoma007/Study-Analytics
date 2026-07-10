# Study Analytics — 学习与阅读时间追踪

前后端分离的活动时长追踪应用，支持**学习**和**阅读**两种活动类型的计时、历史管理与数据统计。

计时逻辑下沉后端（权威计算），前端通过心跳保活，解决"忘记关计时"与后台标签页 JS 节流问题。

## 功能特性

- **双类型计时器** — 学习/阅读两种活动类型，计时中锁定类型切换
- **后端权威计时** — 计时在后端 SQLite，前端仅心跳 + 本地推算显示，防丢失
- **历史记录** — 按类型过滤、手动添加/编辑/批量删除
- **统计图表** — 日/周/月/年维度，学习+阅读双类型分组柱状图，单位自适应
- **Docker 部署** — 单容器 Node 全包（API + 静态资源），SQLite 挂卷持久化

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS v4 |
| 状态/数据 | Zustand 5（仅 currentType）+ TanStack Query 5（服务端缓存） |
| 后端 | Express 4 + better-sqlite3（裸 SQL，无 ORM） |
| 共享契约 | @study-analytics/shared（类型 + 常量，零运行时依赖） |
| 图表 | recharts 3 |
| 日期 | date-fns 4 |
| 图标 | lucide-react |
| 测试 | vitest 4 + @testing-library/react + supertest |
| 部署 | Docker + docker-compose（单容器 node:22-alpine） |

## 快速开始

**前置要求：** Node.js 22+、pnpm v9+

```bash
# 安装依赖
pnpm install

# 启动后端（端口 3002）
pnpm --filter backend dev

# 另开终端，启动前端（端口 3001，自动代理 /api → 3002）
pnpm --filter frontend dev

# 访问 http://localhost:3001
```

## 项目结构

```
├── apps/
│   ├── frontend/          # React 19 SPA
│   │   └── src/
│   │       ├── api/           # TanStack Query hooks + fetch 封装
│   │       ├── timer/         # 心跳模块（15s 心跳 + clockOffset 校准）
│   │       ├── migration/     # 旧数据迁移（IndexedDB → 后端单向漏斗）
│   │       ├── hooks/         # useTimer（心跳薄壳）/ useStatistics（取数据薄壳）
│   │       ├── pages/         # TimerPage / HistoryPage / StatisticsPage
│   │       └── components/    # Layout / SessionTable / SessionFormModal 等
│   └── backend/           # Express + better-sqlite3
│       └── src/
│           ├── server.ts      # 入口（dev API / 生产全包静态托管）
│           ├── routes.ts      # /api/* 路由 + 中间件
│           ├── db.ts          # SQLite 连接 + schema migration
│           └── services/      # timer / sessions / statistics 业务逻辑
├── packages/
│   └── shared/            # 前后端共享类型 + 常量（纯 TypeScript）
├── data/                  # SQLite 数据库（dev 生成 + Docker 挂卷）
├── Dockerfile             # node:22-alpine 多阶段构建
├── docker-compose.yml     # 单服务 + 挂卷部署
└── docs/adr/              # 架构决策记录（0001-0005）
```

## 可用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动全部开发服务器 |
| `pnpm -r build` | 构建所有包（shared → backend → frontend） |
| `pnpm -r test` | 运行全部测试 |
| `pnpm -r lint` | TypeScript 类型检查（全部包） |
| `pnpm clean` | 清理所有构建输出 |

## 架构设计

### 计时器：后端权威 + 前端心跳

- 计时逻辑在后端：时长 = 结算点 − `serverStartTime`，SQLite `active_session` 单行表为唯一事实源
- 前端显示用 `elapsedMs = (Date.now() + clockOffset) − serverStartTime`，`clockOffset` 由心跳响应的 `serverTime` 校准
- 停止入库的 `duration` 用后端返回值，非前端推算值
- 前端：`setInterval(15s)` 心跳 + 回前台/网络恢复补发 + `sendBeacon` 卸载心跳
- 已移除暂停/恢复（ADR-0001），运行中仅停止按钮

### 后端懒结算

超时判定不在后台跑定时器，而是在下次请求入口顺带检查 `last_heartbeat_at` 是否超 90s，超了先结算再处理请求。

### 数据库

```sql
-- 已完成记录
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, date TEXT NOT NULL,
  start_time INTEGER NOT NULL, end_time INTEGER NOT NULL,
  duration INTEGER NOT NULL, content TEXT NOT NULL DEFAULT ''
);

-- 运行中会话（始终最多一行）
CREATE TABLE active_session (
  id TEXT PRIMARY KEY, type TEXT NOT NULL,
  start_time INTEGER NOT NULL, last_heartbeat_at INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT ''
);
```

### 数据访问

better-sqlite3 同步 API + 裸 SQL prepared statements，无 ORM。统计聚合用 SQL `GROUP BY`。

### Store 瘦身

Zustand store 仅保留 `currentType` + `setCurrentType`，persist 到 localStorage。sessions 列表由 TanStack Query 管理，计时器状态由组件本地 state 管理。

## Docker 部署

```bash
docker compose up -d --build
# 访问 http://localhost:47291
# API: curl localhost:47291/api/health
```

- 端口映射：`47291:3002`
- SQLite 持久化：`./data:/app/data`
- 环境变量：`SERVE_STATIC=1`、`DB_PATH=/app/data/study.db`

## CI/CD

GitHub Actions（`.github/workflows/docker-build-push.yml`）：push to main 触发测试 → 构建镜像 → 推送到 Docker Hub `ryoma9426/study-analytics:latest`。

## 许可证

Apache-2.0
