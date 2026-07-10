import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

/** TanStack Query 全局客户端 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 页面焦点恢复时不自动重新请求（心跳已负责校准）
      refetchOnWindowFocus: false,
      // 失败重试 1 次
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
