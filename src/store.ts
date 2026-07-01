import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { ActivityType } from './enums/ActivityType';

/** 活动记录数据模型 */
export interface ActivitySession {
  id: string;
  /** 活动类型：学习或阅读 */
  type: ActivityType;
  /** 日期，YYYY-MM-DD 格式 */
  date: string;
  /** 开始时间戳（epoch ms） */
  startTime: number;
  /** 结束时间戳（epoch ms） */
  endTime: number;
  /** 时长（秒） */
  duration: number;
  /** 活动内容描述 */
  content: string;
}

/** 旧版数据模型（缺少 type 字段），用于迁移 */
interface LegacySession {
  id: string;
  date: string;
  startTime: number;
  endTime: number;
  duration: number;
  content: string;
}

/** Store 状态接口 */
export interface ActivityState {
  sessions: ActivitySession[];
  /** 当前全局活动类型 */
  currentType: ActivityType;
  /** 计时器是否正在运行（用于类型切换守卫） */
  isTimerRunning: boolean;

  // 操作方法
  addSession: (session: Omit<ActivitySession, 'id'>) => void;
  updateSession: (id: string, session: Partial<Omit<ActivitySession, 'id'>>) => void;
  deleteSessions: (ids: string[]) => void;
  setCurrentType: (type: ActivityType) => void;
  setIsTimerRunning: (running: boolean) => void;
}

// 存储 key 常量
const STORAGE_KEY = 'activity_sessions_storage';
const LEGACY_STORAGE_KEY = 'study_sessions_storage';

/** 检查记录是否缺少 type 字段（旧版数据） */
const isLegacySession = (session: unknown): session is LegacySession => {
  if (!session || typeof session !== 'object') return true;
  const s = session as Record<string, unknown>;
  return s.type === undefined || s.type === null;
};

/** 将旧版记录迁移为新版，缺失 type 默认归为 STUDY */
const migrateSession = (session: LegacySession | ActivitySession): ActivitySession => {
  if (isLegacySession(session)) {
    return {
      ...session,
      type: (session as any).type ?? ActivityType.STUDY,
    } as ActivitySession;
  }
  // enumify 反序列化：将普通对象转换为 ActivityType 实例
  const s = session as ActivitySession & { type: unknown };
  if (typeof s.type === 'object' && s.type !== null && 'enumKey' in s.type) {
    const typeName = (s.type as { enumKey: string }).enumKey;
    try {
      // enumValueOf 对无效 key 返回 undefined（不抛异常），需 || 兜底
      s.type = ActivityType.enumValueOf(typeName) || ActivityType.STUDY;
    } catch {
      s.type = ActivityType.STUDY;
    }
  }
  return s;
};

/**
 * 自定义 persist merge 函数
 * 将水化后的普通对象恢复为 Enumify 实例
 * createJSONStorage 的 JSON.parse 会将 ActivityType 实例变为 {enumKey: "X"}
 * 此函数在 persist 合并阶段将其恢复为真正的 ActivityType 实例
 */
export const activityMerge = (
  persisted: Partial<ActivityState> | null | undefined,
  current: ActivityState
): ActivityState => {
  // persisted 为 null/undefined 时使用初始值兜底
  if (!persisted || typeof persisted !== 'object') {
    return current;
  }

  // 标准合并：persisted 覆盖 current
  const merged = { ...current, ...persisted } as ActivityState;

  // --- 恢复 currentType ---
  const rawType = (persisted as Record<string, unknown>).currentType;
  if (rawType && typeof rawType === 'object' && !(rawType instanceof ActivityType)) {
    const enumKey = (rawType as Record<string, unknown>).enumKey;
    if (typeof enumKey === 'string') {
      try {
        // enumValueOf 对无效 key 返回 undefined（不抛异常），需 || 兜底
        merged.currentType = ActivityType.enumValueOf(enumKey) || ActivityType.STUDY;
      } catch {
        merged.currentType = ActivityType.STUDY;
      }
    } else {
      merged.currentType = ActivityType.STUDY;
    }
  } else if (!rawType) {
    // persisted 中无 currentType（首次访问或新字段），使用 current 的值
    merged.currentType = current.currentType;
  }
  // else: rawType 已经是 ActivityType 实例，保持不变

  // --- 恢复 sessions[].type ---
  if (Array.isArray(merged.sessions)) {
    merged.sessions = merged.sessions.map(migrateSession);
  }

  // --- isTimerRunning 默认值 ---
  if (merged.isTimerRunning === undefined || merged.isTimerRunning === null) {
    merged.isTimerRunning = false;
  }

  return merged;
};

/** 自定义 IndexedDB 存储引擎 */
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // 先尝试读新 key
    let data = await get(name);
    // 兼容旧 key
    if (!data && name === STORAGE_KEY) {
      data = await get(LEGACY_STORAGE_KEY);
    }
    // 兼容 localStorage 中的旧格式数据
    if (!data) {
      const legacyData = localStorage.getItem('study_sessions');
      if (legacyData) {
        try {
          const parsed = JSON.parse(legacyData);
          if (Array.isArray(parsed)) {
            // 为旧数据补充 type 字段
            const migrated = parsed.map(migrateSession);
            const zustandState = JSON.stringify({
              state: { sessions: migrated, currentType: ActivityType.STUDY, isTimerRunning: false },
              version: 0,
            });
            await set(name, zustandState);
            localStorage.removeItem('study_sessions');
            return zustandState;
          }
        } catch {
          // 忽略解析错误
        }
      }
      return null;
    }
    return data;
  },

  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },

  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

/** 活动记录 store（Zustand + IndexedDB 持久化） */
export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      sessions: [],
      currentType: ActivityType.STUDY,
      isTimerRunning: false,

      /** 添加一条活动记录 */
      addSession: (session) => {
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).substring(2);
        const newSession = { ...session, id };
        set((state) => ({ sessions: [newSession, ...state.sessions] }));
      },

      /** 更新一条活动记录 */
      updateSession: (id, sessionUpdate) => {
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...sessionUpdate } : s)),
        }));
      },

      /** 批量删除活动记录 */
      deleteSessions: (ids) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => !ids.includes(s.id)),
        }));
      },

      /** 切换全局活动类型（计时器运行中时禁止切换） */
      setCurrentType: (type) => {
        set((state) => {
          if (state.isTimerRunning) {
            // 计时器运行中，忽略切换请求
            return {};
          }
          return { currentType: type };
        });
      },

      /** 设置计时器运行状态 */
      setIsTimerRunning: (running) => {
        set({ isTimerRunning: running });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => idbStorage),
      merge: activityMerge,
    }
  )
);

// 兼容旧版导出，向后兼容
export type StudySession = ActivitySession;
