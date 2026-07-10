// Layout 组件行为测试
import { render, screen, fireEvent } from '@testing-library/react';
import { Layout } from '../components/Layout';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

vi.mock('idb-keyval');

// 避免 sonner 报错
vi.mock('sonner', () => ({
  Toaster: () => null,
}));

// 模拟 motion
vi.mock('motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
  AnimatePresence: ({ children }: any) => children,
}));

beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ currentType: ActivityType.STUDY });
});

const renderLayout = (tab = 'timer', isTimerRunning = false) => {
  const onTabChange = vi.fn();
  return {
    onTabChange,
    ...render(
      <Layout currentTab={tab} onTabChange={onTabChange} isTimerRunning={isTimerRunning}>
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
    const studyBtn = screen.getByText('学习').closest('button');
    expect(studyBtn).not.toBeNull();
  });

  it('store currentType 为 READING 时选中"阅读"', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderLayout();
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
    const logoContainer = document.querySelector('[class*="bg-indigo"]');
    expect(logoContainer).not.toBeNull();
  });

  it('阅读模式下 Logo 背景为 emerald', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderLayout();
    const logoContainer = document.querySelector('[class*="bg-emerald"]');
    expect(logoContainer).not.toBeNull();
  });

  // === 计时中禁用（通过 isTimerRunning prop） ===
  it('isTimerRunning=true 时，分段按钮 disabled', () => {
    renderLayout('timer', true);
    const readingBtn = screen.getByText('阅读').closest('button');
    expect(readingBtn).toBeDisabled();
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

  // === 统计页禁用类型切换（切换器始终渲染，按钮不可点击） ===
  it('disableTypeSwitcher=true 时切换按钮渲染但 disabled', () => {
    const onTabChange = vi.fn();
    render(
      <Layout currentTab="statistics" onTabChange={onTabChange} disableTypeSwitcher>
        <div data-testid="content">page content</div>
      </Layout>
    );
    // 按钮仍然在 DOM 中（不隐藏，避免闪烁和下方内容上移）
    expect(screen.getByText('学习')).toBeInTheDocument();
    expect(screen.getByText('阅读')).toBeInTheDocument();
    // 两个按钮都被禁用
    expect(screen.getByText('学习').closest('button')).toBeDisabled();
    expect(screen.getByText('阅读').closest('button')).toBeDisabled();
  });

  it('数据统计页仍渲染导航 tab', () => {
    renderLayout('statistics');
    expect(screen.getByText('计时器')).toBeInTheDocument();
    expect(screen.getByText('历史记录')).toBeInTheDocument();
    expect(screen.getByText('数据统计')).toBeInTheDocument();
  });

  // === 子内容渲染 ===
  it('渲染 children', () => {
    renderLayout();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});
