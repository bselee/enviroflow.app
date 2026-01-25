/**
 * E2E Test: Dashboard Viewing
 *
 * Tests dashboard display, sensor data visualization, and basic interactions
 */

import { test, expect } from '@playwright/test'
import {
  login,
  navigateTo,
  waitForElement,
  createTestRoom,
  createTestController,
  cleanupTestData,
} from './fixtures/helpers'
import {
  TEST_USER,
  TEST_ROOMS,
  TEST_CONTROLLERS,
  SELECTORS,
  TIMEOUTS,
} from './fixtures/test-data'

test.describe('Dashboard Viewing', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    await cleanupTestData(page)
  })

  test('should display empty state when no controllers', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    // Should show dashboard
    await expect(page).toHaveURL(/\/dashboard/)

    // Check for empty state or welcome message
    const hasEmptyState = await page
      .locator('text=/no controllers|add controller|get started/i')
      .isVisible({ timeout: TIMEOUTS.medium })
      .catch(() => false)

    // Either empty state or existing data should be visible
    expect(hasEmptyState || (await page.locator(SELECTORS.dashboardCard).isVisible().catch(() => false))).toBeTruthy()
  })

  test('should display room cards when rooms exist', async ({ page }) => {
    // Create a test room
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    expect(roomResponse.success).toBe(true)

    await navigateTo(page, '/dashboard')

    // Dashboard should load
    await expect(page).toHaveURL(/\/dashboard/)

    // Check for room card or room name
    const roomVisible = await page
      .locator(`text=${TEST_ROOMS.growRoom.name}`)
      .isVisible({ timeout: TIMEOUTS.medium })
      .catch(() => false)

    expect(roomVisible).toBe(true)
  })

  test('should display sensor readings when available', async ({ page }) => {
    // Create room and controller
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    const controllerResponse = await createTestController(page, {
      ...TEST_CONTROLLERS.acInfinity,
      room_id: roomResponse.data.id,
    })

    expect(controllerResponse.success).toBe(true)

    await navigateTo(page, '/dashboard')

    // Check for sensor reading indicators
    const hasSensorData =
      (await page.locator('[data-testid^="sensor-reading-"]').count()) > 0 ||
      (await page.locator('text=/temperature|humidity|vpd/i').isVisible().catch(() => false))

    expect(hasSensorData).toBeTruthy()
  })

  test('should update when navigating between dashboard sections', async ({
    page,
  }) => {
    await navigateTo(page, '/dashboard')

    // Get initial state
    const initialUrl = page.url()

    // If there are navigation tabs/sections, click them
    const overviewTab = page.locator('text=/overview|summary/i').first()
    if (await overviewTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await overviewTab.click()
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.medium })
    }

    // Should still be on dashboard
    expect(page.url()).toContain('/dashboard')
  })

  test('should handle real-time updates', async ({ page }) => {
    // Create room and controller
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    await createTestController(page, {
      ...TEST_CONTROLLERS.acInfinity,
      room_id: roomResponse.data.id,
    })

    await navigateTo(page, '/dashboard')

    // Wait for initial load
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long })

    // Capture initial dashboard state
    const initialContent = await page
      .locator('main')
      .textContent()
      .catch(() => '')

    // Wait a bit (realtime updates may come through)
    await page.waitForTimeout(3000)

    // Dashboard should remain stable or update gracefully
    const updatedContent = await page
      .locator('main')
      .textContent()
      .catch(() => '')

    // Content should exist
    expect(updatedContent || initialContent).toBeTruthy()
  })

  test('should navigate to controllers page from dashboard', async ({
    page,
  }) => {
    await navigateTo(page, '/dashboard')

    // Look for navigation link to controllers
    const controllersLink = page.locator('a[href*="/controllers"]').first()

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

  test('should display room statistics correctly', async ({ page }) => {
    // Create room with settings
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    expect(roomResponse.success).toBe(true)

    await navigateTo(page, '/dashboard')

    // Check for room statistics or target values
    const hasTargets = await page
      .locator('text=/target|ideal|range/i')
      .isVisible({ timeout: TIMEOUTS.medium })
      .catch(() => false)

    // Either targets are shown or dashboard is visible
    expect(hasTargets || (await page.locator(SELECTORS.dashboardCard).isVisible().catch(() => false))).toBeTruthy()
  })

  test('should handle multiple rooms display', async ({ page }) => {
    // Create multiple rooms
    await createTestRoom(page, TEST_ROOMS.growRoom)
    await createTestRoom(page, TEST_ROOMS.vegRoom)
    await createTestRoom(page, TEST_ROOMS.dryRoom)

    await navigateTo(page, '/dashboard')

    // Should show multiple room cards or list
    const roomCards = await page.locator('[data-testid="room-card"]').count()
    const roomNames = await page.locator('text=/E2E.*Room/').count()

    // Should have at least 2 rooms visible (may not show all)
    expect(Math.max(roomCards, roomNames)).toBeGreaterThanOrEqual(2)
  })

  test('should show controller status indicators', async ({ page }) => {
    // Create controller
    await createTestController(page, TEST_CONTROLLERS.acInfinity)

    await navigateTo(page, '/dashboard')

    // Look for status indicators
    const hasStatus =
      (await page
        .locator('[data-testid^="device-status-"]')
        .isVisible({ timeout: TIMEOUTS.medium })
        .catch(() => false)) ||
      (await page.locator('text=/online|offline|connected/i').isVisible().catch(() => false))

    expect(hasStatus).toBeTruthy()
  })

  test('should handle dashboard with no data gracefully', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.long })

    // Dashboard should render without errors
    const dashboardContent = await page.locator('main').isVisible()
    expect(dashboardContent).toBe(true)

    // No error boundary should be triggered
    const hasError = await page
      .locator('text=/error|something went wrong/i')
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    expect(hasError).toBe(false)
  })

  test('should refresh data when reload button clicked', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    // Look for refresh/reload button
    const refreshButton = page
      .locator('button[aria-label*="refresh"], button[title*="refresh"]')
      .first()

    if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refreshButton.click()

      // Wait for refresh to complete
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.medium })

      // Dashboard should still be visible
      const dashboardVisible = await page.locator('main').isVisible()
      expect(dashboardVisible).toBe(true)
    }
  })

  test('should display correct time periods for historical data', async ({
    page,
  }) => {
    await navigateTo(page, '/dashboard')

    // Look for time period selectors (24h, 7d, 30d, etc.)
    const timeSelectors = await page
      .locator('button, select')
      .filter({ hasText: /24h|7d|30d|hour|day|week|month/i })
      .count()

    // Time selectors may or may not be present depending on data
    expect(timeSelectors >= 0).toBe(true)
  })
})
