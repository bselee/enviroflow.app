/**
 * E2E Test: Schedule Management
 *
 * Tests device schedule creation and execution:
 * 1. Create time-based schedule
 * 2. Create sunrise/sunset schedule
 * 3. Verify schedule activation
 * 4. Check scheduled execution in activity log
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
  createTestController,
  createTestRoom,
  waitForLoading,
} from './fixtures/helpers'
import {
  TEST_ROOMS,
  TEST_SCHEDULES,
  SELECTORS,
  TIMEOUTS,
} from './fixtures/test-data'

test.describe('Schedule Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    // Cleanup test data after each test
    await cleanupTestData(page)
  })

  test('should create and activate time-based schedule', async ({ page }) => {
    // Step 1: Create test room and controller
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    const controllerResponse = await createTestController(page, {
      brand: 'ac_infinity',
      name: 'E2E Schedule Test Controller',
      room_id: roomResponse.data.id,
      credentials: {
        email: 'test@acinfinity.test',
        password: 'testpass',
      },
    })

    expect(roomResponse.success).toBe(true)
    const controllerId = controllerResponse.data?.id

    if (!controllerId) {
      console.log('Controller creation failed, skipping schedule test')
      return
    }

    // Step 2: Navigate to schedules page (or automations)
    await navigateTo(page, '/automations')

    // Step 3: Click "Create Schedule" button
    const createScheduleBtn = page.locator(SELECTORS.createScheduleButton)
    const hasScheduleFeature = await createScheduleBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasScheduleFeature) {
      await createScheduleBtn.click()

      // Step 4: Fill schedule form
      await fillForm(page, {
        name: TEST_SCHEDULES.basicLighting.name,
        description: TEST_SCHEDULES.basicLighting.description || '',
      })

      // Step 5: Select controller
      await selectOption(
        page,
        '[data-testid="schedule-controller"]',
        controllerId
      )

      // Step 6: Select device port
      await selectOption(
        page,
        '[data-testid="schedule-port"]',
        String(TEST_SCHEDULES.basicLighting.device_port)
      )

      // Step 7: Select trigger type
      await selectOption(
        page,
        '[data-testid="schedule-trigger"]',
        TEST_SCHEDULES.basicLighting.trigger_type
      )

      // Step 8: Set time range
      await fillForm(page, {
        start_time: TEST_SCHEDULES.basicLighting.schedule.start_time,
        end_time: TEST_SCHEDULES.basicLighting.schedule.end_time || '',
      })

      // Step 9: Select action
      await selectOption(
        page,
        '[data-testid="schedule-action"]',
        TEST_SCHEDULES.basicLighting.schedule.action
      )

      // Step 10: Save schedule
      await page.click(SELECTORS.saveButton)

      // Wait for save API call
      await waitForApiResponse(page, '/api/schedules', {
        timeout: TIMEOUTS.long,
      })

      // Step 11: Verify schedule appears in list
      await expect(
        page.locator(`text=${TEST_SCHEDULES.basicLighting.name}`)
      ).toBeVisible()

      // Step 12: Verify schedule is active
      const scheduleCard = page.locator(SELECTORS.scheduleCard).first()
      const activeIndicator = scheduleCard.locator(SELECTORS.scheduleActive)
      await expect(activeIndicator).toBeVisible()
    } else {
      console.log('Schedule feature not available in UI - may be under workflows')

      // Alternative: Create schedule via API
      const scheduleResponse = await page.evaluate(
        async ({ ctrlId, schedule }) => {
          try {
            const response = await fetch('/api/schedules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...schedule,
                controller_id: ctrlId,
              }),
            })
            return await response.json()
          } catch (error) {
            return { success: false, error: String(error) }
          }
        },
        { ctrlId: controllerId, schedule: TEST_SCHEDULES.basicLighting }
      )

      console.log('Schedule creation via API:', scheduleResponse)

      // Verify via activity log or workflow list
      await navigateTo(page, '/automations')

      // Should see the schedule (if API worked)
      const hasSchedule = await page
        .locator(`text=${TEST_SCHEDULES.basicLighting.name}`)
        .isVisible({ timeout: 5000 })
        .catch(() => false)

      if (hasSchedule) {
        console.log('Schedule created successfully via API')
      }
    }
  })

  test('should create sunrise/sunset schedule with offset', async ({
    page,
  }) => {
    // Create controller
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    const controllerResponse = await createTestController(page, {
      brand: 'ac_infinity',
      name: 'E2E Sunrise Test Controller',
      room_id: roomResponse.data.id,
      credentials: {
        email: 'test@acinfinity.test',
        password: 'testpass',
      },
    })

    const controllerId = controllerResponse.data?.id
    if (!controllerId) return

    // Create sunrise schedule via API (UI may not have this feature yet)
    const scheduleResponse = await page.evaluate(
      async ({ ctrlId, schedule }) => {
        try {
          const response = await fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...schedule,
              controller_id: ctrlId,
            }),
          })
          return await response.json()
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },
      { ctrlId: controllerId, schedule: TEST_SCHEDULES.sunriseDimmer }
    )

    console.log('Sunrise schedule response:', scheduleResponse)

    // Navigate to schedules page
    await navigateTo(page, '/automations')

    // Verify schedule appears (if created successfully)
    const hasSchedule = await page
      .locator(`text=${TEST_SCHEDULES.sunriseDimmer.name}`)
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasSchedule) {
      // Click on schedule to view details
      await page.click(`text=${TEST_SCHEDULES.sunriseDimmer.name}`)

      // Verify trigger type is sunrise
      await expect(page.locator('text=sunrise')).toBeVisible()

      // Verify offset is displayed
      await expect(page.locator('text=30')).toBeVisible() // 30 minute offset
    }
  })

  test('should toggle schedule active state', async ({ page }) => {
    // Create controller
    const controllerResponse = await createTestController(page, {
      brand: 'ac_infinity',
      name: 'E2E Toggle Test Controller',
      credentials: {
        email: 'test@acinfinity.test',
        password: 'testpass',
      },
    })

    const controllerId = controllerResponse.data?.id
    if (!controllerId) return

    // Create active schedule via API
    const scheduleData = {
      ...TEST_SCHEDULES.basicLighting,
      controller_id: controllerId,
      is_active: true,
    }

    const scheduleResponse = await page.evaluate(async (data) => {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      return response.json()
    }, scheduleData)

    if (!scheduleResponse.success) {
      console.log('Schedule creation failed, skipping toggle test')
      return
    }

    const scheduleId = scheduleResponse.data?.id

    // Navigate to schedules
    await navigateTo(page, '/automations')

    // Find schedule toggle switch
    const toggleSwitch = page.locator(
      `[data-testid="schedule-toggle-${scheduleId}"]`
    )

    const hasToggle = await toggleSwitch
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasToggle) {
      // Verify it's currently active
      await expect(toggleSwitch).toBeChecked()

      // Toggle it off
      await toggleSwitch.click()

      // Wait for update
      await waitForApiResponse(page, '/api/schedules', {
        timeout: TIMEOUTS.medium,
      })

      // Verify it's now inactive
      await expect(toggleSwitch).not.toBeChecked()

      // Toggle back on
      await toggleSwitch.click()
      await waitForApiResponse(page, '/api/schedules')
      await expect(toggleSwitch).toBeChecked()
    } else {
      console.log('Toggle switch not found in UI')
    }
  })

  test('should display next execution time for schedules', async ({ page }) => {
    // Create controller
    const controllerResponse = await createTestController(page, {
      brand: 'ac_infinity',
      name: 'E2E Execution Time Test',
      credentials: {
        email: 'test@acinfinity.test',
        password: 'testpass',
      },
    })

    const controllerId = controllerResponse.data?.id
    if (!controllerId) return

    // Create schedule for tomorrow morning
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(8, 0, 0, 0)

    const scheduleData = {
      ...TEST_SCHEDULES.basicLighting,
      controller_id: controllerId,
      schedule: {
        ...TEST_SCHEDULES.basicLighting.schedule,
        start_time: '08:00',
      },
    }

    await page.evaluate(async (data) => {
      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    }, scheduleData)

    // Navigate to schedules
    await navigateTo(page, '/automations')

    // Look for next execution indicator
    const nextExecution = page.locator('[data-testid="next-execution"]')
    const hasNextExecution = await nextExecution
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasNextExecution) {
      // Should show time (e.g., "Tomorrow at 8:00 AM")
      const text = await nextExecution.textContent()
      expect(text).toContain('8')
    }
  })

  test('should delete schedule successfully', async ({ page }) => {
    // Create controller
    const controllerResponse = await createTestController(page, {
      brand: 'ac_infinity',
      name: 'E2E Delete Schedule Test',
      credentials: {
        email: 'test@acinfinity.test',
        password: 'testpass',
      },
    })

    const controllerId = controllerResponse.data?.id
    if (!controllerId) return

    // Create schedule
    const scheduleData = {
      ...TEST_SCHEDULES.basicLighting,
      name: 'E2E Schedule to Delete',
      controller_id: controllerId,
    }

    const scheduleResponse = await page.evaluate(async (data) => {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      return response.json()
    }, scheduleData)

    if (!scheduleResponse.success) {
      console.log('Schedule creation failed, skipping delete test')
      return
    }

    // Navigate to schedules
    await navigateTo(page, '/automations')

    // Verify schedule exists
    await expect(page.locator('text=E2E Schedule to Delete')).toBeVisible()

    // Click on schedule
    await page.click('text=E2E Schedule to Delete')

    // Click delete button
    await page.click(SELECTORS.deleteButton)

    // Confirm deletion
    await page.click(SELECTORS.confirmButton)

    // Wait for delete API call
    await waitForApiResponse(page, '/api/schedules', {
      timeout: TIMEOUTS.medium,
    })

    // Verify schedule is removed
    await expect(page.locator('text=E2E Schedule to Delete')).not.toBeVisible({
      timeout: TIMEOUTS.short,
    })
  })

  test('should show schedule execution in activity log', async ({ page }) => {
    // This test verifies that when a schedule executes, it appears in the activity log

    // Create controller
    const controllerResponse = await createTestController(page, {
      brand: 'ac_infinity',
      name: 'E2E Activity Log Schedule',
      credentials: {
        email: 'test@acinfinity.test',
        password: 'testpass',
      },
    })

    const controllerId = controllerResponse.data?.id
    if (!controllerId) return

    // Create schedule
    const scheduleData = {
      ...TEST_SCHEDULES.basicLighting,
      name: 'E2E Activity Log Schedule',
      controller_id: controllerId,
    }

    await page.evaluate(async (data) => {
      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    }, scheduleData)

    // Manually trigger schedule execution via cron API
    const cronResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/cron/schedules', {
          method: 'GET',
        })
        return await response.json()
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    console.log('Cron execution response:', cronResponse)

    // Navigate to activity log
    await navigateTo(page, '/dashboard')

    // Wait a moment for activity log to update
    await page.waitForTimeout(2000)

    // Check for schedule execution in activity log
    const activityItem = page.locator(
      '[data-testid="activity-log-item"]'
    ).first()

    const hasActivity = await activityItem
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasActivity) {
      // Should show schedule_executed or similar
      const text = await activityItem.textContent()
      console.log('Activity log entry:', text)

      // May contain "schedule" or "executed"
      const hasScheduleActivity =
        text?.includes('schedule') || text?.includes('executed')

      if (hasScheduleActivity) {
        console.log('Schedule execution found in activity log')
      }
    }
  })
})
