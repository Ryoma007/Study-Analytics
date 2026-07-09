import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { ActivityType, activityTypeFromValue } from './enums/ActivityType';

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

/**
 * 将旧版 Enumify 序列化格式 {enumKey:"X"} 迁移为纯字符串
 * 新版 ActivityType 是字符串联合类型，无需实例化
 * 无效值直接抛异常，不静默降级
 */
const normalizeType = (rawType: unknown): ActivityType => {
  if (typeof rawType === 'string') return activityTypeFromValue(rawType);
  if (rawType && typeof rawType === 'object' && 'enumKey' in (rawType as Record<string, unknown>)) {
    const key = (rawType as Record<string, unknown>).enumKey;
    if (typeof key === 'string') return activityTypeFromValue(key);
    throw new Error(`无法从对象中提取有效的活动类型 enumKey: ${JSON.stringify(rawType)}`);
  }
  throw new Error(`无法解析活动类型，期望字符串或 {enumKey} 对象，实际: ${typeof rawType} ${JSON.stringify(rawType)}`);
};

/** 将旧版记录迁移为新版，缺失 type 默认归为 STUDY */
const migrateSession = (session: LegacySession | ActivitySession): ActivitySession => {
  const s = session as unknown as Record<string, unknown>;
  if (typeof s.type === 'undefined' || s.type === null) {
    return { ...(s as unknown as ActivitySession), type: ActivityType.STUDY };
  }
  return { ...(s as unknown as ActivitySession), type: normalizeType(s.type) };
};

/**
 * 自定义 persist merge 函数
 * 处理旧版 Enumify 序列化格式的兼容迁移
 * 入参类型对齐 Zustand PersistOptions.merge 的签名（persistedState: unknown）
 */
export const activityMerge = (
  persistedState: unknown,
  currentState: ActivityState
): ActivityState => {
  const persisted = persistedState as Partial<ActivityState> | null | undefined;
  if (!persisted || typeof persisted !== 'object') return currentState;

  const merged = { ...currentState, ...persisted } as ActivityState;

  // 兼容旧版 Enumify 序列化格式 {enumKey:"X"} → 纯字符串
  const rawType = (persisted as Record<string, unknown>).currentType;
  if (rawType !== undefined && rawType !== null) {
    merged.currentType = normalizeType(rawType);
  } else {
    // 缺失或为 null 时使用 currentState 的初始值
    merged.currentType = currentState.currentType;
  }

  if (Array.isArray(merged.sessions)) {
    merged.sessions = merged.sessions.map(migrateSession);
  }

  // 永远重置为 false：isTimerRunning 是计时器组件的瞬态运行状态镜像，
  // 真实运行态（useTimer 的 isRunning）是组件本地 state，刷新即丢失。
  // 若保留持久化的 true，会导致"幽灵运行状态"——UI 未在计时却永久禁用类型切换器。
  // 新会话起始时计时器必然未启动，故强制重置。
  merged.isTimerRunning = false;

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
      // 只持久化 sessions 和 currentType。
      // isTimerRunning 是计时器组件的瞬态运行状态镜像，真实运行态随组件卸载/刷新而丢失，
      // 持久化它会导致"幽灵运行状态"——刷新后 UI 未在计时却因恢复 true 而永久禁用类型切换器。
      partialize: (state) => ({
        sessions: state.sessions,
        currentType: state.currentType,
      }),
    }
  )
);

// 兼容旧版导出，向后兼容
export type StudySession = ActivitySession;
