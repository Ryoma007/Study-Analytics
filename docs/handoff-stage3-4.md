# 交接文档：Study-Analytics 后端重构（阶段3 + 阶段4 待办）

## 仓库
`D:\Ryoma\work_space\Study-Analytics`（pnpm workspaces，git 分支 `back`，平台 Windows 11，shell bash，Node 22/pnpm 9.15.4）

## 本次会话已完成
- **阶段1**（commit `94513cb`）：重组 pnpm workspaces，前端从 `src/` 平移到 `apps/frontend/src/`，零行为改动。验收 lint/test(104)/build 全绿。
- **阶段2**（commit `4996c89`）：建 `packages/shared`（@study-analytics/shared，零运行时依赖）类型契约 + `apps/backend`（Express + better-sqlite3 裸 SQL 无 ORM）完整后端。**前端未接，应用行为不变**。验收：backend test 49 passed、lint、build、runtime（/api/health 200、start 200+sessionId）全绿；frontend test 104 + lint 仍全绿。
- **db 路径修复**（commit `f498fac`）：better-sqlite3 不自动建 DB 父目录导致 dev 启动报错；db.ts 自动 mkdirSync 建父目录，server.ts 的 DB_PATH 改用 `__dirname` 定位仓库根 `data/`（避免 dev/cwd 与生产 cwd 漂移），.gitignore 忽略 `data/`。

阶段2 已通过两轴代码评审（Standards + Spec），评审发现并修复：时钟注入贯通到路由层、常量替代魔法字符串、SessionRow 统一、移除 server.ts 中阶段4 越界的静态托管、清理 FakeClock.set 死代码。保留的偏离（懒结算只在读路径、tsconfig.build.json、shared 包重命名为 @study-analytics/shared）在 `apps/backend/src/routes.ts` 注释中有权衡说明。

## 待办：阶段3 + 阶段4（唯一行为改变点，需用户确认后再推进）

**详细任务清单、验收标准、回退点全部写在 `docs/backend-refactor-plan.md`**，不要在本文档复制——直接读那份计划执行。以下只记录计划里没有、但本会话确定的关键实现细节和已验证的接口契约。

## 阶段3 执行要点（前端切换后端，行为改变点）

### 必读参考（按路径）
- 完整任务清单：`docs/backend-refactor-plan.md` 第 227-319 行（阶段3 段落）
- 设计决策：`docs/adr/0001-0005` + `CONTEXT.md` 术语表
- 后端 API 契约（前端要对接的目标）：`packages/shared/src/api.ts`（DTO 类型）+ `apps/backend/src/routes.ts`（实际端点）

### 后端已实现的接口契约（前端对接时以此为准）
全部 REST + JSON，基址 `/api`，无认证。开发态经 vite proxy（`apps/frontend/vite.config.ts` 已配 `/api` → `localhost:3002`）：
- `POST /api/sessions/start` body `{type, content?, clientStartTime}` → `{sessionId, serverStartTime, serverTime}`
- `POST /api/sessions/:id/heartbeat` body `{clientTime}` → 200 `{serverTime, active:true}` | 410 `{reason: 'preempted'|'timeout'}`
- `POST /api/sessions/:id/stop` body `{content?}` → `{sessionId, duration, endTime}` | 404
- `GET /api/sessions/active` → `{active, session?}`
- `GET /api/sessions?type=` → ActivitySession[]（倒序，type 可选）
- `POST /api/sessions`（手动添加）→ 201 ActivitySession；`PATCH /api/sessions/:id`；`DELETE /api/sessions` body `{ids:[]}` → `{deleted}`
- `GET /api/statistics?range=7|14|30|year` → StatisticsData（含两类型聚合，前端按 currentType 选用）
- `POST /api/sessions/migrate` body `{sessions, currentType?}` → `{mergedCount}`
- `GET /api/health` → `{status:'ok', timestamp}`

### 关键实现约束（计划里强调的，务必遵守）
1. **时钟源**：前端显示用 `serverStartTime` 本地推算 `elapsedMs = (Date.now() + clockOffset) − serverStartTime`，`clockOffset = serverTime − Date.now()` 由每次心跳响应的 `serverTime` 校准。停止入库的 `duration` 用**后端返回值**，不是前端推算值。
2. **心跳不上 Web Worker**：`setInterval(15s)+fetch` 常态 + 回前台/`online` 事件补发 + 卸载 `navigator.sendBeacon` 最后心跳。容忍 3 次连续失败乐观继续。
3. **砍掉暂停/恢复**（ADR-0001）：TimerPage 运行中只有停止按钮，无暂停按钮。
4. **旧数据迁移单向漏斗**：上传 → **仅在后端返回 mergedCount 后**才清空本地 IndexedDB；失败保留本地重试。这是安全网，绝不能在上传未确认前清空。
5. **store 瘦身**：`apps/frontend/src/store.ts` 删到只剩 `currentType` + `setCurrentType`，persist 到 localStorage（不再用 IndexedDB）。删除整个 IndexedDB 链路（idbStorage/activityMerge/旧 key 迁移）。`currentType` 切换守卫数据源从 `store.isTimerRunning` 改为计时器组件本地 `isRunning`。
6. **useStatistics 退化**：本地 reduce 聚合逻辑删除，改为调后端 `GET /api/statistics` 取数据 + 按 currentType 选。
7. **共享类型**：前端引入 `@study-analytics/shared` 作为 workspace 依赖（已存在，后端在用），前端 import 用包名而非 `@shared` 别名（别名已在阶段2 移除）。

### 待改的前端文件（阶段3 会动）
- `apps/frontend/src/store.ts`（瘦身）、`hooks/useTimer.ts`（重写为心跳薄壳）、`hooks/useStatistics.ts`（退化）、`pages/TimerPage.tsx`（去暂停按钮）、`pages/HistoryPage.tsx`、`pages/StatisticsPage.tsx`、`components/Layout.tsx`（isTimerRunning 来源改）
- 新增 `apps/frontend/src/api/`（client + TanStack Query hooks）、`apps/frontend/src/timer/heartbeat.ts`、`apps/frontend/src/migration/migrate.ts`
- 测试：删 `test/useTimer.test.ts`、`test/useStatistics.test.ts`、`test/store.test.ts`、`test/ghost-running-state.test.tsx`（逻辑已搬后端）；保留 `test/HistoryPage.test.tsx`、`test/StatisticsPage.test.tsx`、`test/Layout.test.tsx`、`test/time.test.ts`、`test/ActivityType.test.ts`、`test/TimerPage.test.tsx`（后者需改断言——暂停按钮没了）
- 依赖：`apps/frontend/package.json` 加 `@tanstack/react-query`、`@study-analytics/shared`（workspace:*）；移除 `idb-keyval`（迁移逻辑里读取旧数据仍需，迁移完成后可删）

### 阶段3 验收命令
```bash
pnpm --filter frontend dev        # 需同时起后端 pnpm --filter backend dev（端口 3002）
pnpm --filter frontend vitest run  # 薄壳测试全绿
pnpm --filter backend test         # 后端仍 49 passed
```
手动端到端见计划第 308-315 行（计时/心跳/超时/刷新恢复/抢占/迁移/失联 7 项）。

## 阶段4 执行要点（部署改造）

- 详见 `docs/backend-refactor-plan.md` 第 323-375 行。
- **server.ts 追加静态托管**：阶段2 删掉了静态托管（评审认为越界），阶段4 要在 `apps/backend/src/server.ts` 加回 `express.static(dist)` + SPA 回退 + 缓存头（index.html no-cache，带 hash 资源 immutable），由 `SERVE_STATIC=1` env 开启。前端 dist 路径相对 `__dirname`：`../../frontend/dist`。
- Dockerfile：从 nginx 单镜像改 node:22-alpine 单容器全包（builder 装 python3/make/g++ 编译 better-sqlite3，runtime 复制 backend/dist + frontend/dist）。
- docker-compose：单服务，挂卷 `./data:/app/data`，端口 `47291:3002`，env `DB_PATH=/app/data/study.db`。
- CI `.github/workflows/docker-build-push.yml`：`pnpm/action-setup@v4` 不写 version；`setup-node` 22；安装 `pnpm install --frozen-lockfile`；测试 `pnpm -r test`。
- 移除 `@google/genai`：`apps/frontend/package.json` 删依赖 + `apps/frontend/vite.config.ts` 删 `process.env.GEMINI_API_KEY` 注入与 `loadEnv`。

## 已知陷阱（本会话踩过的）
- **better-sqlite3 是 native addon**：前后端必须分 package.json（已分）。alpine 需装编译工具链。
- **better-sqlite3 不自动建 DB 父目录**：已修复（db.ts mkdirSync）；生产态 compose 挂卷 `/app/data` 需宿主目录存在或依赖此修复。
- **git mv 在 Windows 有时 Permission denied**（IDE 锁文件）：关 IDE 后用普通 `mv` + `git add -A`，git 仍能识别为重命名。
- **pnpm install 偶发 ECONNRESET**：网络抖动，重试会成功。
- **端口**：后端固定 **3002**（避开常用端口，用户指定），前端 dev 仍 3001，生产容器内 3002 映射 47291。
- **EADDRINUSE 3002**：测试残留进程或多个 dev 实例争端口。排查：`netstat -ano | grep ":3002" | grep LISTENING` 找 PID → `taskkill //F //PID <PID>`。
- **DB 路径**：dev 态落仓库根 `data/study.db`（用 `__dirname` 定位，不依赖 cwd）；生产态由 `DB_PATH` env 覆盖为 `/app/data/study.db`。
- **后端懒结算只在读路径**（list/statistics/active），不在写路径——否则 stop/heartbeat 会被中间件提前结算丢数据。这是有意偏离规范的"每个路由"，routes.ts 注释说明。
- **stop 超时用最后心跳结算点**（不是 now）：若 stop 时距最后心跳已超 90s，duration 算到最后心跳而非 stop 时刻——诚实，超时期间不可证明在计时。
- **测试用 FakeClock 推进时间**模拟超时/抢占，业务层禁止直接 `Date.now()`（已通过时钟注入保证）。

## 建议的技能（skills）
- **`superpowers:test-driven-development`**：阶段3 前端薄壳逻辑（心跳失联状态机、迁移成功/失败清空）用 TDD，先写测试再实现。
- **`code-review`**：阶段3 完成后跑两轴评审（Standards + Spec），固定点 `f498fac`（当前 HEAD）。
- **`superpowers:verification-before-completion`**：阶段3 是行为改变点，提交前必须端到端验证（计时/心跳/迁移 7 项手动验收）。
- **`commit-commands:commit`** 或手动 git commit：每阶段独立提交（阶段1/2 + db 修复已各一个 commit，阶段3/4 同样）。

## 快速恢复状态
```bash
cd D:/Ryoma/work_space/Study-Analytics
git log --oneline -5              # 确认 f498fac（db 修复）是 HEAD
pnpm --filter backend test        # 应 49 passed
pnpm --filter frontend test       # 应 104 passed（阶段3 会改这些）
pnpm --filter backend dev         # 起后端 3002，前端 dev 前需先起后端
# 若 EADDRINUSE 3002：netstat -ano | grep ":3002" | grep LISTENING → taskkill //F //PID <PID>
```
