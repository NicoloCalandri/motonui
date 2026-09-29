import { configDefaults, defineConfig } from 'vitest/config';
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
    testTimeout: 15000,
    // nextgen/ has its own package.json, deps and vitest config.
    exclude: [...configDefaults.exclude, 'nextgen/**', 'mobile/**'],
  },
});
