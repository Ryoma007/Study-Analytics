import React, { useMemo, useState } from 'react';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import {
  format,
  subDays,
  isSameDay,
  startOfDay,
  eachDayOfInterval,
  subMonths,
  startOfMonth,
  isSameMonth,
  eachMonthOfInterval,
} from 'date-fns';
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

// 图表颜色常量
const STUDY_COLOR = '#6366f1'; // indigo-500
const READING_COLOR = '#059669'; // emerald-600

/** 图表数据点结构 */
interface ChartDataPoint {
  label: string;
  study: number;
  reading: number;
}

/** 格式化时间值的返回结构 */
interface FormattedTime {
  value: string;
  unit: string;
}

/**
 * 根据秒数自适应格式化时间值
 * >= 3600 秒用小时，>= 60 秒用分钟，否则用秒
 */
const formatTimeValue = (seconds: number): FormattedTime => {
  if (seconds === 0) return { value: '0', unit: '分钟' };
  if (seconds < 60) return { value: Math.round(seconds).toString(), unit: '秒' };
  if (seconds < 3600) return { value: (seconds / 60).toFixed(1), unit: '分钟' };
  return { value: (seconds / 3600).toFixed(2), unit: '小时' };
};

export function StatisticsPage() {
  const sessions = useActivityStore((s) => s.sessions);
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

    const studyDays = countDays(studySessions);
    const readingDays = countDays(readingSessions);

    // 日均时长
    const studyAvgSeconds = studyTotalSeconds / totalDaysInRange;
    const readingAvgSeconds = readingTotalSeconds / totalDaysInRange;

    return {
      chartData,
      chartUnit,
      studyTotal: formatTimeValue(studyTotalSeconds),
      readingTotal: formatTimeValue(readingTotalSeconds),
      studyAvg: formatTimeValue(studyAvgSeconds),
      readingAvg: formatTimeValue(readingAvgSeconds),
      studyDays,
      readingDays,
      totalDaysInRange,
    };
  }, [sessions, rangeType]);

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

  /** 自定义 Tooltip 组件 */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div
        style={{
          borderRadius: '12px',
          border: 'none',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          background: '#fff',
          padding: '10px 14px',
        }}
      >
        <p className="text-sm font-medium text-slate-600 mb-1">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {entry.value} {stats.chartUnit}
          </p>
        ))}
      </div>
    );
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
            {renderStatRow('学习', stats.studyTotal, STUDY_COLOR)}
            {renderStatRow('阅读', stats.readingTotal, READING_COLOR)}
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
            {renderStatRow('学习', stats.studyAvg, STUDY_COLOR)}
            {renderStatRow('阅读', stats.readingAvg, READING_COLOR)}
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
            {renderDaysRow('学习', stats.studyDays, STUDY_COLOR)}
            {renderDaysRow('阅读', stats.readingDays, READING_COLOR)}
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
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Legend
                wrapperStyle={{ paddingTop: '12px' }}
                iconType="rect"
              />
              <Bar
                dataKey="study"
                name="学习"
                fill={STUDY_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
              <Bar
                dataKey="reading"
                name="阅读"
                fill={READING_COLOR}
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
