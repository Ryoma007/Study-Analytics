/**
 * 统计聚合服务 —— 后端权威计算
 * 按日（7/14/30天）/按月（year）聚合学习+阅读两类型时长
 * 单位自适应基于两类型全局最大值，见 useStatistics 原逻辑
 *
 * 时区：用本地时间按天/月分组（new Date(ms).getDay 等），与前端原有行为一致
 */
import type { Database } from 'better-sqlite3';
import type { StatisticsData, ChartDataPoint, FormattedTime, RangeType } from '@study-analytics/shared';
import { ActivityType } from '@study-analytics/shared';
import type { SessionRow } from '../session-row.js';

/** 统计读取时只关注 type/start_time/duration 三列 */
type StatsRow = Pick<SessionRow, 'type' | 'start_time' | 'duration'>;

export class StatisticsService {
  constructor(private readonly db: Database) {}

  /**
   * 计算指定范围的统计
   * @param range '7' | '14' | '30' | 'year'
   * @param now 当前时间戳（注入便于测试）
   */
  getStatistics(range: RangeType, now: number): StatisticsData {
    const today = startOfDay(now);

    // 查询范围内的所有 sessions（含两类型）
    // 范围起点：year=12 个月前月初；其余=往前 N-1 天
    let startDate: Date;
    let totalDaysInRange: number;
    if (range === 'year') {
      startDate = startOfMonth(subMonths(today, 11));
      totalDaysInRange = 365;
    } else {
      const days = parseInt(range, 10);
      startDate = subDays(today, days - 1);
      totalDaysInRange = days;
    }

    const startMs = startDate.getTime();
    const rows = this.db
      .prepare('SELECT type, start_time, duration FROM sessions WHERE start_time >= ? ORDER BY start_time ASC')
      .all(startMs) as StatsRow[];

    // 按天/月分桶（本地时间）
    const buckets = range === 'year' ? groupByMonth(rows, startDate, today) : groupByDay(rows, startDate, today);

    // 两类型全局最大值 → 决定图表单位
    const maxSeconds = Math.max(...buckets.map((b) => Math.max(b.studySeconds, b.readingSeconds)));
    const { chartUnit, divisor, decimals } = pickUnit(maxSeconds);

    const chartData: ChartDataPoint[] = buckets.map((b) => ({
      label: b.label,
      study: Number((b.studySeconds / divisor).toFixed(decimals)),
      reading: Number((b.readingSeconds / divisor).toFixed(decimals)),
    }));

    // 汇总（范围内）
    const studyTotal = sumByType(rows, ActivityType.STUDY, startMs);
    const readingTotal = sumByType(rows, ActivityType.READING, startMs);

    // 活动天数去重
    const studyDays = countActiveDays(rows, ActivityType.STUDY);
    const readingDays = countActiveDays(rows, ActivityType.READING);

    return {
      chartData,
      chartUnit,
      studyTotal: formatTimeValue(studyTotal),
      readingTotal: formatTimeValue(readingTotal),
      studyAvg: formatTimeValue(studyTotal / totalDaysInRange),
      readingAvg: formatTimeValue(readingTotal / totalDaysInRange),
      studyDays,
      readingDays,
      totalDaysInRange,
    };
  }
}

// ===== 分桶 =====

interface Bucket {
  label: string;
  studySeconds: number;
  readingSeconds: number;
}

/** 按天分桶（本地时间），补齐范围内每一天 */
function groupByDay(rows: StatsRow[], startDate: Date, today: Date): Bucket[] {
  const days = eachDayOfInterval(startDate, today);
  return days.map((date) => {
    const study = rows
      .filter((r) => r.type === ActivityType.STUDY && isSameDay(r.start_time, date))
      .reduce((acc, r) => acc + r.duration, 0);
    const reading = rows
      .filter((r) => r.type === ActivityType.READING && isSameDay(r.start_time, date))
      .reduce((acc, r) => acc + r.duration, 0);
    return {
      label: `${date.getMonth() + 1}月${date.getDate()}日`,
      studySeconds: study,
      readingSeconds: reading,
    };
  });
}

/** 按月分桶（本地时间），补齐 12 个月 */
function groupByMonth(rows: StatsRow[], startDate: Date, today: Date): Bucket[] {
  const months = eachMonthOfInterval(startDate, today);
  return months.map((date) => {
    const study = rows
      .filter((r) => r.type === ActivityType.STUDY && isSameMonth(r.start_time, date))
      .reduce((acc, r) => acc + r.duration, 0);
    const reading = rows
      .filter((r) => r.type === ActivityType.READING && isSameMonth(r.start_time, date))
      .reduce((acc, r) => acc + r.duration, 0);
    return {
      label: `${String(date.getFullYear()).slice(2)}年${date.getMonth() + 1}月`,
      studySeconds: study,
      readingSeconds: reading,
    };
  });
}

// ===== 汇总辅助 =====

function sumByType(rows: StatsRow[], type: string, sinceMs: number): number {
  return rows.filter((r) => r.type === type && r.start_time >= sinceMs).reduce((acc, r) => acc + r.duration, 0);
}

function countActiveDays(rows: StatsRow[], type: string): number {
  const days = new Set<string>();
  for (const r of rows) {
    if (r.type !== type) continue;
    days.add(toLocalDateLabel(r.start_time));
  }
  return days.size;
}

// ===== 单位自适应 =====

function pickUnit(maxSeconds: number): { chartUnit: string; divisor: number; decimals: number } {
  if (maxSeconds >= 3600) return { chartUnit: '小时', divisor: 3600, decimals: 2 };
  if (maxSeconds >= 60) return { chartUnit: '分钟', divisor: 60, decimals: 1 };
  return { chartUnit: '秒', divisor: 1, decimals: 0 };
}

// ===== 时间格式化（汇总用，与前端 formatTimeValue 等价） =====

function formatTimeValue(seconds: number): FormattedTime {
  if (seconds === 0) return { value: '0', unit: '分钟' };
  if (seconds < 60) return { value: Math.round(seconds).toString(), unit: '秒' };
  if (seconds < 3600) return { value: (seconds / 60).toFixed(1), unit: '分钟' };
  return { value: (seconds / 3600).toFixed(2), unit: '小时' };
}

// ===== 日期工具（本地时间，与前端 date-fns 行为对齐） =====

function startOfDay(ms: number): Date {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function subDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - n);
}

function subMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() - n, 1);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function eachDayOfInterval(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function eachMonthOfInterval(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    out.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

function isSameDay(ms: number, date: Date): boolean {
  const d = new Date(ms);
  return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
}

function isSameMonth(ms: number, date: Date): boolean {
  const d = new Date(ms);
  return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
}

function toLocalDateLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
