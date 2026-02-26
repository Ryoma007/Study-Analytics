/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { TimerPage } from './pages/TimerPage';
import { HistoryPage } from './pages/HistoryPage';
import { StatisticsPage } from './pages/StatisticsPage';

export default function App() {
  const [currentTab, setCurrentTab] = useState('timer');

  return (
    <Layout currentTab={currentTab} onTabChange={setCurrentTab}>
      {currentTab === 'timer' && <TimerPage />}
      {currentTab === 'history' && <HistoryPage />}
      {currentTab === 'statistics' && <StatisticsPage />}
    </Layout>
  );
}
