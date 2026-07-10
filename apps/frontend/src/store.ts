/**
 * Zustand store —— 全局状态管理
 * 阶段3 瘦身后仅保留 currentType，持久化到 localStorage
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ActivityType } from '@study-analytics/shared';

/** Store 状态接口 */
export interface ActivityState {
  /** 当前全局活动类型 */
  currentType: ActivityType;

  /** 切换全局活动类型 */
  setCurrentType: (type: ActivityType) => void;
}

// 存储 key 常量
const STORAGE_KEY = 'study_analytics_current_type';

/** 活动记录 store（Zustand + localStorage 持久化） */
export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      currentType: ActivityType.STUDY,

      /** 切换全局活动类型 */
      setCurrentType: (type) => set({ currentType: type }),
    }),
    {
      name: STORAGE_KEY,
    }
  )
);
