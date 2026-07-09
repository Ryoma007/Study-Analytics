import React, { useState } from 'react';
import { useActivityStore, type ActivitySession } from '../store';
import { getActivityConfig } from '../config/activityConfig';
import { format } from 'date-fns';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SessionTable } from '../components/HistoryPage/SessionTable';
import { SessionFormModal, type SessionFormData } from '../components/HistoryPage/SessionFormModal';
import { DeleteConfirmDialog } from '../components/HistoryPage/DeleteConfirmDialog';

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

  const [formData, setFormData] = useState<SessionFormData>({
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

  const emptyText = getActivityConfig(currentType).copy.emptyHistory;

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
          {getActivityConfig(currentType).copy.historyTitle}
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

      {/* 表格 */}
      <SessionTable
        sessions={filteredSessions}
        selectedIds={selectedIds}
        emptyText={emptyText}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onEdit={handleEdit}
      />

      {/* 添加/编辑弹窗 */}
      {isModalOpen && (
        <SessionFormModal
          editingSession={editingSession}
          formData={formData}
          onFormChange={setFormData}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* 删除确认弹窗 */}
      {isDeleteConfirmOpen && (
        <DeleteConfirmDialog
          count={selectedIds.length}
          onConfirm={confirmDelete}
          onCancel={() => setIsDeleteConfirmOpen(false)}
        />
      )}
    </div>
  );
}
