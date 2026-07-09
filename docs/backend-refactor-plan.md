# 后端重构实施计划

本文件是把"为 Study-Analytics 增加 Node.js 后端、计时下沉后端、前端改心跳包"的设计落成可执行的四阶段计划。设计决策详见 `docs/adr/0001-0005` 与 `CONTEXT.md`。每阶段独立可验证、可部署，阶段1/2 不改变应用行为，阶段3 是唯一行为改变点。

所有文档与脚本注释用中文。

---

## 决策索引

| # | 决策 | ADR |
|---|------|-----|
| 1 | 单用户自托管，无认证 | — |
| 2 | 单活跃槽，全局唯一运行中会话 | — |
| 3 | 抢占/超时统一用"最后心跳时间"结算；显式停止用 stop 时刻 | — |
| 4 | 砍掉暂停/恢复，只留开始/停止 | 0001 |
| 5 | 心跳 15s / 超时 90s / 超时结算到最后心跳 | — |
| 6 | SQLite + better-sqlite3 同步驱动（全局禁同步规则的项目级例外） | 0002 |
| 7 | 裸 SQL 无 ORM | 0003 |
| 8 | ActiveSession 落 SQLite 单行表，重启恢复，懒结算无后台定时器 | 0004 |
| 9 | 单容器 Node 全包（API + 静态托管） | 0005 |
| 10 | pnpm workspaces：apps/frontend + apps/backend + packages/shared | — |
| 11 | shared 只放类型契约；聚合计算前后端各写 | — |
| 12 | Zustand 瘦到 currentType；sessions/统计走 TanStack Query | — |
| 13 | 心跳 setInterval+fetch + 回前台补发 + 卸载 sendBeacon，不上 Worker | — |
| 14 | 前端 serverStartTime 本地推算 + serverTime 校准；停止以后端 duration 为准 | — |
| 15 | 旧数据首次连接自动上传，按 id 去重，确认成功后才清空本地 | — |
| 16 | 后端 vitest + :memory: SQLite + supertest；业务层注入 now() | — |
| 17 | 移除 @google/genai 与 GEMINI_API_KEY 注入 | — |

---

## 通用约定

### workspaces 骨架

根 `package.json` 声明 workspaces，根 `pnpm-workspace.yaml`：

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

根 `package.json`（仅编排，不含业务依赖）：

```json
{
  "name": "study-analytics",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "clean": "pnpm -r clean"
  }
}
```

### 常量（packages/shared 导出）

```typescript
export const HEARTBEAT_INTERVAL_MS = 15_000;   // 心跳发送间隔
export const HEARTBEAT_TIMEOUT_MS = 90_000;     // 超时阈值（6 个心跳周期）
export const HEARTBEAT_FAIL_TOLERANCE = 3;      // 连续失败容忍次数
```

### API 基址

- 开发态：前端 vite dev（3001）经 proxy `/api` → 后端 localhost:3000
- 生产态：同源（单进程），相对路径 `/api`

---

## 阶段1：结构重组（零行为改动）

### 目标

把单包 `src/` 平移进 pnpm workspaces 三包骨架。前端纯前端逻辑零改动，应用行为完全不变（仍读 IndexedDB、计时仍在本地）。此阶段后端不存在。

### 任务清单

1. **建 workspaces 根配置**
   - 新建根 `pnpm-workspace.yaml`（内容见上）
   - 改写根 `package.json` 为编排包（内容见上，移除原 dependencies/devDependencies，下放到各子包）

2. **平移前端到 `apps/frontend/`**
   - 移动 `src/` → `apps/frontend/src/`（内部结构不变）
   - 移动 `index.html` → `apps/frontend/index.html`
   - 移动 `vite.config.ts` → `apps/frontend/vite.config.ts`（此阶段暂保留 `GEMINI_API_KEY` 注入，阶段4删）
   - 移动 `tsconfig.json` → `apps/frontend/tsconfig.json`
   - 新建 `apps/frontend/package.json`，承接原 dependencies/devDependencies（react、vite、recharts、zustand、idb-keyval、vitest 等），此阶段**仍含 `@google/genai`**（阶段4删）

3. **建占位包**
   - `apps/backend/package.json`（空 main，阶段2填）
   - `packages/shared/package.json`（声明 `"types"` 导出，零运行时依赖，阶段2填内容）

4. **调整 vite alias**：`apps/frontend/vite.config.ts` 的 `@` alias 指向 `apps/frontend`，新增 `@shared` → `packages/shared/src`（阶段2用到）

5. **保留旧测试**：`apps/frontend/src/test/` 原样平移，阶段3再删改

### 文件迁移映射

| 原路径 | 新路径 |
|--------|--------|
| `src/**` | `apps/frontend/src/**` |
| `index.html` | `apps/frontend/index.html` |
| `vite.config.ts` | `apps/frontend/vite.config.ts` |
| `tsconfig.json` | `apps/frontend/tsconfig.json` |
| `package.json`（依赖） | `apps/frontend/package.json` |
| `package.json`（编排） | 根 `package.json` |

### 验收标准

```bash
pnpm install                          # workspaces 安装成功
pnpm --filter frontend dev            # 前端起在 3001，行为与重构前一致
pnpm --filter frontend build          # 构建成功
pnpm --filter frontend vitest run     # 现有测试全绿
pnpm --filter frontend lint           # 类型检查通过
```

手动验收：打开应用，计时器/历史/统计与重构前无差异，IndexedDB 数据正常读写。

### 回退点

阶段1纯搬运，若出问题直接回退到重构前 commit。无数据风险。

---

## 阶段2：后端骨架 + 共享契约（前端未接）

### 目标

建 `packages/shared` 类型契约 + `apps/backend` 完整后端（Express + better-sqlite3 + 业务逻辑 + 测试）。后端可独立用 supertest 验证全部业务逻辑，但前端**还没接**——应用行为仍不变（前端仍走阶段1的 IndexedDB）。

### 任务清单

#### packages/shared

1. **类型契约**（`packages/shared/src/types.ts`）：
   - `ActivitySession`（已完成记录）
   - `ActiveSession`（运行中会话：id/type/startTime/lastHeartbeatAt/content）
   - `StatisticsData`、`ChartDataPoint`
   - 时间范围 `RangeType = '7' | '14' | '30' | 'year'`

2. **枚举与常量**（`packages/shared/src/enums.ts`）：
   - `ActivityType` const + 联合类型（从 `apps/frontend/src/enums/ActivityType.ts` 上移）
   - `ACTIVITY_TYPES` 数组、`activityTypeFromValue`（无效值抛异常）
   - `HEARTBEAT_INTERVAL_MS`、`HEARTBEAT_TIMEOUT_MS`、`HEARTBEAT_FAIL_TOLERANCE`

3. **API DTO**（`packages/shared/src/api.ts`）：
   - `StartSessionRequest` / `StartSessionResponse`
   - `HeartbeatRequest` / `HeartbeatResponse`
   - `StopRequest` / `StopResponse`
   - `ActiveSessionResponse`
   - `CreateSessionRequest` / `UpdateSessionRequest`（手动增删改）
   - `StatisticsResponse`
   - `MigrateRequest` / `MigrateResponse`

4. `packages/shared/src/index.ts` 统一导出；`package.json` 声明 `"types": "./src/index.ts"`，零运行时依赖。

#### apps/backend

1. **时钟注入**（`apps/backend/src/clock.ts`）：
   - 导出 `now()`，生产实现 = `Date.now()`；测试通过模块替换或依赖注入传伪时钟。业务层**不直接调 `Date.now()`**。

2. **数据库**（`apps/backend/src/db.ts`）：
   - `better-sqlite3` 连接，DB 路径来自环境变量 `DB_PATH`（默认 `./data/study.db`，测试传 `:memory:`）
   - `initSchema()`：建 `sessions` + `active_session` 两表（schema 见 ADR-0004 / CLAUDE.md），`CREATE TABLE IF NOT EXISTS` + 索引
   - prepared statements 封装

3. **业务服务**（`apps/backend/src/services/`，全部注入 `now()`）：
   - `timer.ts`：
     - `startActiveSession({type, content, clientStartTime})`：事务内先懒结算（若有 active 行且超时）或抢占结算（若未超时被新请求触发），再 INSERT 新 active 行；返回 `{sessionId, serverStartTime, serverTime}`
     - `heartbeat(sessionId, clientTime)`：UPDATE last_heartbeat_at；若行不存在/已结算返回 `settled` 标志（路由层转 410）
     - `stop(sessionId, content?)`：读 active 行 → duration = now() − start_time → INSERT sessions + DELETE active 行（事务）
     - `getActiveSession()`：返回当前 active 行或 null
     - `settleIfStale()`：懒结算入口，now() − last_heartbeat_at > TIMEOUT 则结算（用于每个请求入口）
     - `settleActive(settlementPoint)`：把 active 行结算为 ActivitySession（INSERT sessions + DELETE active），复用于停止/抢占/超时
   - `sessions.ts`：`list(type)`、`get(id)`、`create(dto)`、`update(id, dto)`、`deleteMany(ids)`、`migrate(sessions, currentType)`（按 id `INSERT OR IGNORE` 去重，返回合并成功计数）
   - `statistics.ts`：`getStatistics(range)` —— SQL `GROUP BY` 聚合，返回学习+阅读两类型 `chartData` + 各类型 total/avg/days + `chartUnit`（单位自适应逻辑搬后端，基于两类型全局最大值）

4. **路由**（`apps/backend/src/routes/`）：
   - 每个路由入口先调 `settleIfStale()`（懒结算）
   - `POST /api/sessions/start`、`POST /api/sessions/:id/heartbeat`（410）、`POST /api/sessions/:id/stop`、`GET /api/sessions/active`
   - `GET /api/sessions?type=`、`GET /api/sessions/:id`、`POST /api/sessions`、`PATCH /api/sessions/:id`、`DELETE /api/sessions`（body `{ids}`）
   - `GET /api/statistics?range=`、`POST /api/sessions/migrate`、`GET /api/health`
   - 错误处理中间件：非法 type 用 `activityTypeFromValue` 抛异常 → 400

5. **测试**（`apps/backend/test/`）：
   - 业务单测（`:memory:` SQLite + 伪时钟）：
     - `timer.test.ts`：start 创建 active 行；heartbeat 续命；stop 结算 duration 正确；超时（推进时钟 >90s）懒结算；抢占（start 时已有 active）结算旧的用最后心跳；stop 后 heartbeat 返回 settled
     - `sessions.test.ts`：CRUD；migrate 按 id 去重（重复上传幂等）；migrate 缺 type 字段旧记录归 STUDY
     - `statistics.test.ts`：7/14/30/year 各范围聚合正确；单位自适应（>=3600 小时、>=60 分钟、否则秒）；活动天数去重
   - supertest HTTP 契约测试：
     - start→heartbeat→stop 全流程，200/响应结构
     - heartbeat 已结算返回 410 + `{reason}`
     - 超时后请求触发结算
     - 抢占场景
     - migrate 去重
     - 非法 type 400

6. **启动脚本**：`apps/backend/package.json` 的 `dev` 用 `tsx watch src/server.ts`，`test` 用 `vitest run`，`start` 用 `node`（阶段4 build 后）。

### 验收标准

```bash
pnpm --filter backend test          # vitest + supertest 全绿
pnpm --filter backend dev            # 后端起在 3000，可用 curl 打通
# 抽样验证
curl localhost:3000/api/health                    # 200
curl -X POST localhost:3000/api/sessions/start ... # 200 + sessionId
```

阶段2 不要求前端动；前端仍跑阶段1，应用行为不变。

### 回退点

后端独立，不影响前端。若后端有问题，前端继续用阶段1状态，后端单独修。

---

## 阶段3：前端切换到后端（唯一行为改变点）

### 目标

前端从"读 IndexedDB + 本地计时"切换到"调后端接口 + 心跳"。store 瘦身，引入 TanStack Query，旧数据迁移上传。这是行为改变点，集中验证。

### 任务清单

#### 前端数据层重构

1. **store 瘦身**（`apps/frontend/src/store.ts`）：
   - 仅 `currentType` + `setCurrentType`，persist 到 localStorage
   - 删除 `sessions`、`addSession/updateSession/deleteSessions`、`isTimerRunning`、`setIsTimerRunning`
   - 删除整个 IndexedDB 链路：`idbStorage`、`activityMerge`、`normalizeType`、`migrateSession`、旧 key 迁移逻辑
   - `setCurrentType` 守卫数据源改由调用方（Layout）传入计时器组件本地 `isRunning`

2. **API 客户端**（`apps/frontend/src/api/`）：
   - `client.ts`：fetch 封装（基址 `/api`，JSON，错误转 toast）
   - `hooks.ts`：TanStack Query hooks：
     - `useSessions(type)` —— `GET /api/sessions?type=`
     - `useStatistics(range)` —— `GET /api/statistics?range=`
     - `useActiveSession()` —— `GET /api/sessions/active`（页面挂载/刷新恢复用）
     - `useStartSession/useStopSession/useCreateSession/useUpdateSession/useDeleteSessions` —— mutation + 失效对应 query
     - `useMigrate()` —— 一次性迁移

#### 心跳计时重构

3. **心跳模块**（`apps/frontend/src/timer/heartbeat.ts`）：
   - `startHeartbeat(sessionId)`：`setInterval(15s)` 发心跳，更新 `clockOffset = serverTime − Date.now()`
   - `stopHeartbeat()`：清 interval
   - 失联状态处理（见决策14）：
     - 心跳 410 → 触发 onSettled 回调（停止本地显示 + toast 提示，不自动重开）
     - 网络失败 → 容忍 3 次（45s）乐观继续；超阈值提示"连接丢失"但不自动结算
   - 事件补发：`visibilitychange`→visible、`online` 立即补发心跳 + `GET /api/sessions/active` 校准
   - 卸载：`pagehide`/`beforeunload` 用 `navigator.sendBeacon` 发最后心跳

4. **useTimer 重写**（`apps/frontend/src/hooks/useTimer.ts`）：
   - 退化为"调接口 + 心跳 + 显示推算"薄壳
   - `handleStart`：`POST start` → 拿 `serverStartTime` → 启动心跳 + 显示 setInterval
   - 显示推算：`elapsedMs = (Date.now() + clockOffset) − serverStartTime`，每秒刷新
   - `handleStop`：`POST stop` → 用后端返回 `duration` 入历史 → 停心跳/显示
   - 移除 `handlePause`（ADR-0001）、`accumulatedTime`、`lastStartTime`、`sessionStartTime` 等本地计时状态
   - `isRunning` 仍是组件本地 state

5. **useStatistics 重写**（`apps/frontend/src/hooks/useStatistics.ts`）：
   - 退化为取数据薄壳：调 `useStatistics(range)` 拿后端聚合结果，按 `currentType` 选数据
   - 删除本地 reduce 聚合逻辑、单位自适应计算（已搬后端）

#### UI 适配

6. **TimerPage**（`apps/frontend/src/pages/TimerPage.tsx`）：
   - 去掉暂停按钮（amber），运行中只保留停止按钮
   - `handleStart/handleStop` 改用新 useTimer

7. **HistoryPage / StatisticsPage**：数据源改 TanStack Query hooks（`useSessions`/`useStatistics`），删除从 store 取 sessions 的逻辑

8. **Layout**：`isTimerRunning` 改从计时器组件本地态获取（通过 prop 或简单订阅），守卫 currentType 切换

#### 旧数据迁移

9. **迁移逻辑**（`apps/frontend/src/migration/migrate.ts`）：
   - 应用首次连接后端时触发（检测本地 IndexedDB 有旧数据 + 后端可达）
   - 读取本地 IndexedDB（`activity_sessions_storage` + 旧 `study_sessions_storage` + localStorage `study_sessions`）的 sessions + currentType
   - `POST /api/sessions/migrate` 上传
   - **仅在后端返回合并成功计数后**才 `clear()` 本地 IndexedDB；失败保留本地，下次重试
   - 单向漏斗：本地→后端，不可逆

#### 测试调整

10. **删除旧测试**：`useTimer` 状态机测试、`useStatistics` 聚合测试、store 持久化/迁移测试（逻辑已搬后端或删除）
11. **新增薄壳测试**：mock fetch，测 useTimer 调接口流程、心跳失联状态、useStatistics 取数据、迁移成功/失败清空逻辑
12. **保留 UI 测试**：SessionFormModal/SessionTable 表单交互、recharts mock 渲染

### 验收标准

```bash
pnpm --filter frontend dev       # 前端 + 后端 dev（根 pnpm dev 并行起两个）
pnpm --filter frontend vitest run # 前端薄壳测试全绿
pnpm --filter backend test        # 后端测试仍全绿
```

手动端到端验收：
- 计时：开始→停止，历史出现记录，duration = 后端权威值
- 心跳：开始后等 15s+，后端 last_heartbeat_at 更新
- 超时：开始后关闭页面/断网 90s+，后端下次请求懒结算
- 刷新恢复：计时中刷新页面，`GET active` 接管显示
- 多设备抢占：两设备各开，后开者触发旧会话结算
- 旧数据迁移：首次打开新版，IndexedDB 旧数据上传到后端、本地清空、历史页显示完整
- 失联：模拟心跳 410，前端提示并停止显示；模拟断网，3 次内乐观继续

### 回退点

阶段3 行为改变。回退需把前端切回阶段1的 IndexedDB 模式 + 保留本地未清空数据。**迁移清空本地前**是安全点；清空后回退会丢本地数据（但后端已有）。建议阶段3上线前完整备份 IndexedDB。

---

## 阶段4：部署改造

### 目标

把"前端 nginx 单镜像"改成"单容器 Node 全包"。Docker/CI/compose 调整，移除 genai，Express 承接缓存策略。

### 任务清单

1. **Dockerfile 重写**（ADR-0005）：
   - builder 阶段：`node:22-alpine`，装 `python3 make g++`（编译 better-sqlite3），`corepack enable pnpm`，`pnpm -r install --frozen-lockfile`，`pnpm -r build`
   - runtime 阶段：`node:22-alpine`，复制 `apps/backend/dist` + `apps/frontend/dist`，`node apps/backend/dist/server.js`
   - better-sqlite3 native：runtime 需匹配 builder 的 node 版本/alpine，避免重编

2. **后端 server.ts 生产态全包**：
   - `app.use('/api', routes)`
   - `express.static(apps/frontend/dist)` + SPA 回退 `index.html`
   - 缓存中间件：`index.html` → `Cache-Control: no-cache`；带 hash 静态资源 → `max-age=31536000, immutable`
   - 端口 env `PORT`（默认 3000）

3. **docker-compose.yml**：
   - 单服务，挂卷 `./data:/app/data`（SQLite 持久化）
   - 端口映射 `47291:3000`（对外行为不变）
   - `environment: NODE_ENV=production, DB_PATH=/app/data/study.db`

4. **CI 调整**（`.github/workflows/docker-build-push.yml`）：
   - `pnpm/action-setup@v4` **不写 version**（packageManager 已声明）
   - `setup-node` node-version: 22
   - 安装改 `pnpm install --frozen-lockfile`（workspaces 自动识别）
   - 测试改 `pnpm -r test`（前后端都跑）
   - 构建 + 推送逻辑不变

5. **移除 genai**：
   - `apps/frontend/package.json` 删 `@google/genai`
   - `apps/frontend/vite.config.ts` 删 `process.env.GEMINI_API_KEY` 注入与 `loadEnv` 相关行
   - 删 `.env` 中 GEMINI_API_KEY（如有）

### 验收标准

```bash
docker build -t study-analytics .          # 构建成功
docker compose up                            # 容器起，API + 前端同源可达
curl localhost:47291/api/health             # 200
# 浏览器访问 localhost:47291：前端正常、计时/历史/统计走 /api
docker compose down && docker compose up    # 重建容器，SQLite 数据仍在（挂卷）
```

CI：push to main 后 workflow 全绿，镜像推到 `ryoma9426/study-analytics:latest`。

### 回退点

部署层独立。若容器有问题，回退到阶段3的镜像 + 开发态运行方式（前后端分别跑）临时顶。SQLite 挂卷保证数据不丢。

---

## 风险与注意事项

- **better-sqlite3 native 与 alpine/node 版本**：builder 和 runtime 必须用同一 `node:22-alpine`，否则 native 模块需重编或二进制不兼容。CI 与本地 Docker 版本对齐。
- **迁移单向漏斗**：阶段3 清空本地 IndexedDB 前务必确认后端已存。上传失败绝不清空。
- **懒结算的延迟感知**：唯一设备关页面不主动停，最长 90s 后端才结算。多设备抢占场景无此延迟。这是有意取舍（决策5/8），非缺陷。
- **前端时钟漂移**：前端系统时间被改会影响显示，但 clockOffset 由心跳 serverTime 持续校准；最终入库 duration 用后端值，不受前端时钟影响。
- **后端无内存副本**：每次心跳一次 SQLite UPDATE，单用户场景无压力；若未来多用户需评估。
- **测试伪时钟**：业务层必须通过注入的 `now()` 取时间，禁止直接 `Date.now()`，否则计时测试无法精确复现超时/抢占。
