import React, { useState } from 'react';
import { useStudyStore, StudySession } from '../store';
import { format } from 'date-fns';
import { Trash2, CheckSquare, Square, Plus, Edit2, X } from 'lucide-react';

export function HistoryPage() {
  const { sessions, deleteSessions, addSession, updateSession } = useStudyStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: format(new Date(), 'HH:mm'),
    endTime: format(new Date(), 'HH:mm'),
    content: ''
  });

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

  const handleAdd = () => {
    setEditingSession(null);
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: format(new Date(), 'HH:mm'),
      endTime: format(new Date(), 'HH:mm'),
      content: ''
    });
    setIsModalOpen(true);
  };

  const handleEdit = (session: StudySession) => {
    setEditingSession(session);
    setFormData({
      date: format(new Date(session.startTime), 'yyyy-MM-dd'),
      startTime: format(new Date(session.startTime), 'HH:mm'),
      endTime: format(new Date(session.endTime), 'HH:mm'),
      content: session.content
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const start = new Date(`${formData.date}T${formData.startTime}`).getTime();
    let end = new Date(`${formData.date}T${formData.endTime}`).getTime();
    
    if (end < start) {
      // If end time is before start time, assume it's the next day
      end += 24 * 60 * 60 * 1000;
    }

    const duration = Math.floor((end - start) / 1000);

    if (editingSession) {
      updateSession(editingSession.id, {
        date: formData.date,
        startTime: start,
        endTime: end,
        duration,
        content: formData.content
      });
    } else {
      addSession({
        date: formData.date,
        startTime: start,
        endTime: end,
        duration,
        content: formData.content
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">学习历史</h2>
        <div className="flex gap-3">
          {selectedIds.length > 0 && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors font-medium text-sm"
            >
              <Trash2 className="w-4 h-4" />
              删除选中 ({selectedIds.length})
            </button>
          )}
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            手动添加
          </button>
        </div>
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
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleEdit(session)}
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
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {editingSession ? '编辑学习记录' : '手动添加记录'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">日期</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">开始时间</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">结束时间</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">学习内容</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="记录一下学习了什么..."
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
