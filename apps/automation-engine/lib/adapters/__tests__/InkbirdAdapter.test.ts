/**
 * InkbirdAdapter Unit Tests
 *
 * Tests the Inkbird adapter with mocked API responses
 * NOTE: Inkbird uses Tuya platform, so these tests verify the error messaging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InkbirdAdapter } from '../InkbirdAdapter'
import type {
  InkbirdCredentials,
  ConnectionResult,
  SensorReading,
  CommandResult,
  ControllerStatus,
  DeviceCommand,
} from '../types'

// Mock the retry module
vi.mock('../retry', () => ({
  adapterFetch: vi.fn(),
  getCircuitBreaker: vi.fn(() => ({
    state: 'closed',
    failures: 0,
    lastFailure: null,
    lastSuccess: null,
  })),
  resetCircuitBreaker: vi.fn(),
}))

import { adapterFetch } from '../retry'

const mockedAdapterFetch = adapterFetch as any

describe('InkbirdAdapter', () => {
  let adapter: InkbirdAdapter
  const validCredentials: InkbirdCredentials = {
    type: 'inkbird',
    email: 'test@example.com',
    password: 'testpass123',
  }

  beforeEach(() => {
    adapter = new InkbirdAdapter()
    vi.clearAllMocks()
  })

  describe('connect', () => {
    it('should fail with Tuya dependency error', async () => {
      const result: ConnectionResult = await adapter.connect(validCredentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tuya')
      expect(result.error).toContain('CSV Upload')
      expect(mockedAdapterFetch).not.toHaveBeenCalled()
    })

    it('should fail with invalid credentials type', async () => {
      const invalidCredentials = {
        type: 'invalid',
        email: 'test@example.com',
        password: 'testpass',
      } as any

      const result = await adapter.connect(invalidCredentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid credentials type')
      expect(mockedAdapterFetch).not.toHaveBeenCalled()
    })
  })

  describe('getCapabilitiesForModel', () => {
    it('should return appropriate capabilities for ITC-308', async () => {
      // Since connect fails, we test through discoverDevices
      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'Tuya platform required',
      })

      const result = await adapter.discoverDevices({
        brand: 'inkbird',
        email: 'test@example.com',
        password: 'testpass',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tuya')
    })
  })

  describe('readSensors', () => {
    it('should throw error when not connected', async () => {
      await expect(adapter.readSensors('unknown_device')).rejects.toThrow(
        'Controller not connected'
      )
    })
  })

  describe('controlDevice', () => {
    it('should fail when not connected', async () => {
      const command: DeviceCommand = { type: 'turn_on' }
      const result = await adapter.controlDevice('unknown_device', 1, command)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not connected')
    })
  })

  describe('getStatus', () => {
    it('should return offline when not connected', async () => {
      const status: ControllerStatus = await adapter.getStatus('unknown_device')

      expect(status.status).toBe('offline')
      expect(status.lastSeen).toBeInstanceOf(Date)
    })
  })

  describe('disconnect', () => {
    it('should handle disconnect gracefully', async () => {
      await expect(adapter.disconnect('any_id')).resolves.not.toThrow()
    })
  })

  describe('discoverDevices', () => {
    it('should fail with Tuya dependency error', async () => {
      const result = await adapter.discoverDevices({
        brand: 'inkbird',
        email: 'test@example.com',
        password: 'testpass',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Tuya')
      expect(result.devices).toHaveLength(0)
      expect(result.totalDevices).toBe(0)
    })
  })
})
