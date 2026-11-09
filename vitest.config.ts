import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          environment: 'node',
          include: ['src/core/**/*.test.ts'],
          exclude: ['**/.worktrees/**', '**/.agent/**'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          exclude: ['**/.worktrees/**', '**/.agent/**'],
        },
      },
    ],
  },
});
