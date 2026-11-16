import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 15000
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 720 },
    // Sin reintentos, 'on-first-retry' nunca guardaría nada: se conserva la traza de cada fallo.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        channel: 'chrome'
      }
    }
  ]
});
