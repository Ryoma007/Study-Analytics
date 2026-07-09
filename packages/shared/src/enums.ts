/**
 * 活动类型常量定义
 * 使用 const 对象 + 字符串联合类型替代 Enumify，简化序列化/反序列化
 * 此为前后端共享的唯一活动类型事实源
 */

/** 活动类型常量 */
export const ActivityType = {
  /** 学习类活动 */
  STUDY: 'STUDY',
  /** 阅读类活动 */
  READING: 'READING',
} as const;

/** 活动类型联合类型 */
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

/** 所有活动类型的数组（替代原 Enumify.enumValues） */
export const ACTIVITY_TYPES: readonly ActivityType[] = [ActivityType.STUDY, ActivityType.READING];

/**
 * 从字符串解析为 ActivityType
 * 无效值直接抛出异常（不兜底），替代原 Enumify.enumValueOf()
 * 后端校验请求 type 字段时复用此函数，非法 type 会抛异常（路由层转 400）
 */
export function activityTypeFromValue(value: string): ActivityType {
  const valid = ACTIVITY_TYPES as readonly string[];
  if (!valid.includes(value)) {
    throw new Error(`无效的活动类型: "${value}"，有效值为: ${valid.join(', ')}`);
  }
  return value as ActivityType;
}
