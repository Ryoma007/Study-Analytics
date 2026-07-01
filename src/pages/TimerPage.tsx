import React, { useState, useEffect } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { format } from 'date-fns';
import { toast } from 'sonner';

// 学习模式文案
const STUDY_COPY = {
  heading: '当前学习',
  label: '你在学习什么？（选填）',
  placeholder: '例如：React Hooks，微积分，高等数学...',
  defaultContent: '日常学习',
};

// 阅读模式文案
const READING_COPY = {
  heading: '当前阅读',
  label: '你在读什么？（选填）',
  placeholder: '例如：深入理解计算机系统，三体，设计模式...',
  defaultContent: '日常阅读',
};

export function TimerPage() {
  // 从 store 读取
  const addSession = useActivityStore((s) => s.addSession);
  const currentType = useActivityStore((s) => s.currentType);
  const setIsTimerRunning = useActivityStore((s) => s.setIsTimerRunning);

  const [isRunning, setIsRunning] = useState(false);
  const [accumulatedTime, setAccumulatedTime] = useState(0); // 秒
  const [lastStartTime, setLastStartTime] = useState<number | null>(null);
  const [displayTime, setDisplayTime] = useState(0); // 秒
  const [content, setContent] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // 根据活动类型获取文案
  const copy = currentType === ActivityType.READING ? READING_COPY : STUDY_COPY;

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
    // 通知 store 计时器开始运行（用于类型切换守卫）
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
    // 暂停时不设置 isTimerRunning = false，计时器仍在 session 中
  };

  /** 停止并保存 */
  const handleStop = () => {
    setIsRunning(false);

    let finalDuration = accumulatedTime;
    if (lastStartTime) {
      finalDuration += Math.floor((Date.now() - lastStartTime) / 1000);
    }

    if (finalDuration > 0) {
      const now = Date.now();
      addSession({
        type: currentType,
        date: format(now, 'yyyy-MM-dd'),
        startTime: sessionStartTime || now - finalDuration * 1000,
        endTime: now,
        duration: finalDuration,
        content: content.trim() || copy.defaultContent,
      });

      // 重置
      setAccumulatedTime(0);
      setDisplayTime(0);
      setContent('');
      setSessionStartTime(null);
      setLastStartTime(null);
      // 停止后解除切换守卫
      setIsTimerRunning(false);
      toast.success('记录保存成功！');
    } else {
      // 即使时长为 0 也重置状态
      setIsTimerRunning(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 根据类型获取主题色
  const isReading = currentType === ActivityType.READING;
  const btnColor = isReading
    ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700'
    : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700';
  const focusRing = isReading ? 'focus:ring-emerald-500 focus:border-emerald-500' : 'focus:ring-indigo-500 focus:border-indigo-500';

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-sm font-semibold tracking-widest text-slate-400 uppercase">{copy.heading}</h2>
        <div className="text-8xl font-mono font-light text-slate-800 tracking-tight">
          {formatTime(displayTime)}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className={`w-20 h-20 flex items-center justify-center rounded-full text-white shadow-lg hover:scale-105 transition-all duration-200 ${btnColor}`}
          >
            <Play className="w-8 h-8 ml-1" />
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="w-20 h-20 flex items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-amber-200 hover:bg-amber-600 hover:scale-105 transition-all duration-200"
          >
            <Pause className="w-8 h-8" />
          </button>
        )}

        <button
          onClick={handleStop}
          disabled={displayTime === 0}
          className={`w-20 h-20 flex items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
            displayTime === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-rose-500 text-white shadow-rose-200 hover:bg-rose-600 hover:scale-105'
          }`}
        >
          <Square className="w-8 h-8" />
        </button>
      </div>

      <div className="w-full max-w-md space-y-3">
        <label htmlFor="content" className="block text-sm font-medium text-slate-600">
          {copy.label}
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={copy.placeholder}
          className={`w-full p-4 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 outline-none transition-all resize-none h-32 text-slate-700 ${focusRing}`}
        />
      </div>
    </div>
  );
}
