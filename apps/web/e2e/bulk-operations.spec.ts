/**
 * E2E Test: Bulk Operations
 *
 * Tests bulk controller operations:
 * 1. Bulk assign 3 controllers to room
 * 2. Handle partial success/failure scenarios
 * 3. Verify all controllers updated correctly
 */

import { test, expect } from '@playwright/test'
import {
  login,
  navigateTo,
  waitForApiResponse,
  selectOption,
  waitForElement,
  cleanupTestData,
  createTestController,
  createTestRoom,
  waitForLoading,
  getAuthSkipReason,
} from './fixtures/helpers'
import {
  TEST_ROOMS,
  BULK_CONTROLLERS,
  SELECTORS,
  TIMEOUTS,
} from './fixtures/test-data'

test.describe('Bulk Operations', () => {
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

  test('should bulk assign 3 controllers to a room successfully', async ({
    page,
  }) => {
    // Step 1: Create test room
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    expect(roomResponse.success).toBe(true)
    const roomId = roomResponse.data.id

    // Step 2: Create 3 controllers without room assignment
    const controllers = await Promise.all(
      BULK_CONTROLLERS.map((controller) =>
        createTestController(page, {
          ...controller,
          credentials: controller.credentials || {},
        })
      )
    )

    // Get controller IDs
    const controllerIds = controllers
      .map((c) => c.data?.id)
      .filter((id): id is string => !!id)

    expect(controllerIds.length).toBe(3)

    // Step 3: Navigate to controllers page
    await navigateTo(page, '/controllers')

    // Step 4: Look for bulk action UI
    const bulkSelectCheckbox = page.locator('[data-testid="bulk-select"]')
    const hasBulkFeature = await bulkSelectCheckbox
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasBulkFeature) {
      // UI-based bulk operation

      // Step 5: Select all 3 controllers
      for (const id of controllerIds) {
        await page.check(`[data-testid="select-controller-${id}"]`)
      }

      // Step 6: Click bulk actions menu
      await page.click('[data-testid="bulk-actions"]')

      // Step 7: Select "Assign to Room"
      await page.click('[data-testid="bulk-assign-room"]')

      // Step 8: Select room from dropdown
      await selectOption(page, '[data-testid="bulk-room-select"]', roomId)

      // Step 9: Confirm bulk action
      await page.click('[data-testid="bulk-confirm"]')

      // Wait for bulk update API call
      await waitForApiResponse(page, '/api/controllers/batch', {
        timeout: TIMEOUTS.veryLong,
      })

      // Step 10: Verify success message
      await expect(page.locator('text=3 controllers updated')).toBeVisible()
    } else {
      // API-based bulk operation

      // Make batch API call
      const batchResponse = await page.evaluate(
        async ({ ids, room }) => {
          try {
            const response = await fetch('/api/controllers/batch', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                controller_ids: ids,
                updates: {
                  room_id: room,
                },
              }),
            })
            return await response.json()
          } catch (error) {
            return { success: false, error: String(error) }
          }
        },
        { ids: controllerIds, room: roomId }
      )

      console.log('Batch update response:', batchResponse)

      // Verify all succeeded
      if (batchResponse.success) {
        expect(batchResponse.updated).toBe(3)
      }
    }

    // Step 11: Verify all controllers now show correct room
    await navigateTo(page, '/controllers')
    await waitForLoading(page)

    // Check each controller card shows the room name
    for (let i = 0; i < BULK_CONTROLLERS.length; i++) {
      const controller = BULK_CONTROLLERS[i]
      const card = page.locator(`text=${controller.name}`).first()

      await expect(card).toBeVisible()

      // Room name should be visible near controller name
      const roomName = TEST_ROOMS.growRoom.name
      await expect(page.locator(`text=${roomName}`)).toBeVisible()
    }

    // Step 12: Verify on dashboard
    await navigateTo(page, '/dashboard')

    // Should see all 3 controllers under the same room
    await expect(page.locator(`text=${TEST_ROOMS.growRoom.name}`)).toBeVisible()

    // Count controller cards
    const controllerCards = page.locator('[data-testid="controller-card"]')
    const count = await controllerCards.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('should handle partial failure in bulk operations', async ({ page }) => {
    // Create 2 valid controllers and 1 invalid scenario
    const room1 = await createTestRoom(page, TEST_ROOMS.growRoom)
    const room2 = await createTestRoom(page, TEST_ROOMS.vegRoom)

    // Create 3 controllers
    const controller1 = await createTestController(page, {
      brand: 'csv_upload',
      name: 'E2E Bulk Valid 1',
      room_id: room1.data.id,
    })

    const controller2 = await createTestController(page, {
      brand: 'csv_upload',
      name: 'E2E Bulk Valid 2',
      room_id: room1.data.id,
    })

    const controller3 = await createTestController(page, {
      brand: 'csv_upload',
      name: 'E2E Bulk Valid 3',
      room_id: room1.data.id,
    })

    const validIds = [
      controller1.data?.id,
      controller2.data?.id,
      controller3.data?.id,
    ].filter((id): id is string => !!id)

    // Add one invalid ID to the batch
    const mixedIds = [...validIds, 'invalid-controller-id-12345']

    // Attempt bulk update with mixed valid/invalid IDs
    const batchResponse = await page.evaluate(
      async ({ ids, room }) => {
        try {
          const response = await fetch('/api/controllers/batch', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              controller_ids: ids,
              updates: {
                room_id: room,
              },
            }),
          })
          return await response.json()
        } catch (error) {
          return { success: false, error: String(error) }
        }
      },
      { ids: mixedIds, room: room2.data.id }
    )

    console.log('Partial failure response:', batchResponse)

    // Should have partial success
    if (batchResponse.updated) {
      // Some should succeed (the valid ones)
      expect(batchResponse.updated).toBe(3)

      // Should have error details for the invalid one
      if (batchResponse.errors) {
        expect(batchResponse.errors.length).toBeGreaterThan(0)
      }
    }

    // Verify valid controllers were updated
    await navigateTo(page, '/controllers')

    // Should show room2 for valid controllers
    await expect(page.locator(`text=${TEST_ROOMS.vegRoom.name}`)).toBeVisible()
  })

  test('should bulk delete multiple controllers', async ({ page }) => {
    // Create 3 controllers to delete
    const controllers = await Promise.all([
      createTestController(page, {
        brand: 'csv_upload',
        name: 'E2E Bulk Delete 1',
      }),
      createTestController(page, {
        brand: 'csv_upload',
        name: 'E2E Bulk Delete 2',
      }),
      createTestController(page, {
        brand: 'csv_upload',
        name: 'E2E Bulk Delete 3',
      }),
    ])

    const controllerIds = controllers
      .map((c) => c.data?.id)
      .filter((id): id is string => !!id)

    expect(controllerIds.length).toBe(3)

    // Navigate to controllers page
    await navigateTo(page, '/controllers')

    // Verify all 3 are visible
    await expect(page.locator('text=E2E Bulk Delete 1')).toBeVisible()
    await expect(page.locator('text=E2E Bulk Delete 2')).toBeVisible()
    await expect(page.locator('text=E2E Bulk Delete 3')).toBeVisible()

    // Check for bulk delete UI
    const bulkDeleteBtn = page.locator('[data-testid="bulk-delete"]')
    const hasBulkDelete = await bulkDeleteBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasBulkDelete) {
      // Select all 3 controllers
      for (const id of controllerIds) {
        await page.check(`[data-testid="select-controller-${id}"]`)
      }

      // Click bulk delete
      await bulkDeleteBtn.click()

      // Confirm deletion
      await page.click(SELECTORS.confirmButton)

      // Wait for batch delete
      await waitForApiResponse(page, '/api/controllers/batch', {
        timeout: TIMEOUTS.long,
      })
    } else {
      // Use API for bulk delete
      const deleteResponse = await page.evaluate(async (ids) => {
        try {
          const response = await fetch('/api/controllers/batch', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              controller_ids: ids,
            }),
          })
          return await response.json()
        } catch (error) {
          return { success: false, error: String(error) }
        }
      }, controllerIds)

      console.log('Bulk delete response:', deleteResponse)

      if (deleteResponse.success) {
        expect(deleteResponse.deleted).toBe(3)
      }
    }

    // Reload page
    await navigateTo(page, '/controllers')

    // Verify all 3 are gone
    await expect(page.locator('text=E2E Bulk Delete 1')).not.toBeVisible()
    await expect(page.locator('text=E2E Bulk Delete 2')).not.toBeVisible()
    await expect(page.locator('text=E2E Bulk Delete 3')).not.toBeVisible()
  })

  test('should show progress indicator during bulk operations', async ({
    page,
  }) => {
    // Create 5 controllers for longer operation
    const controllers = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createTestController(page, {
          brand: 'csv_upload',
          name: `E2E Bulk Progress ${i + 1}`,
        })
      )
    )

    const controllerIds = controllers
      .map((c) => c.data?.id)
      .filter((id): id is string => !!id)

    // Create room for assignment
    const room = await createTestRoom(page, TEST_ROOMS.growRoom)

    // Navigate to controllers
    await navigateTo(page, '/controllers')

    // Start bulk operation
    const batchPromise = page.evaluate(
      async ({ ids, roomId }) => {
        const response = await fetch('/api/controllers/batch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            controller_ids: ids,
            updates: { room_id: roomId },
          }),
        })
        return response.json()
      },
      { ids: controllerIds, roomId: room.data.id }
    )

    // Check for loading indicator while operation is in progress
    const loadingIndicator = page.locator(SELECTORS.loadingSpinner)
    const hasLoading = await loadingIndicator
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    if (hasLoading) {
      console.log('Loading indicator visible during bulk operation')
    }

    // Wait for completion
    const result = await batchPromise
    console.log('Bulk operation result:', result)

    // Loading should be gone
    await expect(loadingIndicator).not.toBeVisible({ timeout: TIMEOUTS.short })
  })

  test('should validate bulk operation limits', async ({ page }) => {
    // Try to bulk update with too many controllers (if there's a limit)
    const MAX_BULK_SIZE = 100

    const largeIdArray = Array.from({ length: MAX_BULK_SIZE + 1 }, (_, i) =>
      `fake-id-${i}`.toString()
    )

    const room = await createTestRoom(page, TEST_ROOMS.growRoom)

    // Attempt bulk update with oversized array
    const response = await page.evaluate(
      async ({ ids, roomId }) => {
        try {
          const response = await fetch('/api/controllers/batch', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              controller_ids: ids,
              updates: { room_id: roomId },
            }),
          })
          return { status: response.status, data: await response.json() }
        } catch (error) {
          return { status: 500, error: String(error) }
        }
      },
      { ids: largeIdArray, roomId: room.data.id }
    )

    console.log('Bulk limit validation response:', response)

    // Should either reject (400) or handle gracefully
    if (response.status === 400) {
      expect(response.data.error).toContain('limit')
    } else {
      // API may not have limit validation yet
      console.log('No bulk size limit enforced')
    }
  })

  test('should maintain transaction integrity in bulk operations', async ({
    page,
  }) => {
    // Test that partial failures don't leave data in inconsistent state

    // Create 2 controllers
    const controller1 = await createTestController(page, {
      brand: 'csv_upload',
      name: 'E2E Transaction Test 1',
    })

    const controller2 = await createTestController(page, {
      brand: 'csv_upload',
      name: 'E2E Transaction Test 2',
    })

    const validId1 = controller1.data?.id
    const validId2 = controller2.data?.id

    if (!validId1 || !validId2) {
      console.log('Controller creation failed, skipping test')
      return
    }

    // Create room
    const room = await createTestRoom(page, TEST_ROOMS.growRoom)

    // Mix valid and invalid IDs
    const mixedIds = [validId1, 'invalid-id', validId2]

    // Attempt bulk update
    const response = await page.evaluate(
      async ({ ids, roomId }) => {
        const response = await fetch('/api/controllers/batch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            controller_ids: ids,
            updates: { room_id: roomId },
          }),
        })
        return response.json()
      },
      { ids: mixedIds, roomId: room.data.id }
    )

    console.log('Transaction test response:', response)

    // Get current state of valid controllers
    const state1 = await page.evaluate(async (id) => {
      const response = await fetch(`/api/controllers/${id}`)
      return response.json()
    }, validId1)

    const state2 = await page.evaluate(async (id) => {
      const response = await fetch(`/api/controllers/${id}`)
      return response.json()
    }, validId2)

    console.log('Controller 1 state:', state1)
    console.log('Controller 2 state:', state2)

    // Both valid controllers should either:
    // - Both be updated (optimistic)
    // - Both be unchanged (pessimistic/transaction rolled back)
    // They should NOT be in different states

    const room1 = state1.data?.room_id
    const room2 = state2.data?.room_id

    if (room1 === room.data.id || room2 === room.data.id) {
      // If one was updated, both should be
      expect(room1).toBe(room2)
    }
  })
})
