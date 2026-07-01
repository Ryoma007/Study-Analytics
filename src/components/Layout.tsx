import React from 'react';
import { BookOpen, Clock, History, BarChart2 } from 'lucide-react';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: string;
  onTabChange: (tab: string) => void;
}

// 根据 ActivityType 实例获取主题色
const getTheme = (type: ActivityType) => {
  if (type === ActivityType.READING) {
    return {
      primary: 'emerald',
      logoBg: 'bg-emerald-600',
      activeBg: 'bg-emerald-50',
      activeText: 'text-emerald-700',
      iconColor: 'text-emerald-600',
    } as const;
  }
  return {
    primary: 'indigo',
    logoBg: 'bg-indigo-600',
    activeBg: 'bg-indigo-50',
    activeText: 'text-indigo-700',
    iconColor: 'text-indigo-600',
  } as const;
};

export function Layout({ children, currentTab, onTabChange }: LayoutProps) {
  // 从 store 读取当前类型和计时器状态
  const currentType = useActivityStore((s) => s.currentType);
  const isTimerRunning = useActivityStore((s) => s.isTimerRunning);
  const setCurrentType = useActivityStore((s) => s.setCurrentType);

  const tabs = [
    { id: 'timer', label: '计时器', icon: Clock },
    { id: 'history', label: '历史记录', icon: History },
    { id: 'statistics', label: '数据统计', icon: BarChart2 },
  ];

  const theme = getTheme(currentType);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* 侧边栏 */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo 区域 */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className={`${theme.logoBg} p-2 rounded-lg`}>
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">时间记录</h1>
        </div>

        {/* 活动类型切换（分段按钮） */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex rounded-lg bg-slate-100 p-1">
            {/* 学习按钮 */}
            <button
              onClick={() => setCurrentType(ActivityType.STUDY)}
              disabled={isTimerRunning}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                currentType === ActivityType.STUDY
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              } ${isTimerRunning ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              学习
            </button>
            {/* 阅读按钮 */}
            <button
              onClick={() => setCurrentType(ActivityType.READING)}
              disabled={isTimerRunning}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                currentType === ActivityType.READING
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              } ${isTimerRunning ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              阅读
            </button>
          </div>
        </div>

        {/* 导航 tab */}
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => {
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

      {/* 主内容 */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
