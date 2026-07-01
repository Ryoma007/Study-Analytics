// TimerPage 行为测试：动态文案、类型保存、主题色、isTimerRunning 同步
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TimerPage } from '../pages/TimerPage';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

vi.mock('idb-keyval');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ sessions: [], currentType: ActivityType.STUDY, isTimerRunning: false });
  vi.useFakeTimers();
  // 固定当前时间
  vi.setSystemTime(new Date('2026-07-01T10:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

const renderTimerPage = () => render(<TimerPage />);

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

  // === 启动/停止同步 isTimerRunning ===
  it('点击开始后 store.isTimerRunning 为 true', () => {
    renderTimerPage();
    // 找到 Play 图标的按钮（开始按钮）
    const playBtn = document.querySelector('.lucide-play')?.closest('button') as HTMLButtonElement;
    fireEvent.click(playBtn!);
    const { isTimerRunning } = useActivityStore.getState();
    expect(isTimerRunning).toBe(true);
  });

  // === 保存时记录包含正确 type ===
  it('学习模式下保存的 session type 为 STUDY', () => {
    renderTimerPage();
    // 点击开始按钮
    const playBtn = document.querySelector('.lucide-play')?.closest('button') as HTMLButtonElement;
    fireEvent.click(playBtn!);
    // 推进 1 秒
    act(() => { vi.advanceTimersByTime(1000); });
    // 点击停止按钮
    const stopBtn = document.querySelector('.lucide-square')?.closest('button') as HTMLButtonElement;
    fireEvent.click(stopBtn!);
    const { sessions } = useActivityStore.getState();
    expect(sessions[0].type).toBe(ActivityType.STUDY);
  });

  it('阅读模式下保存的 session type 为 READING', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderTimerPage();
    const playBtn = document.querySelector('.lucide-play')?.closest('button') as HTMLButtonElement;
    fireEvent.click(playBtn!);
    act(() => { vi.advanceTimersByTime(1000); });
    const stopBtn = document.querySelector('.lucide-square')?.closest('button') as HTMLButtonElement;
    fireEvent.click(stopBtn!);
    const { sessions } = useActivityStore.getState();
    expect(sessions[0].type).toBe(ActivityType.READING);
  });

  // === 默认内容 ===
  it('未填写内容时，学习模式默认保存"日常学习"', () => {
    renderTimerPage();
    const playBtn = document.querySelector('.lucide-play')?.closest('button') as HTMLButtonElement;
    fireEvent.click(playBtn!);
    act(() => { vi.advanceTimersByTime(1000); });
    const stopBtn = document.querySelector('.lucide-square')?.closest('button') as HTMLButtonElement;
    fireEvent.click(stopBtn!);
    const { sessions } = useActivityStore.getState();
    expect(sessions[0].content).toBe('日常学习');
  });

  it('未填写内容时，阅读模式默认保存"日常阅读"', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderTimerPage();
    const playBtn = document.querySelector('.lucide-play')?.closest('button') as HTMLButtonElement;
    fireEvent.click(playBtn!);
    act(() => { vi.advanceTimersByTime(1000); });
    const stopBtn = document.querySelector('.lucide-square')?.closest('button') as HTMLButtonElement;
    fireEvent.click(stopBtn!);
    const { sessions } = useActivityStore.getState();
    expect(sessions[0].content).toBe('日常阅读');
  });

  // === 主题色按钮 ===
  it('学习模式下开始按钮为 indigo', () => {
    renderTimerPage();
    const playBtn = document.querySelector('.lucide-play')?.closest('button') as HTMLButtonElement;
    expect(playBtn.className).toContain('bg-indigo');
  });

  it('阅读模式下开始按钮为 emerald', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    renderTimerPage();
    const playBtn = document.querySelector('.lucide-play')?.closest('button') as HTMLButtonElement;
    expect(playBtn.className).toContain('bg-emerald');
  });

  // === 停止后 isTimerRunning 恢复为 false ===
  it('点击停止后 store.isTimerRunning 为 false', () => {
    renderTimerPage();
    const playBtn = document.querySelector('.lucide-play')?.closest('button') as HTMLButtonElement;
    fireEvent.click(playBtn!);
    // 推进时间，让停止按钮可用
    act(() => { vi.advanceTimersByTime(2000); });
    const stopBtn = document.querySelector('.lucide-square')?.closest('button') as HTMLButtonElement;
    fireEvent.click(stopBtn!);
    const { isTimerRunning } = useActivityStore.getState();
    expect(isTimerRunning).toBe(false);
  });
});
