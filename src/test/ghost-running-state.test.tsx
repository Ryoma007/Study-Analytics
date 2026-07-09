// 回归测试：幽灵运行状态 — 启动计时器后未停止就关闭页面，下次打开切换器被错误禁用
// bug 根因：store 的 isTimerRunning 被持久化，但计时器真实运行状态是组件本地 state，刷新即丢失。
// 二者不一致导致 persist 恢复 isTimerRunning=true，而 UI 根本没在计时，切换器永久禁用。
// 最小 repro：activityMerge（persist merge 函数）不应保留持久化的 isTimerRunning=true —— 新会话起始时计时器尚未启动。
import { describe, it, expect } from 'vitest';
import { activityMerge, ActivityState } from '../store';
import { ActivityType } from '../enums/ActivityType';

const current = {
  sessions: [],
  currentType: ActivityType.STUDY,
  isTimerRunning: false,
} as ActivityState;

describe('幽灵运行状态回归', () => {
  it('persist 恢复的 isTimerRunning=true 不应被保留（新会话起始计时器未启动）', () => {
    // 模拟用户上次启动计时器未停止就关闭页面，IndexedDB 残留 isTimerRunning=true
    const persisted = {
      currentType: ActivityType.STUDY,
      sessions: [],
      isTimerRunning: true,
    } as Partial<ActivityState>;
    const merged = activityMerge(persisted, current);
    // 新会话开始时计时器组件尚未启动，运行态必须重置为 false
    expect(merged.isTimerRunning).toBe(false);
  });

  it('isTimerRunning 缺失时仍默认为 false（回归保护）', () => {
    const merged = activityMerge({ currentType: ActivityType.STUDY, sessions: [] } as Partial<ActivityState>, current);
    expect(merged.isTimerRunning).toBe(false);
  });
});
