/**
 * API 请求/响应 DTO 契约 —— 前后端共享的接口形状
 * 后端实现需严格匹配此契约，前端按此调用
 */
import type { ActivitySession, ActiveSession, RangeType, StatisticsData } from './types.js';
import type { ActivityType } from './enums.js';

// ===== 计时生命周期 =====

/** 开始计时请求 */
export interface StartSessionRequest {
  type: ActivityType;
  /** 活动内容（可选，stop 时可更新） */
  content?: string;
  /** 前端本地开始时刻（epoch ms，仅参考，后端用自己时钟作 startTime） */
  clientStartTime: number;
}

/** 开始计时响应 */
export interface StartSessionResponse {
  /** 后端权威会话 id */
  sessionId: string;
  /** 后端权威开始时刻（前端用它本地推算显示计时） */
  serverStartTime: number;
  /** 后端当前时刻（前端据此校准 clockOffset） */
  serverTime: number;
}

/** 心跳请求 */
export interface HeartbeatRequest {
  /** 前端当前时刻（epoch ms） */
  clientTime: number;
}

/** 心跳响应（200，会话仍在运行） */
export interface HeartbeatResponse {
  serverTime: number;
  active: true;
}

/** 心跳已结算响应（410 Gone） */
export interface HeartbeatSettledResponse {
  /** 结算原因：被抢占 / 超时 */
  reason: 'preempted' | 'timeout';
}

/** 停止计时请求 */
export interface StopRequest {
  /** 停止时更新活动内容（可选） */
  content?: string;
}

/** 停止计时响应 */
export interface StopResponse {
  sessionId: string;
  /** 后端权威时长（秒），前端入库以此为准 */
  duration: number;
  /** 结束时刻（epoch ms） */
  endTime: number;
}

/** 查询当前活跃会话响应（GET /api/sessions/active） */
export interface ActiveSessionResponse {
  active: boolean;
  /** 活跃会话详情（active 为 true 时存在） */
  session?: ActiveSession;
}

// ===== 历史记录 CRUD =====

/** 手动添加记录请求 */
export interface CreateSessionRequest {
  type: ActivityType;
  date: string;
  startTime: number;
  endTime: number;
  duration: number;
  content: string;
}

/** 编辑记录请求 */
export interface UpdateSessionRequest {
  type?: ActivityType;
  date?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
  content?: string;
}

/** 批量删除请求 */
export interface DeleteSessionsRequest {
  ids: string[];
}

/** 历史记录列表响应（GET /api/sessions?type=） */
export type ListSessionsResponse = ActivitySession[];

// ===== 统计 =====

/** 统计响应（GET /api/statistics?range=） */
export type StatisticsResponse = StatisticsData;

// ===== 旧数据迁移 =====

/** 旧数据迁移请求 */
export interface MigrateRequest {
  /** 本地 IndexedDB 的所有 sessions */
  sessions: ActivitySession[];
  /** 本地 currentType */
  currentType?: ActivityType;
}

/** 旧数据迁移响应 */
export interface MigrateResponse {
  /** 实际新合并入后端的条数（去重后） */
  mergedCount: number;
}

// ===== 健康检查 =====

/** 健康检查响应 */
export interface HealthResponse {
  status: 'ok';
  timestamp: number;
}

export { RangeType };
