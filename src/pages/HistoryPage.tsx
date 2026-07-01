import React, { useState } from 'react';
import { useActivityStore, ActivitySession } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { format } from 'date-fns';
import { Trash2, CheckSquare, Square, Plus, Edit2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function HistoryPage() {
  const sessions = useActivityStore((s) => s.sessions);
  const currentType = useActivityStore((s) => s.currentType);
  const deleteSessions = useActivityStore((s) => s.deleteSessions);
  const addSession = useActivityStore((s) => s.addSession);
  const updateSession = useActivityStore((s) => s.updateSession);

  // 根据当前类型过滤
  const filteredSessions = sessions.filter((s) => s.type === currentType);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ActivitySession | null>(null);

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: format(new Date(), 'HH:mm'),
    endTime: format(new Date(), 'HH:mm'),
    content: '',
    type: currentType,
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSessions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSessions.map((s) => s.id));
    }
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    deleteSessions(selectedIds);
    setSelectedIds([]);
    setIsDeleteConfirmOpen(false);
    toast.success('记录已成功删除');
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}小时 ${m}分钟 ${s}秒`;
    if (m > 0) return `${m}分钟 ${s}秒`;
    return `${s}秒`;
  };

  /** 将字符串转为 ActivityType 实例 */
  const parseType = (value: string): ActivityType => {
    return ActivityType.enumValueOf(value) as ActivityType;
  };

  const handleAdd = () => {
    setEditingSession(null);
    const currentTypeFromStore = useActivityStore.getState().currentType;
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: format(new Date(), 'HH:mm'),
      endTime: format(new Date(), 'HH:mm'),
      content: '',
      type: currentTypeFromStore,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (session: ActivitySession) => {
    setEditingSession(session);
    setFormData({
      date: format(new Date(session.startTime), 'yyyy-MM-dd'),
      startTime: format(new Date(session.startTime), 'HH:mm'),
      endTime: format(new Date(session.endTime), 'HH:mm'),
      content: session.content,
      type: session.type,
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const start = new Date(`${formData.date}T${formData.startTime}`).getTime();
    let end = new Date(`${formData.date}T${formData.endTime}`).getTime();

    if (end < start) {
      // 如果结束时间早于开始时间，假设跨天
      end += 24 * 60 * 60 * 1000;
    }

    const duration = Math.floor((end - start) / 1000);

    if (editingSession) {
      updateSession(editingSession.id, {
        date: formData.date,
        startTime: start,
        endTime: end,
        duration,
        content: formData.content,
        type: formData.type,
      });
      toast.success('记录已更新');
    } else {
      addSession({
        date: formData.date,
        startTime: start,
        endTime: end,
        duration,
        content: formData.content,
        type: formData.type,
      });
      toast.success('记录已添加');
    }
    setIsModalOpen(false);
  };

  // 空状态文案根据类型
  const emptyText = currentType === ActivityType.READING
    ? '暂无阅读记录。开始阅读吧！'
    : '暂无学习记录。开始学习吧！';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
          {currentType === ActivityType.READING ? '阅读历史' : '学习历史'}
        </h2>
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
        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            {emptyText}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm font-medium uppercase tracking-wider">
                <th className="p-4 w-12 text-center">
                  <button onClick={toggleSelectAll} className="hover:text-indigo-600 transition-colors">
                    {selectedIds.length === filteredSessions.length && filteredSessions.length > 0 ? (
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
              {filteredSessions.map((session) => (
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
                {editingSession ? '编辑记录' : '手动添加记录'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 活动类型选择器 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">活动类型</label>
                <select
                  value={formData.type.enumKey}
                  onChange={(e) => setFormData({ ...formData, type: parseType(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="STUDY">学习</option>
                  <option value="READING">阅读</option>
                </select>
              </div>

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
                <label className="block text-sm font-medium text-slate-700 mb-1">内容描述</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="记录一下..."
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

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800">确认删除</h3>
                <p className="text-slate-500 text-sm">
                  确定要删除这 {selectedIds.length} 条记录吗？此操作无法撤销。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
