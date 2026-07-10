/**
 * 计时心跳常量 —— 前后端共享，单一事实源
 * 数值依据见 backend-refactor-plan.md 决策5
 */

/** 心跳发送间隔（15 秒） */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** 心跳超时阈值（90 秒，≈6 个心跳周期）：超过则懒结算 */
export const HEARTBEAT_TIMEOUT_MS = 90_000;

/** 前端连续心跳失败容忍次数（3 次 = 45s），超过才提示连接丢失 */
export const HEARTBEAT_FAIL_TOLERANCE = 3;

/** 结算原因常量（单活跃槽被新会话抢占） */
export const SETTLE_REASON_PREEMPTED = 'preempted' as const;

/** 结算原因常量（心跳超时） */
export const SETTLE_REASON_TIMEOUT = 'timeout' as const;

/** 心跳已结算响应的合法原因集合（路由/校验复用，避免字面量重复） */
export const SETTLE_REASONS = [SETTLE_REASON_PREEMPTED, SETTLE_REASON_TIMEOUT] as const;

