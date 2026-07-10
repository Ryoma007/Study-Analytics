// HistoryPage 行为测试：类型过滤、弹窗类型选择器
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryPage } from '../pages/HistoryPage';
import { useActivityStore } from '../store';
import { ActivityType } from '../enums/ActivityType';
import { clearMockStore } from './__mocks__/idb-keyval';

// Mock TanStack Query hooks
const mockSessions: any[] = [];
vi.mock('../api/hooks', () => ({
  useSessions: () => ({ data: mockSessions, isLoading: false }),
  useCreateSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSessions: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('idb-keyval');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  clearMockStore();
  useActivityStore.setState({ currentType: ActivityType.STUDY });
  mockSessions.length = 0;
});

describe('HistoryPage', () => {
  // === 类型过滤：mock 数据已在前端通过 useSessions(type) 过滤，
  // 后端直接返回对应类型的数据。这里测试组件展示后端返回的数据。

  it('显示从后端获取的学习记录', () => {
    mockSessions.push(
      { id: '1', type: 'STUDY', date: '2026-07-01', startTime: 1, endTime: 2, duration: 100, content: '学习A' },
      { id: '2', type: 'STUDY', date: '2026-07-02', startTime: 5, endTime: 6, duration: 300, content: '学习C' }
    );
    render(<HistoryPage />);
    expect(screen.getByText('学习A')).toBeInTheDocument();
    expect(screen.getByText('学习C')).toBeInTheDocument();
  });

  it('切换到 READING 后显示阅读记录', () => {
    useActivityStore.getState().setCurrentType(ActivityType.READING);
    mockSessions.push(
      { id: '3', type: 'READING', date: '2026-07-01', startTime: 3, endTime: 4, duration: 200, content: '阅读B' }
    );
    render(<HistoryPage />);
    expect(screen.getByText('阅读B')).toBeInTheDocument();
  });

  // === 弹窗类型选择器 ===
  it('手动添加弹窗中包含类型选择器', () => {
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('手动添加'));
    expect(screen.getByText('活动类型')).toBeInTheDocument();
  });

  it('弹窗中类型选择器默认为学习（跟随全局类型）', () => {
    render(<HistoryPage />);
    fireEvent.click(screen.getByText('手动添加'));
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
  it('无数据时显示空状态文案', () => {
    render(<HistoryPage />);
    expect(screen.getByText(/暂无.*记录/)).toBeInTheDocument();
  });
});
