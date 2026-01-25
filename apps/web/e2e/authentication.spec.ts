/**
 * E2E Test: Authentication Flow
 *
 * Tests user login, logout, and session management
 */

import { test, expect } from '@playwright/test'
import {
  login,
  logout,
  navigateTo,
  waitForElement,
  expectSuccess,
  expectError,
} from './fixtures/helpers'
import { TEST_USER, TEST_USER_ALT, SELECTORS, TIMEOUTS } from './fixtures/test-data'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start at login page
    await page.goto('/login')
  })

  test('should successfully login with valid credentials', async ({ page }) => {
    await login(page)

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/)

    // Dashboard should be visible
    await waitForElement(page, SELECTORS.dashboardCard)
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.fill(SELECTORS.emailInput, 'invalid@example.com')
    await page.fill(SELECTORS.passwordInput, 'wrongpassword')
    await page.click(SELECTORS.submitButton)

    // Should show error message
    await expectError(page)

    // Should remain on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show error with empty email', async ({ page }) => {
    await page.fill(SELECTORS.passwordInput, 'password123')
    await page.click(SELECTORS.submitButton)

    // Should show validation error or remain on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show error with empty password', async ({ page }) => {
    await page.fill(SELECTORS.emailInput, TEST_USER.email)
    await page.click(SELECTORS.submitButton)

    // Should show validation error or remain on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('should successfully logout', async ({ page }) => {
    // Login first
    await login(page)
    await expect(page).toHaveURL(/\/dashboard/)

    // Logout
    await logout(page)

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('should redirect to login when accessing protected route while logged out', async ({
    page,
  }) => {
    // Try to access protected route without being logged in
    await page.goto('/dashboard')

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: TIMEOUTS.medium })
    await expect(page).toHaveURL(/\/login/)
  })

  test('should maintain session on page reload', async ({ page }) => {
    // Login
    await login(page)
    await expect(page).toHaveURL(/\/dashboard/)

    // Reload page
    await page.reload()

    // Should still be on dashboard
    await expect(page).toHaveURL(/\/dashboard/)
    await waitForElement(page, SELECTORS.dashboardCard)
  })

  test('should handle concurrent login attempts', async ({ browser }) => {
    // Create two contexts (simulate two browser sessions)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    // Login from both contexts
    await login(page1)
    await login(page2, TEST_USER_ALT.email, TEST_USER_ALT.password)

    // Both should be logged in
    await expect(page1).toHaveURL(/\/dashboard/)
    await expect(page2).toHaveURL(/\/dashboard/)

    // Cleanup
    await context1.close()
    await context2.close()
  })

  test('should handle session expiry gracefully', async ({ page }) => {
    // Login
    await login(page)
    await expect(page).toHaveURL(/\/dashboard/)

    // Clear cookies to simulate session expiry
    await page.context().clearCookies()

    // Try to navigate to another page
    await page.goto('/controllers')

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: TIMEOUTS.long })
    await expect(page).toHaveURL(/\/login/)
  })

  test('should prevent SQL injection in login', async ({ page }) => {
    await page.fill(SELECTORS.emailInput, "admin'--")
    await page.fill(SELECTORS.passwordInput, "' OR '1'='1")
    await page.click(SELECTORS.submitButton)

    // Should fail and remain on login page
    await expect(page).toHaveURL(/\/login/)

    // Should show error
    const errorVisible =
      (await page
        .locator(SELECTORS.errorMessage)
        .isVisible({ timeout: 2000 })
        .catch(() => false)) ||
      (await page
        .locator(SELECTORS.connectionError)
        .isVisible({ timeout: 2000 })
        .catch(() => false))

    expect(errorVisible).toBe(true)
  })
})
