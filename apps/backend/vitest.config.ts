import { defineConfig } from 'vitest/config';

// 后端 vitest 配置：@study-analytics/shared 经 node_modules workspace 符号链接解析
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
  },
});
