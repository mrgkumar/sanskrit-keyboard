import { defineConfig } from '@playwright/test';

const defaultAppUrl = process.env.APP_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: defaultAppUrl,
    headless: true,
    launchOptions: {
      args: ['--disable-dev-shm-usage'],
    },
  },
  webServer: process.env.APP_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: defaultAppUrl,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
