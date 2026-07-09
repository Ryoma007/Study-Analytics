/**
 * 时间格式化工具函数集
 * 将三个页面中重复的时间格式化逻辑集中管理
 */

/** 自适应时间格式化返回值 */
export interface FormattedTime {
  value: string;
  unit: string;
}

/**
 * 格式化为 HH:MM:SS 格式（计时器使用）
 * @param seconds 秒数
 * @returns 格式化的时间字符串 "00:00:00"
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 格式化为中文可读格式（历史记录列表使用）
 * @param seconds 秒数
 * @returns 如 "1小时 1分钟 1秒" 或 "30分钟 0秒"
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}小时 ${m}分钟 ${s}秒`;
  if (m > 0) return `${m}分钟 ${s}秒`;
  return `${s}秒`;
}

/**
 * 自适应单位格式化（统计页面使用）
 * >= 3600 秒用小时，>= 60 秒用分钟，否则用秒
 * @param seconds 秒数
 * @returns 包含数值字符串和单位的对象
 */
export function formatTimeValue(seconds: number): FormattedTime {
  if (seconds === 0) return { value: '0', unit: '分钟' };
  if (seconds < 60) return { value: Math.round(seconds).toString(), unit: '秒' };
  if (seconds < 3600) return { value: (seconds / 60).toFixed(1), unit: '分钟' };
  return { value: (seconds / 3600).toFixed(2), unit: '小时' };
}
