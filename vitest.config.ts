import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        // Default vitest excludes
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/__tests__/**',
        // Plugin bootstrap and UI components that are hard to unit test
        'src/index.ts',
        'src/plugin.ts',
        'src/ui/EditorModal.ts',
        'src/ui/VisualEditor.ts',
        'src/ui/ColumnResizer.ts',
        'scripts/**',
      ],
      include: [
        'src/**/*.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
