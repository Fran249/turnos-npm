import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Component tests render real DOM (RTL + localStorage in the store):
    // node env has neither, so jsdom is mandatory for the whole suite.
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
  },
})
