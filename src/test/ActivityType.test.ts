// ActivityType 枚举行为测试
import { ActivityType } from '../enums/ActivityType';

describe('ActivityType', () => {
  it('包含 STUDY 和 READING 两个枚举值', () => {
    expect(ActivityType.STUDY).toBeDefined();
    expect(ActivityType.READING).toBeDefined();
  });

  it('STUDY 和 READING 不相等', () => {
    expect(ActivityType.STUDY).not.toBe(ActivityType.READING);
  });

  it('能通过 enumValueOf 反向查找', () => {
    expect(ActivityType.enumValueOf('STUDY')).toBe(ActivityType.STUDY);
    expect(ActivityType.enumValueOf('READING')).toBe(ActivityType.READING);
  });

  it('toString 返回类名.枚举名', () => {
    expect(ActivityType.STUDY.toString()).toBe('ActivityType.STUDY');
    expect(ActivityType.READING.toString()).toBe('ActivityType.READING');
  });
});
