import React from 'react';
import { BookOpen, Clock, History, BarChart2 } from 'lucide-react';
import { useActivityStore } from '../store';
import { ACTIVITY_TYPES } from '@study-analytics/shared';
import { getActivityConfig } from '../config/activityConfig';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: string;
  onTabChange: (tab: string) => void;
  /** 是否禁用活动类型切换器（统计页等不需要切换器的页面使用，切换器始终可见但不可点击） */
  disableTypeSwitcher?: boolean;
  /** 计时器是否正在运行（从 TimerPage 组件本地态传入，用于类型切换守卫） */
  isTimerRunning?: boolean;
}

/** 底部导航 tab 定义 */
const BOTTOM_TABS = [
  { id: 'timer', label: '计时器', icon: Clock },
  { id: 'history', label: '历史记录', icon: History },
  { id: 'statistics', label: '数据统计', icon: BarChart2 },
] as const;

/**
 * 活动类型分段切换器（桌面端/移动端复用）
 * 纯展示组件，从父组件接收状态和回调
 */
function TypeSwitcher({
  currentType,
  onTypeChange,
  disabled,
}: {
  currentType: string;
  onTypeChange: (type: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-1">
      {ACTIVITY_TYPES.map((type) => {
        const isActive = currentType === type;
        return (
          <button
            key={type}
            onClick={() => onTypeChange(type)}
            disabled={disabled}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              isActive
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            {getActivityConfig(type).label}
          </button>
        );
      })}
    </div>
  );
}

export function Layout({ children, currentTab, onTabChange, disableTypeSwitcher = false, isTimerRunning = false }: LayoutProps) {
  const currentType = useActivityStore((s) => s.currentType);
  const setCurrentType = useActivityStore((s) => s.setCurrentType);

  const theme = getActivityConfig(currentType).color.tailwind;
  const isSwitcherDisabled = isTimerRunning || disableTypeSwitcher;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900">
      {/* ======== 桌面端侧边栏（md 及以上显示） ======== */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0">
        {/* Logo 区域 */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className={`${theme.logoBg} p-2 rounded-lg`}>
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">时间记录</h1>
        </div>

        {/* 活动类型切换（分段按钮），统计页禁用而非隐藏，避免 DOM 闪烁和下方内容上移 */}
        <div className="px-4 py-3 border-b border-slate-100">
          <TypeSwitcher
            currentType={currentType}
            onTypeChange={setCurrentType}
            disabled={isSwitcherDisabled}
          />
        </div>

        {/* 导航 tab */}
        <nav className="flex-1 p-4 space-y-1">
          {BOTTOM_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? `${theme.activeBg} ${theme.activeText} font-medium`
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? theme.iconColor : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ======== 移动端顶部 sticky 类型切换器（md 以下显示） ======== */}
      <div className="md:hidden sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3">
        <TypeSwitcher
          currentType={currentType}
          onTypeChange={setCurrentType}
          disabled={isSwitcherDisabled}
        />
      </div>

      {/* ======== 主内容区 ======== */}
      {/* pb-24(96px) 为移动端底部导航栏(64px) + 安全区(≤34px)留出空间 */}
      <main className="flex-1 overflow-auto pb-24 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* ======== 移动端底部导航栏（md 以下显示，固定定位） ======== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-slate-200 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {BOTTOM_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-colors duration-200 ${
                  isActive
                    ? `${theme.activeText}`
                    : 'text-slate-400'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? theme.iconColor : ''}`} />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
