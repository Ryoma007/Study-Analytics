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
| 枚举 | enumify 2 |
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
│   │   ├── ActivityType.ts   # 活动类型枚举（STUDY/READING）
│   │   └── index.ts          # 枚举统一导出
│   ├── test/
│   │   ├── setup.ts          # vitest 初始化（@testing-library/jest-dom）
│   │   ├── __mocks__/idb-keyval.ts  # idb-keyval mock（jsdom 无 IndexedDB）
│   │   └── *.test.{ts,tsx}   # 测试文件
│   ├── components/
│   │   └── Layout.tsx        # 侧边栏布局（3 个 tab + 学习/阅读分段按钮）
│   ├── pages/
│   │   ├── TimerPage.tsx     # 计时器（开始/暂停/停止，支持学习/阅读文案）
│   │   ├── HistoryPage.tsx   # 历史记录列表（按类型过滤、CRUD、批量删除）
│   │   └── StatisticsPage.tsx # 统计图表（按类型过滤、7/14/30天/年度）
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

**关键陷阱：自定义 `StateStorage.getItem` 返回值会经过双重 JSON 解析。** `getItem` 返回字符串 → `createJSONStorage` 内部 `JSON.parse` → Zustand merge。在 `getItem` 中做 enum 反序列化再 `JSON.stringify` 是无效的（实例再次变成普通对象）。**Enumify 实例恢复必须在 persist 的 `merge` 函数中完成**，`merge` 是水化最后一步，此时已是 JS 对象。本项目的 `activityMerge`（`src/store.ts`）已处理此事。

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

### enumify v2 注意事项

- `.name` 返回 `undefined`，使用 `.enumKey` 获取枚举名（如 `"STUDY"`）
- `.toString()` 返回 `"ClassName.VALUE"`（如 `"ActivityType.STUDY"`）
- 序列化后恢复：`ActivityType.enumValueOf(obj.enumKey)`
- 比较枚举值：使用 `===` 直接比较实例，不要用字符串比较
- `enumValueOf` 对无效 key 返回 `undefined`（不抛异常），容错需 `enumValueOf(key) || fallback`，单靠 try/catch 不够

### 测试约定

- jsdom 不支持 IndexedDB，测试 store 时必须 `vi.mock('idb-keyval')`，mock 实现在 `src/test/__mocks__/idb-keyval.ts`
- recharts 的 `ResponsiveContainer` 在 jsdom 中无法正常渲染，需 mock 为直接透传 children
- Tailwind 动态 class：避免用 `{ [key]: value }` lookup 表拼接 class 字符串，改用条件分支返回完整 class 字符串，确保 Tailwind v4 能扫描到
- 当前测试全部通过 `setState` 直接设值，绕过了 persist 水化过程。涉及 persist 恢复逻辑的修改需单独测试 `activityMerge` 函数（已导出），或通过 mock IndexedDB 写入数据后触发 `persist.rehydrate()` 做端到端验证

### 图表单位自适应

`StatisticsPage.tsx` 根据数据最大值自动选择图表单位：>= 3600 秒用小时，>= 60 秒用分钟，否则用秒。

### 无后端

当前项目为纯前端应用，所有数据存储在浏览器 IndexedDB 中。`package.json` 的 dependencies 中有 `express` 和 `@types/express`，但目前 `server/` 目录不存在，属于预留依赖。

## Agent skills

### Issue tracker

使用 GitHub Issues，通过 `gh` CLI 操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用中文标签：待评估、待补充信息、可供Agent处理、需人工处理、不予处理。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文布局：`CONTEXT.md` + `docs/adr/`。详见 `docs/agents/domain.md`。
