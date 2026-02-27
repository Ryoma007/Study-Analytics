import React, { useMemo, useState } from 'react';
import { useStudyStore } from '../store';
import { 
  format, 
  subDays, 
  isSameDay, 
  startOfDay, 
  eachDayOfInterval, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  isSameMonth, 
  eachMonthOfInterval 
} from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Calendar, Clock, Target } from 'lucide-react';

export function StatisticsPage() {
  const { sessions } = useStudyStore();
  const [rangeType, setRangeType] = useState<'7' | '14' | '30' | 'year'>('7');

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    let chartDataRaw: { label: string; totalSeconds: number; hasStudied: boolean }[] = [];
    let startDate: Date;
    let totalDaysInRange: number;

    if (rangeType === 'year') {
      startDate = startOfMonth(subMonths(today, 11));
      totalDaysInRange = 365; // Approximate for averaging
      const monthRange = eachMonthOfInterval({ start: startDate, end: today });
      
      chartDataRaw = monthRange.map(month => {
        const monthSessions = sessions.filter(s => isSameMonth(new Date(s.startTime), month));
        const totalSeconds = monthSessions.reduce((acc, curr) => acc + curr.duration, 0);
        return {
          label: format(month, 'yy年M月'),
          totalSeconds,
          hasStudied: totalSeconds > 0
        };
      });
    } else {
      const days = parseInt(rangeType);
      startDate = subDays(today, days - 1);
      totalDaysInRange = days;
      const dateRange = eachDayOfInterval({ start: startDate, end: today });
      
      chartDataRaw = dateRange.map(date => {
        const daySessions = sessions.filter(s => isSameDay(new Date(s.startTime), date));
        const totalSeconds = daySessions.reduce((acc, curr) => acc + curr.duration, 0);
        return {
          label: format(date, 'M月d日'),
          totalSeconds,
          hasStudied: totalSeconds > 0
        };
      });
    }

    // Determine the appropriate unit for the chart based on the maximum value
    const maxSeconds = Math.max(...chartDataRaw.map(d => d.totalSeconds));
    let chartUnit = '秒';
    let chartDataKey = 'durationSeconds';
    
    if (maxSeconds >= 3600) {
      chartUnit = '小时';
      chartDataKey = 'durationHours';
    } else if (maxSeconds >= 60) {
      chartUnit = '分钟';
      chartDataKey = 'durationMinutes';
    }

    const chartData = chartDataRaw.map(d => {
      let value = d.totalSeconds;
      if (chartUnit === '小时') {
        value = Number((d.totalSeconds / 3600).toFixed(2));
      } else if (chartUnit === '分钟') {
        value = Number((d.totalSeconds / 60).toFixed(1));
      }
      return {
        label: d.label,
        [chartDataKey]: value,
        hasStudied: d.hasStudied
      };
    });

    const totalSecondsInRange = sessions
      .filter(s => new Date(s.startTime) >= startDate)
      .reduce((acc, curr) => acc + curr.duration, 0);

    const daysStudied = rangeType === 'year' 
      ? sessions.filter(s => new Date(s.startTime) >= startDate).reduce((acc, curr) => {
          const day = format(new Date(curr.startTime), 'yyyy-MM-dd');
          if (!acc.includes(day)) acc.push(day);
          return acc;
        }, [] as string[]).length
      : chartData.filter(d => d.hasStudied).length;

    const formatTimeValue = (seconds: number) => {
      if (seconds === 0) return { value: '0', unit: '分钟' };
      if (seconds < 60) return { value: Math.round(seconds).toString(), unit: '秒' };
      if (seconds < 3600) return { value: (seconds / 60).toFixed(1), unit: '分钟' };
      return { value: (seconds / 3600).toFixed(2), unit: '小时' };
    };

    const avgSecondsPerDay = totalSecondsInRange / totalDaysInRange;

    return {
      chartData,
      chartUnit,
      chartDataKey,
      totalTime: formatTimeValue(totalSecondsInRange),
      avgTime: formatTimeValue(avgSecondsPerDay),
      daysStudied,
      totalDaysInRange
    };
  }, [sessions, rangeType]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">学习统计</h2>
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
          {(['7', '14', '30', 'year'] as const).map(range => (
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">总时长</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalTime.value} <span className="text-base font-normal text-slate-500">{stats.totalTime.unit}</span></p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">日均时长</p>
            <p className="text-2xl font-bold text-slate-800">{stats.avgTime.value} <span className="text-base font-normal text-slate-500">{stats.avgTime.unit}</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">学习天数</p>
            <p className="text-2xl font-bold text-slate-800">{stats.daysStudied} <span className="text-base font-normal text-slate-500">/ {stats.totalDaysInRange}</span></p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">学习时长（{stats.chartUnit}）</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar 
                dataKey={stats.chartDataKey} 
                name="学习时长"
                fill="#6366f1" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
