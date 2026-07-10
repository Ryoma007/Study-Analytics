import React from 'react';
import type { ActivitySession } from '@study-analytics/shared';
import { format } from 'date-fns';
import { formatDuration } from '../../utils/time';
import { CheckSquare, Square, Edit2 } from 'lucide-react';

/**
 * 活动记录表格组件
 * 从 HistoryPage 提取，负责表格渲染、空状态、选择交互
 * 桌面端用 <table>，移动端用卡片列表（md 断点切换）
 */
interface SessionTableProps {
  /** 过滤后的 session 列表 */
  sessions: ActivitySession[];
  /** 已选中的 session ID 列表 */
  selectedIds: string[];
  /** 空状态提示文案 */
  emptyText: string;
  /** 切换单行选中 */
  onToggleSelect: (id: string) => void;
  /** 切换全选 */
  onToggleSelectAll: () => void;
  /** 编辑按钮回调 */
  onEdit: (session: ActivitySession) => void;
}

export function SessionTable({ sessions, selectedIds, emptyText, onToggleSelect, onToggleSelectAll, onEdit }: SessionTableProps) {
  // 空状态
  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-12 text-center text-slate-500">{emptyText}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* ======== 桌面端表格（md 及以上显示） ======== */}
      <table className="hidden md:table w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm font-medium uppercase tracking-wider">
            <th className="p-4 w-12 text-center">
              <button onClick={onToggleSelectAll} className="hover:text-indigo-600 transition-colors">
                {selectedIds.length === sessions.length && sessions.length > 0 ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>
            </th>
            <th className="p-4">日期</th>
            <th className="p-4">时间</th>
            <th className="p-4">时长</th>
            <th className="p-4">内容</th>
            <th className="p-4 w-20 text-center">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sessions.map((session) => (
            <tr
              key={session.id}
              className={`hover:bg-slate-50 transition-colors ${
                selectedIds.includes(session.id) ? 'bg-indigo-50/50' : ''
              }`}
            >
              <td className="p-4 text-center">
                <button
                  onClick={() => onToggleSelect(session.id)}
                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {selectedIds.includes(session.id) ? (
                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
              </td>
              <td className="p-4 text-slate-800 font-medium">
                {format(new Date(session.startTime), 'yyyy年M月d日')}
              </td>
              <td className="p-4 text-slate-500 text-sm">
                {format(new Date(session.startTime), 'HH:mm')} -{' '}
                {format(new Date(session.endTime), 'HH:mm')}
              </td>
              <td className="p-4 text-indigo-600 font-mono font-medium text-sm">
                {formatDuration(session.duration)}
              </td>
              <td className="p-4 text-slate-600 max-w-xs truncate">
                {session.content}
              </td>
              <td className="p-4 text-center">
                <button
                  onClick={() => onEdit(session)}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="编辑"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ======== 移动端卡片列表（md 以下显示） ======== */}
      <div className="md:hidden divide-y divide-slate-100">
        {/* 移动端全选框 + 计数 */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
          <button
            onClick={onToggleSelectAll}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            {selectedIds.length === sessions.length && sessions.length > 0 ? (
              <CheckSquare className="w-5 h-5 text-indigo-600" />
            ) : (
              <Square className="w-5 h-5" />
            )}
            全选
          </button>
          {selectedIds.length > 0 && (
            <span className="text-xs text-slate-400">已选 {selectedIds.length} 项</span>
          )}
        </div>

        {sessions.map((session) => {
          const isSelected = selectedIds.includes(session.id);
          return (
            <div
              key={session.id}
              className={`px-4 py-3 transition-colors ${
                isSelected ? 'bg-indigo-50/50' : ''
              }`}
            >
              {/* 第一行：复选框 + 日期 + 时长 + 编辑 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => onToggleSelect(session.id)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <span className="text-slate-800 font-medium text-sm truncate">
                    {format(new Date(session.startTime), 'M月d日')}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-indigo-600 font-mono font-medium text-sm">
                    {formatDuration(session.duration)}
                  </span>
                  <button
                    onClick={() => onEdit(session)}
                    className="p-2 md:p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 第二行：时间范围 */}
              <div className="mt-1 ml-7 text-xs text-slate-500">
                {format(new Date(session.startTime), 'HH:mm')} -{' '}
                {format(new Date(session.endTime), 'HH:mm')}
              </div>

              {/* 第三行：内容描述（有内容时才显示） */}
              {session.content && (
                <div className="mt-1 ml-7 text-sm text-slate-600 truncate">
                  {session.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
