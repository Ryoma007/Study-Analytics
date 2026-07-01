# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

学习记录（Study Analytics）—— 纯前端学习时长追踪 SPA。支持计时器、历史记录管理、数据统计图表（日/周/月/年维度）。

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
| AI | @google/genai (Gemini API) |

## 常用命令

```bash
# 开发服务器（端口 3001，绑定所有网卡）
pnpm dev

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
│   ├── store.ts              # Zustand store，含 StudySession 数据模型和 CRUD
│   ├── components/
│   │   └── Layout.tsx        # 侧边栏布局（3 个 tab 导航）
│   ├── pages/
│   │   ├── TimerPage.tsx     # 学习计时器（开始/暂停/停止）
│   │   ├── HistoryPage.tsx   # 历史记录列表（CRUD、批量删除）
│   │   └── StatisticsPage.tsx # 统计图表（7/14/30天/年度柱状图）
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

`store.ts` 中 `useStudyStore` 使用 Zustand 的 `persist` 中间件，自定义 `idbStorage` engine 基于 `idb-keyval`。同时包含从 localStorage 旧格式迁移的逻辑 (`getItem` 中的 `legacyData` 检查)。

### 计时器精度：基于系统时钟

`TimerPage.tsx` 不使用 `setInterval` 累加计数，而是记录 `lastStartTime`（`Date.now()`），展示时间为 `accumulatedTime + 当前分段`。同时监听 `visibilitychange` 事件，标签页恢复可见时立即校准显示时间。

### 数据模型：StudySession

```typescript
interface StudySession {
  id: string;        // crypto.randomUUID() 或 fallback
  date: string;      // YYYY-MM-DD
  startTime: number; // epoch ms
  endTime: number;   // epoch ms
  duration: number;  // 秒
  content: string;   // 学习内容描述
}
```

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
