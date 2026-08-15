import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      'tests/integration/**',
      'tests/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'services/*/src/domain/**/*.ts',
        'services/*/src/application/**/*.ts',
        'packages/contracts/src/**/*.ts',
        'packages/http/src/**/*.ts',
        'packages/messaging/src/**/*.ts',
        'apps/web/src/utils/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/src/generated/**',
        '**/infrastructure/**',
        '**/interfaces/**',
        '**/messaging/src/kafka.ts',
        '**/ports.ts',
        '**/domain/payment.ts',
        '**/domain/notification.ts',
        '**/domain/product.ts',
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
        'services/*/src/{domain,application}/**/*.ts': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
