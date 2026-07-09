// StatisticsPage 行为测试：双类型合并统计、分组柱状图、拆分卡片
import { render, screen } from '@testing-library/react';
import { StatisticsPage } from '../pages/StatisticsPage';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

vi.mock('idb-keyval');

// 辅助：添加 session（使用实际当前日期，确保落在时间范围内）
const addSession = (type: ActivityType, daysAgo: number, durationSec: number, content = 'test') => {
  const now = new Date();
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
  // === S1: 双类型合并统计 ===
  it('同时统计学习与阅读两种类型的数据', () => {
    addSession(ActivityType.STUDY, 0, 7200, '学习今天');   // 2小时
    addSession(ActivityType.READING, 0, 3600, '阅读今天');  // 1小时

    render(<StatisticsPage />);
    // 三种卡片中各有一组学习/阅读标签
    expect(screen.getAllByText('学习').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('阅读').length).toBeGreaterThanOrEqual(3);
    // 学习 2.00 小时
    expect(screen.getByText('2.00')).toBeInTheDocument();
    // 阅读 1.00 小时
    expect(screen.getByText('1.00')).toBeInTheDocument();
  });

  it('不依赖 currentType，始终统计全部数据', () => {
    // 即使 currentType 是 READING，STUDY 数据也应计入
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    addSession(ActivityType.STUDY, 0, 3600, '学习今天');   // 1小时
    addSession(ActivityType.READING, 0, 1800, '阅读今天');  // 30分钟

    render(<StatisticsPage />);
    // 学习类型数据仍然显示
    expect(screen.getAllByText('学习').length).toBeGreaterThanOrEqual(3);
    // 阅读类型数据仍然显示
    expect(screen.getAllByText('阅读').length).toBeGreaterThanOrEqual(3);
  });

  // === S2: 固定标题 ===
  it('标题固定显示"数据统计"', () => {
    render(<StatisticsPage />);
    expect(screen.getByText('数据统计')).toBeInTheDocument();
  });

  it('标题不随 currentType 改变', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    render(<StatisticsPage />);
    expect(screen.getByText('数据统计')).toBeInTheDocument();
    // 不应出现旧的"阅读统计"或"学习统计"
    expect(screen.queryByText('阅读统计')).toBeNull();
    expect(screen.queryByText('学习统计')).toBeNull();
  });

  // === S3: 卡片拆分显示 ===
  it('总时长卡片拆分显示学习与阅读数据（相同单位）', () => {
    // 使用相同数量级的时长，确保单位一致（都在分钟范围）
    addSession(ActivityType.STUDY, 0, 1800, '学习');   // 1800秒 = 30.0 分钟
    addSession(ActivityType.READING, 0, 900, '阅读');   // 900秒 = 15.0 分钟

    render(<StatisticsPage />);
    // 三张卡片中各有学习行和阅读行
    const studyElements = screen.getAllByText('学习');
    const readingElements = screen.getAllByText('阅读');
    expect(studyElements.length).toBeGreaterThanOrEqual(3);
    expect(readingElements.length).toBeGreaterThanOrEqual(3);
    // 学习 30.0 分钟
    expect(screen.getByText('30.0')).toBeInTheDocument();
    // 阅读 15.0 分钟
    expect(screen.getByText('15.0')).toBeInTheDocument();
  });

  it('活动天数卡片拆分显示学习与阅读天数', () => {
    // 学习：今天和昨天 = 2天
    addSession(ActivityType.STUDY, 0, 3600, '学习D0');
    addSession(ActivityType.STUDY, 1, 3600, '学习D1');
    // 阅读：仅今天 = 1天
    addSession(ActivityType.READING, 0, 1800, '阅读D0');

    render(<StatisticsPage />);
    // 检查天数卡片中存在拆分的学习/阅读行
    const studyElements = screen.getAllByText('学习');
    const readingElements = screen.getAllByText('阅读');
    // 每张统计卡片各有一组学习/阅读标签（3张卡片 = 至少3个）
    expect(studyElements.length).toBeGreaterThanOrEqual(3);
    expect(readingElements.length).toBeGreaterThanOrEqual(3);
  });

  // === 页面完整渲染 ===
  it('双类型数据下页面完整渲染（含图表和卡片）', () => {
    addSession(ActivityType.STUDY, 0, 3600);
    addSession(ActivityType.READING, 0, 1800);
    render(<StatisticsPage />);
    // 标题存在
    expect(screen.getByText('数据统计')).toBeInTheDocument();
    // 三张卡片都存在
    expect(screen.getByText('总时长')).toBeInTheDocument();
    expect(screen.getByText('日均时长')).toBeInTheDocument();
    expect(screen.getByText('活动天数')).toBeInTheDocument();
    // 两种类型标签都存在
    expect(screen.getAllByText('学习').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('阅读').length).toBeGreaterThanOrEqual(1);
  });

  // === 空数据 ===
  it('无数据时卡片显示 0', () => {
    render(<StatisticsPage />);
    // 三张卡片都存在
    expect(screen.getByText('总时长')).toBeInTheDocument();
    expect(screen.getByText('日均时长')).toBeInTheDocument();
    expect(screen.getByText('活动天数')).toBeInTheDocument();
    // 学习行和阅读行都显示 0
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(1);
  });
});
