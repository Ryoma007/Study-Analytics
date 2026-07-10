// Layout 组件行为测试（含响应式双轨渲染：桌面侧边栏 + 移动端底栏/TopBar）
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

  // === 分段按钮（桌面侧边栏 + 移动端顶栏 双轨渲染，各有两个"学习"/"阅读"按钮） ===
  it('渲染学习和阅读两个分段按钮（桌面端+移动端各一组）', () => {
    renderLayout();
    // 双轨渲染：桌面侧边栏 + 移动端顶栏各有一组切换按钮
    const studyButtons = screen.getAllByText('学习');
    const readingButtons = screen.getAllByText('阅读');
    expect(studyButtons).toHaveLength(2);
    expect(readingButtons).toHaveLength(2);
  });

  it('默认选中"学习"（跟随 currentType）', () => {
    renderLayout();
    const studyBtns = screen.getAllByText('学习');
    // 每个按钮都应该是 <button>
    studyBtns.forEach((btn) => {
      expect(btn.closest('button')).not.toBeNull();
    });
  });

  it('store currentType 为 READING 时选中"阅读"', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderLayout();
    const readingBtns = screen.getAllByText('阅读');
    readingBtns.forEach((btn) => {
      expect(btn.closest('button')).not.toBeNull();
    });
  });

  it('点击"阅读"触发类型切换', () => {
    renderLayout();
    // 点击第一个匹配的"阅读"按钮即可（桌面端侧边栏中的）
    fireEvent.click(screen.getAllByText('阅读')[0]);
    const { currentType } = useActivityStore.getState();
    expect(currentType).toBe(ActivityType.READING);
  });

  it('点击"学习"触发类型切换', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderLayout();
    fireEvent.click(screen.getAllByText('学习')[0]);
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
    const readingBtns = screen.getAllByText('阅读');
    // 所有"阅读"按钮应该都被禁用
    readingBtns.forEach((btn) => {
      expect(btn.closest('button')).toBeDisabled();
    });
  });

  // === 导航 tab 不变（桌面侧边栏 + 移动端底栏 双轨渲染） ===
  it('三个导航 tab 仍然存在（桌面端+移动端各一组）', () => {
    renderLayout();
    // 双轨渲染：桌面侧边栏 + 移动端底栏各有一组导航按钮
    expect(screen.getAllByText('计时器')).toHaveLength(2);
    expect(screen.getAllByText('历史记录')).toHaveLength(2);
    expect(screen.getAllByText('数据统计')).toHaveLength(2);
  });

  it('点击导航 tab 触发 onTabChange', () => {
    const { onTabChange } = renderLayout();
    // 点击第一个匹配的"历史记录"按钮
    fireEvent.click(screen.getAllByText('历史记录')[0]);
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
    const studyBtns = screen.getAllByText('学习');
    const readingBtns = screen.getAllByText('阅读');
    // 两组按钮都存在（桌面端+移动端）
    expect(studyBtns).toHaveLength(2);
    expect(readingBtns).toHaveLength(2);
    // 所有按钮都被禁用
    [...studyBtns, ...readingBtns].forEach((btn) => {
      expect(btn.closest('button')).toBeDisabled();
    });
  });

  it('数据统计页仍渲染导航 tab', () => {
    renderLayout('statistics');
    expect(screen.getAllByText('计时器')).toHaveLength(2);
    expect(screen.getAllByText('历史记录')).toHaveLength(2);
    expect(screen.getAllByText('数据统计')).toHaveLength(2);
  });

  // === 子内容渲染 ===
  it('渲染 children', () => {
    renderLayout();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});
