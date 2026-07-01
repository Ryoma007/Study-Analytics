# CONTEXT.md

## 项目：Study-Analytics（学习与阅读时间追踪）

本文件定义项目的领域术语表。所有代码、文档、Issue 讨论中的概念必须使用以下统一术语。

---

## 领域术语

### ActivitySession（活动记录）

一条完整的时间记录，代表用户完成的一次"学习"或"阅读"活动。每条记录包含类型、日期、起止时间、时长和内容描述。原名 `StudySession`，已废弃。

**属性：**
- `id: string` — 唯一标识（UUID）
- `type: ActivityType` — 活动类型（STUDY | READING）
- `date: string` — 发生日期（YYYY-MM-DD 格式）
- `startTime: number` — 开始时间戳（epoch ms）
- `endTime: number` — 结束时间戳（epoch ms）
- `duration: number` — 时长（秒）
- `content: string` — 活动内容描述

### ActivityType（活动类型）

区分一次记录是"学习"还是"阅读"的枚举。定义在 `src/enums/` 下，使用 enumify 实现。包含两个值：

- `STUDY` — 学习类活动
- `READING` — 阅读类活动

### currentType（当前活动类型）

全局状态，存储在 `useActivityStore` 中。控制侧边栏切换开关的选中值，影响计时器页面、历史记录页面、统计页面的数据过滤和行为。持久化到 IndexedDB。

会话期间计时器运行中时，切换被禁用。

### 计时器（Timer）

用户"开始"→"暂停/恢复"→"停止保存"的交互流程。基于系统时钟（`Date.now()`）计算时长，不依赖 `setInterval` 累加。监听 `visibilitychange` 事件，标签页恢复可见时立即校准显示时间。停止时保存为一条 `ActivitySession`。

### currentTab（当前标签页）

应用的主导航状态，值域为 `'timer' | 'history' | 'statistics'`。在 `App.tsx` 中用 `useState` 管理（不持久化）。侧边栏渲染三个导航按钮。

### 统计图表（Statistics Chart）

基于 recharts 的柱状图，支持 7 天/14 天/30 天/近一年四种时间范围。根据当前 `currentType` 筛选数据。图表单位自适应（>= 3600 秒用小时，>= 60 秒用分钟，否则用秒）。柱子颜色跟随 `currentType` 对应的主题色（学习 = indigo，阅读 = emerald）。

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

---

## 旧数据迁移

- IndexedDB 中旧 key `study_sessions_storage` 的数据自动迁移到新 key `activity_sessions_storage`
- 所有缺少 `type` 字段的旧记录自动归类为 `STUDY`（学习）
- localStorage 中 `study_sessions` 的旧格式数据也一并迁移
