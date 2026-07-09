import React from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { useActivityStore } from '../store';
import { getActivityConfig } from '../config/activityConfig';
import { formatTime } from '../utils/time';
import { useTimer } from '../hooks/useTimer';

export function TimerPage() {
  const currentType = useActivityStore((s) => s.currentType);
  const addSession = useActivityStore((s) => s.addSession);
  const setIsTimerRunning = useActivityStore((s) => s.setIsTimerRunning);
  const cfg = getActivityConfig(currentType);
  const { displayTime, isRunning, content, setContent, handleStart, handlePause, handleStop } =
    useTimer({ currentType, addSession, setIsTimerRunning });

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-sm font-semibold tracking-widest text-slate-400 uppercase">{cfg.copy.heading}</h2>
        <div className="text-8xl font-mono font-light text-slate-800 tracking-tight">
          {formatTime(displayTime)}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {!isRunning ? (
          <button
            onClick={handleStart}
            data-testid="timer-start"
            className={`w-20 h-20 flex items-center justify-center rounded-full text-white shadow-lg hover:scale-105 transition-all duration-200 ${cfg.color.tailwind.btn}`}
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
          data-testid="timer-stop"
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
          {cfg.copy.label}
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={cfg.copy.placeholder}
          className={`w-full p-4 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 outline-none transition-all resize-none h-32 text-slate-700 ${cfg.color.tailwind.focusRing}`}
        />
      </div>
    </div>
  );
}
