// Store 行为测试：ActivitySession 数据模型、currentType 切换、守卫、迁移、persist merge
import { ActivityType } from '../enums/ActivityType';
import { useActivityStore, activityMerge, ActivitySession, ActivityState } from '../store';
import { clearMockStore } from './__mocks__/idb-keyval';

// 模拟 idb-keyval（jsdom 无 IndexedDB）
vi.mock('idb-keyval');

// 每个测试前重置 store
beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ sessions: [], currentType: ActivityType.STUDY, isTimerRunning: false });
});

describe('useActivityStore', () => {
  // === 基础数据：ActivitySession 模型 ===
  describe('addSession', () => {
    it('添加一条学习记录到 sessions 中', () => {
      useActivityStore.getState().addSession({
        type: ActivityType.STUDY,
        date: '2026-07-01',
        startTime: 1719792000000,
        endTime: 1719795600000,
        duration: 3600,
        content: '学习 React',
      });
      const { sessions } = useActivityStore.getState();
      expect(sessions).toHaveLength(1);
      const session = sessions[0];
      expect(session.id).toBeDefined();
      expect(session.type).toBe(ActivityType.STUDY);
      expect(session.content).toBe('学习 React');
      expect(session.duration).toBe(3600);
    });

    it('添加一条阅读记录到 sessions 中', () => {
      useActivityStore.getState().addSession({
        type: ActivityType.READING,
        date: '2026-07-01',
        startTime: 1719792000000,
        endTime: 1719795600000,
        duration: 1800,
        content: '阅读三体',
      });
      const { sessions } = useActivityStore.getState();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].type).toBe(ActivityType.READING);
      expect(sessions[0].content).toBe('阅读三体');
    });

    it('新记录插入到数组最前面', () => {
      const store = useActivityStore.getState();
      store.addSession({ type: ActivityType.STUDY, date: '2026-07-01', startTime: 1, endTime: 2, duration: 1, content: 'A' });
      store.addSession({ type: ActivityType.STUDY, date: '2026-07-01', startTime: 3, endTime: 4, duration: 1, content: 'B' });
      const { sessions } = useActivityStore.getState();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].content).toBe('B');
      expect(sessions[1].content).toBe('A');
    });
  });

  describe('updateSession', () => {
    it('更新已存在记录的内容和时长', () => {
      const store = useActivityStore.getState();
      store.addSession({ type: ActivityType.STUDY, date: '2026-07-01', startTime: 1, endTime: 2, duration: 100, content: '原始' });
      const id = useActivityStore.getState().sessions[0].id;

      store.updateSession(id, { content: '已修改', duration: 200 });
      const updated = useActivityStore.getState().sessions[0];
      expect(updated.content).toBe('已修改');
      expect(updated.duration).toBe(200);
      // 未修改的字段保持不变
      expect(updated.type).toBe(ActivityType.STUDY);
    });

    it('不存在的 id 不产生任何变化', () => {
      const store = useActivityStore.getState();
      store.addSession({ type: ActivityType.STUDY, date: '2026-07-01', startTime: 1, endTime: 2, duration: 100, content: 'A' });
      store.updateSession('non-existent-id', { content: 'X' });
      const { sessions } = useActivityStore.getState();
      expect(sessions[0].content).toBe('A');
    });
  });

  describe('deleteSessions', () => {
    it('删除选中的多条记录', () => {
      const store = useActivityStore.getState();
      store.addSession({ type: ActivityType.STUDY, date: '2026-07-01', startTime: 1, endTime: 2, duration: 1, content: 'A' });
      store.addSession({ type: ActivityType.READING, date: '2026-07-01', startTime: 3, endTime: 4, duration: 1, content: 'B' });
      store.addSession({ type: ActivityType.STUDY, date: '2026-07-01', startTime: 5, endTime: 6, duration: 1, content: 'C' });
      // addSession 插入到数组最前，顺序为 C, B, A
      // 删除前两条（C 和 B），剩余 A
      const { sessions: allSessions } = useActivityStore.getState();
      const ids = allSessions.slice(0, 2).map(s => s.id);
      store.deleteSessions(ids);
      const { sessions } = useActivityStore.getState();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].content).toBe('A');
    });
  });

  // === 全局类型切换 ===
  describe('currentType', () => {
    it('默认 currentType 为 STUDY', () => {
      const { currentType } = useActivityStore.getState();
      expect(currentType).toBe(ActivityType.STUDY);
    });

    it('setCurrentType 切换到 READING', () => {
      useActivityStore.getState().setCurrentType(ActivityType.READING);
      const { currentType } = useActivityStore.getState();
      expect(currentType).toBe(ActivityType.READING);
    });

    it('setCurrentType 切换回 STUDY', () => {
      const store = useActivityStore.getState();
      store.setCurrentType(ActivityType.READING);
      store.setCurrentType(ActivityType.STUDY);
      const { currentType } = useActivityStore.getState();
      expect(currentType).toBe(ActivityType.STUDY);
    });
  });

  // === 计时器运行中守卫 ===
  describe('切换守卫', () => {
    it('计时器运行中时，setCurrentType 不生效（保持原值）', () => {
      const store = useActivityStore.getState();
      store.setCurrentType(ActivityType.STUDY);
      store.setIsTimerRunning(true);
      // 计时器运行中，尝试切换到 READING 应被拦截
      store.setCurrentType(ActivityType.READING);
      const { currentType } = useActivityStore.getState();
      expect(currentType).toBe(ActivityType.STUDY);
    });

    it('计时器未运行时，setCurrentType 正常切换', () => {
      const store = useActivityStore.getState();
      store.setIsTimerRunning(false);
      store.setCurrentType(ActivityType.READING);
      const { currentType } = useActivityStore.getState();
      expect(currentType).toBe(ActivityType.READING);
    });
  });

  // === isTimerRunning ===
  describe('isTimerRunning', () => {
    it('默认值为 false', () => {
      const { isTimerRunning } = useActivityStore.getState();
      expect(isTimerRunning).toBe(false);
    });

    it('setIsTimerRunning 可设置为 true', () => {
      useActivityStore.getState().setIsTimerRunning(true);
      expect(useActivityStore.getState().isTimerRunning).toBe(true);
    });
  });
});

// ============================================================
// Persist merge: 旧版 Enumify 序列化格式兼容迁移
// ============================================================
describe('activityMerge', () => {
  const current = {
    sessions: [],
    currentType: ActivityType.STUDY,
    isTimerRunning: false,
  } as ActivityState;

  it('将旧版 {enumKey:"READING"} 迁移为 "READING" 字符串', () => {
    const persisted = {
      currentType: { enumKey: 'READING' } as unknown as ActivityType,
      sessions: [],
      isTimerRunning: false,
    };
    const merged = activityMerge(persisted, current);
    expect(merged.currentType).toBe(ActivityType.READING);
  });

  it('纯字符串 currentType 保持不变', () => {
    const persisted = {
      currentType: ActivityType.READING,
      sessions: [],
      isTimerRunning: false,
    };
    const merged = activityMerge(persisted, current);
    expect(merged.currentType).toBe(ActivityType.READING);
  });

  it('将 sessions[].type 从旧版 {enumKey} 迁移为字符串', () => {
    const persisted = {
      currentType: ActivityType.STUDY,
      sessions: [
        { id: '1', type: { enumKey: 'READING' }, date: '2026-07-01',
          startTime: 1000, endTime: 2000, duration: 1000, content: '阅读' },
      ] as unknown as ActivitySession[],
      isTimerRunning: false,
    };
    const merged = activityMerge(persisted, current);
    expect(merged.sessions[0].type).toBe(ActivityType.READING);
  });

  it('persisted 为 null 时返回 current', () => {
    const merged = activityMerge(null, current);
    expect(merged.currentType).toBe(ActivityType.STUDY);
    expect(merged.sessions).toEqual([]);
  });

  it('persisted 为 undefined 时返回 current', () => {
    const merged = activityMerge(undefined, current);
    expect(merged.currentType).toBe(ActivityType.STUDY);
  });

  it('persisted 中 currentType 缺失时使用 current 的值', () => {
    const merged = activityMerge({ sessions: [], isTimerRunning: false } as Partial<ActivityState>, current);
    expect(merged.currentType).toBe(ActivityType.STUDY);
  });

  it('isTimerRunning 缺失时默认为 false', () => {
    const merged = activityMerge({ currentType: ActivityType.STUDY, sessions: [] } as Partial<ActivityState>, current);
    expect(merged.isTimerRunning).toBe(false);
  });

  it('已恢复的字符串类型保持不变（幂等性）', () => {
    const persisted = {
      currentType: ActivityType.STUDY,
      sessions: [
        { id: '1', type: ActivityType.READING, date: '2026-07-01',
          startTime: 1000, endTime: 2000, duration: 1000, content: '阅读' },
      ] as unknown as ActivitySession[],
      isTimerRunning: false,
    };
    const merged = activityMerge(persisted, current);
    expect(merged.currentType).toBe(ActivityType.STUDY);
    expect(merged.sessions[0].type).toBe(ActivityType.READING);
  });

  it('旧版 session 无 type 字段时降级为 STUDY', () => {
    const persisted = {
      currentType: ActivityType.STUDY,
      sessions: [
        { id: '1', date: '2026-07-01', startTime: 1000, endTime: 2000, duration: 1000, content: '旧数据' },
      ] as unknown as ActivitySession[],
      isTimerRunning: false,
    };
    const merged = activityMerge(persisted, current);
    expect(merged.sessions[0].type).toBe(ActivityType.STUDY);
  });

  it('无效 enumKey 时抛出异常', () => {
    const persisted = {
      currentType: { enumKey: 'INVALID_TYPE' } as unknown as ActivityType,
      sessions: [],
      isTimerRunning: false,
    };
    expect(() => activityMerge(persisted, current)).toThrow('无效的活动类型');
  });

  it('enumKey 不是字符串时抛出异常', () => {
    const persisted = {
      currentType: { enumKey: 123 } as unknown as ActivityType,
      sessions: [],
      isTimerRunning: false,
    };
    expect(() => activityMerge(persisted, current)).toThrow('无法从对象中提取有效的活动类型');
  });
});
