/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from './components/Layout';
import { TimerPage } from './pages/TimerPage';
import { HistoryPage } from './pages/HistoryPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { Toaster } from 'sonner';
import { migrateLegacyData } from './migration/migrate';

export default function App() {
  const [currentTab, setCurrentTab] = useState('timer');
  // 计时器运行状态（从 TimerPage 组件本地态提升至此，供 Layout 类型切换守卫使用）
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const handleRunningChange = useCallback((running: boolean) => {
    setIsTimerRunning(running);
  }, []);

  // 应用首次挂载时尝试旧数据迁移
  useEffect(() => {
    migrateLegacyData();
  }, []);

  return (
    <>
      <Toaster position="top-center" richColors />
      <Layout
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        hideTypeSwitcher={currentTab === 'statistics'}
        isTimerRunning={isTimerRunning}
      >
        {currentTab === 'timer' && <TimerPage onRunningChange={handleRunningChange} />}
        {currentTab === 'history' && <HistoryPage />}
        {currentTab === 'statistics' && <StatisticsPage />}
      </Layout>
    </>
  );
}
