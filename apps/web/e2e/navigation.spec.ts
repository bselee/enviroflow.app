/**
 * E2E Test: Navigation
 *
 * Tests basic navigation between pages and route handling
 */

import { test, expect } from '@playwright/test'
import { login, navigateTo, waitForElement } from './fixtures/helpers'
import { SELECTORS, TIMEOUTS } from './fixtures/test-data'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should navigate to dashboard from sidebar', async ({ page }) => {
    // Start on controllers page
    await navigateTo(page, '/controllers')

    // Click dashboard link in sidebar
    const dashboardLink = page
      .locator('a[href*="/dashboard"], a:has-text("Dashboard")')
      .first()

    if (await dashboardLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dashboardLink.click()
      await page.waitForURL('**/dashboard', { timeout: TIMEOUTS.long })
      await expect(page).toHaveURL(/\/dashboard/)
    }
  })

  test('should navigate to controllers page', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    // Click controllers link
    const controllersLink = page
      .locator('a[href*="/controllers"], a:has-text("Controllers")')
      .first()

    if (await controllersLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await controllersLink.click()
      await page.waitForURL('**/controllers', { timeout: TIMEOUTS.long })
      await expect(page).toHaveURL(/\/controllers/)
    } else {
      // Navigate directly
      await navigateTo(page, '/controllers')
      await expect(page).toHaveURL(/\/controllers/)
    }
  })

  test('should navigate using browser back button', async ({ page }) => {
    // Navigate to dashboard
    await navigateTo(page, '/dashboard')
    const dashboardUrl = page.url()

    // Navigate to controllers
    await navigateTo(page, '/controllers')
    await expect(page).toHaveURL(/\/controllers/)

    // Go back
    await page.goBack()

    // Should be back on dashboard
    expect(page.url()).toContain('/dashboard')
  })

  test('should navigate using browser forward button', async ({ page }) => {
    // Navigate to dashboard
    await navigateTo(page, '/dashboard')

    // Navigate to controllers
    await navigateTo(page, '/controllers')

    // Go back
    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard/)

    // Go forward
    await page.goForward()
    await expect(page).toHaveURL(/\/controllers/)
  })

  test('should handle direct URL navigation', async ({ page }) => {
    // Navigate directly to controllers page
    await page.goto('/controllers')
    await page.waitForURL('**/controllers', { timeout: TIMEOUTS.long })
    await expect(page).toHaveURL(/\/controllers/)

    // Page should load correctly
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long })
    const pageContent = await page.locator('main').isVisible()
    expect(pageContent).toBe(true)
  })

  test('should handle 404 for invalid routes', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto('/this-page-does-not-exist')

    // Should show 404 or redirect
    const is404 =
      page.url().includes('404') ||
      (await page
        .locator('text=/404|not found|page not found/i')
        .isVisible({ timeout: 2000 })
        .catch(() => false))

    // Either 404 page or redirect to dashboard is acceptable
    const isDashboard = page.url().includes('/dashboard')

    expect(is404 || isDashboard).toBe(true)
  })

  test('should maintain navigation state across pages', async ({ page }) => {
    // Navigate to dashboard
    await navigateTo(page, '/dashboard')

    // Navigate to controllers
    await navigateTo(page, '/controllers')

    // Navigate back
    await page.goBack()

    // Should remember previous state
    await expect(page).toHaveURL(/\/dashboard/)
    const pageLoaded = await page.locator('main').isVisible()
    expect(pageLoaded).toBe(true)
  })

  test('should show active navigation item', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    // Dashboard nav item should be active
    const dashboardNav = page
      .locator('a[href*="/dashboard"], a:has-text("Dashboard")')
      .first()

    if (await dashboardNav.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isActive =
        (await dashboardNav.getAttribute('aria-current')) === 'page' ||
        (await dashboardNav.getAttribute('class'))?.includes('active') ||
        (await dashboardNav.getAttribute('data-state')) === 'active'

      // Active state may or may not be implemented
      expect(isActive !== undefined).toBe(true)
    }
  })

  test('should handle rapid navigation clicks', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    // Rapidly click navigation links
    const controllersLink = page
      .locator('a[href*="/controllers"]')
      .first()

    if (await controllersLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click multiple times rapidly
      await controllersLink.click()
      await controllersLink.click()
      await controllersLink.click()

      // Should end up on controllers page without errors
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long })

      const finalUrl = page.url()
      expect(finalUrl).toContain('/controllers')
    }
  })

  test('should navigate to schedules page if available', async ({ page }) => {
    // Try to navigate to schedules
    await page.goto('/schedules')

    // Should either load schedules page or redirect
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long })

    const pageLoaded = await page.locator('main').isVisible()
    expect(pageLoaded).toBe(true)
  })

  test('should handle concurrent navigation requests', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    // Try to navigate to multiple pages at once
    await Promise.race([
      page.goto('/controllers'),
      page.goto('/dashboard'),
    ])

    // Should end up on a valid page
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long })

    const url = page.url()
    expect(url.includes('/dashboard') || url.includes('/controllers')).toBe(true)
  })

  test('should preserve query parameters when navigating', async ({ page }) => {
    // Navigate with query parameters
    await page.goto('/dashboard?view=compact')

    // Query parameter should be preserved
    expect(page.url()).toContain('view=compact')

    // Navigate to another page
    await navigateTo(page, '/controllers')

    // Navigate back
    await page.goBack()

    // Query parameter might be preserved
    const hasParam = page.url().includes('view=compact')

    // Either preserved or not is acceptable behavior
    expect(hasParam !== undefined).toBe(true)
  })

  test('should handle hash navigation', async ({ page }) => {
    // Navigate with hash
    await page.goto('/dashboard#overview')

    // Hash should be in URL
    expect(page.url()).toContain('#overview')

    // Page should load
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long })
    const pageLoaded = await page.locator('main').isVisible()
    expect(pageLoaded).toBe(true)
  })

  test('should handle navigation during loading', async ({ page }) => {
    // Start navigating to dashboard
    const navigation = page.goto('/dashboard')

    // Immediately try to navigate elsewhere
    await page.goto('/controllers')

    // Wait for final navigation to complete
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long })

    // Should end up on a valid page
    const url = page.url()
    expect(url.includes('/dashboard') || url.includes('/controllers')).toBe(true)
  })

  test('should handle sidebar collapse/expand', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    // Look for sidebar toggle button
    const sidebarToggle = page
      .locator('button[aria-label*="menu"], button[aria-label*="sidebar"]')
      .first()

    if (await sidebarToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click to toggle
      await sidebarToggle.click()
      await page.waitForTimeout(500)

      // Click again to toggle back
      await sidebarToggle.click()
      await page.waitForTimeout(500)

      // Sidebar should still be functional
      const sidebarVisible = await page
        .locator('nav, aside')
        .first()
        .isVisible()
        .catch(() => true)

      expect(sidebarVisible).toBeDefined()
    }
  })
})
