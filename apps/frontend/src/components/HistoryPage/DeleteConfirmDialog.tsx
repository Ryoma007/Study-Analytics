import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * 删除确认弹窗组件
 * 从 HistoryPage 提取，通过 props 控制显示逻辑
 */
interface DeleteConfirmDialogProps {
  /** 待删除记录数 */
  count: number;
  /** 确认删除回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

export function DeleteConfirmDialog({ count, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-800">确认删除</h3>
            <p className="text-slate-500 text-sm">
              确定要删除这 {count} 条记录吗？此操作无法撤销。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
