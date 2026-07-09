import { describe, it, expect } from 'vitest';
import { formatTime, formatDuration, formatTimeValue } from '../utils/time';

describe('formatTime', () => {
  it('零秒应返回 "00:00:00"', () => {
    expect(formatTime(0)).toBe('00:00:00');
  });

  it('仅秒数 < 60', () => {
    expect(formatTime(7)).toBe('00:00:07');
    expect(formatTime(59)).toBe('00:00:59');
  });

  it('仅分钟数 < 3600', () => {
    expect(formatTime(60)).toBe('00:01:00');
    expect(formatTime(3599)).toBe('00:59:59');
  });

  it('包含小时', () => {
    expect(formatTime(3600)).toBe('01:00:00');
    expect(formatTime(3661)).toBe('01:01:01');
    expect(formatTime(86399)).toBe('23:59:59');
  });

  it('边界值', () => {
    expect(formatTime(1)).toBe('00:00:01');
    expect(formatTime(10)).toBe('00:00:10');
    expect(formatTime(100)).toBe('00:01:40');
  });
});

describe('formatDuration', () => {
  it('零秒应返回 "0秒"', () => {
    expect(formatDuration(0)).toBe('0秒');
  });

  it('仅秒数', () => {
    expect(formatDuration(30)).toBe('30秒');
    expect(formatDuration(59)).toBe('59秒');
  });

  it('分钟+秒', () => {
    expect(formatDuration(60)).toBe('1分钟 0秒');
    expect(formatDuration(90)).toBe('1分钟 30秒');
    expect(formatDuration(3599)).toBe('59分钟 59秒');
  });

  it('小时+分钟+秒', () => {
    expect(formatDuration(3600)).toBe('1小时 0分钟 0秒');
    expect(formatDuration(3661)).toBe('1小时 1分钟 1秒');
    expect(formatDuration(7200)).toBe('2小时 0分钟 0秒');
  });
});

describe('formatTimeValue', () => {
  it('零秒返回默认单位 "分钟"', () => {
    expect(formatTimeValue(0)).toEqual({ value: '0', unit: '分钟' });
  });

  it('秒级 (< 60)', () => {
    expect(formatTimeValue(30)).toEqual({ value: '30', unit: '秒' });
    expect(formatTimeValue(59)).toEqual({ value: '59', unit: '秒' });
  });

  it('分钟级 (60 ~ 3599)', () => {
    expect(formatTimeValue(60)).toEqual({ value: '1.0', unit: '分钟' });
    expect(formatTimeValue(90)).toEqual({ value: '1.5', unit: '分钟' });
    expect(formatTimeValue(3599)).toEqual({ value: '60.0', unit: '分钟' });
  });

  it('小时级 (>= 3600)', () => {
    expect(formatTimeValue(3600)).toEqual({ value: '1.00', unit: '小时' });
    expect(formatTimeValue(7200)).toEqual({ value: '2.00', unit: '小时' });
    expect(formatTimeValue(9000)).toEqual({ value: '2.50', unit: '小时' });
  });
});
