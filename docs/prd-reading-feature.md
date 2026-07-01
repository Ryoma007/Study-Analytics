# PRD：阅读时间记录功能

## Problem Statement

用户当前只能记录"学习"类活动的时间。用户希望跟学习一样，记录阅读的时间，统计、历史等其他功能与学习保持一致。用户需要在同一个应用中自由切换学习/阅读两个上下文，分别计时、查看历史和统计数据。

## Solution

在现有学习记录应用中新增"阅读"活动类型，通过侧边栏全局类型切换支持学习和阅读两种模式的完整功能。核心改动：数据模型增加活动类型字段、侧边栏新增类型切换 UI、计时器/历史/统计三个页面均根据当前活动类型进行过滤和呈现。

## User Stories

1. 作为用户，我希望在侧边栏顶部看到一个学习/阅读的切换控件，以便我快速切换当前要记录的活动类型
2. 作为用户，我希望切换开关位于侧边栏 logo 下方、导航 tab 上方，以便我遵循"先选类型，再选功能"的操作逻辑
3. 作为用户，我希望切换控件是分段按钮样式，学习和阅读两个选项等宽显示，以便我直观理解这是两个对等的选项
4. 作为用户，我希望计时器运行中时类型切换被禁用，以便我不会因为误触而导致正在计时的数据被分类错误
5. 作为用户，我希望应用能记住我上次选择的活动类型（保存到 IndexedDB），以便我下次打开页面时不需要重新切换
6. 作为用户，我希望在阅读模式下，侧边栏 logo、计时器按钮、统计图表柱子变为绿色系（emerald），以便我视觉上能一眼区分当前模式
7. 作为用户，我希望在阅读模式下看到"当前阅读"标题和"你在读什么？"的输入提示，以便我知道正在记录阅读活动
8. 作为用户，我希望阅读计时的默认保存内容为"日常阅读"（未填写内容时），与学习模式的"日常学习"区分开
9. 作为用户，我希望在阅读模式下打来历史记录只显示阅读的记录，以便我能专注于查看阅读历史
10. 作为用户，我希望手动添加/编辑记录时弹窗内有活动类型选择器，默认跟随全局类型但可以手动修改，以便我灵活地补录不同类型的记录
11. 作为用户，我希望在阅读模式下进入统计页面，只看到阅读方面的时长统计和图表，以便我了解自己的阅读习惯
12. 作为用户，我希望统计图表柱子颜色在阅读模式下切换为绿色，以便与学习模式的蓝色图表形成视觉区分
13. 作为用户，我希望旧版没有分类的记录自动归类为"学习"，以便我升级后数据不丢失且分类合理
14. 作为用户，我希望侧边栏标题从"学习记录"改为"时间记录"，以便标题准确反映应用当前的功能范围

## Implementation Decisions

### 1. 数据模型：统合方案，ActivitySession 增加 type 字段

`ActivitySession` 接口（原名 `StudySession`）新增 `type: ActivityType` 字段，学习和阅读共用同一个 store 和 IndexedDB 存储。通过 `currentType` 全局状态过滤展示数据。

### 2. ActivityType 枚举

使用 enumify 在 `src/enums/ActivityType.ts` 中定义，包含 `STUDY` 和 `READING` 两个值。所有涉及活动类型判断的地方通过枚举引用，避免字符串硬编码。

### 3. 全局类型切换

`currentType` 存储在 `useActivityStore`（Zustand store）中，持久化到 IndexedDB。侧边栏顶部渲染分段按钮（Segmented Control），选中项高亮，对应活动类型的主题色（学习 = indigo，阅读 = emerald）。

### 4. 计时器运行中禁用切换

当 `isRunning === true` 时，分段按钮 `disabled` + `cursor-not-allowed`，防止计时器进行中的类型变更。用户在停止计时器后方可切换类型。

### 5. 主题色系统

- 学习模式：主色 indigo-600，浅色 indigo-50
- 阅读模式：主色 emerald-600，浅色 emerald-50

主题色应用于：侧边栏 Logo 背景、计时器开始按钮、统计图表柱子。其他辅助元素（编辑按钮、选中态等）保持 indigo。

### 6. Store 重命名

- `StudySession` → `ActivitySession`
- `useStudyStore` → `useActivityStore`
- `StudyState` → `ActivityState`
- IndexedDB key: `study_sessions_storage` → `activity_sessions_storage`

### 7. 旧数据迁移

在 `idbStorage.getItem` 中处理：
- 先尝试读新 key `activity_sessions_storage`
- 若为空，再读旧 key `study_sessions_storage`（兼容）
- 对缺少 `type` 字段的旧记录自动赋值为 `STUDY`
- localStorage 中 `study_sessions` 的旧格式数据一并迁移

### 8. 计时器页面文案规则

| 模式 | 标题 | 输入框 label | placeholder | 默认保存内容 |
|------|------|-------------|-------------|-------------|
| 学习 | 当前学习 | 你在学习什么？（选填） | 例如：React Hooks，微积分，高等数学... | 日常学习 |
| 阅读 | 当前阅读 | 你在读什么？（选填） | 例如：深入理解计算机系统，三体，设计模式... | 日常阅读 |

### 9. 历史记录过滤

历史记录列表根据 `currentType` 过滤 `sessions`，只显示当前类型的记录。手动添加/编辑弹窗中：新建时活动类型默认跟随 `currentType`（可通过下拉修改），编辑时允许修改类型。

### 10. 统计页面过滤

统计数据（总时长、日均时长、学习天数）和图表数据均根据 `currentType` 过滤。图表柱子颜色跟随类型主题色。

### 11. 新建模块

| # | 模块 | 操作 | 说明 |
|---|------|------|------|
| 1 | `src/enums/ActivityType.ts` | 新建 | enumify 枚举，STUDY / READING |
| 2 | `src/enums/index.ts` | 新建 | 枚举统一导出 |
| 3 | `src/store.ts` | 修改 | 重命名接口/hook，新增 `currentType`，旧数据迁移逻辑 |
| 4 | `src/App.tsx` | 修改 | 适配 Layout 新接口 |
| 5 | `src/components/Layout.tsx` | 修改 | 标题、分段按钮、Logo 颜色、禁用逻辑 |
| 6 | `src/pages/TimerPage.tsx` | 修改 | 文案动态化、默认内容、主题色 |
| 7 | `src/pages/HistoryPage.tsx` | 修改 | 类型过滤、弹窗类型选择器 |
| 8 | `src/pages/StatisticsPage.tsx` | 修改 | 类型过滤、图表颜色 |

### 12. Vitest 测试配置

新增 vitest 依赖和配置文件。测试覆盖：

- **ActivityType 枚举** — 枚举值正确性、反向查找
- **store** — `currentType` 切换、计时中切换守卫、旧数据迁移（含缺失 type 字段记录）、CRUD 操作正确性、类型过滤逻辑
- **Layout 组件** — 分段按钮渲染、切换回调、Logo 颜色跟随、计时中禁用态
- **TimerPage 组件** — 文案动态切换（学习/阅读模式下标题、placeholder、默认内容不同）、计时开始/暂停/停止核心流程
- **HistoryPage 组件** — 类型过滤展示、手动添加弹窗类型选择器默认值和可修改性
- **StatisticsPage 组件** — 类型过滤、图表颜色跟随、统计卡片数值正确性

## Testing Decisions

### 测试原则

- 仅测试外部行为（输入→输出），不测试实现细节（内部 state 变量名、私有方法等）
- 组件测试使用 React Testing Library（`@testing-library/react`），尽量通过用户可感知的方式验证（文本内容、按钮禁用态、颜色 class 等）
- Store 测试直接调用 hook 返回值、模拟 zustand persist storage
- 迁移逻辑使用 mock 的 IndexedDB/lStorage 进行独立单元测试

### 测试工具

- **vitest** — 测试运行器
- **@testing-library/react** — 组件渲染与查询
- **@testing-library/jest-dom** — DOM 断言扩展
- **jsdom** — 浏览器环境模拟

### 测试模块

全部 8 个模块均需要测试覆盖。

## Further Notes

- 当前项目 `packageManager` 为 `pnpm@9.15.4`，所有依赖安装需使用 pnpm
- 测试配置参考 vitest 官方推荐的 Vite 项目配置（vite.config.ts 中 `test` 字段）
- 本项目无 Router，路由通过 `currentTab` state 驱动，测试时无需 mock 路由库
- enumify 使用 `npm:enumify@^1.0.6`
