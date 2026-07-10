import React from 'react';
import { ActivityType, ACTIVITY_TYPES } from '@study-analytics/shared';
import { getActivityConfig } from '../config/activityConfig';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Calendar, Clock, Target } from 'lucide-react';
import { useStatistics } from '../hooks/useStatistics';
import { StatTooltip } from '../components/StatTooltip';
import type { FormattedTime } from '@study-analytics/shared';

export function StatisticsPage() {
  const { stats, rangeType, setRangeType, isLoading } = useStatistics();

  // 渲染单个统计卡片行（带颜色圆点）
  const renderStatRow = (label: string, time: FormattedTime, color: string) => (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-lg font-bold text-slate-800 ml-auto">
        {time.value}{' '}
        <span className="text-sm font-normal text-slate-500">{time.unit}</span>
      </span>
    </div>
  );

  /** 渲染天数统计行 */
  const renderDaysRow = (label: string, days: number, color: string) => (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-lg font-bold text-slate-800 ml-auto">
        {days}{' '}
        <span className="text-sm font-normal text-slate-500">/ {stats.totalDaysInRange} 天</span>
      </span>
    </div>
  );

  // 构建类型 → 统计值的映射（驱动卡片行渲染）
  const typeStatsMap = {
    [ActivityType.STUDY]: {
      total: stats.studyTotal,
      avg: stats.studyAvg,
      days: stats.studyDays,
    },
    [ActivityType.READING]: {
      total: stats.readingTotal,
      avg: stats.readingAvg,
      days: stats.readingDays,
    },
  };

  return (
    <div className="space-y-8">
      {/* 标题和时间范围选择 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">数据统计</h2>
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
          {(['7', '14', '30', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setRangeType(range)}
              disabled={isLoading}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                rangeType === range
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {range === 'year' ? '近一年' : `${range} 天`}
            </button>
          ))}
        </div>
      </div>

      {/* 统计卡片（拆分显示） */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 总时长卡片 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">总时长</p>
          </div>
          <div className="space-y-2">
            {ACTIVITY_TYPES.map((type) => {
              const cfg = getActivityConfig(type);
              return renderStatRow(cfg.label, typeStatsMap[type].total, cfg.color.hex);
            })}
          </div>
        </div>

        {/* 日均时长卡片 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Target className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">日均时长</p>
          </div>
          <div className="space-y-2">
            {ACTIVITY_TYPES.map((type) => {
              const cfg = getActivityConfig(type);
              return renderStatRow(cfg.label, typeStatsMap[type].avg, cfg.color.hex);
            })}
          </div>
        </div>

        {/* 活动天数卡片 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">活动天数</p>
          </div>
          <div className="space-y-2">
            {ACTIVITY_TYPES.map((type) => {
              const cfg = getActivityConfig(type);
              return renderDaysRow(cfg.label, typeStatsMap[type].days, cfg.color.hex);
            })}
          </div>
        </div>
      </div>

      {/* 分组柱状图 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">时长（{stats.chartUnit}）</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stats.chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                allowDecimals={stats.chartUnit !== '秒'}
              />
              <Tooltip content={<StatTooltip chartUnit={stats.chartUnit} />} cursor={{ fill: '#f1f5f9' }} />
              <Legend
                wrapperStyle={{ paddingTop: '12px' }}
                iconType="rect"
              />
              <Bar
                dataKey="study"
                name={getActivityConfig(ActivityType.STUDY).label}
                fill={getActivityConfig(ActivityType.STUDY).color.hex}
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
              <Bar
                dataKey="reading"
                name={getActivityConfig(ActivityType.READING).label}
                fill={getActivityConfig(ActivityType.READING).color.hex}
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
