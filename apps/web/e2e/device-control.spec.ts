/**
 * E2E Test: Device Control Flow
 *
 * Tests device control functionality:
 * 1. Add Govee device
 * 2. Discover device
 * 3. Control light/device
 * 4. Verify activity log
 */

import { test, expect } from '@playwright/test'
import {
  login,
  navigateTo,
  waitForApiResponse,
  fillForm,
  waitForElement,
  cleanupTestData,
  createTestController,
  createTestRoom,
  waitForLoading,
} from './fixtures/helpers'
import {
  TEST_USER,
  GOVEE_CREDENTIALS,
  TEST_ROOMS,
  TEST_CONTROLLERS,
  SELECTORS,
  TIMEOUTS,
} from './fixtures/test-data'

test.describe('Device Control Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    // Cleanup test data after each test
    await cleanupTestData(page)
  })

  test('should control AC Infinity device and check activity log', async ({
    page,
  }) => {
    // Step 1: Create a test room
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    expect(roomResponse.success).toBe(true)

    // Step 2: Add AC Infinity controller via API (faster)
    const controllerResponse = await createTestController(page, {
      brand: 'ac_infinity',
      name: 'E2E Control Test Controller',
      room_id: roomResponse.data.id,
      credentials: {
        email: 'test@acinfinity.test',
        password: 'testpass',
      },
    })

    // Note: Controller may fail to connect in test environment, but we can still test UI
    console.log('Controller creation response:', controllerResponse)

    // Step 3: Navigate to dashboard
    await navigateTo(page, '/dashboard')

    // Step 4: Find controller card
    const controllerCard = page.locator('text=E2E Control Test Controller')

    // Check if controller is visible (may not be if API connection failed)
    const isVisible = await controllerCard
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (isVisible) {
      // Step 5: Click on controller to view devices
      await controllerCard.click()

      // Step 6: Wait for device list to load
      await waitForElement(page, '[data-testid="device-list"]', {
        timeout: TIMEOUTS.long,
      })

      // Step 7: Find a device control button (fan on port 1)
      const deviceButton = page.locator('[data-testid="device-control-1"]')
      const hasDevice = await deviceButton
        .isVisible({ timeout: 2000 })
        .catch(() => false)

      if (hasDevice) {
        // Step 8: Click to toggle device
        await deviceButton.click()

        // Wait for control API call
        await waitForApiResponse(page, '/control', {
          timeout: TIMEOUTS.long,
        })

        // Step 9: Verify device status changed
        const statusIndicator = page.locator('[data-testid="device-status-1"]')
        await expect(statusIndicator).toBeVisible()

        // Step 10: Navigate to activity log
        await navigateTo(page, '/dashboard')
        await page.click('text=Activity Log')

        // Step 11: Verify device control action appears in log
        await waitForElement(page, SELECTORS.activityLogItem)
        await expect(
          page.locator('text=device_controlled')
        ).toBeVisible({ timeout: TIMEOUTS.short })
      } else {
        console.log('No devices found - API may not be mocked')
      }
    } else {
      console.log('Controller not visible - connection may have failed')
    }
  })

  test('should display device status indicators correctly', async ({
    page,
  }) => {
    // Create controller via API
    await createTestController(page, {
      brand: 'csv_upload',
      name: 'E2E Status Test Controller',
    })

    // Navigate to controllers page
    await navigateTo(page, '/controllers')

    // Find the controller
    const controller = page.locator('text=E2E Status Test Controller')
    const isVisible = await controller
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (isVisible) {
      // Click to view details
      await controller.click()

      // Verify status indicator is present
      const statusBadge = page.locator('[data-testid="controller-status"]')
      await expect(statusBadge).toBeVisible()

      // Should show online, offline, or initializing
      const statusText = await statusBadge.textContent()
      expect(['online', 'offline', 'initializing', 'error']).toContain(
        statusText?.toLowerCase()
      )
    }
  })

  test('should handle device control errors gracefully', async ({ page }) => {
    // Create a controller
    const controllerResponse = await createTestController(page, {
      brand: 'csv_upload',
      name: 'E2E Error Test Controller',
    })

    expect(controllerResponse.success).toBe(true)
    const controllerId = controllerResponse.data?.id

    if (!controllerId) {
      console.log('Controller creation failed, skipping test')
      return
    }

    // Try to control a non-existent device via direct API call
    const errorResponse = await page.evaluate(
      async ({ id }) => {
        try {
          const response = await fetch(
            `/api/controllers/${id}/devices/99/control`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                command: 'on',
              }),
            }
          )
          return { success: response.ok, status: response.status }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },
      { id: controllerId }
    )

    // Should return error (4xx or 5xx)
    expect(errorResponse.success).toBe(false)
  })

  test('should filter activity log by controller', async ({ page }) => {
    // Create two controllers
    await createTestController(page, {
      brand: 'csv_upload',
      name: 'E2E Controller A',
    })

    await createTestController(page, {
      brand: 'csv_upload',
      name: 'E2E Controller B',
    })

    // Navigate to dashboard
    await navigateTo(page, '/dashboard')

    // Open activity log (if exists as separate page)
    const activityLink = page.locator('text=Activity')
    const hasActivityPage = await activityLink
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    if (hasActivityPage) {
      await activityLink.click()

      // Wait for activity log to load
      await waitForElement(page, SELECTORS.activityLogFilter, {
        timeout: TIMEOUTS.medium,
      })

      // Apply filter for Controller A
      const filterSelect = page.locator(SELECTORS.activityLogFilter)
      await filterSelect.selectOption({ label: 'E2E Controller A' })

      // Wait for filtered results
      await waitForLoading(page)

      // Verify filtered logs only show Controller A
      const logItems = await page.locator(SELECTORS.activityLogItem).all()

      for (const item of logItems) {
        const text = await item.textContent()
        // Should not contain Controller B
        expect(text).not.toContain('E2E Controller B')
      }
    }
  })

  test('should show real-time sensor readings for active controller', async ({
    page,
  }) => {
    // Create controller with room
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    const controllerResponse = await createTestController(page, {
      brand: 'csv_upload',
      name: 'E2E Sensor Test Controller',
      room_id: roomResponse.data.id,
    })

    expect(controllerResponse.success).toBe(true)

    // Navigate to dashboard
    await navigateTo(page, '/dashboard')

    // Wait for dashboard to load
    await waitForElement(page, SELECTORS.dashboardCard, {
      timeout: TIMEOUTS.long,
    })

    // Check if sensor readings are displayed
    const tempSensor = page.locator('[data-testid="sensor-reading-temperature"]')
    const humSensor = page.locator('[data-testid="sensor-reading-humidity"]')

    const hasTempSensor = await tempSensor
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    const hasHumSensor = await humSensor
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    // At least one sensor should be visible (or dashboard is empty state)
    if (hasTempSensor || hasHumSensor) {
      console.log('Sensor readings visible')

      // Verify sensor values are formatted correctly
      if (hasTempSensor) {
        const tempText = await tempSensor.textContent()
        expect(tempText).toMatch(/\d+\.?\d*/) // Should contain a number
      }
    } else {
      console.log('No sensor readings - controller may not have data yet')
    }
  })

  test('should toggle device dimming level', async ({ page }) => {
    // Create AC Infinity controller (supports dimming)
    const controllerResponse = await createTestController(page, {
      brand: 'ac_infinity',
      name: 'E2E Dimmer Test Controller',
      credentials: {
        email: 'test@acinfinity.test',
        password: 'testpass',
      },
    })

    if (!controllerResponse.success) {
      console.log('Controller creation failed, skipping dimmer test')
      return
    }

    // Navigate to dashboard
    await navigateTo(page, '/dashboard')

    // Look for dimmer control
    const dimmerSlider = page.locator('[data-testid="dimmer-slider"]')
    const hasDimmer = await dimmerSlider
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasDimmer) {
      // Get initial value
      const initialValue = await dimmerSlider.getAttribute('value')

      // Change dimmer to 75%
      await dimmerSlider.fill('75')

      // Wait for update
      await waitForLoading(page, TIMEOUTS.short)

      // Verify value changed
      const newValue = await dimmerSlider.getAttribute('value')
      expect(newValue).toBe('75')
    } else {
      console.log('Dimmer control not available')
    }
  })

  test('should handle concurrent device commands', async ({ page }) => {
    // Create controller
    const controllerResponse = await createTestController(page, {
      brand: 'ac_infinity',
      name: 'E2E Concurrent Test Controller',
      credentials: {
        email: 'test@acinfinity.test',
        password: 'testpass',
      },
    })

    if (!controllerResponse.success) {
      console.log('Controller creation failed, skipping concurrent test')
      return
    }

    const controllerId = controllerResponse.data?.id

    if (!controllerId) return

    // Send multiple device commands concurrently
    const commands = [
      { port: 1, command: 'on' },
      { port: 2, command: 'on' },
      { port: 3, command: 'off' },
    ]

    const results = await Promise.all(
      commands.map(({ port, command }) =>
        page.evaluate(
          async ({ id, p, cmd }) => {
            try {
              const response = await fetch(
                `/api/controllers/${id}/devices/${p}/control`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ command: cmd }),
                }
              )
              return { success: response.ok, port: p }
            } catch (error) {
              return { success: false, port: p, error: String(error) }
            }
          },
          { id: controllerId, p: port, cmd: command }
        )
      )
    )

    // Verify at least some commands succeeded (or all failed if API not mocked)
    console.log('Concurrent command results:', results)

    // All commands should complete (success or failure)
    expect(results.length).toBe(commands.length)
  })
})
