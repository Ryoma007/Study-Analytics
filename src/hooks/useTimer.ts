import React, { useState, useEffect } from 'react';
import type { ActivitySession } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { getActivityConfig } from '../config/activityConfig';
import { format } from 'date-fns';
import { toast } from 'sonner';

/** useTimer hook 依赖注入参数 */
export interface UseTimerDeps {
  /** 当前活动类型 */
  currentType: ActivityType;
  /** 添加 session 回调 */
  addSession: (session: Omit<ActivitySession, 'id'>) => void;
  /** 设置计时器运行状态回调 */
  setIsTimerRunning: (running: boolean) => void;
}

/** useTimer hook 返回值接口 */
export interface UseTimerReturn {
  displayTime: number;
  isRunning: boolean;
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  handleStart: () => void;
  handlePause: () => void;
  handleStop: () => void;
}

/**
 * 计时器状态机 hook
 * 通过参数注入依赖，不直接访问 store，便于测试
 */
export function useTimer({ currentType, addSession, setIsTimerRunning }: UseTimerDeps): UseTimerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [accumulatedTime, setAccumulatedTime] = useState(0); // 秒
  const [lastStartTime, setLastStartTime] = useState<number | null>(null);
  const [displayTime, setDisplayTime] = useState(0); // 秒
  const [content, setContent] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // 定时更新 displayTime + 页面可见性校准
  useEffect(() => {
    let interval: number;
    if (isRunning && lastStartTime) {
      interval = window.setInterval(() => {
        const currentSegment = Math.floor((Date.now() - lastStartTime) / 1000);
        setDisplayTime(accumulatedTime + currentSegment);
      }, 1000);
    } else {
      setDisplayTime(accumulatedTime);
    }

    // 标签页恢复可见时立即校准显示时间
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning && lastStartTime) {
        const currentSegment = Math.floor((Date.now() - lastStartTime) / 1000);
        setDisplayTime(accumulatedTime + currentSegment);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, lastStartTime, accumulatedTime]);

  /** 开始计时 */
  const handleStart = () => {
    const now = Date.now();
    if (!sessionStartTime) {
      setSessionStartTime(now);
    }
    setLastStartTime(now);
    setIsRunning(true);
    setIsTimerRunning(true);
  };

  /** 暂停计时 */
  const handlePause = () => {
    if (lastStartTime) {
      const currentSegment = Math.floor((Date.now() - lastStartTime) / 1000);
      setAccumulatedTime((prev) => prev + currentSegment);
    }
    setLastStartTime(null);
    setIsRunning(false);
  };

  /** 停止并保存 */
  const handleStop = () => {
    setIsRunning(false);

    let finalDuration = accumulatedTime;
    if (lastStartTime) {
      finalDuration += Math.floor((Date.now() - lastStartTime) / 1000);
    }

    if (finalDuration > 0) {
      const cfg = getActivityConfig(currentType);
      const now = Date.now();
      addSession({
        type: currentType,
        date: format(now, 'yyyy-MM-dd'),
        startTime: sessionStartTime || now - finalDuration * 1000,
        endTime: now,
        duration: finalDuration,
        content: content.trim() || cfg.copy.defaultContent,
      });

      // 重置状态
      setAccumulatedTime(0);
      setDisplayTime(0);
      setContent('');
      setSessionStartTime(null);
      setLastStartTime(null);
      setIsTimerRunning(false);
      toast.success('记录保存成功！');
    } else {
      setIsTimerRunning(false);
    }
  };

  return {
    displayTime,
    isRunning,
    content,
    setContent,
    handleStart,
    handlePause,
    handleStop,
  };
}
