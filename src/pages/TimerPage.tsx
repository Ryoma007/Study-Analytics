import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Save } from 'lucide-react';
import { useStudyStore } from '../store';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function TimerPage() {
  const { addSession } = useStudyStore();
  
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // in seconds
  const [content, setContent] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handleStart = () => {
    if (!sessionStartTime) {
      setSessionStartTime(Date.now());
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    
    if (elapsed > 0) {
      const now = Date.now();
      addSession({
        date: format(now, 'yyyy-MM-dd'),
        startTime: sessionStartTime || now - elapsed * 1000,
        endTime: now,
        duration: elapsed,
        content: content.trim() || '日常学习',
      });
      
      // Reset
      setElapsed(0);
      setContent('');
      setSessionStartTime(null);
      toast.success('学习记录保存成功！');
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-sm font-semibold tracking-widest text-slate-400 uppercase">当前学习</h2>
        <div className="text-8xl font-mono font-light text-slate-800 tracking-tight">
          {formatTime(elapsed)}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="w-20 h-20 flex items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all duration-200"
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
          disabled={elapsed === 0}
          className={`w-20 h-20 flex items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
            elapsed === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-rose-500 text-white shadow-rose-200 hover:bg-rose-600 hover:scale-105'
          }`}
        >
          <Square className="w-8 h-8" />
        </button>
      </div>

      <div className="w-full max-w-md space-y-3">
        <label htmlFor="content" className="block text-sm font-medium text-slate-600">
          你在学习什么？（选填）
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="例如：React Hooks，微积分，阅读..."
          className="w-full p-4 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none h-32 text-slate-700"
        />
      </div>
    </div>
  );
}
