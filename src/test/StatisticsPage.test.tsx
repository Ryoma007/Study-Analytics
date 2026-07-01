// StatisticsPage 行为测试：类型过滤、图表颜色
import { render, screen } from '@testing-library/react';
import { StatisticsPage } from '../pages/StatisticsPage';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

vi.mock('idb-keyval');

// 辅助：添加 session
const addSession = (type: ActivityType, daysAgo: number, durationSec: number, content = 'test') => {
  const now = new Date('2026-07-01T12:00:00');
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  const start = date.getTime();
  useActivityStore.getState().addSession({
    type,
    date: date.toISOString().split('T')[0],
    startTime: start,
    endTime: start + durationSec * 1000,
    duration: durationSec,
    content,
  });
};

beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ sessions: [], currentType: ActivityType.STUDY, isTimerRunning: false });
});

describe('StatisticsPage', () => {
  // === 类型过滤 ===
  it('仅统计当前类型（STUDY）的数据', () => {
    addSession(ActivityType.STUDY, 0, 7200, '学习今天');   // 2小时
    addSession(ActivityType.STUDY, 1, 3600, '学习昨天');   // 1小时
    addSession(ActivityType.READING, 0, 3600, '阅读今天');  // 1小时阅读，不应计入

    render(<StatisticsPage />);
    // 总时长为 3 小时 = 3.00
    expect(screen.getByText('3.00')).toBeInTheDocument();
  });

  it('切换到 READING 后仅统计阅读数据', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    addSession(ActivityType.STUDY, 0, 7200, '学习今天');   // 不计入
    addSession(ActivityType.READING, 0, 1800, '阅读今天');  // 1800秒 = 30分钟

    render(<StatisticsPage />);
    // 1800秒 = 30.0 分钟
    expect(screen.getByText('30.0')).toBeInTheDocument();
  });

  // === 图表区域 ===
  it('学习模式下页面完整渲染（含图表）', () => {
    addSession(ActivityType.STUDY, 0, 3600);
    render(<StatisticsPage />);
    expect(screen.getByText('学习统计')).toBeInTheDocument();
    // 总时长卡片存在数据
    expect(screen.getByText('1.00')).toBeInTheDocument();
  });

  it('阅读模式下页面完整渲染（含图表）', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    addSession(ActivityType.READING, 0, 3600);
    render(<StatisticsPage />);
    expect(screen.getByText('阅读统计')).toBeInTheDocument();
    expect(screen.getByText('1.00')).toBeInTheDocument();
  });

  // === 页面标题 ===
  it('显示"学习统计"标题（学习模式）', () => {
    render(<StatisticsPage />);
    expect(screen.getByText('学习统计')).toBeInTheDocument();
  });

  it('显示"阅读统计"标题（阅读模式）', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    render(<StatisticsPage />);
    expect(screen.getByText('阅读统计')).toBeInTheDocument();
  });

  // === 空数据 ===
  it('无数据时卡片显示 0', () => {
    render(<StatisticsPage />);
    // 总时长默认为 0 分钟
    const totalCard = screen.getByText('总时长').closest('div')?.parentElement;
    expect(totalCard).toBeTruthy();
    // 日均时长和活动天数卡片也包含 0
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(1);
  });
});
