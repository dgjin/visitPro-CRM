/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    plugins: [react()],
    server: {
      proxy: {
        // 本地 MySQL 后端 API (server/index.js)
        '/api': 'http://localhost:3006',
      },
    },
    define: {
      // Polyfill global process to prevent "process is not defined" errors in some libraries
      // 安全约定：禁止在此注入任何 API 密钥，密钥一律由用户在系统设置中配置（localStorage）
      'process.env': {},
    },
    test: {
      // 前端单测仅扫描 services/components 目录（server/ 为旧 Node 后端的测试，由 Node 侧单独运行）
      include: ['services/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}'],
    },
  };
});