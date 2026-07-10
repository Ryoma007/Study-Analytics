// TimerPage 行为测试：动态文案、类型保存、主题色、isRunning 状态回调
import { render, screen, fireEvent } from '@testing-library/react';
import { TimerPage } from '../pages/TimerPage';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

// Mock useTimer hook
const mockHandleStart = vi.fn();
const mockHandleStop = vi.fn();
let mockIsRunning = false;
let mockDisplayTime = 0;

vi.mock('../hooks/useTimer', () => ({
  useTimer: () => ({
    displayTime: mockDisplayTime,
    isRunning: mockIsRunning,
    content: '',
    setContent: vi.fn(),
    handleStart: mockHandleStart,
    handleStop: mockHandleStop,
  }),
}));

vi.mock('idb-keyval');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ currentType: ActivityType.STUDY });
  mockIsRunning = false;
  mockDisplayTime = 0;
  mockHandleStart.mockClear();
  mockHandleStop.mockClear();
});

const renderTimerPage = (onRunningChange?: (running: boolean) => void) =>
  render(<TimerPage onRunningChange={onRunningChange} />);

describe('TimerPage', () => {
  // === 动态文案 ===
  describe('学习模式文案', () => {
    it('标题为"当前学习"', () => {
      renderTimerPage();
      expect(screen.getByText('当前学习')).toBeInTheDocument();
    });

    it('输入框 label 为"你在学习什么？（选填）"', () => {
      renderTimerPage();
      expect(screen.getByText('你在学习什么？（选填）')).toBeInTheDocument();
    });

    it('输入框 placeholder 包含 React 等示例', () => {
      renderTimerPage();
      const textarea = screen.getByPlaceholderText(/React Hooks/);
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('阅读模式文案', () => {
    beforeEach(() => {
      useActivityStore.getState().setCurrentType(ActivityType.READING);
    });

    it('标题为"当前阅读"', () => {
      renderTimerPage();
      expect(screen.getByText('当前阅读')).toBeInTheDocument();
    });

    it('输入框 label 为"你在读什么？（选填）"', () => {
      renderTimerPage();
      expect(screen.getByText('你在读什么？（选填）')).toBeInTheDocument();
    });

    it('输入框 placeholder 包含三体等示例', () => {
      renderTimerPage();
      const textarea = screen.getByPlaceholderText(/三体/);
      expect(textarea).toBeInTheDocument();
    });
  });

  // === 停止状态：显示开始按钮 ===
  it('未运行时显示开始按钮', () => {
    renderTimerPage();
    expect(screen.getByTestId('timer-start')).toBeInTheDocument();
  });

  it('点击开始按钮调用 handleStart', () => {
    renderTimerPage();
    fireEvent.click(screen.getByTestId('timer-start'));
    expect(mockHandleStart).toHaveBeenCalledTimes(1);
  });

  // === 运行状态：显示停止按钮，无暂停按钮 ===
  it('运行时显示停止按钮', () => {
    mockIsRunning = true;
    renderTimerPage();
    expect(screen.getByTestId('timer-stop')).toBeInTheDocument();
  });

  it('运行时无暂停按钮（ADR-0001）', () => {
    mockIsRunning = true;
    renderTimerPage();
    // 整个页面应该只有 2 个按钮：停止 +（开始按钮不应出现）
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(1); // 仅停止按钮
  });

  it('点击停止按钮调用 handleStop', () => {
    mockIsRunning = true;
    renderTimerPage();
    fireEvent.click(screen.getByTestId('timer-stop'));
    expect(mockHandleStop).toHaveBeenCalledTimes(1);
  });

  // === onRunningChange 回调 ===
  it('isRunning 变化时通知父组件', () => {
    const onRunningChange = vi.fn();
    mockIsRunning = true;
    renderTimerPage(onRunningChange);
    expect(onRunningChange).toHaveBeenCalledWith(true);
  });

  // === 主题色按钮 ===
  it('学习模式下开始按钮为 indigo', () => {
    renderTimerPage();
    const btn = screen.getByTestId('timer-start');
    expect(btn.className).toContain('bg-indigo');
  });

  it('阅读模式下开始按钮为 emerald', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderTimerPage();
    const btn = screen.getByTestId('timer-start');
    expect(btn.className).toContain('bg-emerald');
  });
});
