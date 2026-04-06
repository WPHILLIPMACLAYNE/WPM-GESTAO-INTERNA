import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/unit/*.test.js', 'tests/integration/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['app.js'],
      exclude: ['node_modules/', 'tests/']
    },
    reporters: ['verbose'],
    testTimeout: 10000
  }
});
