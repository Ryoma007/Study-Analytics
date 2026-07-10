/**
 * useStatistics —— 统计数据薄壳
 *
 * 阶段3 重写：删除本地 reduce 聚合逻辑，改为调后端 GET /api/statistics 取数据。
 * 前端仅按 currentType 筛选展示。
 */
import React, { useState } from 'react';
import type { RangeType, StatisticsData, FormattedTime, ChartDataPoint } from '@study-analytics/shared';
import { useStatistics as useStatisticsQuery } from '../api/hooks';

/** useStatistics hook 返回值接口 */
export interface UseStatisticsReturn {
  stats: StatisticsData;
  rangeType: RangeType;
  setRangeType: React.Dispatch<React.SetStateAction<RangeType>>;
  /** 是否正在加载 */
  isLoading: boolean;
}

/** 空统计数据（加载中或错误时的兜底） */
const EMPTY_STATS: StatisticsData = {
  chartData: [],
  chartUnit: '分钟',
  studyTotal: { value: '0', unit: '分钟' },
  readingTotal: { value: '0', unit: '分钟' },
  studyAvg: { value: '0', unit: '分钟' },
  readingAvg: { value: '0', unit: '分钟' },
  studyDays: 0,
  readingDays: 0,
  totalDaysInRange: 0,
};

/**
 * 统计数据取数据薄壳 hook
 */
export function useStatistics(): UseStatisticsReturn {
  const [rangeType, setRangeType] = useState<RangeType>('7');
  const { data, isLoading } = useStatisticsQuery(rangeType);

  return {
    stats: data ?? EMPTY_STATS,
    rangeType,
    setRangeType,
    isLoading,
  };
}

// 重新导出共享类型（兼容旧引用）
export type { StatisticsData, ChartDataPoint, FormattedTime };
