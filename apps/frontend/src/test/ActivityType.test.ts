// ActivityType 常量测试
import { ActivityType, ACTIVITY_TYPES, activityTypeFromValue } from '../enums/ActivityType';

describe('ActivityType', () => {
  it('包含 STUDY 和 READING 两个值', () => {
    expect(ActivityType.STUDY).toBe('STUDY');
    expect(ActivityType.READING).toBe('READING');
  });

  it('STUDY 和 READING 不相等', () => {
    expect(ActivityType.STUDY).not.toBe(ActivityType.READING);
  });

  it('ACTIVITY_TYPES 包含全部两个值', () => {
    expect(ACTIVITY_TYPES).toHaveLength(2);
    expect(ACTIVITY_TYPES).toContain(ActivityType.STUDY);
    expect(ACTIVITY_TYPES).toContain(ActivityType.READING);
  });

  it('activityTypeFromValue 能正常解析有效值', () => {
    expect(activityTypeFromValue('STUDY')).toBe(ActivityType.STUDY);
    expect(activityTypeFromValue('READING')).toBe(ActivityType.READING);
  });

  it('activityTypeFromValue 对无效值抛出异常', () => {
    expect(() => activityTypeFromValue('INVALID')).toThrow('无效的活动类型');
    expect(() => activityTypeFromValue('')).toThrow('无效的活动类型');
  });
});
