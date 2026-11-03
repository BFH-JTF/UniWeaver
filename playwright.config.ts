import { defineConfig, devices } from '@playwright/test'

// E2E against the production Docker stack (docker compose up -d --build app).
// The stack must be running at http://localhost:3003 before `npx playwright test`.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3003',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  expect: {
    timeout: 10_000,
  },
  reporter: [['list']],
})