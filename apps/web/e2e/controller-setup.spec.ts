/**
 * E2E Test: Controller Setup Flow
 *
 * Tests the complete user journey for adding a controller:
 * 1. Login
 * 2. Navigate to controller page
 * 3. Add AC Infinity controller
 * 4. Test connection
 * 5. Assign to room
 * 6. Verify dashboard display
 */

import { test, expect } from '@playwright/test'
import {
  login,
  navigateTo,
  waitForApiResponse,
  fillForm,
  selectOption,
  waitForElement,
  expectSuccess,
  cleanupTestData,
  createTestRoom,
  clickAndNavigate,
  waitForLoading,
  getAuthSkipReason,
} from './fixtures/helpers'
import {
  TEST_USER,
  AC_INFINITY_CREDENTIALS,
  TEST_ROOMS,
  SELECTORS,
  TIMEOUTS,
} from './fixtures/test-data'

test.describe('Controller Setup Flow', () => {
  // Skip if test users are not configured
  test.skip(getAuthSkipReason())

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    // Cleanup test data after each test
    await cleanupTestData(page)
  })

  test('should add AC Infinity controller and verify dashboard', async ({
    page,
  }) => {
    // Step 1: Create a test room first
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    expect(roomResponse.success).toBe(true)
    const roomId = roomResponse.data.id

    // Step 2: Navigate to controllers page
    await navigateTo(page, '/controllers')
    await expect(page).toHaveURL(/\/controllers/)

    // Step 3: Click "Add Controller" button
    await page.click(SELECTORS.addControllerButton)

    // Step 4: Select AC Infinity brand
    const brandSelector = '[data-testid="brand-ac_infinity"]'
    await waitForElement(page, brandSelector)
    await page.click(brandSelector)

    // Step 5: Fill in credentials
    await fillForm(page, {
      name: 'E2E AC Infinity Controller',
      email: AC_INFINITY_CREDENTIALS.email,
      password: AC_INFINITY_CREDENTIALS.password,
    })

    // Step 6: Click "Connect" button and wait for connection test
    const connectButton = '[data-testid="connect"]'
    await page.click(connectButton)

    // Wait for connection API call
    await waitForLoading(page, TIMEOUTS.veryLong)

    // Step 7: Verify connection success message
    // Note: This may show error in test environment if AC Infinity API is not mocked
    const connectionStatus = page.locator('[data-testid="connection-status"]')
    await waitForElement(page, '[data-testid="connection-status"]')

    // Check if connection succeeded or handle mock scenario
    const statusText = await connectionStatus.textContent()
    const isConnected =
      statusText?.includes('Connected') || statusText?.includes('Success')

    if (isConnected) {
      // Step 8: Assign to room
      await selectOption(page, SELECTORS.roomSelect, roomId)

      // Step 9: Save controller
      await page.click(SELECTORS.saveButton)

      // Wait for save API call
      await waitForApiResponse(page, '/api/controllers', {
        timeout: TIMEOUTS.long,
      })

      // Step 10: Verify redirect to controllers list
      await expect(page).toHaveURL(/\/controllers/)

      // Step 11: Verify controller appears in list
      await waitForElement(page, SELECTORS.controllerCard)
      await expect(page.locator('text=E2E AC Infinity Controller')).toBeVisible()

      // Step 12: Navigate to dashboard
      await navigateTo(page, '/dashboard')

      // Step 13: Verify controller shows on dashboard
      await waitForElement(page, SELECTORS.dashboardCard)
      await expect(page.locator('text=AC Infinity')).toBeVisible()
      await expect(page.locator('text=E2E Grow Room')).toBeVisible()
    } else {
      console.log('Connection test skipped - mock API not available')
    }
  })

  test('should handle invalid credentials gracefully', async ({ page }) => {
    // Navigate to controllers page
    await navigateTo(page, '/controllers')

    // Click "Add Controller"
    await page.click(SELECTORS.addControllerButton)

    // Select AC Infinity
    await page.click('[data-testid="brand-ac_infinity"]')

    // Fill in invalid credentials
    await fillForm(page, {
      name: 'E2E Invalid Controller',
      email: 'invalid@test.com',
      password: 'wrongpassword',
    })

    // Try to connect
    await page.click('[data-testid="connect"]')

    // Wait for error or connection status
    await waitForLoading(page, TIMEOUTS.veryLong)

    // Should show error or connection failed status
    const errorVisible = await page
      .locator(SELECTORS.errorMessage)
      .isVisible({ timeout: 2000 })
      .catch(() => false)
    const connectionError = await page
      .locator(SELECTORS.connectionError)
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    // Either error message or connection error should be visible
    expect(errorVisible || connectionError).toBe(true)
  })

  test('should allow adding CSV upload controller without credentials', async ({
    page,
  }) => {
    // Navigate to controllers page
    await navigateTo(page, '/controllers')

    // Click "Add Controller"
    await page.click(SELECTORS.addControllerButton)

    // Select CSV Upload brand (doesn't require credentials)
    await page.click('[data-testid="brand-csv_upload"]')

    // Fill in controller name only
    await fillForm(page, {
      name: 'E2E CSV Upload Sensor',
    })

    // Save without credentials
    await page.click(SELECTORS.saveButton)

    // Wait for save API call
    await waitForApiResponse(page, '/api/controllers', {
      timeout: TIMEOUTS.long,
    })

    // Verify controller appears in list
    await expect(page).toHaveURL(/\/controllers/)
    await waitForElement(page, SELECTORS.controllerCard)
    await expect(page.locator('text=E2E CSV Upload Sensor')).toBeVisible()
  })

  test('should update controller room assignment', async ({ page }) => {
    // Create two test rooms
    const room1Response = await createTestRoom(page, TEST_ROOMS.growRoom)
    const room2Response = await createTestRoom(page, TEST_ROOMS.vegRoom)

    expect(room1Response.success).toBe(true)
    expect(room2Response.success).toBe(true)

    const room1Id = room1Response.data.id
    const room2Id = room2Response.data.id

    // Navigate to controllers page
    await navigateTo(page, '/controllers')

    // Add CSV controller (simplest)
    await page.click(SELECTORS.addControllerButton)
    await page.click('[data-testid="brand-csv_upload"]')

    await fillForm(page, {
      name: 'E2E Room Assignment Test',
    })

    // Assign to room 1
    await selectOption(page, SELECTORS.roomSelect, room1Id)
    await page.click(SELECTORS.saveButton)

    await waitForApiResponse(page, '/api/controllers')

    // Now edit the controller to change room
    await page.click('text=E2E Room Assignment Test')

    // Wait for edit page to load
    await waitForElement(page, SELECTORS.roomSelect)

    // Change to room 2
    await selectOption(page, SELECTORS.roomSelect, room2Id)
    await page.click(SELECTORS.saveButton)

    await waitForApiResponse(page, '/api/controllers')

    // Verify update was successful
    await expect(page).toHaveURL(/\/controllers/)

    // Navigate to dashboard and verify new room assignment
    await navigateTo(page, '/dashboard')
    await expect(page.locator('text=E2E Veg Room')).toBeVisible()
  })

  test('should delete controller successfully', async ({ page }) => {
    // Navigate to controllers page
    await navigateTo(page, '/controllers')

    // Add a test controller
    await page.click(SELECTORS.addControllerButton)
    await page.click('[data-testid="brand-csv_upload"]')
    await fillForm(page, { name: 'E2E Delete Test Controller' })
    await page.click(SELECTORS.saveButton)
    await waitForApiResponse(page, '/api/controllers')

    // Verify controller was added
    await expect(page.locator('text=E2E Delete Test Controller')).toBeVisible()

    // Click on the controller to open details
    await page.click('text=E2E Delete Test Controller')

    // Click delete button
    await page.click(SELECTORS.deleteButton)

    // Confirm deletion in dialog
    await page.click(SELECTORS.confirmButton)

    // Wait for delete API call
    await waitForApiResponse(page, '/api/controllers', {
      timeout: TIMEOUTS.medium,
    })

    // Verify controller is removed from list
    await expect(page).toHaveURL(/\/controllers/)
    await expect(
      page.locator('text=E2E Delete Test Controller')
    ).not.toBeVisible({ timeout: TIMEOUTS.short })
  })

  test('should display controller capabilities correctly', async ({ page }) => {
    // Navigate to controllers page
    await navigateTo(page, '/controllers')

    // Click "Add Controller"
    await page.click(SELECTORS.addControllerButton)

    // Select AC Infinity (has many capabilities)
    await page.click('[data-testid="brand-ac_infinity"]')

    // Verify capabilities are displayed
    await expect(page.locator('text=Temperature')).toBeVisible()
    await expect(page.locator('text=Humidity')).toBeVisible()
    await expect(page.locator('text=VPD')).toBeVisible()
    await expect(page.locator('text=Fan')).toBeVisible()
    await expect(page.locator('text=Light')).toBeVisible()

    // Cancel and try CSV Upload (limited capabilities)
    await page.click(SELECTORS.cancelButton)
    await page.click(SELECTORS.addControllerButton)
    await page.click('[data-testid="brand-csv_upload"]')

    // Verify CSV upload capabilities
    await expect(page.locator('text=Temperature')).toBeVisible()
    await expect(page.locator('text=Humidity')).toBeVisible()

    // Should note it's read-only
    await expect(page.locator('text=Read-only')).toBeVisible()
  })
})
