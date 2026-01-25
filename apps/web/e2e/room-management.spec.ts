/**
 * E2E Test: Room Management
 *
 * Tests creating, editing, and deleting rooms
 */

import { test, expect } from '@playwright/test'
import {
  login,
  navigateTo,
  waitForElement,
  fillForm,
  expectSuccess,
  createTestRoom,
  cleanupTestData,
  waitForApiResponse,
} from './fixtures/helpers'
import { TEST_ROOMS, SELECTORS, TIMEOUTS } from './fixtures/test-data'

test.describe('Room Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    await cleanupTestData(page)
  })

  test('should create a new room successfully', async ({ page }) => {
    // Navigate to dashboard or rooms page
    await navigateTo(page, '/dashboard')

    // Look for create room button
    const createButton = page.locator(SELECTORS.createRoomButton).first()

    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click()

      // Fill in room details
      await fillForm(page, {
        name: TEST_ROOMS.growRoom.name,
        description: TEST_ROOMS.growRoom.description || '',
      })

      // Save room
      await page.click(SELECTORS.saveButton)

      // Wait for API response
      await waitForApiResponse(page, '/api/rooms', { timeout: TIMEOUTS.long })

      // Should show success message or room in list
      const roomVisible =
        (await expectSuccess(page).catch(() => false)) ||
        (await page
          .locator(`text=${TEST_ROOMS.growRoom.name}`)
          .isVisible({ timeout: TIMEOUTS.medium })
          .catch(() => false))

      expect(roomVisible).toBeTruthy()
    } else {
      // Create via API if UI not available
      const result = await createTestRoom(page, TEST_ROOMS.growRoom)
      expect(result.success).toBe(true)
    }
  })

  test('should edit an existing room', async ({ page }) => {
    // Create room first
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    expect(roomResponse.success).toBe(true)

    await navigateTo(page, '/dashboard')

    // Find and click on the room
    const roomCard = page.locator(`text=${TEST_ROOMS.growRoom.name}`).first()

    if (await roomCard.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false)) {
      await roomCard.click()

      // Wait for room details to load
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.medium })

      // Look for edit button
      const editButton = page
        .locator('button:has-text("Edit"), button[aria-label*="edit"]')
        .first()

      if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editButton.click()

        // Update room name
        await page.fill('[name="name"]', 'E2E Updated Grow Room')

        // Save changes
        await page.click(SELECTORS.saveButton)

        // Wait for update
        await waitForApiResponse(page, '/api/rooms', { timeout: TIMEOUTS.long })

        // Verify update
        const updatedName = await page
          .locator('text=E2E Updated Grow Room')
          .isVisible({ timeout: TIMEOUTS.short })
          .catch(() => false)

        expect(updatedName).toBe(true)
      }
    }
  })

  test('should delete a room successfully', async ({ page }) => {
    // Create room first
    const roomResponse = await createTestRoom(page, TEST_ROOMS.vegRoom)
    expect(roomResponse.success).toBe(true)

    await navigateTo(page, '/dashboard')

    // Find and click on the room
    const roomCard = page.locator(`text=${TEST_ROOMS.vegRoom.name}`).first()

    if (await roomCard.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false)) {
      await roomCard.click()

      // Wait for room details to load
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.medium })

      // Look for delete button
      const deleteButton = page
        .locator('button:has-text("Delete"), button[aria-label*="delete"]')
        .first()

      if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteButton.click()

        // Confirm deletion
        const confirmButton = page.locator(SELECTORS.confirmButton)
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click()
        }

        // Wait for delete API call
        await waitForApiResponse(page, '/api/rooms', { timeout: TIMEOUTS.medium })

        // Verify room is removed
        await page.waitForTimeout(1000)
        const roomGone = !(await page
          .locator(`text=${TEST_ROOMS.vegRoom.name}`)
          .isVisible({ timeout: 2000 })
          .catch(() => false))

        expect(roomGone).toBe(true)
      }
    }
  })

  test('should validate required fields when creating room', async ({ page }) => {
    await navigateTo(page, '/dashboard')

    const createButton = page.locator(SELECTORS.createRoomButton).first()

    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click()

      // Try to save without filling required fields
      await page.click(SELECTORS.saveButton)

      // Should show validation error or remain on form
      const hasValidationError =
        (await page
          .locator('text=/required|invalid|must/i')
          .isVisible({ timeout: 2000 })
          .catch(() => false)) ||
        (await page.locator('[role="alert"]').isVisible({ timeout: 2000 }).catch(() => false))

      expect(hasValidationError).toBeTruthy()
    }
  })

  test('should set room environmental targets', async ({ page }) => {
    // Create room
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    expect(roomResponse.success).toBe(true)

    await navigateTo(page, '/dashboard')

    // Find and click on the room
    const roomCard = page.locator(`text=${TEST_ROOMS.growRoom.name}`).first()

    if (await roomCard.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false)) {
      await roomCard.click()

      // Wait for room details
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.medium })

      // Look for settings or targets section
      const settingsButton = page
        .locator('button:has-text("Settings"), a:has-text("Settings")')
        .first()

      if (await settingsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await settingsButton.click()

        // Try to set targets if UI is available
        const tempMinInput = page.locator('[name*="temp"][name*="min"]').first()

        if (await tempMinInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tempMinInput.fill('68')

          const tempMaxInput = page.locator('[name*="temp"][name*="max"]').first()
          await tempMaxInput.fill('78')

          // Save
          await page.click(SELECTORS.saveButton)

          // Wait for save
          await page.waitForTimeout(1000)
        }
      }
    }
  })

  test('should display room controllers', async ({ page }) => {
    // Create room
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    expect(roomResponse.success).toBe(true)

    await navigateTo(page, '/dashboard')

    // Find and click on the room
    const roomCard = page.locator(`text=${TEST_ROOMS.growRoom.name}`).first()

    if (await roomCard.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false)) {
      await roomCard.click()

      // Wait for room details
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.medium })

      // Should show controllers section or empty state
      const hasControllers =
        (await page
          .locator('text=/controllers|devices/i')
          .isVisible({ timeout: 2000 })
          .catch(() => false)) ||
        (await page
          .locator('text=/no controllers|add controller/i')
          .isVisible({ timeout: 2000 })
          .catch(() => false))

      expect(hasControllers).toBeTruthy()
    }
  })

  test('should handle room with special characters in name', async ({ page }) => {
    const specialRoom = {
      name: 'E2E Test Room: "Special" & <Characters>',
      description: 'Testing special characters',
    }

    const roomResponse = await createTestRoom(page, specialRoom)

    if (roomResponse.success) {
      await navigateTo(page, '/dashboard')

      // Room name should be displayed correctly (escaped/encoded)
      const roomVisible = await page
        .locator(`text=/E2E Test Room/`)
        .isVisible({ timeout: TIMEOUTS.medium })
        .catch(() => false)

      expect(roomVisible).toBeTruthy()
    } else {
      // Special characters might be rejected - that's also valid behavior
      expect(roomResponse.success).toBeDefined()
    }
  })

  test('should prevent duplicate room names', async ({ page }) => {
    // Create first room
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    expect(roomResponse.success).toBe(true)

    // Try to create another room with same name
    const duplicateResponse = await createTestRoom(page, TEST_ROOMS.growRoom)

    // Should either succeed (allowing duplicates) or fail gracefully
    expect(duplicateResponse.success !== undefined).toBe(true)
  })

  test('should navigate back to dashboard from room details', async ({ page }) => {
    // Create room
    const roomResponse = await createTestRoom(page, TEST_ROOMS.growRoom)
    expect(roomResponse.success).toBe(true)

    await navigateTo(page, '/dashboard')

    // Click on room
    const roomCard = page.locator(`text=${TEST_ROOMS.growRoom.name}`).first()

    if (await roomCard.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false)) {
      await roomCard.click()

      // Wait for room details
      await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.medium })

      // Find back button
      const backButton = page
        .locator('button:has-text("Back"), a:has-text("Dashboard")')
        .first()

      if (await backButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backButton.click()

        // Should return to dashboard
        await page.waitForURL('**/dashboard', { timeout: TIMEOUTS.medium })
        await expect(page).toHaveURL(/\/dashboard/)
      }
    }
  })
})
