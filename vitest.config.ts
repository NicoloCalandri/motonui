import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2,
        execArgv: ['--max-old-space-size=1024'],
      },
    },
  },
});
