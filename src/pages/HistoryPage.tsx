import React, { useState } from 'react';
import { useStudyStore } from '../store';
import { format } from 'date-fns';
import { Trash2, CheckSquare, Square } from 'lucide-react';

export function HistoryPage() {
  const { sessions, deleteSessions } = useStudyStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sessions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sessions.map((s) => s.id));
    }
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`确定要删除这 ${selectedIds.length} 条记录吗？`)) {
      deleteSessions(selectedIds);
      setSelectedIds([]);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}小时 ${m}分钟 ${s}秒`;
    if (m > 0) return `${m}分钟 ${s}秒`;
    return `${s}秒`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">学习历史</h2>
        {selectedIds.length > 0 && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors font-medium text-sm"
          >
            <Trash2 className="w-4 h-4" />
            删除选中 ({selectedIds.length})
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            暂无学习记录。开始学习吧！
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm font-medium uppercase tracking-wider">
                <th className="p-4 w-12 text-center">
                  <button onClick={toggleSelectAll} className="hover:text-indigo-600 transition-colors">
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
                      onClick={() => toggleSelect(session.id)}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
