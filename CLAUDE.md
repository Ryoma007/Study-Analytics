# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

学习与阅读时间记录（Study Analytics）—— 纯前端活动时长追踪 SPA。支持学习和阅读两种类型的计时器、历史记录管理、按类型过滤的数据统计图表（日/周/月/年维度）。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript 5.8 |
| 构建 | Vite 6 |
| CSS | Tailwind CSS v4 |
| 状态管理 | Zustand 5 (persist 中间件) |
| 客户端存储 | IndexedDB（通过 `idb-keyval`，作为 Zustand 自定义 storage engine） |
| 图表 | recharts 3 |
| 日期 | date-fns 4 |
| 图标 | lucide-react |
| 动画 | motion (Framer Motion) |
| Toast | sonner |
| 枚举 | const 对象 + 字符串联合类型 |
| 测试 | vitest 4 + @testing-library/react + jsdom |
| AI | @google/genai (Gemini API) |

## 常用命令

```bash
# 开发服务器（端口 3001，绑定所有网卡）
pnpm dev

# 运行测试
pnpm vitest run

# 运行测试（监听模式）
pnpm vitest

# 构建
pnpm build

# 类型检查（即 lint）
pnpm lint

# 预览构建产物
pnpm preview

# 清理构建输出
pnpm clean
```

## 项目架构

```
/
├── src/
│   ├── main.tsx              # 入口，挂载 React 根节点
│   ├── App.tsx               # 根组件，管理 tab 切换状态（timer/history/statistics）
│   ├── store.ts              # Zustand store，含 ActivitySession 数据模型和 CRUD
│   ├── enums/
│   │   ├── ActivityType.ts   # 活动类型常量 + 联合类型（STUDY/READING，已移除 Enumify）
│   │   └── index.ts          # 枚举统一导出
│   ├── config/
│   │   └── activityConfig.ts # 活动类型 → 展示属性映射表（颜色、文案），getActivityConfig()
│   ├── hooks/
│   │   ├── useTimer.ts       # 计时器状态机 hook（依赖注入模式）
│   │   └── useStatistics.ts  # 统计数据管道 hook（接受 sessions 参数）
│   ├── utils/
│   │   └── time.ts           # 时间格式化工具：formatTime / formatDuration / formatTimeValue
│   ├── test/
│   │   ├── setup.ts          # vitest 初始化（@testing-library/jest-dom）
│   │   ├── __mocks__/idb-keyval.ts  # idb-keyval mock（jsdom 无 IndexedDB）
│   │   └── *.test.{ts,tsx}   # 测试文件
│   ├── components/
│   │   ├── Layout.tsx        # 侧边栏布局（hideTypeSwitcher prop 解除对 StatisticsPage 的感知）
│   │   ├── StatTooltip.tsx   # 统计图表自定义 Tooltip（chartUnit 通过 props 传入）
│   │   └── HistoryPage/
│   │       ├── SessionTable.tsx       # 历史记录表格（空状态、全选、行渲染）
│   │       ├── SessionFormModal.tsx   # 添加/编辑记录弹窗
│   │       └── DeleteConfirmDialog.tsx # 删除确认弹窗
│   ├── pages/
│   │   ├── TimerPage.tsx     # 计时器 UI 薄层（逻辑在 useTimer hook 中，按钮有 data-testid）
│   │   ├── HistoryPage.tsx   # 历史记录编排层（逻辑在子组件中）
│   │   └── StatisticsPage.tsx # 统计图表编排层（数据管道在 useStatistics hook 中）
│   └── index.css             # Tailwind 入口（@import "tailwindcss"）
├── server.ts / server.js     # Express 后端（如有）
├── docs/
│   └── agents/               # Agent 技能参考文档
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 核心设计决策

### 路由：无 React Router，tab 状态驱动

应用没有使用 React Router，路由通过 `App.tsx` 中的 `currentTab` 状态管理，条件渲染对应页面组件。三个 tab：`timer`、`history`、`statistics`。

### 状态持久化：Zustand + IndexedDB

`store.ts` 中 `useActivityStore` 使用 Zustand 的 `persist` 中间件，自定义 `idbStorage` engine 基于 `idb-keyval`。同时包含从 localStorage 和旧 key `study_sessions_storage` 迁移的逻辑。`currentType` 切换受 `isTimerRunning` 守卫保护（计时器运行中禁止切换）。

**关键陷阱：自定义 `StateStorage.getItem` 返回值会经过双重 JSON 解析。** `getItem` 返回字符串 → `createJSONStorage` 内部 `JSON.parse` → Zustand merge。类型恢复逻辑应在 `activityMerge` 中处理（水化最后一步）。当前 `activityMerge` 兼容旧版 Enumify `{enumKey:"X"}` 格式，自动迁移为纯字符串。

**陷阱：`isTimerRunning` 是瞬态状态，不持久化。** 它是计时器组件运行状态的**镜像**，真实运行态（`useTimer` 的 `isRunning`）是组件本地 state，刷新即丢失。若持久化它会导致"幽灵运行状态"——启动计时器未停止就关页面，下次打开 UI 未在计时却因恢复 `true` 而永久禁用类型切换器。store 用 `partialize` 只持久化 `sessions` + `currentType`（**不写入** `isTimerRunning`），`activityMerge` 强制 `merged.isTimerRunning = false`（新会话起始必然未启动，同时清理旧脏数据）。改 `isTimerRunning` 相关逻辑时注意：它只反映当前会话运行态，不应跨会话保留。

### 计时器精度：基于系统时钟

`TimerPage.tsx` 不使用 `setInterval` 累加计数，而是记录 `lastStartTime`（`Date.now()`），展示时间为 `accumulatedTime + 当前分段`。同时监听 `visibilitychange` 事件，标签页恢复可见时立即校准显示时间。

### 数据模型：ActivitySession（原名 StudySession，已废弃）

```typescript
interface ActivitySession {
  id: string;          // crypto.randomUUID() 或 fallback
  type: ActivityType;  // 活动类型：STUDY | READING
  date: string;        // YYYY-MM-DD
  startTime: number;   // epoch ms
  endTime: number;     // epoch ms
  duration: number;    // 秒
  content: string;     // 活动内容描述
}
```

### ActivityType 常量模式（已移除 Enumify）

- `ActivityType` 是 `const { STUDY: 'STUDY', READING: 'READING' } as const` + 联合类型
- `ACTIVITY_TYPES` 数组替代原 `ActivityType.enumValues`（遍历所有类型用）
- `activityTypeFromValue(str)` 替代原 `ActivityType.enumValueOf(str)` —— **无效值抛异常，不兜底**
- `type` 字段现在是纯字符串，JSON 序列化后直接可用，无需反序列化逻辑
- store 的 `activityMerge` 兼容旧版 `{enumKey: "X"}` 格式，自动迁移为纯字符串

### 配置表模式（activityConfig）

- `src/config/activityConfig.ts` 是活动类型 → 展示属性的**单一事实源**
- `getActivityConfig(type)` 返回 `{ label, color: { hex, tailwind: {...} }, copy: {...} }`
- 新增活动类型只需改 2 个文件：`ActivityType.ts`（加一行） + `activityConfig.ts`（加一条记录）
- 所有组件通过查表获取颜色/文案，不存在 if/else 三元表达式

### Hooks 依赖注入模式

- `useTimer({ currentType, addSession, setIsTimerRunning })` —— 接受 store deps 作为参数
- `useStatistics(sessions)` —— 接受 sessions 数组作为参数
- hooks 本身与 store 解耦，测试时可传入 mock 数据

### Layout 接口

- `Layout` 新增 `hideTypeSwitcher?: boolean` prop，由 App.tsx 传入 `currentTab === 'statistics'`
- Layout 不再持有页面特定知识（不再检查 `currentTab` 值）

### 测试约定

- jsdom 不支持 IndexedDB，测试 store 时必须 `vi.mock('idb-keyval')`，mock 实现在 `src/test/__mocks__/idb-keyval.ts`
- recharts 的 `ResponsiveContainer` 在 jsdom 中无法正常渲染，需 mock 为直接透传 children
- Tailwind 动态 class：避免用 `{ [key]: value }` lookup 表拼接 class 字符串，改用条件分支返回完整 class 字符串，确保 Tailwind v4 能扫描到
- **计时器按钮**使用 `data-testid="timer-start"` / `data-testid="timer-stop"` 定位，不要用 `.lucide-play` 等 CSS class 选择器
- **Hooks 测试**使用 `renderHook` from `@testing-library/react`；`useTimer` 需传入 store deps 参数
- 当前测试全部通过 `setState` 直接设值，绕过了 persist 水化过程。涉及 persist 恢复逻辑的修改需单独测试 `activityMerge` 函数（已导出），或通过 mock IndexedDB 写入数据后触发 `persist.rehydrate()` 做端到端验证
  - 测试辅助函数中创建 session 应使用 `new Date()` 而非硬编码日期（如 `new Date('2026-07-01')`）。组件内部 `startOfDay(new Date())` 依赖系统时钟，硬编码日期会随时间推移超出默认范围（如 7 天），导致数据被过滤、测试静默返回 0
  - 统计页拆分卡片后，"学习"/"阅读"标签在多张卡片中重复出现，断言需使用 `getAllByText` + `.length` 而非 `getByText`

### 图表单位自适应

`StatisticsPage.tsx` 根据数据最大值自动选择图表单位：>= 3600 秒用小时，>= 60 秒用分钟，否则用秒。

### 无后端

当前项目为纯前端应用，所有数据存储在浏览器 IndexedDB 中。`package.json` 的 dependencies 中有 `express` 和 `@types/express`，但目前 `server/` 目录不存在，属于预留依赖。

## CI/CD

- GitHub Actions 工作流 `.github/workflows/docker-build-push.yml`，push to main + `workflow_dispatch` 手动触发
- Docker 镜像 `ryoma9426/study-analytics`，推送到 Docker Hub，tag 为 `latest`
- **关键陷阱：`pnpm/action-setup@v4` 不要写 `version` 参数**，`package.json` 的 `packageManager` 字段已声明版本，重复指定会报 `Multiple versions of pnpm specified` 错误
- GitHub Actions 已弃用 Node 20，`setup-node` 必须用 `node-version: 22` 或更高
- **nginx 缓存策略**：`index.html` 设为 `no-cache`，带 hash 的 JS/CSS 设为 `max-age=31536000, immutable`，否则部署后浏览器缓存旧入口导致白屏
- Docker Hub 认证通过 GitHub Secrets：`DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`

## Agent skills

### Issue tracker

使用 GitHub Issues，通过 `gh` CLI 操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用中文标签：待评估、待补充信息、可供Agent处理、需人工处理、不予处理。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文布局：`CONTEXT.md` + `docs/adr/`。详见 `docs/agents/domain.md`。
