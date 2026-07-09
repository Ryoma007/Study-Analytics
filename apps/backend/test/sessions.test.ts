/**
 * 历史记录 CRUD + 迁移测试 —— :memory: SQLite
 */
import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db';
import { SessionsService } from '../src/services/sessions';
import { ActivityType } from '@study-analytics/shared';
import type { ActivitySession } from '@study-analytics/shared';

function makeSession(overrides: Partial<ActivitySession> = {}): ActivitySession {
  return {
    id: overrides.id ?? 'sess-1',
    type: overrides.type ?? ActivityType.STUDY,
    date: overrides.date ?? '2026-07-01',
    startTime: overrides.startTime ?? 1_700_000_000_000,
    endTime: overrides.endTime ?? 1_700_000_030_000,
    duration: overrides.duration ?? 30,
    content: overrides.content ?? '测试内容',
  };
}

function setup() {
  const db = createDb(':memory:');
  const service = new SessionsService(db);
  return { db, service };
}

describe('SessionsService - CRUD', () => {
  it('create 写入并返回记录（自动生成 id）', () => {
    const { service } = setup();
    const s = service.create({
      type: ActivityType.STUDY,
      date: '2026-07-01',
      startTime: 1,
      endTime: 61,
      duration: 60,
      content: '学',
    });
    expect(s.id).toBeTruthy();
    expect(service.get(s.id)).toMatchObject({ content: '学', duration: 60 });
  });

  it('list 按 type 过滤且 start_time 倒序', () => {
    const { service } = setup();
    service.create({ ...makeSession({ id: 'a', startTime: 100 }), type: ActivityType.STUDY });
    service.create({ ...makeSession({ id: 'b', startTime: 200 }), type: ActivityType.READING });
    service.create({ ...makeSession({ id: 'c', startTime: 300 }), type: ActivityType.STUDY });

    const study = service.list(ActivityType.STUDY);
    expect(study.map((s) => s.id)).toEqual(['c', 'a']); // 倒序

    const all = service.list();
    expect(all).toHaveLength(3);
  });

  it('list 非法 type 抛异常', () => {
    const { service } = setup();
    expect(() => service.list('BAD' as never)).toThrow(/无效的活动类型/);
  });

  it('update 更新字段，不存在返回 null', () => {
    const { service } = setup();
    service.create({ ...makeSession({ id: 'x', content: '旧' }) });
    const updated = service.update('x', { content: '新', duration: 99 });
    expect(updated?.content).toBe('新');
    expect(updated?.duration).toBe(99);
    expect(service.update('不存在', { content: 'x' })).toBeNull();
  });

  it('deleteMany 批量删除返回删除数', () => {
    const { service } = setup();
    service.create({ ...makeSession({ id: 'a' }) });
    service.create({ ...makeSession({ id: 'b' }) });
    service.create({ ...makeSession({ id: 'c' }) });
    expect(service.deleteMany(['a', 'b'])).toBe(2);
    expect(service.list()).toHaveLength(1);
    expect(service.deleteMany([])).toBe(0);
  });
});

describe('SessionsService - 迁移', () => {
  it('迁移新数据，返回合并条数', () => {
    const { service } = setup();
    const sessions = [makeSession({ id: 'm1' }), makeSession({ id: 'm2', type: ActivityType.READING })];
    const count = service.migrate(sessions);
    expect(count).toBe(2);
    expect(service.list()).toHaveLength(2);
  });

  it('迁移按 id 去重：重复上传幂等，第二次合并数为 0', () => {
    const { service } = setup();
    const sessions = [makeSession({ id: 'dup-1' })];
    expect(service.migrate(sessions)).toBe(1);
    // 再次迁移相同 id
    expect(service.migrate(sessions)).toBe(0);
    expect(service.list()).toHaveLength(1);
  });

  it('迁移空数组返回 0', () => {
    const { service } = setup();
    expect(service.migrate([])).toBe(0);
  });

  it('迁移缺 type 字段的旧记录归 STUDY', () => {
    const { service } = setup();
    // 旧记录 type 为空字符串
    const legacy = { ...makeSession({ id: 'legacy-1', type: '' as never }) };
    service.migrate([legacy]);
    const got = service.get('legacy-1');
    expect(got?.type).toBe(ActivityType.STUDY);
  });

  it('迁移非法 type 容错归 STUDY，不阻断整批', () => {
    const { service } = setup();
    const sessions = [
      makeSession({ id: 'bad' }),
      makeSession({ id: 'good', type: ActivityType.READING }),
    ];
    // 伪造一条非法 type
    (sessions[0] as any).type = 'GARBAGE';
    const count = service.migrate(sessions);
    expect(count).toBe(2);
    expect(service.get('bad')?.type).toBe(ActivityType.STUDY);
    expect(service.get('good')?.type).toBe(ActivityType.READING);
  });
});
