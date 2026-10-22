import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:4173/cet4-study-planner/', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'zh-CN', timezoneId: 'Asia/Shanghai',
    screenshot: 'only-on-failure', trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', ...(process.platform === 'win32' ? { channel: 'msedge' } : {}), launchOptions: { args: ['--no-sandbox', '--disable-gpu', '--disk-cache-size=1048576'] } } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173/cet4-study-planner/', reuseExistingServer: !process.env.CI },
  reporter: [['list'], ['json', { outputFile: 'local-reports/e2e-results.json' }]]
})
