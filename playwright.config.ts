import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
/** La build di produzione usa la base di GitHub Pages: i test girano sullo stesso percorso. */
const BASE_PATH = process.env.BASE_PATH ?? '/chessmemory-ai/';
/** Facoltativo: percorso di un Chromium già installato (altrimenti `npx playwright install chromium`). */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 90_000,
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'off',
    locale: 'it-IT',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
