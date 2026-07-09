import React from 'react';

/**
 * 统计图表自定义 Tooltip 组件
 * 从 StatisticsPage 内联组件提取，chartUnit 通过 props 传入
 */
interface StatTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  /** 图表当前使用的单位（小时/分钟/秒） */
  chartUnit: string;
}

export function StatTooltip({ active, payload, label, chartUnit }: StatTooltipProps) {
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
      {payload.map((entry, idx) => (
        <p key={idx} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value} {chartUnit}
        </p>
      ))}
    </div>
  );
}
