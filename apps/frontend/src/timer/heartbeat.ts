/**
 * 心跳模块 —— 维护与后端的会话保活
 *
 * 核心机制：
 * - setInterval(15s) 发送心跳，更新 clockOffset
 * - 回前台/online 事件补发心跳 + GET active 校准
 * - 卸载时 sendBeacon 发送最后心跳
 * - 心跳 410 → onSettled 回调（已结算，不自动重开）
 * - 网络失败 → 容忍 HEARTBEAT_FAIL_TOLERANCE 次乐观继续
 */
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_FAIL_TOLERANCE,
  SETTLE_REASON_PREEMPTED,
  SETTLE_REASON_TIMEOUT,
} from '@study-analytics/shared';
import { api, ApiError } from '../api/client';
import { sendHeartbeat, sendBeaconHeartbeat } from '../api/hooks';
import type { ActiveSessionResponse } from '@study-analytics/shared';

/** 心跳回调配置 */
export interface HeartbeatCallbacks {
  /** 会话已结算（410），传入结算原因 */
  onSettled: (reason: string) => void;
  /** clockOffset 更新（用于前端计时推算） */
  onClockOffsetUpdate: (offset: number) => void;
  /** 连接丢失（超过容忍次数） */
  onConnectionLost?: () => void;
}

/** 心跳句柄，用于停止心跳 */
export interface HeartbeatHandle {
  /** 当前 clockOffset（ms） */
  clockOffset: number;
  /** 停止心跳并清理所有监听器 */
  stop: () => void;
}

/**
 * 启动心跳循环
 * @param sessionId 当前活跃会话 ID
 * @param callbacks 回调配置
 * @returns 心跳句柄
 */
export function startHeartbeat(sessionId: string, callbacks: HeartbeatCallbacks): HeartbeatHandle {
  const handle: HeartbeatHandle = {
    clockOffset: 0,
    stop: () => {},
  };

  let failCount = 0; // 连续心跳失败计数
  let intervalId: ReturnType<typeof setInterval> | null = null;

  /** 发送一次心跳 */
  const tick = async () => {
    try {
      const clientTime = Date.now();
      const res = await sendHeartbeat(sessionId, clientTime);
      // 心跳成功，校准 clockOffset
      handle.clockOffset = res.serverTime - clientTime;
      callbacks.onClockOffsetUpdate(handle.clockOffset);
      failCount = 0; // 重置失败计数
    } catch (e) {
      // 410 → 会话已结算
      if (e instanceof ApiError && e.status === 410) {
        const reason = e.serverError.includes(SETTLE_REASON_PREEMPTED)
          ? SETTLE_REASON_PREEMPTED
          : SETTLE_REASON_TIMEOUT;
        callbacks.onSettled(reason);
        handle.stop();
        return;
      }

      // 网络失败
      failCount++;
      if (failCount > HEARTBEAT_FAIL_TOLERANCE && callbacks.onConnectionLost) {
        callbacks.onConnectionLost();
      }
    }
  };

  // 启动定时心跳
  intervalId = setInterval(tick, HEARTBEAT_INTERVAL_MS);

  /** 补发心跳 + 校准（回前台/网络恢复时调用） */
  const refresh = async () => {
    try {
      // 同时发心跳和查询活跃会话以校准状态
      const [heartbeatRes, activeRes] = await Promise.all([
        sendHeartbeat(sessionId, Date.now()),
        api.get<ActiveSessionResponse>('/sessions/active'),
      ]);
      handle.clockOffset = heartbeatRes.serverTime - Date.now();
      callbacks.onClockOffsetUpdate(handle.clockOffset);
      failCount = 0;

      // 如果后端说没活跃会话了，触发结算
      if (!activeRes.active) {
        callbacks.onSettled('timeout');
        handle.stop();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) {
        callbacks.onSettled(SETTLE_REASON_PREEMPTED);
        handle.stop();
      }
    }
  };

  // 页面可见性变化 → 回前台时补发
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      refresh();
    }
  };

  // 网络恢复时补发
  const onOnline = () => {
    refresh();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('online', onOnline);

  // 卸载时 sendBeacon 发送最后心跳
  const onUnload = () => {
    sendBeaconHeartbeat(sessionId, Date.now());
  };
  window.addEventListener('pagehide', onUnload);
  window.addEventListener('beforeunload', onUnload);

  /** 停止心跳并清理所有监听器 */
  handle.stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('pagehide', onUnload);
    window.removeEventListener('beforeunload', onUnload);
  };

  return handle;
}
