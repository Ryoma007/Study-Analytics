/**
 * useTimer —— 计时器心跳薄壳
 *
 * 阶段3 重写：本地计时逻辑全部移除，改为调后端接口 + 心跳 + 显示推算。
 * 后端是计时权威源，前端仅通过 serverStartTime + clockOffset 推算显示值。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { ActivityType } from '@study-analytics/shared';
import { useStartSession, useStopSession } from '../api/hooks';
import { startHeartbeat, type HeartbeatHandle } from '../timer/heartbeat';
import { toast } from 'sonner';

/** useTimer 返回值接口 */
export interface UseTimerReturn {
  /** 当前推算的计时显示（秒） */
  displayTime: number;
  /** 计时器是否正在运行 */
  isRunning: boolean;
  /** 活动内容 */
  content: string;
  /** 更新活动内容 */
  setContent: React.Dispatch<React.SetStateAction<string>>;
  /** 开始计时 */
  handleStart: () => void;
  /** 停止计时 */
  handleStop: () => void;
}

/**
 * 计时器心跳薄壳 hook
 * @param currentType 当前活动类型
 */
export function useTimer(currentType: ActivityType): UseTimerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [displayTime, setDisplayTime] = useState(0); // 秒
  const [content, setContent] = useState('');

  // 后端权威值
  const serverStartTimeRef = useRef<number>(0);
  const clockOffsetRef = useRef<number>(0);
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<HeartbeatHandle | null>(null);

  // 显示刷新定时器
  const displayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // TanStack Query mutations
  const startMutation = useStartSession();
  const stopMutation = useStopSession();

  /** 停止显示刷新和心跳 */
  const cleanup = useCallback(() => {
    if (displayIntervalRef.current !== null) {
      clearInterval(displayIntervalRef.current);
      displayIntervalRef.current = null;
    }
    if (heartbeatRef.current) {
      heartbeatRef.current.stop();
      heartbeatRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  /** 开始计时 */
  const handleStart = useCallback(async () => {
    try {
      const clientStartTime = Date.now();
      const result = await startMutation.mutateAsync({
        type: currentType,
        content: content.trim() || undefined,
        clientStartTime,
      });

      // 记录后端权威值
      sessionIdRef.current = result.sessionId;
      serverStartTimeRef.current = result.serverStartTime;
      clockOffsetRef.current = result.serverTime - clientStartTime;

      // 启动心跳
      heartbeatRef.current = startHeartbeat(result.sessionId, {
        onSettled: (reason) => {
          // 会话已结算，停止本地显示
          cleanup();
          setIsRunning(false);
          setDisplayTime(0);
          if (reason === 'preempted') {
            toast.error('计时已在其他设备上被接管');
          } else {
            toast.info('计时已超时自动结算');
          }
        },
        onClockOffsetUpdate: (offset) => {
          clockOffsetRef.current = offset;
        },
        onConnectionLost: () => {
          toast.warning('网络连接丢失，正在重试…');
        },
      });

      // 启动显示刷新（每秒推算 elapsed）
      displayIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() + clockOffsetRef.current - serverStartTimeRef.current) / 1000
        );
        setDisplayTime(Math.max(0, elapsed));
      }, 1000);

      setIsRunning(true);
    } catch {
      // 错误已由 mutation 的 apiWithToast 处理
    }
  }, [currentType, content, startMutation, cleanup]);

  /** 停止计时 */
  const handleStop = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      const result = await stopMutation.mutateAsync({
        id: sessionIdRef.current,
        content: content.trim() || undefined,
      });

      // 用后端返回的权威 duration
      setDisplayTime(result.duration);

      // 清理
      cleanup();
      setIsRunning(false);
      sessionIdRef.current = null;
    } catch {
      // 错误已处理
    }
  }, [content, stopMutation, cleanup]);

  return {
    displayTime,
    isRunning,
    content,
    setContent,
    handleStart,
    handleStop,
  };
}
