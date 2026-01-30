import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration
 *
 * Comprehensive end-to-end testing for EnviroFlow critical user journeys.
 * Tests run in both desktop and mobile viewports to ensure responsive design.
 */
export default defineConfig({
  testDir: './e2e',

  // Global setup to create test users
  globalSetup: './e2e/global-setup.ts',

  // Maximum time one test can run (60 seconds)
  timeout: 60000,

  // Maximum time entire test suite can run (5 minutes target)
  globalTimeout: 300000,

  // Fail the build on CI if tests are flaky
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  // Retry on CI only to handle transient failures
  retries: process.env.CI ? 2 : 0,

  // Run tests in parallel
  workers: process.env.CI ? 2 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    process.env.CI ? ['github'] : ['line']
  ],

  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Capture screenshot only on failure
    screenshot: 'only-on-failure',

    // Capture video only on first retry
    video: 'retain-on-failure',

    // Collect trace on first retry for debugging
    trace: 'on-first-retry',

    // Browser context options
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,

    // Default timeout for actions
    actionTimeout: 15000,

    // Default timeout for navigation
    navigationTimeout: 30000,
  },

  // Configure projects for different browsers and viewports
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },

    {
      name: 'mobile',
      use: {
        ...devices['iPhone 12'],
      },
    },

    // Uncomment for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run local dev server before starting tests
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
