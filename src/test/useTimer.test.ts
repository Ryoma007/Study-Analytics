import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTimer } from '../hooks/useTimer';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

vi.mock('idb-keyval');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** 从当前 store 状态构建 useTimer 依赖 */
const getTimerDeps = () => {
  const state = useActivityStore.getState();
  return {
    currentType: state.currentType,
    addSession: state.addSession,
    setIsTimerRunning: state.setIsTimerRunning,
  };
};

beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ sessions: [], currentType: ActivityType.STUDY, isTimerRunning: false });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-01T10:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTimer', () => {
  it('初始状态：displayTime 为 0，isRunning 为 false，content 为空', () => {
    const { result } = renderHook(() => useTimer(getTimerDeps()));
    expect(result.current.displayTime).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.content).toBe('');
  });

  it('handleStart 后 isRunning 为 true，store.isTimerRunning 为 true', () => {
    const { result } = renderHook(() => useTimer(getTimerDeps()));
    act(() => { result.current.handleStart(); });
    expect(result.current.isRunning).toBe(true);
    expect(useActivityStore.getState().isTimerRunning).toBe(true);
  });

  it('handlePause 后 isRunning 为 false，累加时间保持不变', () => {
    const { result } = renderHook(() => useTimer(getTimerDeps()));
    act(() => { result.current.handleStart(); });
    act(() => { vi.advanceTimersByTime(3000); });
    const timeBeforePause = result.current.displayTime;
    act(() => { result.current.handlePause(); });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.displayTime).toBe(timeBeforePause);
  });

  it('handleStop 保存 session 到 store', () => {
    const { result } = renderHook(() => useTimer(getTimerDeps()));
    act(() => { result.current.handleStart(); });
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { result.current.handleStop(); });
    const { sessions } = useActivityStore.getState();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].duration).toBeGreaterThan(0);
    expect(sessions[0].type).toBe(ActivityType.STUDY);
  });

  it('handleStop 后重置状态：displayTime === 0，isRunning === false', () => {
    const { result } = renderHook(() => useTimer(getTimerDeps()));
    act(() => { result.current.handleStart(); });
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { result.current.handleStop(); });
    expect(result.current.displayTime).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });

  it('handleStop 后 store.isTimerRunning 为 false', () => {
    const { result } = renderHook(() => useTimer(getTimerDeps()));
    act(() => { result.current.handleStart(); });
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { result.current.handleStop(); });
    expect(useActivityStore.getState().isTimerRunning).toBe(false);
  });

  it('阅读模式下保存的 session type 为 READING', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    const { result } = renderHook(() => useTimer(getTimerDeps()));
    act(() => { result.current.handleStart(); });
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { result.current.handleStop(); });
    const { sessions } = useActivityStore.getState();
    expect(sessions[0].type).toBe(ActivityType.READING);
  });

  it('未填写内容时默认保存配置中的 defaultContent', () => {
    const { result } = renderHook(() => useTimer(getTimerDeps()));
    act(() => { result.current.handleStart(); });
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { result.current.handleStop(); });
    const { sessions } = useActivityStore.getState();
    expect(sessions[0].content).toBe('日常学习');
  });
});
