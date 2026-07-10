# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

学习与阅读时间记录（Study Analytics）—— 活动时长追踪应用。重构后为前后端分离架构（pnpm workspaces）：前端 React SPA + Node.js/Express 后端。计时逻辑下沉后端（权威计算），前端通过心跳包维持运行中会话，解决"忘记关闭计时"与后台标签页 JS 节流问题。支持学习和阅读两种活动类型、历史记录管理、按类型过滤的数据统计图表（日/周/月/年维度）。

## 架构（pnpm workspaces 三包）

```
/
├── apps/
│   ├── frontend/            # React 19 SPA（原 src/ 平移至此）
│   └── backend/             # Express + better-sqlite3 后端
├── packages/
│   └── shared/              # 前后端共享类型契约（纯类型+纯函数，零运行时依赖）
└── docs/adr/                # 架构决策记录（0001-0005 见下）
```

详见 `docs/adr/` 与 `CONTEXT.md`。

## 技术栈

### 前端（apps/frontend）

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript 5.8 |
| 构建 | Vite 6 |
| CSS | Tailwind CSS v4 |
| 状态管理 | Zustand 5（仅 currentType，persist localStorage） |
| 服务端数据 | TanStack Query（sessions/统计缓存与失效） |
| 图表 | recharts 3 |
| 日期 | date-fns 4 |
| 图标 | lucide-react |
| 动画 | motion (Framer Motion) |
| Toast | sonner |
| 枚举 | const 对象 + 字符串联合类型（来自 packages/shared） |
| 测试 | vitest 4 + @testing-library/react + jsdom（仅 UI 层） |

### 后端（apps/backend）

| 类别 | 技术 |
|------|------|
| 框架 | Express 4 |
| 数据库 | SQLite + better-sqlite3（同步驱动，**全局禁同步规则的项目级例外**，见 ADR-0002） |
| 数据访问 | 裸 SQL（prepared statements，**无 ORM**，见 ADR-0003） |
| 运行/热重载 | tsx |
| 测试 | vitest + supertest（:memory: SQLite 业务单测 + HTTP 契约测试） |

### 共享（packages/shared）

`ActivitySession` / `ActiveSession` / `ActivityType` 类型 + API DTO 契约 + `StatisticsData`/`ChartDataPoint` 类型。纯类型 + 纯函数，零运行时依赖。聚合计算逻辑不共享（后端 SQL、前端取数据，见 ADR 契约）。


## 常用命令

```bash
# 开发服务器（端口 3001，绑定所有网卡）
pnpm dev

# 运行测试（monorepo，需进入子包目录）
# 前端
cd apps/frontend && npx vitest run
# 后端
cd apps/backend && npx vitest run
# 监听模式
cd apps/frontend && npx vitest

# 构建
pnpm build

# 类型检查（即 lint）
pnpm lint

# 预览构建产物
pnpm preview

# 清理构建输出
pnpm clean
```

## 项目架构（pnpm workspaces）

```
/
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── main.tsx              # 入口，挂载 React 根节点
│   │   │   ├── App.tsx               # 根组件，管理 tab 切换状态（timer/history/statistics）
│   │   │   ├── store.ts              # Zustand store，仅 currentType（persist localStorage）
│   │   │   ├── api/                  # TanStack Query hooks + fetch 封装（对接后端）
│   │   │   ├── timer/                # 心跳计时逻辑：setInterval 心跳 + clockOffset 校准 + 失联状态处理
│   │   │   ├── config/activityConfig.ts # 活动类型 → 展示属性映射表（纯前端，颜色/文案）
│   │   │   ├── utils/time.ts         # 时间格式化（纯展示）
│   │   │   ├── test/                 # 前端 UI 测试（已删 useTimer/useStatistics/store 逻辑测试）
│   │   │   ├── components/           # Layout / StatTooltip / HistoryPage 子组件
│   │   │   └── pages/                # TimerPage(薄壳) / HistoryPage / StatisticsPage(取数据薄壳)
│   │   ├── vite.config.ts           # dev proxy /api → localhost:3000
│   │   └── package.json
│   ├── backend/
│   │   ├── src/
│   │   │   ├── server.ts            # Express 入口（API + 静态托管，单进程全包）
│   │   │   ├── db.ts                # better-sqlite3 连接 + 建表 migration
│   │   │   ├── services/             # 计时/结算/懒结算/抢占/迁移 业务逻辑（注入 now()）
│   │   │   └── routes/               # /api/* 路由（start/heartbeat/stop/active/sessions/statistics/migrate/health）
│   │   ├── test/                     # vitest + supertest（:memory: SQLite）
│   │   └── package.json
│   └── packages/
│       └── shared/                   # ActivitySession/ActiveSession/ActivityType 类型 + API DTO 契约（纯类型，零运行时依赖）
├── data/                             # SQLite 数据库宿主卷挂载点（study.db）
├── docs/
│   ├── adr/                          # 架构决策记录（0001-0005）
│   └── agents/
├── Dockerfile                        # 单容器：build → node runtime 全包（API + 静态）
├── docker-compose.yml
├── vite.config.ts (根)               # workspaces 根配置
└── package.json (根)                 # workspaces 声明 + pnpm
```

## 核心设计决策

> 重构后的架构决策详见 `docs/adr/0001-0005`。以下为补充说明与陷阱。

### 路由：无 React Router，tab 状态驱动

前端无 React Router，路由通过 `App.tsx` 中 `currentTab` 状态管理，条件渲染 timer/history/statistics 三个页面。

### 计时器：后端权威 + 前端心跳（见 ADR-0001/0004）

- **计时逻辑在后端**：时长 = 结算点 − `serverStartTime`，单一事实源是后端 SQLite 的 `active_session` 单行表。
- **前端心跳薄壳**：`setInterval(15s) + fetch` 续命，回前台/网络恢复立即补发，页面卸载 `sendBeacon` 发最后心跳。**不上 Web Worker**（不抗系统休眠，收益边界窄）。
- **前端显示用 `serverStartTime` 本地推算**：`elapsedMs = (Date.now() + clockOffset) − serverStartTime`，`clockOffset` 由每次心跳响应的 `serverTime` 校准。停止入库的 `duration` 用**后端返回值**，不是前端推算值（停止瞬间显示可能跳一下对齐，预期行为）。
- **失联 4 状态**：心跳 410→会话已结算（提示用户，不自动重开）；网络失败→容忍若干次乐观继续；页面刷新→`GET /api/sessions/active` 接管；回前台→立即补发心跳 + 校准。
- **已移除暂停/恢复**（ADR-0001）：运行中只有停止按钮。

### 后端懒结算（无后台定时器）

超时判定与结算**不在后台跑定时器**，而是在下次收到任何请求时顺带检查 `active_session` 的 `last_heartbeat_at` 是否超 90s，超了先结算它再处理请求。代价：唯一设备关页面后，后端不主动结算，要等下次有人连上来——反正没人在看，结算早晚不影响用户。

### 数据库 schema

```sql
-- 已完成记录（归档）
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,            -- "STUDY" | "READING"
  date TEXT NOT NULL,            -- YYYY-MM-DD（保留列，跨天记录由用户在表单指定，不从 startTime 派生）
  start_time INTEGER NOT NULL,   -- epoch ms（后端权威）
  end_time INTEGER NOT NULL,
  duration INTEGER NOT NULL,    -- 秒
  content TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_sessions_type_start ON sessions(type, start_time);

-- 运行中会话（始终最多一行，见 ADR-0004）
CREATE TABLE active_session (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  last_heartbeat_at INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT ''
);
```

### 数据访问：better-sqlite3 + 裸 SQL（见 ADR-0002/0003）

- `better-sqlite3` 同步 API 是**全局"禁同步 API"规则的项目级明确例外**，仅限 SQLite 数据访问层；其它文件 I/O 仍守禁同步规则。不得以"遵循全局规则"为由改回异步驱动。
- 不引入 ORM，直接用 prepared statements 裸 SQL。统计聚合用 SQL `GROUP BY`。
- `better-sqlite3` 不自动建 DB 父目录，`createDb` 已用 `mkdirSync(recursive)` 兜底；新增 DB 路径需确保父目录可建或已被此逻辑覆盖。
- DB 路径：dev 落仓库根 `data/study.db`（`server.ts` 用 `__dirname` 定位，不依赖 cwd）；生产由 `DB_PATH` env 覆盖为 `/app/data/study.db`。不要改回 `process.cwd()`——dev（apps/backend）与生产（/app）cwd 不同会漂移。

### 端口与 Windows 环境陷阱

- 后端固定 **3002**（避开常用端口），前端 dev 仍 3001，生产容器内 3002 映射 47291。
- EADDRINUSE 3002 排查：`netstat -ano | grep ":3002" | grep LISTENING` 找 PID → `taskkill //F //PID <PID>`。
- Windows `git mv` 遇 IDE 锁文件会 Permission denied。关 IDE 或改用普通 `mv` + `git add -A`，git 仍能识别为重命名（R 标记，历史保留）。

### 配置表模式（activityConfig，纯前端）

- `apps/frontend/src/config/activityConfig.ts` 是活动类型 → 展示属性（颜色/文案）的单一事实源。
- `getActivityConfig(type)` 返回 `{ label, color: { hex, tailwind }, copy }`。
- 新增活动类型只需改 2 处：`packages/shared`（类型）+ `activityConfig.ts`（展示属性）。
- 所有组件通过查表获取颜色/文案，不存在 if/else 三元表达式。

### Zustand store 瘦身

- 重构后 store 仅 `currentType` + `setCurrentType`，persist 到 localStorage。
- **已删除**：`sessions` 列表（改 TanStack Query 缓存后端数据）、`addSession/updateSession/deleteSessions`（改调接口）、`isTimerRunning`（计时器组件本地态）、整个 IndexedDB 持久化链路（idbStorage / activityMerge / 旧 key 迁移）。
- `currentType` 切换守卫数据源从 `store.isTimerRunning` 改为计时器组件本地 `isRunning`。

### Layout 接口

`Layout` 的 `disableTypeSwitcher?: boolean` prop，由 App.tsx 传入 `currentTab === 'statistics'`。切换器始终渲染（避免 DOM 闪烁/内容位移），按钮添加 `disabled`。Layout 不持有页面特定知识。

### 响应式设计约定

- 响应式断点统一 `md:`（768px），不要混用 `sm:`。
- 桌面/移动端用 `hidden md:flex` / `md:hidden` 双轨渲染（CSS `display: none` 对屏幕阅读器友好）。
- **双轨渲染测试陷阱**：jsdom 不解析 CSS media query，桌面端和移动端元素同时存在 DOM。测试中 `getByText` 会找到多个匹配，改用 `getAllByText` + `.toHaveLength(2)`。
- Layout 移动端底栏是 `fixed` 定位（`h-16` + `safe-area-bottom`），`<main>` 必须 `pb-24 md:pb-0` 预留空间。
- 移动端触控目标至少 44×44px（WCAG 2.5.5），`p-2`（8px 内边距）配合图标基本满足。
- TypeSwitcher（学习/阅读分段按钮）在 Layout 内提取为内部组件，桌面侧边栏和移动端顶栏复用同一组件。

### 测试约定

- **后端测试**（`apps/backend/test/`）：vitest + `:memory:` SQLite 业务单测 + supertest HTTP 契约测试。业务层注入 `now()` 伪时钟，精确复现 90s 超时/15s 心跳/抢占结算。固化 API 契约（410 心跳、超时结算、迁移去重）。
- **前端测试**（`apps/frontend/src/test/`）：仅 UI 层（表单交互、渲染）。**已删** useTimer 状态机、useStatistics 聚合、store 持久化迁移测试（逻辑已搬后端或删除）。薄壳逻辑（调接口）用 mock fetch 测。
- recharts 的 `ResponsiveContainer` 在 jsdom 中需 mock 为透传 children。
- Tailwind 动态 class：用条件分支返回完整 class 字符串，确保 Tailwind v4 扫描到。
- 计时器按钮用 `data-testid="timer-start"` / `data-testid="timer-stop"` 定位。
- 测试辅助函数中创建 session 应使用 `new Date()` 而非硬编码日期（组件内 `startOfDay(new Date())` 依赖系统时钟）。
- 统计页拆分卡片后，"学习"/"阅读"标签在多张卡片重复出现，断言用 `getAllByText` + `.length`。

### 旧数据迁移（前端首次连接后端）

前端首次连后端时自动把本地 IndexedDB 的 sessions 上传，后端按 `id` 去重（`INSERT OR IGNORE`）。**仅在后端确认合并成功计数后才清空本地**；上传失败保留本地下次重试。每台设备各走一遍"本地→后端"单向漏斗。

### ESM 导入必须带 .js 扩展名

- 后端（`"module": "ESNext"`）和 shared 包所有相对导入必须写 `.js` 后缀（如 `from './db.js'`）。
- TypeScript 编译时 `.js` → `.ts`，不影响类型检查；但 Node.js ESM 运行时需要完整扩展名。
- 检查遗漏：`grep -rn "from '\\.\\." apps/backend/src packages/shared/src | grep -v '\\.js'`。

### shared 包（@study-analytics/shared）构建

- 零运行时依赖（无 node_modules），Docker runtime 不要复制 `packages/shared/node_modules`。
- 生产构建需 `tsconfig.json` + `typescript` devDependency（`pnpm -r build` 时 `tsc` 在此包内运行）。
- `main`/`types` 指向 `./src/index.ts`（vitest/vite 无需预构建即可解析）。
- `exports` 用条件导出：`development` → `./src/index.ts`（vitest），`default` → `./dist/index.js`（Node.js 生产）。否则 CI 不构建 shared 直接跑 test 会报 `Failed to resolve entry for package "@study-analytics/shared"`。

### React 19 类型

React 19 不自带类型声明文件，必须安装 `@types/react` `@types/react-dom` 作为 devDependencies。

### vite.config.ts 与 vitest

- `test` 属性不被 Vite 的 `UserConfig` 类型识别。需在文件顶加 `/// <reference types="vitest/config" />` 指令或用函数式 `defineConfig(() => ({ ... }))`。
- `loadEnv` / `process.env.GEMINI_API_KEY` 相关代码已删除（@google/genai 已移除）。

### Docker 构建要点

- **better-sqlite3 是 native addon**：builder 需 `apk add python3 make g++` 编译。
- builder 和 runtime 必须用同一 `node:22-alpine` 版本，避免 native 模块二进制不兼容。
- `SERVE_STATIC=1` 开启 Express 托管前端 dist + SPA 回退 + 缓存头。

### 前端 isTimerRunning 数据流

计时器运行状态不存 store。流向：`useTimer.isRunning` → `TimerPage.onRunningChange` 回调 → `App.tsx` state → `Layout.isTimerRunning` prop → 类型切换守卫 `disabled`。

## CI/CD

- GitHub Actions 工作流 `.github/workflows/docker-build-push.yml`，push to main + `workflow_dispatch` 手动触发
- Docker 镜像 `ryoma9426/study-analytics`，推送到 Docker Hub，tag 为 `latest`
- **关键陷阱：`pnpm/action-setup@v4` 不要写 `version` 参数**，`package.json` 的 `packageManager` 字段已声明版本，重复指定会报 `Multiple versions of pnpm specified` 错误
- GitHub Actions 已弃用 Node 20，`setup-node` 必须用 `node-version: 22` 或更高
- **缓存策略（重构后由 Express 中间件承接，原 nginx 配置已移除）**：`index.html` 设 `no-cache`，带 hash 的 JS/CSS 设 `max-age=31536000, immutable`，否则部署后浏览器缓存旧入口导致白屏
- Docker Hub 认证通过 GitHub Secrets：`DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`
- **Dockerfile 改造**（见 ADR-0005）：单容器 Node 进程全包（API + 静态托管），node:22-alpine + 构建期装 python3/make/g++ 编译 better-sqlite3。SQLite 数据库挂卷 `./data:/app/data`。

## Agent skills

### Issue tracker

使用 GitHub Issues，通过 `gh` CLI 操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用中文标签：待评估、待补充信息、可供Agent处理、需人工处理、不予处理。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文布局：`CONTEXT.md` + `docs/adr/`。详见 `docs/agents/domain.md`。
