// StatisticsPage 行为测试：双类型合并统计、分组柱状图、拆分卡片
import { render, screen } from '@testing-library/react';
import { StatisticsPage } from '../pages/StatisticsPage';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

// Mock useStatistics hook
let mockStats: any = {
  chartData: [],
  chartUnit: '分钟',
  studyTotal: { value: '0', unit: '分钟' },
  readingTotal: { value: '0', unit: '分钟' },
  studyAvg: { value: '0', unit: '分钟' },
  readingAvg: { value: '0', unit: '分钟' },
  studyDays: 0,
  readingDays: 0,
  totalDaysInRange: 7,
};

vi.mock('../hooks/useStatistics', () => ({
  useStatistics: () => ({
    stats: mockStats,
    rangeType: '7',
    setRangeType: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('idb-keyval');

beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ currentType: ActivityType.STUDY });
  mockStats = {
    chartData: [],
    chartUnit: '分钟',
    studyTotal: { value: '0', unit: '分钟' },
    readingTotal: { value: '0', unit: '分钟' },
    studyAvg: { value: '0', unit: '分钟' },
    readingAvg: { value: '0', unit: '分钟' },
    studyDays: 0,
    readingDays: 0,
    totalDaysInRange: 7,
  };
});

describe('StatisticsPage', () => {
  // === S1: 双类型合并统计 ===
  it('同时显示学习与阅读两种类型的数据', () => {
    mockStats.studyTotal = { value: '2.00', unit: '小时' };
    mockStats.readingTotal = { value: '1.00', unit: '小时' };
    mockStats.chartUnit = '小时';

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
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    mockStats.studyTotal = { value: '1.00', unit: '小时' };
    mockStats.readingTotal = { value: '30.0', unit: '分钟' };
    mockStats.chartUnit = '小时';

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
    expect(screen.queryByText('阅读统计')).toBeNull();
    expect(screen.queryByText('学习统计')).toBeNull();
  });

  // === S3: 卡片拆分显示 ===
  it('总时长卡片拆分显示学习与阅读数据', () => {
    mockStats.studyTotal = { value: '30.0', unit: '分钟' };
    mockStats.readingTotal = { value: '15.0', unit: '分钟' };
    mockStats.chartUnit = '分钟';

    render(<StatisticsPage />);
    const studyElements = screen.getAllByText('学习');
    const readingElements = screen.getAllByText('阅读');
    expect(studyElements.length).toBeGreaterThanOrEqual(3);
    expect(readingElements.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('30.0')).toBeInTheDocument();
    expect(screen.getByText('15.0')).toBeInTheDocument();
  });

  it('活动天数卡片拆分显示学习与阅读天数', () => {
    mockStats.studyDays = 2;
    mockStats.readingDays = 1;

    render(<StatisticsPage />);
    const studyElements = screen.getAllByText('学习');
    const readingElements = screen.getAllByText('阅读');
    expect(studyElements.length).toBeGreaterThanOrEqual(3);
    expect(readingElements.length).toBeGreaterThanOrEqual(3);
  });

  // === 页面完整渲染 ===
  it('双类型数据下页面完整渲染（含图表和卡片）', () => {
    mockStats.studyTotal = { value: '1.00', unit: '小时' };
    mockStats.readingTotal = { value: '30.0', unit: '分钟' };
    mockStats.chartUnit = '小时';

    render(<StatisticsPage />);
    expect(screen.getByText('数据统计')).toBeInTheDocument();
    expect(screen.getByText('总时长')).toBeInTheDocument();
    expect(screen.getByText('日均时长')).toBeInTheDocument();
    expect(screen.getByText('活动天数')).toBeInTheDocument();
    expect(screen.getAllByText('学习').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('阅读').length).toBeGreaterThanOrEqual(1);
  });

  // === 空数据 ===
  it('无数据时卡片显示 0', () => {
    render(<StatisticsPage />);
    expect(screen.getByText('总时长')).toBeInTheDocument();
    expect(screen.getByText('日均时长')).toBeInTheDocument();
    expect(screen.getByText('活动天数')).toBeInTheDocument();
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(1);
  });
});
