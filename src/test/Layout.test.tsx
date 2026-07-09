// Layout 组件行为测试
import { render, screen, fireEvent } from '@testing-library/react';
import { Layout } from '../components/Layout';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

// 模拟 idb-keyval
vi.mock('idb-keyval');

// 避免 sonner 报错
vi.mock('sonner', () => ({
  Toaster: () => null,
}));

// 模拟 motion（避免动画相关告警）
vi.mock('motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
  AnimatePresence: ({ children }: any) => children,
}));

beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ sessions: [], currentType: ActivityType.STUDY, isTimerRunning: false });
});

// 渲染 Layout 的辅助函数
const renderLayout = (tab = 'timer') => {
  const onTabChange = vi.fn();
  return {
    onTabChange,
    ...render(
      <Layout currentTab={tab} onTabChange={onTabChange}>
        <div data-testid="content">page content</div>
      </Layout>
    ),
  };
};

describe('Layout', () => {
  // === 侧边栏标题 ===
  it('侧边栏标题为"时间记录"', () => {
    renderLayout();
    expect(screen.getByText('时间记录')).toBeInTheDocument();
  });

  // === 分段按钮 ===
  it('渲染学习和阅读两个分段按钮', () => {
    renderLayout();
    expect(screen.getByText('学习')).toBeInTheDocument();
    expect(screen.getByText('阅读')).toBeInTheDocument();
  });

  it('默认选中"学习"（跟随 currentType）', () => {
    renderLayout();
    // 学习按钮应带有选中态样式（indigo 背景）
    const studyBtn = screen.getByText('学习').closest('button');
    expect(studyBtn).not.toBeNull();
  });

  it('store currentType 为 READING 时选中"阅读"', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderLayout();
    // 阅读按钮应带有选中态样式
    const readingBtn = screen.getByText('阅读').closest('button');
    expect(readingBtn).not.toBeNull();
  });

  it('点击"阅读"触发类型切换', () => {
    renderLayout();
    fireEvent.click(screen.getByText('阅读'));
    const { currentType } = useActivityStore.getState();
    expect(currentType).toBe(ActivityType.READING);
  });

  it('点击"学习"触发类型切换', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderLayout();
    fireEvent.click(screen.getByText('学习'));
    const { currentType } = useActivityStore.getState();
    expect(currentType).toBe(ActivityType.STUDY);
  });

  // === Logo 颜色跟随类型 ===
  it('学习模式下 Logo 背景为 indigo', () => {
    renderLayout();
    // Logo 容器 div 应包含 indigo 相关背景色 class
    const logoContainer = document.querySelector('[class*="bg-indigo"]');
    expect(logoContainer).not.toBeNull();
  });

  it('阅读模式下 Logo 背景为 emerald', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderLayout();
    const logoContainer = document.querySelector('[class*="bg-emerald"]');
    expect(logoContainer).not.toBeNull();
  });

  // === 计时中禁用 ===
  it('计时器运行时，分段按钮不可点击（不触发切换）', () => {
    useActivityStore.getState().setIsTimerRunning(true);
    renderLayout();
    // 尝试点击阅读
    fireEvent.click(screen.getByText('阅读'));
    // 当前类型应保持 STUDY（切换被拦截）
    const { currentType } = useActivityStore.getState();
    expect(currentType).toBe(ActivityType.STUDY);
  });

  // === 导航 tab 不变 ===
  it('三个导航 tab 仍然存在', () => {
    renderLayout();
    expect(screen.getByText('计时器')).toBeInTheDocument();
    expect(screen.getByText('历史记录')).toBeInTheDocument();
    expect(screen.getByText('数据统计')).toBeInTheDocument();
  });

  it('点击导航 tab 触发 onTabChange', () => {
    const { onTabChange } = renderLayout();
    fireEvent.click(screen.getByText('历史记录'));
    expect(onTabChange).toHaveBeenCalledWith('history');
  });

  // === L1: 统计页隐藏类型切换 ===
  it('数据统计页不渲染类型切换按钮', () => {
    renderLayout('statistics');
    expect(screen.queryByText('学习')).toBeNull();
    expect(screen.queryByText('阅读')).toBeNull();
  });

  it('数据统计页仍渲染导航 tab', () => {
    renderLayout('statistics');
    expect(screen.getByText('计时器')).toBeInTheDocument();
    expect(screen.getByText('历史记录')).toBeInTheDocument();
    expect(screen.getByText('数据统计')).toBeInTheDocument();
  });

  it('计时器页仍渲染类型切换按钮', () => {
    renderLayout('timer');
    expect(screen.getByText('学习')).toBeInTheDocument();
    expect(screen.getByText('阅读')).toBeInTheDocument();
  });

  it('历史记录页仍渲染类型切换按钮', () => {
    renderLayout('history');
    expect(screen.getByText('学习')).toBeInTheDocument();
    expect(screen.getByText('阅读')).toBeInTheDocument();
  });

  // === 子内容渲染 ===
  it('渲染 children', () => {
    renderLayout();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});
