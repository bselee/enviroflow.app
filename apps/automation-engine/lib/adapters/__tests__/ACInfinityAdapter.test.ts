/**
 * ACInfinityAdapter Unit Tests
 *
 * Tests the AC Infinity adapter with mocked API responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ACInfinityAdapter } from '../ACInfinityAdapter'
import type {
  ACInfinityCredentials,
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

describe('ACInfinityAdapter', () => {
  let adapter: ACInfinityAdapter
  const validCredentials: ACInfinityCredentials = {
    type: 'ac_infinity',
    email: 'test@example.com',
    password: 'testpass123',
  }
  const testDeviceId = 'dev_12345'

  beforeEach(() => {
    adapter = new ACInfinityAdapter()
    vi.clearAllMocks()
  })

  describe('connect', () => {
    it('should successfully connect with valid credentials', async () => {
      // Mock login response
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          msg: 'Success',
          data: {
            appId: 'token123',
            userId: 'user123',
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      // Mock device list response
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          msg: 'Success',
          data: [
            {
              devId: testDeviceId,
              devCode: 'AC001',
              devName: 'Test Controller',
              devType: 3,
              firmwareVersion: '1.0.0',
              online: true,
            },
          ],
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      // Mock device capabilities response
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          msg: 'Success',
          data: {
            devId: testDeviceId,
            devName: 'Test Controller',
            devType: 3,
            portData: [
              {
                portId: 1,
                portName: 'Port 1',
                portType: 1,
                devType: 11,
                isSupport: true,
                supportDim: 1,
                onOff: 0,
                speak: 0,
                surplus: 0,
              },
            ],
            sensorData: [
              {
                sensorType: 1,
                sensorName: 'Temperature',
                sensorValue: 2350, // 23.5°C
                unit: 'C',
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result: ConnectionResult = await adapter.connect(validCredentials)

      expect(result.success).toBe(true)
      expect(result.controllerId).toBe(testDeviceId)
      expect(result.metadata.brand).toBe('ac_infinity')
      expect(result.metadata.model).toBe('Test Controller')
      expect(result.metadata.capabilities.sensors).toBeDefined()
      expect(result.metadata.capabilities.devices).toBeDefined()
      expect(mockedAdapterFetch).toHaveBeenCalledTimes(3)
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

    it('should fail with invalid email or password', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 1002,
          msg: 'Invalid password',
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.connect(validCredentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid email or password')
    })

    it('should handle no devices found', async () => {
      // Mock successful login
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: { appId: 'token123' },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      // Mock empty device list
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: [],
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.connect(validCredentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No AC Infinity devices found')
    })

    it('should handle network errors', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
        attempts: 3,
        totalTimeMs: 5000,
        circuitState: 'closed',
      })

      const result = await adapter.connect(validCredentials)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('readSensors', () => {
    beforeEach(async () => {
      // Setup connection
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: { code: 200, data: { appId: 'token123' } },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: [
            {
              devId: testDeviceId,
              devName: 'Test Controller',
              devType: 3,
              online: true,
            },
          ],
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            portData: [],
            sensorData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await adapter.connect(validCredentials)
      vi.clearAllMocks()
    })

    it('should read temperature and humidity sensors', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            sensorData: [
              {
                sensorType: 1,
                sensorName: 'Temperature',
                sensorValue: 2350, // 23.5°C
                unit: 'C',
              },
              {
                sensorType: 2,
                sensorName: 'Humidity',
                sensorValue: 6500, // 65%
                unit: '%',
              },
            ],
            portData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings: SensorReading[] = await adapter.readSensors(testDeviceId)

      expect(readings.length).toBeGreaterThan(0)
      const tempReading = readings.find((r) => r.type === 'temperature')
      const humidityReading = readings.find((r) => r.type === 'humidity')

      expect(tempReading).toBeDefined()
      expect(tempReading?.value).toBeCloseTo(74.3, 1) // 23.5°C ≈ 74.3°F
      expect(tempReading?.unit).toBe('F')

      expect(humidityReading).toBeDefined()
      expect(humidityReading?.value).toBeCloseTo(65, 1)
      expect(humidityReading?.unit).toBe('%')
    })

    it('should throw error when not connected', async () => {
      await expect(adapter.readSensors('unknown_device')).rejects.toThrow(
        'Controller not connected'
      )
    })

    it('should handle API errors', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'API error',
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await expect(adapter.readSensors(testDeviceId)).rejects.toThrow()
    })
  })

  describe('controlDevice', () => {
    beforeEach(async () => {
      // Setup connection
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: { code: 200, data: { appId: 'token123' } },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: [
            {
              devId: testDeviceId,
              devName: 'Test Controller',
              devType: 3,
              online: true,
            },
          ],
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            portData: [],
            sensorData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await adapter.connect(validCredentials)
      vi.clearAllMocks()
    })

    it('should turn device on', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          msg: 'Success',
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'turn_on' }
      const result: CommandResult = await adapter.controlDevice(
        testDeviceId,
        1,
        command
      )

      expect(result.success).toBe(true)
      expect(result.actualValue).toBe(100)
    })

    it('should turn device off', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          msg: 'Success',
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'turn_off' }
      const result: CommandResult = await adapter.controlDevice(
        testDeviceId,
        1,
        command
      )

      expect(result.success).toBe(true)
      expect(result.actualValue).toBe(0)
    })

    it('should set dimmer level', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          msg: 'Success',
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'set_level', value: 75 }
      const result: CommandResult = await adapter.controlDevice(
        testDeviceId,
        1,
        command
      )

      expect(result.success).toBe(true)
      expect(result.actualValue).toBe(80) // Rounded to nearest 10 for AC Infinity (75 -> 80)
    })

    it('should fail when not connected', async () => {
      const command: DeviceCommand = { type: 'turn_on' }
      const result = await adapter.controlDevice('unknown_device', 1, command)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not connected')
    })
  })

  describe('getStatus', () => {
    beforeEach(async () => {
      // Setup connection
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: { code: 200, data: { appId: 'token123' } },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: [
            {
              devId: testDeviceId,
              devName: 'Test Controller',
              devType: 3,
              online: true,
            },
          ],
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            portData: [],
            sensorData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await adapter.connect(validCredentials)
      vi.clearAllMocks()
    })

    it('should return online status', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            portData: [],
            sensorData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const status: ControllerStatus = await adapter.getStatus(testDeviceId)

      expect(status.status).toBe('online')
      expect(status.lastSeen).toBeInstanceOf(Date)
    })

    it('should return offline when not connected', async () => {
      const status = await adapter.getStatus('unknown_device')

      expect(status.status).toBe('offline')
      expect(mockedAdapterFetch).not.toHaveBeenCalled()
    })

    it('should return offline status on failure', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const status = await adapter.getStatus(testDeviceId)

      // Network errors are treated as offline, not error
      expect(status.status).toBe('offline')
    })
  })

  describe('disconnect', () => {
    it('should disconnect and cleanup', async () => {
      // Setup connection first
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: { code: 200, data: { appId: 'token123' } },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: [
            {
              devId: testDeviceId,
              devName: 'Test Controller',
              devType: 3,
              online: true,
            },
          ],
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            portData: [],
            sensorData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await adapter.connect(validCredentials)

      // Disconnect
      await adapter.disconnect(testDeviceId)

      // Verify device is offline after disconnect
      const status = await adapter.getStatus(testDeviceId)
      expect(status.status).toBe('offline')
    })
  })

  describe('discoverDevices', () => {
    it('should discover multiple devices', async () => {
      // Mock login
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: { appId: 'token123' },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      // Mock device list
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: [
            {
              devId: 'dev_1',
              devCode: 'AC001',
              devName: 'Controller 1',
              devType: 3,
              online: true,
              firmwareVersion: '1.0.0',
            },
            {
              devId: 'dev_2',
              devCode: 'AC002',
              devName: 'Controller 2',
              devType: 4,
              online: false,
            },
          ],
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      // Mock capabilities for each device
      mockedAdapterFetch.mockResolvedValue({
        success: true,
        data: {
          code: 200,
          data: {
            portData: [],
            sensorData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.discoverDevices({
        brand: 'ac_infinity',
        email: 'test@example.com',
        password: 'testpass',
      })

      expect(result.success).toBe(true)
      expect(result.devices).toHaveLength(2)
      expect(result.totalDevices).toBe(2)
      expect(result.devices[0].brand).toBe('ac_infinity')
      expect(result.devices[0].isOnline).toBe(true)
      expect(result.devices[1].isOnline).toBe(false)
    })

    it('should handle discovery with no devices', async () => {
      // Mock login
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: { appId: 'token123' },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      // Mock empty device list
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: [],
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.discoverDevices({
        brand: 'ac_infinity',
        email: 'test@example.com',
        password: 'testpass',
      })

      expect(result.success).toBe(true)
      expect(result.devices).toHaveLength(0)
      expect(result.totalDevices).toBe(0)
    })
  })
})
