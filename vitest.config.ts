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
    // .claude/ holds git worktrees: full copies of the repo on other branches.
    exclude: [...configDefaults.exclude, 'nextgen/**', 'mobile/**', '.claude/**'],
    // T-3.1 (SR-SDLC-03): domain logic in src/lib must stay covered. CI runs
    // `npm run test:coverage` and fails below these thresholds.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      // Generated DB types and SDK client factories, no logic of ours.
      exclude: ['src/lib/**/*.test.ts', 'src/lib/supabase/**'],
      reporter: ['text-summary', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 60 },
    },
  },
});
