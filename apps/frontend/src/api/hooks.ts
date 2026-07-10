/**
 * TanStack Query hooks —— 前端数据层
 * 所有后端数据通过 hooks 获取/变更，缓存自动失效
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ActivitySession,
  ActiveSession,
  StatisticsData,
  StartSessionRequest,
  StartSessionResponse,
  StopResponse,
  ActiveSessionResponse,
  ListSessionsResponse,
  CreateSessionRequest,
  UpdateSessionRequest,
  DeleteSessionsRequest,
  MigrateRequest,
  MigrateResponse,
  RangeType,
} from '@study-analytics/shared';
import { ActivityType } from '@study-analytics/shared';
import { api, apiWithToast } from './client';
import { toast } from 'sonner';

// ===== 查询 key 常量（单一事实源，避免字面量重复） =====

/** sessions 列表查询 key */
export const QUERY_KEY_SESSIONS = 'sessions';
/** 统计查询 key */
export const QUERY_KEY_STATISTICS = 'statistics';
/** 活跃会话查询 key */
export const QUERY_KEY_ACTIVE = 'active';

// ===== 查询 hooks =====

/**
 * 查询历史会话列表（支持按类型过滤）
 * @param type 活动类型过滤（可选，不传查全部）
 */
export function useSessions(type?: ActivityType) {
  const queryStr = type ? `?type=${type}` : '';
  return useQuery<ListSessionsResponse>({
    queryKey: [QUERY_KEY_SESSIONS, type ?? 'all'],
    queryFn: () => api.get(`/sessions${queryStr}`),
  });
}

/**
 * 查询统计数据
 * @param range 时间范围（7/14/30/year）
 */
export function useStatistics(range: RangeType) {
  return useQuery<StatisticsData>({
    queryKey: [QUERY_KEY_STATISTICS, range],
    queryFn: () => api.get(`/statistics?range=${range}`),
  });
}

/**
 * 查询当前活跃会话（页面挂载/刷新恢复用）
 */
export function useActiveSession() {
  return useQuery<ActiveSessionResponse>({
    queryKey: [QUERY_KEY_ACTIVE],
    queryFn: () => api.get('/sessions/active'),
    // 页面挂载时取一次即可，不需要轮询
    staleTime: 10_000,
  });
}

// ===== 变更 hooks =====

/**
 * 开始计时
 */
export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation<StartSessionResponse, Error, StartSessionRequest>({
    mutationFn: (body) => apiWithToast(api.post<StartSessionResponse>('/sessions/start', body)),
    onSuccess: () => {
      // 开始计时后失效活跃会话缓存
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_ACTIVE] });
    },
  });
}

/**
 * 停止计时
 */
export function useStopSession() {
  const queryClient = useQueryClient();
  return useMutation<StopResponse, Error, { id: string; content?: string }>({
    mutationFn: ({ id, content }) =>
      apiWithToast(api.post<StopResponse>(`/sessions/${id}/stop`, content !== undefined ? { content } : undefined)),
    onSuccess: () => {
      // 停止后失效所有相关缓存
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_SESSIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_ACTIVE] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_STATISTICS] });
      toast.success('记录保存成功！');
    },
  });
}

/**
 * 发送心跳（不通过 TanStack Query，直接调用 api）
 * 心跳是高频操作，不需要缓存
 */
export async function sendHeartbeat(id: string, clientTime: number): Promise<{ serverTime: number; active: true }> {
  return api.post<{ serverTime: number; active: true }>(`/sessions/${id}/heartbeat`, { clientTime });
}

/**
 * 发送卸载心跳（通过 sendBeacon）
 */
export function sendBeaconHeartbeat(id: string, clientTime: number): void {
  const body = JSON.stringify({ clientTime });
  const blob = new Blob([body], { type: 'application/json' });
  navigator.sendBeacon(`/api/sessions/${id}/heartbeat`, blob);
}

/**
 * 手动添加记录
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation<ActivitySession, Error, CreateSessionRequest>({
    mutationFn: (body) => apiWithToast(api.post<ActivitySession>('/sessions', body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_SESSIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_STATISTICS] });
    },
  });
}

/**
 * 编辑记录
 */
export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation<ActivitySession, Error, { id: string; data: UpdateSessionRequest }>({
    mutationFn: ({ id, data }) => apiWithToast(api.patch<ActivitySession>(`/sessions/${id}`, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_SESSIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_STATISTICS] });
    },
  });
}

/**
 * 批量删除记录
 */
export function useDeleteSessions() {
  const queryClient = useQueryClient();
  return useMutation<{ deleted: number }, Error, string[]>({
    mutationFn: (ids) => apiWithToast(api.delete<{ deleted: number }>('/sessions', { ids } as DeleteSessionsRequest)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_SESSIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_STATISTICS] });
      toast.success(`已成功删除 ${data.deleted} 条记录`);
    },
  });
}

/**
 * 旧数据迁移
 */
export function useMigrate() {
  const queryClient = useQueryClient();
  return useMutation<MigrateResponse, Error, MigrateRequest>({
    mutationFn: (body) => apiWithToast(api.post<MigrateResponse>('/sessions/migrate', body)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_SESSIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_STATISTICS] });
      toast.success(`旧数据迁移完成，共合并 ${data.mergedCount} 条记录`);
    },
  });
}
