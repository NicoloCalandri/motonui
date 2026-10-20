import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // Same-origin /api/* in dev too, mirroring the reverse-proxy
            // topology planned for production (see plan §Hosting).
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/vitest.setup.ts'],
        // Pages render whole trees (Tiptap, charts, axe): 5 seconds is not enough on a busy machine.
        testTimeout: 30_000,
    },
});
