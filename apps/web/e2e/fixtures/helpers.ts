/**
 * E2E Test Helper Functions
 *
 * Reusable utilities for authentication, navigation, data cleanup, and assertions.
 */

import { Page, expect } from '@playwright/test'
import { TEST_USER, SELECTORS, TIMEOUTS } from './test-data'

/**
 * Login helper - authenticates user and waits for dashboard
 */
export async function login(page: Page, email?: string, password?: string) {
  await page.goto('/login')

  await page.fill(SELECTORS.emailInput, email || TEST_USER.email)
  await page.fill(SELECTORS.passwordInput, password || TEST_USER.password)

  // Click submit and wait for navigation
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: TIMEOUTS.long }),
    page.click(SELECTORS.submitButton),
  ])

  // Verify we're on the dashboard
  await expect(page).toHaveURL(/\/dashboard/)
}

/**
 * Logout helper - signs out user
 */
export async function logout(page: Page) {
  // Click user menu or logout button
  const logoutButton = page.locator(SELECTORS.logoutButton)

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click()
    await page.waitForURL('**/login', { timeout: TIMEOUTS.medium })
  }
}

/**
 * Navigate to specific page
 */
export async function navigateTo(page: Page, route: string) {
  await page.goto(route)
  await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long })
}

/**
 * Wait for API response with specific criteria
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options: { timeout?: number; status?: number } = {}
) {
  const timeout = options.timeout || TIMEOUTS.long
  const status = options.status || 200

  return page.waitForResponse(
    (response) => {
      const url = response.url()
      const matches =
        typeof urlPattern === 'string'
          ? url.includes(urlPattern)
          : urlPattern.test(url)
      return matches && response.status() === status
    },
    { timeout }
  )
}

/**
 * Fill form fields from object
 */
export async function fillForm(
  page: Page,
  fields: Record<string, string | number>
) {
  for (const [name, value] of Object.entries(fields)) {
    const selector = `[name="${name}"]`
    await page.fill(selector, String(value))
  }
}

/**
 * Select option from dropdown
 */
export async function selectOption(
  page: Page,
  selector: string,
  value: string
) {
  await page.selectOption(selector, value)
}

/**
 * Wait for element to be visible
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' } = {}
) {
  await page.waitForSelector(selector, {
    timeout: options.timeout || TIMEOUTS.medium,
    state: options.state || 'visible',
  })
}

/**
 * Click element and wait for navigation
 */
export async function clickAndNavigate(
  page: Page,
  selector: string,
  expectedUrl?: string | RegExp
) {
  if (expectedUrl) {
    await Promise.all([
      page.waitForURL(expectedUrl, { timeout: TIMEOUTS.long }),
      page.click(selector),
    ])
  } else {
    await page.click(selector)
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.medium })
  }
}

/**
 * Wait for loading spinner to disappear
 */
export async function waitForLoading(page: Page, timeout = TIMEOUTS.medium) {
  const spinner = page.locator(SELECTORS.loadingSpinner)

  // Wait for spinner to appear (optional)
  await spinner.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {})

  // Wait for spinner to disappear
  await spinner.waitFor({ state: 'hidden', timeout })
}

/**
 * Check for success message
 */
export async function expectSuccess(page: Page, message?: string) {
  const successElement = page.locator(SELECTORS.successMessage)
  await expect(successElement).toBeVisible({ timeout: TIMEOUTS.short })

  if (message) {
    await expect(successElement).toContainText(message)
  }
}

/**
 * Check for error message
 * Looks for toast notifications (shadcn/ui) which is how errors are displayed
 */
export async function expectError(page: Page, message?: string) {
  // Toast notifications appear in a div with role="status" or class containing "toast"
  const toastElement = page.locator('[role="status"]').first()

  // Also try the legacy error message selector as fallback
  const errorElement = page.locator(SELECTORS.errorMessage)

  // Wait for either toast or error message to appear
  const toastVisible = await toastElement
    .isVisible({ timeout: TIMEOUTS.short })
    .catch(() => false)
  const errorVisible = await errorElement
    .isVisible({ timeout: TIMEOUTS.short })
    .catch(() => false)

  // At least one should be visible
  expect(toastVisible || errorVisible).toBe(true)

  // If message is specified, check content
  if (message) {
    if (toastVisible) {
      await expect(toastElement).toContainText(message)
    } else if (errorVisible) {
      await expect(errorElement).toContainText(message)
    }
  }
}

/**
 * Create a test room via API (faster than UI)
 */
export async function createTestRoom(
  page: Page,
  roomData: {
    name: string
    description?: string
    settings?: Record<string, unknown>
  }
) {
  return page.evaluate(async (data) => {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  }, roomData)
}

/**
 * Create a test controller via API (faster than UI)
 */
export async function createTestController(
  page: Page,
  controllerData: {
    brand: string
    name: string
    credentials?: Record<string, unknown>
    room_id?: string
  }
) {
  return page.evaluate(async (data) => {
    const response = await fetch('/api/controllers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  }, controllerData)
}

/**
 * Delete a controller via API (cleanup)
 */
export async function deleteController(page: Page, controllerId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/controllers/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  }, controllerId)
}

/**
 * Delete a room via API (cleanup)
 */
export async function deleteRoom(page: Page, roomId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/rooms/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  }, roomId)
}

/**
 * Get all controllers for cleanup
 */
export async function getAllControllers(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/controllers')
    const data = await response.json()
    return data.controllers || []
  })
}

/**
 * Get all rooms for cleanup
 */
export async function getAllRooms(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/rooms')
    const data = await response.json()
    return data.rooms || []
  })
}

/**
 * Cleanup all test data created during test
 */
export async function cleanupTestData(page: Page) {
  try {
    // Get all controllers
    const controllers = await getAllControllers(page)

    // Delete test controllers (those with E2E in name)
    for (const controller of controllers) {
      if (controller.name.includes('E2E')) {
        await deleteController(page, controller.id)
      }
    }

    // Get all rooms
    const rooms = await getAllRooms(page)

    // Delete test rooms
    for (const room of rooms) {
      if (room.name.includes('E2E')) {
        await deleteRoom(page, room.id)
      }
    }
  } catch (error) {
    console.warn('Cleanup failed:', error)
    // Don't fail the test on cleanup errors
  }
}

/**
 * Take screenshot with custom name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `./test-results/screenshots/${name}.png`,
    fullPage: true,
  })
}

/**
 * Wait for specific number of milliseconds
 */
export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts || 3
  const delay = options.delay || 1000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxAttempts) throw error
      await wait(delay * attempt) // Exponential backoff
    }
  }

  throw new Error('Retry failed')
}

/**
 * Check if element contains text (case-insensitive)
 */
export async function expectTextContent(
  page: Page,
  selector: string,
  text: string,
  options: { exact?: boolean } = {}
) {
  const element = page.locator(selector)
  await expect(element).toBeVisible()

  if (options.exact) {
    await expect(element).toHaveText(text)
  } else {
    await expect(element).toContainText(text)
  }
}

/**
 * Parse CSV string into array of objects
 */
export function parseCSV(csvString: string): Record<string, string>[] {
  const lines = csvString.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim())
  const rows = lines.slice(1)

  return rows.map((row) => {
    const values = row.split(',').map((v) => v.trim())
    const obj: Record<string, string> = {}

    headers.forEach((header, index) => {
      obj[header] = values[index] || ''
    })

    return obj
  })
}

/**
 * Validate CSV structure
 */
export function validateCSV(
  csvString: string,
  expectedHeaders: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  const lines = csvString.trim().split('\n')

  if (lines.length < 1) {
    errors.push('CSV is empty')
    return { valid: false, errors }
  }

  const headers = lines[0].split(',').map((h) => h.trim())

  // Check all expected headers are present
  for (const expectedHeader of expectedHeaders) {
    if (!headers.includes(expectedHeader)) {
      errors.push(`Missing header: ${expectedHeader}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Mock API response for testing
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  responseData: unknown,
  options: { status?: number } = {}
) {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status: options.status || 200,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    })
  })
}

/**
 * Get current URL path
 */
export async function getCurrentPath(page: Page): Promise<string> {
  const url = new URL(page.url())
  return url.pathname
}

/**
 * Wait for URL to match pattern
 */
export async function waitForUrl(
  page: Page,
  pattern: string | RegExp,
  timeout = TIMEOUTS.long
) {
  await page.waitForURL(pattern, { timeout })
}

/**
 * Check if E2E auth is configured
 * Returns true if test users can be created/authenticated
 */
export function isAuthConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Get skip reason for auth tests if not configured
 */
export function getAuthSkipReason(): string | false {
  if (isAuthConfigured()) {
    return false
  }
  return 'Test users not configured. Run: npx playwright test --headed to see setup instructions, or see e2e/E2E_TEST_SETUP.md'
}
