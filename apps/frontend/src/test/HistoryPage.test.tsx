// HistoryPage 行为测试：类型过滤、弹窗类型选择器
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryPage } from '../pages/HistoryPage';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

vi.mock('idb-keyval');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const seedSessions = () => {
  const store = useActivityStore.getState();
  store.addSession({ type: ActivityType.STUDY, date: '2026-07-01', startTime: 1, endTime: 2, duration: 100, content: '学习A' });
  store.addSession({ type: ActivityType.READING, date: '2026-07-01', startTime: 3, endTime: 4, duration: 200, content: '阅读B' });
  store.addSession({ type: ActivityType.STUDY, date: '2026-07-02', startTime: 5, endTime: 6, duration: 300, content: '学习C' });
};

beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ sessions: [], currentType: ActivityType.STUDY, isTimerRunning: false });
});

describe('HistoryPage', () => {
  // === 类型过滤 ===
  it('仅显示当前类型（STUDY）的记录', () => {
    seedSessions();
    render(<HistoryPage />);
    // 应看到学习A和学习C，但不应看到阅读B
    expect(screen.getByText('学习A')).toBeInTheDocument();
    expect(screen.getByText('学习C')).toBeInTheDocument();
    expect(screen.queryByText('阅读B')).toBeNull();
  });

  it('切换到 READING 后仅显示阅读记录', () => {
    seedSessions();
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    render(<HistoryPage />);
    expect(screen.getByText('阅读B')).toBeInTheDocument();
    expect(screen.queryByText('学习A')).toBeNull();
    expect(screen.queryByText('学习C')).toBeNull();
  });

  // === 弹窗类型选择器 ===
  it('手动添加弹窗中包含类型选择器', () => {
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('手动添加'));
    // 类型选择器应存在
    expect(screen.getByText('活动类型')).toBeInTheDocument();
  });

  it('弹窗中类型选择器默认为学习（跟随全局类型）', () => {
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('手动添加'));
    // 学习选项应被选中
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('STUDY');
  });

  it('全局类型为 READING 时，弹窗类型选择器默认为阅读', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('手动添加'));
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('READING');
  });

  it('弹窗中可切换活动类型', () => {
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('手动添加'));
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'READING' } });
    expect(select).toHaveValue('READING');
  });

  // === 空状态 ===
  it('无匹配记录时显示空状态文案', () => {
    render(<HistoryPage />);
    expect(screen.getByText(/暂无.*记录/)).toBeInTheDocument();
  });
});
