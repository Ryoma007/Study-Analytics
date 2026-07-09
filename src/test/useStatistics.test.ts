import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStatistics } from '../hooks/useStatistics';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

vi.mock('idb-keyval');

beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ sessions: [], currentType: ActivityType.STUDY, isTimerRunning: false });
});

describe('useStatistics', () => {
  it('无数据时 totalDaysInRange === 7，总时长为 0', () => {
    const { result } = renderHook(() => useStatistics([]));
    expect(result.current.stats.totalDaysInRange).toBe(7);
    expect(result.current.stats.studyTotal.value).toBe('0');
    expect(result.current.stats.readingTotal.value).toBe('0');
  });

  it('默认 rangeType 为 "7"', () => {
    const { result } = renderHook(() => useStatistics([]));
    expect(result.current.rangeType).toBe('7');
  });

  it('切换范围到 30 天后 totalDaysInRange === 30', () => {
    const { result } = renderHook(() => useStatistics([]));
    act(() => { result.current.setRangeType('30'); });
    expect(result.current.stats.totalDaysInRange).toBe(30);
  });

  it('年度范围 totalDaysInRange === 365', () => {
    const { result } = renderHook(() => useStatistics([]));
    act(() => { result.current.setRangeType('year'); });
    expect(result.current.stats.totalDaysInRange).toBe(365);
  });

  it('单条学习 record 3600 秒，总时长为 1.00 小时', () => {
    const now = Date.now();
    const sessions = [{
      id: '1', type: ActivityType.STUDY, date: '2026-07-01',
      startTime: now - 3600000, endTime: now, duration: 3600, content: 'test',
    }];
    const { result } = renderHook(() => useStatistics(sessions));
    expect(result.current.stats.studyTotal.value).toBe('1.00');
    expect(result.current.stats.studyTotal.unit).toBe('小时');
  });

  it('单条阅读 record 1800 秒，总时长为 30.0 分钟', () => {
    const now = Date.now();
    const sessions = [{
      id: '1', type: ActivityType.READING, date: '2026-07-01',
      startTime: now - 1800000, endTime: now, duration: 1800, content: 'test',
    }];
    const { result } = renderHook(() => useStatistics(sessions));
    expect(result.current.stats.readingTotal.value).toBe('30.0');
    expect(result.current.stats.readingTotal.unit).toBe('分钟');
  });

  it('chartData 包含 study + reading 双字段', () => {
    const now = Date.now();
    const sessions = [
      { id: '1', type: ActivityType.STUDY, date: '2026-07-01', startTime: now - 3600000, endTime: now, duration: 3600, content: '' },
      { id: '2', type: ActivityType.READING, date: '2026-07-01', startTime: now - 1800000, endTime: now, duration: 1800, content: '' },
    ];
    const { result } = renderHook(() => useStatistics(sessions));
    const { chartData } = result.current.stats;
    expect(chartData.length).toBeGreaterThan(0);
    expect(chartData[0]).toHaveProperty('study');
    expect(chartData[0]).toHaveProperty('reading');
  });
});
