# CONTEXT.md

## 项目：Study-Analytics（学习与阅读时间追踪）

本文件定义项目的领域术语表。所有代码、文档、Issue 讨论中的概念必须使用以下统一术语。

---

## 领域术语

### ActivitySession（活动记录）

一条**已完成**的时间记录，代表用户完成的一次"学习"或"阅读"活动。每条记录包含类型、日期、起止时间、时长和内容描述。原名 `StudySession`，已废弃。

**属性：**
- `id: string` — 唯一标识（UUID）
- `type: ActivityType` — 活动类型（STUDY | READING）
- `date: string` — 发生日期（YYYY-MM-DD 格式）
- `startTime: number` — 开始时间戳（epoch ms）
- `endTime: number` — 结束时间戳（epoch ms）
- `duration: number` — 时长（秒）
- `content: string` — 活动内容描述

_Avoid_: 运行中会话（用 ActiveSession）

### ActiveSession（活动会话 / 进行中会话）

**后端权威的、正在进行中的计时会话**。同一时刻全局唯一（单活跃槽）。引入后端心跳架构后新增的概念，区别于已完成的 ActivitySession。

- 用户"开始"计时 → 后端创建 ActiveSession（运行中）
- 停止 / 被新会话抢占 / 心跳超时 → 后端结算，将 ActiveSession 转化为一条已完成的 ActivitySession

**结算点（settlement point）**：统一指"最后一个已知仍在计时的时间点"。
- 显式停止 → 结算点 = stop 请求时刻
- 抢占 / 超时 → 结算点 = 最后一次有效心跳时刻

ActiveSession 持久化为后端 SQLite 单行表 `active_session`（始终最多一行），后端不维护内存副本，重启天然恢复。它要么在运行中（DB 里那一行），要么已结算为 ActivitySession（移入 `sessions` 表）。不存在"长期挂起的运行中记录"。

_Avoid_: 把运行中会话直接称作 ActivitySession

### ActivityType（活动类型）

区分一次记录是"学习"还是"阅读"的枚举。定义在 `packages/shared`（重构后），为 `const` 对象 + 字符串联合类型（**已移除 enumify**），含两个值：

- `STUDY` — 学习类活动
- `READING` — 阅读类活动

### currentType（当前活动类型）

全局 UI 状态，重构后存储在瘦身的 `useActivityStore`（仅此一项），持久化到 localStorage（不再用 IndexedDB）。控制侧边栏切换开关的选中值，影响历史记录页面的数据过滤。统计页面不再依赖它过滤（后端返回全类型，前端选用）。

会话期间计时器运行中时，切换被禁用（守卫数据源为计时器组件本地 isRunning）。

### 计时器（Timer）

用户"开始"→"停止保存"的交互流程。**已移除暂停/恢复**（见 ADR-0001）。

**架构变更后（后端权威计时）**：时长计算下沉到后端，前端通过心跳包维持运行中的 ActiveSession。停止/被抢占/心跳超时三种结束路径都触发后端结算，将 ActiveSession 转化为一条已完成的 ActivitySession。

ActiveSession 是单段模型：`startTime` + `lastHeartbeatAt`，时长 = 结算点 − startTime，无分段状态机。心跳只有"我在"一种消息。

用户要"歇一下继续"就停止存一条、再开始一条——对个人时长统计等价，且历史里能看到真实的分段记录。

### currentTab（当前标签页）

应用的主导航状态，值域为 `'timer' | 'history' | 'statistics'`。在 `App.tsx` 中用 `useState` 管理（不持久化）。侧边栏渲染三个导航按钮。

### 统计图表（Statistics Chart）

基于 recharts 的柱状图，支持 7 天/14 天/30 天/近一年四种时间范围。重构后**聚合计算下沉后端**（SQL GROUP BY），后端一次返回学习+阅读两类型聚合，前端按 `currentType` 选用，切换类型无需重新请求。图表单位自适应（>= 3600 秒用小时，>= 60 秒用分钟，否则用秒，基于两类型全局最大值判定）。柱子颜色跟随 `currentType` 对应的主题色（学习 = indigo，阅读 = emerald）。

### 主题色（Theme Color）

- **学习模式** — 主色 indigo-600，浅色 indigo-50
- **阅读模式** — 主色 emerald-600，浅色 emerald-50

主题色应用于：侧边栏 Logo 背景、计时器开始按钮、统计图表柱子。

---

## 已废弃术语

| 废弃术语 | 替代 |
|----------|------|
| StudySession | ActivitySession |
| useStudyStore | useActivityStore |
| study_sessions_storage | activity_sessions_storage |

重构后进一步废弃：

| 废弃术语 | 替代 |
|----------|------|
| Enumify 实现的 ActivityType | const 对象 + 联合类型 |
| store 的 IndexedDB 持久化链路（idbStorage / activityMerge / 旧 key 迁移） | 数据上后端，前端 store 仅 currentType + localStorage |
| useTimer 的本地计时状态机 | 后端权威计时 + 前端心跳薄壳 |
| useStatistics 的本地聚合 reduce | 后端 SQL 聚合 |
| @google/genai (Gemini) 依赖 | 移除（未启用） |

---

## 旧数据迁移（重构后）

- 前端首次连接后端时，自动把本地 IndexedDB 的 sessions 上传后端，后端按 `id` 去重合并（`INSERT OR IGNORE`）。
- 仅在收到后端确认的合并成功计数后才清空本地 IndexedDB；上传失败则保留本地，下次重试。
- 每台设备各自走一遍"本地 → 后端"单向漏斗，按 id 幂等，多次上传无副作用。
- 旧 key（`study_sessions_storage` / localStorage `study_sessions`）一并上传后清空。
