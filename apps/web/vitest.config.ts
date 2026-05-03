import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/App.tsx',
        'src/app/**',
        'src/features/**',
        '!src/features/weighing/machine.ts',
        '!src/features/weighing/machine.guards.ts',
        '!src/features/weighing/machine.events.ts',
        'src/components/ui/**',
        'src/components/layout/**',
        'src/components/domain/StatusChip.tsx',
        'src/components/domain/LedDot.tsx',
        'src/lib/serial/**',
        'src/lib/api/query-client.ts',
        'src/stores/scale-stream-store.ts',
      ],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
