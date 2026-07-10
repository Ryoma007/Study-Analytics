/**
 * 统计聚合测试 —— :memory: SQLite
 * 注入 now() 固定时间，避免依赖系统时钟
 */
import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db';
import { StatisticsService } from '../src/services/statistics';
import { SessionsService } from '../src/services/sessions';
import { ActivityType } from '@study-analytics/shared';

// 固定 now：2026-07-09 12:00 本地时间 → 用其 ms
const NOW = new Date(2026, 6, 9, 12, 0, 0).getTime();

function setup() {
  const db = createDb(':memory:');
  return { db, stats: new StatisticsService(db), sessions: new SessionsService(db) };
}

/** 插入一条记录：offsetDays 相对今天，type，durationSec */
function insert(sessions: SessionsService, offsetDays: number, type: ActivityType, durationSec: number) {
  const dayStart = new Date(new Date(NOW).getFullYear(), new Date(NOW).getMonth(), new Date(NOW).getDate() - offsetDays, 10);
  const start = dayStart.getTime();
  sessions.create({
    type,
    date: `${dayStart.getFullYear()}-${pad(dayStart.getMonth() + 1)}-${pad(dayStart.getDate())}`,
    startTime: start,
    endTime: start + durationSec * 1000,
    duration: durationSec,
    content: '',
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

describe('StatisticsService - 7 天范围', () => {
  it('按天聚合两类型，补齐 7 天', () => {
    const { sessions, stats } = setup();
    insert(sessions, 0, ActivityType.STUDY, 60); // 今天学习 60s
    insert(sessions, 0, ActivityType.READING, 120); // 今天阅读 120s
    insert(sessions, 5, ActivityType.STUDY, 30); // 5 天前学习 30s

    const r = stats.getStatistics('7', NOW);
    expect(r.totalDaysInRange).toBe(7);
    expect(r.chartData).toHaveLength(7);
    // 最后一项是今天
    const today = r.chartData[6];
    expect(today.study).toBe(1); // 60s = 1 分钟
    expect(today.reading).toBe(2); // 120s = 2 分钟
    // 5 天前 = 第 2 项（index 1）
    expect(r.chartData[1].study).toBe(0.5); // 30s = 0.5 分钟
  });

  it('汇总总时长、日均、活动天数', () => {
    const { sessions, stats } = setup();
    insert(sessions, 0, ActivityType.STUDY, 60);
    insert(sessions, 2, ActivityType.STUDY, 120);
    insert(sessions, 5, ActivityType.READING, 3600);

    const r = stats.getStatistics('7', NOW);
    // study 总 = 180s = 3 分钟
    expect(r.studyTotal).toEqual({ value: '3.0', unit: '分钟' });
    // reading 总 = 3600s = 1 小时
    expect(r.readingTotal).toEqual({ value: '1.00', unit: '小时' });
    // 日均：study 180/7 ≈ 25.7s → 秒；reading 3600/7 ≈ 514s → 分钟
    expect(r.studyAvg.unit).toBe('秒');
    expect(r.readingAvg.unit).toBe('分钟');
    // 活动天数：study 2 天，reading 1 天
    expect(r.studyDays).toBe(2);
    expect(r.readingDays).toBe(1);
  });
});

describe('StatisticsService - 单位自适应', () => {
  it('最大值 < 60 用秒', () => {
    const { sessions, stats } = setup();
    insert(sessions, 0, ActivityType.STUDY, 30);
    const r = stats.getStatistics('7', NOW);
    expect(r.chartUnit).toBe('秒');
  });

  it('60 <= 最大值 < 3600 用分钟', () => {
    const { sessions, stats } = setup();
    insert(sessions, 0, ActivityType.STUDY, 60);
    const r = stats.getStatistics('7', NOW);
    expect(r.chartUnit).toBe('分钟');
  });

  it('最大值 >= 3600 用小时', () => {
    const { sessions, stats } = setup();
    insert(sessions, 0, ActivityType.STUDY, 3600);
    const r = stats.getStatistics('7', NOW);
    expect(r.chartUnit).toBe('小时');
  });
});

describe('StatisticsService - year 范围', () => {
  it('按月聚合 12 个月', () => {
    const { sessions, stats } = setup();
    // 上个月学习
    const lastMonth = new Date(2026, 5, 15, 10);
    insert(sessions, 0, ActivityType.STUDY, 3600); // 占位让单位非秒
    // 直接插入跨月数据（不用 insert 助手，精确控月）
    sessions.create({
      type: ActivityType.READING,
      date: '2026-06-15',
      startTime: lastMonth.getTime(),
      endTime: lastMonth.getTime() + 7200_000,
      duration: 7200,
      content: '',
    });

    const r = stats.getStatistics('year', NOW);
    expect(r.totalDaysInRange).toBe(365);
    expect(r.chartData).toHaveLength(12);
    // 最后一项是当前月（2026年7月）
    const last = r.chartData[11];
    expect(last.label).toBe('26年7月');
    // 第一项是 12 个月前月初（2025年8月）
    expect(r.chartData[0].label).toBe('25年8月');
    // 6 月（index 10，即 26年6月）应有 reading 数据
    expect(r.chartData[10].reading).toBeGreaterThan(0);
  });
});

describe('StatisticsService - 空数据', () => {
  it('无记录返回全 0，7 天', () => {
    const { stats } = setup();
    const r = stats.getStatistics('7', NOW);
    expect(r.chartData).toHaveLength(7);
    expect(r.studyTotal.value).toBe('0');
    expect(r.studyDays).toBe(0);
  });
});
