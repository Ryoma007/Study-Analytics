# Study Analytics — 学习与阅读时间追踪

纯前端活动时长追踪 SPA，支持**学习**和**阅读**两种活动类型的计时器、历史记录管理以及按类型过滤的数据统计图表。

## 功能特性

- **双类型计时器** — 支持"学习"和"阅读"两种活动类型，计时器运行中自动锁定类型
- **精确计时** — 基于系统时钟（`Date.now()`），避免 `setInterval` 累积误差；标签页隐藏/恢复时自动校准
- **历史记录** — 按类型过滤、支持编辑/删除单条记录、批量删除，数据持久化至 IndexedDB
- **统计图表** — 按日/周/月/年维度展示学习/阅读时长，图表单位自适应（秒/分钟/小时）
- **离线可用** — 纯前端应用，无需后端，所有数据存储在浏览器 IndexedDB 中

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript 5.8 |
| 构建工具 | Vite 6 |
| CSS | Tailwind CSS v4 |
| 状态管理 | Zustand 5（persist 中间件 + IndexedDB 自定义 storage） |
| 客户端存储 | IndexedDB（`idb-keyval`） |
| 图表 | recharts 3 |
| 日期处理 | date-fns 4 |
| 图标 | lucide-react |
| 动画 | motion (Framer Motion) |
| Toast | sonner |
| 枚举 | enumify 2 |
| 测试 | vitest 4 + @testing-library/react + jsdom |

## 快速开始

**前置要求：** Node.js 18+、pnpm v8+

```bash
# 安装依赖
pnpm install

# 启动开发服务器（端口 3001）
pnpm dev

# 构建生产版本
pnpm build

# 预览构建产物
pnpm preview
```

## 项目结构

```
src/
├── main.tsx                  # 入口，挂载 React 根节点
├── App.tsx                   # 根组件，管理 tab 切换（timer/history/statistics）
├── store.ts                  # Zustand store，ActivitySession 数据模型与 CRUD
├── index.css                 # Tailwind 入口
├── enums/
│   ├── ActivityType.ts       # 活动类型枚举（STUDY / READING）
│   └── index.ts              # 枚举统一导出
├── components/
│   └── Layout.tsx            # 侧边栏布局 + 学习/阅读分段按钮
├── pages/
│   ├── TimerPage.tsx         # 计时器页面
│   ├── HistoryPage.tsx       # 历史记录页面
│   └── StatisticsPage.tsx    # 统计图表页面
└── test/
    ├── setup.ts              # vitest 初始化
    ├── __mocks__/idb-keyval.ts  # IndexedDB mock（jsdom 不支持 IndexedDB）
    └── *.test.{ts,tsx}       # 测试文件
```

## 可用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器（`localhost:3001`，绑定所有网卡） |
| `pnpm build` | TypeScript 编译 + Vite 生产构建 |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm lint` | TypeScript 类型检查（`tsc --noEmit`） |
| `pnpm vitest` | 运行测试（监听模式） |
| `pnpm vitest run` | 单次运行全部测试 |
| `pnpm clean` | 清理构建输出目录 |

## 架构设计

### 路由：状态驱动，无 React Router

通过 `App.tsx` 中的 `currentTab` 状态切换页面，三个 tab：`timer`、`history`、`statistics`。

### 数据持久化：Zustand + IndexedDB

`useActivityStore` 使用 Zustand `persist` 中间件，通过 `idb-keyval` 自定义 storage engine 将状态写入 IndexedDB。同时兼容从 localStorage 及旧版本 key 迁移数据。

### 计时器精度

不使用 `setInterval` 累加，而是记录 `lastStartTime`，展示时间 = `accumulatedTime + (Date.now() - lastStartTime)`。监听 `visibilitychange` 事件，标签页恢复可见时立即校准。

### 数据模型

```typescript
interface ActivitySession {
  id: string;          // crypto.randomUUID()
  type: ActivityType;  // STUDY | READING
  date: string;        // YYYY-MM-DD
  startTime: number;   // epoch ms
  endTime: number;     // epoch ms
  duration: number;    // 秒
  content: string;     // 活动内容描述
}
```

### 图表单位自适应

统计图表根据数据最大值自动切换单位：≥ 3600 秒显示为小时，≥ 60 秒显示为分钟，否则显示为秒。

## 许可证

Apache-2.0
