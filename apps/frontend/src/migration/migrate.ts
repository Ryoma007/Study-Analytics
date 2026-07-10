/**
 * 旧数据迁移模块 —— 本地 IndexedDB → 后端单向漏斗
 *
 * 应用首次连接后端时触发：
 * 1. 读取本地 IndexedDB 旧数据（新旧 key + localStorage 兼容）
 * 2. POST /api/sessions/migrate 上传
 * 3. 仅在后端返回合并成功计数后才清空本地
 * 4. 失败保留本地，下次重试
 */
import { get, del } from 'idb-keyval';
import { api } from '../api/client';
import { toast } from 'sonner';
import type { ActivitySession } from '@study-analytics/shared';
import type { MigrateResponse } from '@study-analytics/shared';

// 存储 key 常量
const STORAGE_KEY = 'activity_sessions_storage';
const LEGACY_STORAGE_KEY = 'study_sessions_storage';
const LOCAL_STORAGE_KEY = 'study_sessions';

/**
 * 从 IndexedDB 读取旧数据（兼容新旧 key + localStorage）
 * @returns 解析后的 sessions 数组和 currentType
 */
async function readLegacyData(): Promise<{
  sessions: ActivitySession[];
  currentType: string | undefined;
}> {
  let rawData: string | null = null;

  // 先尝试新 key
  rawData = await get(STORAGE_KEY);

  // 兼容旧 key
  if (!rawData) {
    rawData = await get(LEGACY_STORAGE_KEY);
  }

  // 兼容 localStorage
  if (!rawData) {
    const legacy = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (legacy) {
      rawData = legacy;
    }
  }

  if (!rawData) {
    return { sessions: [], currentType: undefined };
  }

  // 解析 Zustand persist 格式
  try {
    const parsed = JSON.parse(rawData);
    // Zustand persist 格式: { state: { sessions, currentType, ... }, version }
    if (parsed && typeof parsed === 'object') {
      const state = parsed.state ?? parsed;
      return {
        sessions: Array.isArray(state?.sessions) ? state.sessions : [],
        currentType: typeof state?.currentType === 'string' ? state.currentType : undefined,
      };
    }
  } catch {
    // JSON 解析失败
  }

  return { sessions: [], currentType: undefined };
}

/**
 * 清空本地 IndexedDB 旧数据（迁移成功后调用）
 */
async function clearLegacyData(): Promise<void> {
  await del(STORAGE_KEY);
  await del(LEGACY_STORAGE_KEY);
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

/**
 * 执行旧数据迁移（单向漏斗：本地 → 后端）
 * @returns 合并条数（无数据或失败返回 0）
 */
export async function migrateLegacyData(): Promise<number> {
  const { sessions, currentType } = await readLegacyData();

  // 无旧数据，跳过
  if (sessions.length === 0) {
    return 0;
  }

  try {
    const result = await api.post<MigrateResponse>('/sessions/migrate', {
      sessions,
      currentType,
    });

    // 仅在后端确认合并成功后清空本地
    if (result.mergedCount > 0) {
      await clearLegacyData();
      toast.success(`旧数据迁移完成，共合并 ${result.mergedCount} 条记录`);
    }

    return result.mergedCount;
  } catch {
    // 迁移失败，保留本地数据下次重试
    toast.error('旧数据迁移失败，将在下次连接时重试');
    return 0;
  }
}
