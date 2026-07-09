import React, { useMemo, useState } from 'react';
import type { ActivitySession } from '../store';
import { ActivityType } from '../enums/ActivityType';
import {
  subDays,
  isSameDay,
  startOfDay,
  eachDayOfInterval,
  subMonths,
  startOfMonth,
  isSameMonth,
  eachMonthOfInterval,
  format,
} from 'date-fns';
import { formatTimeValue, type FormattedTime } from '../utils/time';

/** 图表数据点结构 */
export interface ChartDataPoint {
  label: string;
  study: number;
  reading: number;
}

/** 统计计算结果的完整结构 */
export interface StatisticsData {
  chartData: ChartDataPoint[];
  chartUnit: string;
  studyTotal: FormattedTime;
  readingTotal: FormattedTime;
  studyAvg: FormattedTime;
  readingAvg: FormattedTime;
  studyDays: number;
  readingDays: number;
  totalDaysInRange: number;
}

/** useStatistics hook 返回值接口 */
export interface UseStatisticsReturn {
  stats: StatisticsData;
  rangeType: '7' | '14' | '30' | 'year';
  setRangeType: React.Dispatch<React.SetStateAction<'7' | '14' | '30' | 'year'>>;
}

/**
 * 统计数据计算 hook
 * 通过参数注入 sessions，不直接访问 store，便于测试
 */
export function useStatistics(sessions: ActivitySession[]): UseStatisticsReturn {
  const [rangeType, setRangeType] = useState<'7' | '14' | '30' | 'year'>('7');

  const stats = useMemo(() => {
    const today = startOfDay(new Date());

    // 按类型拆分数据
    const studySessions = sessions.filter((s) => s.type === ActivityType.STUDY);
    const readingSessions = sessions.filter((s) => s.type === ActivityType.READING);

    let chartDataRaw: { label: string; studySeconds: number; readingSeconds: number }[] = [];
    let startDate: Date;
    let totalDaysInRange: number;

    if (rangeType === 'year') {
      startDate = startOfMonth(subMonths(today, 11));
      totalDaysInRange = 365;
      const monthRange = eachMonthOfInterval({ start: startDate, end: today });

      chartDataRaw = monthRange.map((month) => {
        const studyTotal = studySessions
          .filter((s) => isSameMonth(new Date(s.startTime), month))
          .reduce((acc, curr) => acc + curr.duration, 0);
        const readingTotal = readingSessions
          .filter((s) => isSameMonth(new Date(s.startTime), month))
          .reduce((acc, curr) => acc + curr.duration, 0);
        return {
          label: format(month, 'yy年M月'),
          studySeconds: studyTotal,
          readingSeconds: readingTotal,
        };
      });
    } else {
      const days = parseInt(rangeType);
      startDate = subDays(today, days - 1);
      totalDaysInRange = days;
      const dateRange = eachDayOfInterval({ start: startDate, end: today });

      chartDataRaw = dateRange.map((date) => {
        const studyTotal = studySessions
          .filter((s) => isSameDay(new Date(s.startTime), date))
          .reduce((acc, curr) => acc + curr.duration, 0);
        const readingTotal = readingSessions
          .filter((s) => isSameDay(new Date(s.startTime), date))
          .reduce((acc, curr) => acc + curr.duration, 0);
        return {
          label: format(date, 'M月d日'),
          studySeconds: studyTotal,
          readingSeconds: readingTotal,
        };
      });
    }

    // 根据两类型全局最大值选择图表单位
    const maxSeconds = Math.max(
      ...chartDataRaw.map((d) => Math.max(d.studySeconds, d.readingSeconds))
    );
    let chartUnit: string;
    let divisor: number;
    let decimals: number;

    if (maxSeconds >= 3600) {
      chartUnit = '小时';
      divisor = 3600;
      decimals = 2;
    } else if (maxSeconds >= 60) {
      chartUnit = '分钟';
      divisor = 60;
      decimals = 1;
    } else {
      chartUnit = '秒';
      divisor = 1;
      decimals = 0;
    }

    // 转换图表数据
    const chartData: ChartDataPoint[] = chartDataRaw.map((d) => ({
      label: d.label,
      study: Number((d.studySeconds / divisor).toFixed(decimals)),
      reading: Number((d.readingSeconds / divisor).toFixed(decimals)),
    }));

    // 计算各类型汇总数据
    const recentFilter = (s: { startTime: number }) => new Date(s.startTime) >= startDate;

    const studyTotalSeconds = studySessions.filter(recentFilter).reduce((acc, curr) => acc + curr.duration, 0);
    const readingTotalSeconds = readingSessions.filter(recentFilter).reduce((acc, curr) => acc + curr.duration, 0);

    // 活动天数（去重计数）
    const countDays = (sessionsList: typeof sessions) =>
      sessionsList
        .filter(recentFilter)
        .reduce((acc, curr) => {
          const day = format(new Date(curr.startTime), 'yyyy-MM-dd');
          if (!acc.includes(day)) acc.push(day);
          return acc;
        }, [] as string[]).length;

    return {
      chartData,
      chartUnit,
      studyTotal: formatTimeValue(studyTotalSeconds),
      readingTotal: formatTimeValue(readingTotalSeconds),
      studyAvg: formatTimeValue(studyTotalSeconds / totalDaysInRange),
      readingAvg: formatTimeValue(readingTotalSeconds / totalDaysInRange),
      studyDays: countDays(studySessions),
      readingDays: countDays(readingSessions),
      totalDaysInRange,
    };
  }, [sessions, rangeType]);

  return { stats, rangeType, setRangeType };
}
