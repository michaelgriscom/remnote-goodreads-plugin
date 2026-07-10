import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // DOMParser is needed by the RSS parsing code under test
    environment: 'jsdom',
  },
});
