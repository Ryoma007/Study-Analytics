import React from 'react';
import { ActivityType, ACTIVITY_TYPES, activityTypeFromValue } from '../../enums/ActivityType';
import { getActivityConfig } from '../../config/activityConfig';
import type { ActivitySession } from '@study-analytics/shared';
import { X } from 'lucide-react';

/**
 * 添加/编辑记录表单弹窗组件
 * 从 HistoryPage 提取，通过 props 控制表单数据和回调
 */
export interface SessionFormData {
  date: string;
  startTime: string;
  endTime: string;
  content: string;
  type: ActivityType;
}

interface SessionFormModalProps {
  /** 编辑中的 session（null 表示手动添加模式） */
  editingSession: ActivitySession | null;
  /** 表单数据 */
  formData: SessionFormData;
  /** 表单字段变更回调 */
  onFormChange: (data: SessionFormData) => void;
  /** 保存回调 */
  onSave: () => void;
  /** 关闭回调 */
  onClose: () => void;
}

export function SessionFormModal({ editingSession, formData, onFormChange, onSave, onClose }: SessionFormModalProps) {
  /** 将字符串转为 ActivityType（兜底 STUDY） */
  const parseType = (value: string): ActivityType => activityTypeFromValue(value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">
            {editingSession ? '编辑记录' : '手动添加记录'}
          </h3>
          <button
            onClick={onClose}
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
              value={formData.type}
              onChange={(e) => onFormChange({ ...formData, type: parseType(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              {ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {getActivityConfig(type).label}
                </option>
              ))}
            </select>
          </div>

          {/* 日期 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">日期</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => onFormChange({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* 时间范围 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">开始时间</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => onFormChange({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">结束时间</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => onFormChange({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 内容描述 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">内容描述</label>
            <textarea
              value={formData.content}
              onChange={(e) => onFormChange({ ...formData, content: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              placeholder="记录一下..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
