/**
 * GoveeAdapter Unit Tests
 *
 * Tests the Govee API adapter with mocked API responses
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { GoveeAdapter } from '../GoveeAdapter'
import type {
  GoveeCredentials,
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

const mockedAdapterFetch = adapterFetch as Mock

describe('GoveeAdapter', () => {
  let adapter: GoveeAdapter
  const validApiKey = 'test-api-key-12345'
  const testDeviceId = 'AA:BB:CC:DD:EE:FF:GG:HH'
  const testModel = 'H5179'

  beforeEach(() => {
    adapter = new GoveeAdapter()
    vi.clearAllMocks()
  })

  describe('connect', () => {
    it('should successfully connect with valid API key', async () => {
      const credentials: GoveeCredentials = {
        type: 'govee',
        apiKey: validApiKey,
      }

      // Mock successful device list response
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devices: [
              {
                device: testDeviceId,
                model: testModel,
                deviceName: 'Living Room Sensor',
                controllable: true,
                retrievable: true,
                supportCmds: ['turn', 'brightness', 'color'],
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(true)
      expect(result.controllerId).toBe(testDeviceId)
      expect(result.metadata.brand).toBe('govee')
      expect(result.metadata.model).toBe(testModel)
      expect(result.metadata.capabilities.supportsDimming).toBe(true)
      expect(mockedAdapterFetch).toHaveBeenCalledTimes(1)
    })

    it('should fail with invalid credentials type', async () => {
      const invalidCredentials = {
        type: 'invalid',
        apiKey: validApiKey,
      } as any

      const result = await adapter.connect(invalidCredentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid credentials type')
      expect(mockedAdapterFetch).not.toHaveBeenCalled()
    })

    it('should fail with missing API key', async () => {
      const credentials: GoveeCredentials = {
        type: 'govee',
        apiKey: '',
      }

      const result = await adapter.connect(credentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('API key is required')
      expect(mockedAdapterFetch).not.toHaveBeenCalled()
    })

    it('should handle 401 unauthorized error', async () => {
      const credentials: GoveeCredentials = {
        type: 'govee',
        apiKey: 'invalid-key',
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 401,
          message: 'Unauthorized',
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.connect(credentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid API key')
    })

    it('should handle no devices found', async () => {
      const credentials: GoveeCredentials = {
        type: 'govee',
        apiKey: validApiKey,
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devices: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.connect(credentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No Govee devices found')
    })

    it('should handle network errors', async () => {
      const credentials: GoveeCredentials = {
        type: 'govee',
        apiKey: validApiKey,
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
        attempts: 3,
        totalTimeMs: 5000,
        circuitState: 'closed',
      })

      const result = await adapter.connect(credentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })

  describe('readSensors', () => {
    beforeEach(async () => {
      // Connect first
      const credentials: GoveeCredentials = {
        type: 'govee',
        apiKey: validApiKey,
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devices: [
              {
                device: testDeviceId,
                model: testModel,
                deviceName: 'Test Sensor',
                controllable: true,
                retrievable: true,
                supportCmds: ['turn'],
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await adapter.connect(credentials)
      vi.clearAllMocks()
    })

    it('should read temperature and humidity sensors', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            device: testDeviceId,
            model: testModel,
            properties: [
              {
                online: true,
                temperature: 23.5, // Celsius
                humidity: 65.0,
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings: SensorReading[] = await adapter.readSensors(testDeviceId)

      expect(readings).toHaveLength(2)

      // Temperature (converted to Fahrenheit)
      const tempReading = readings.find(r => r.type === 'temperature')
      expect(tempReading).toBeDefined()
      expect(tempReading?.value).toBeCloseTo(74.3, 1) // 23.5°C ≈ 74.3°F
      expect(tempReading?.unit).toBe('F')

      // Humidity
      const humidityReading = readings.find(r => r.type === 'humidity')
      expect(humidityReading).toBeDefined()
      expect(humidityReading?.value).toBe(65.0)
      expect(humidityReading?.unit).toBe('%')
    })

    it('should return empty array when no sensor data available', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            device: testDeviceId,
            model: testModel,
            properties: [
              {
                online: true,
                powerState: 'on',
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings: SensorReading[] = await adapter.readSensors(testDeviceId)

      expect(readings).toHaveLength(0)
    })

    it('should throw error when device not connected', async () => {
      await expect(adapter.readSensors('unknown-device')).rejects.toThrow(
        'Device not connected'
      )
    })

    it('should throw error on API failure', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'API error',
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await expect(adapter.readSensors(testDeviceId)).rejects.toThrow()
    })

    it('should handle 404 device not found error', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 404,
          message: 'Device not found',
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await expect(adapter.readSensors(testDeviceId)).rejects.toThrow(
        'device may have been removed'
      )
    })
  })

  describe('controlDevice', () => {
    beforeEach(async () => {
      // Connect first
      const credentials: GoveeCredentials = {
        type: 'govee',
        apiKey: validApiKey,
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devices: [
              {
                device: testDeviceId,
                model: 'H6159', // Light model
                deviceName: 'Test Light',
                controllable: true,
                retrievable: true,
                supportCmds: ['turn', 'brightness', 'color'],
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await adapter.connect(credentials)
      vi.clearAllMocks()
    })

    it('should turn device on', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'turn_on' }
      const result: CommandResult = await adapter.controlDevice(testDeviceId, 1, command)

      expect(result.success).toBe(true)
      expect(mockedAdapterFetch).toHaveBeenCalledWith(
        'govee',
        expect.stringContaining('/devices/control'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"turn"'),
        })
      )
    })

    it('should turn device off', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'turn_off' }
      const result: CommandResult = await adapter.controlDevice(testDeviceId, 1, command)

      expect(result.success).toBe(true)
      expect(mockedAdapterFetch).toHaveBeenCalledWith(
        'govee',
        expect.stringContaining('/devices/control'),
        expect.objectContaining({
          body: expect.stringContaining('"value":"off"'),
        })
      )
    })

    it('should set brightness level', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'set_level', value: 75 }
      const result: CommandResult = await adapter.controlDevice(testDeviceId, 1, command)

      expect(result.success).toBe(true)
      expect(mockedAdapterFetch).toHaveBeenCalledWith(
        'govee',
        expect.stringContaining('/devices/control'),
        expect.objectContaining({
          body: expect.stringContaining('"brightness"'),
        })
      )
    })

    it('should clamp brightness to 0-100 range', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'set_level', value: 150 }
      await adapter.controlDevice(testDeviceId, 1, command)

      const callArgs = mockedAdapterFetch.mock.calls[0]
      const bodyStr = callArgs[2]?.body as string
      const body = JSON.parse(bodyStr)

      expect(body.cmd.value).toBe(100) // Clamped to max
    })

    it('should fail when device not connected', async () => {
      const command: DeviceCommand = { type: 'turn_on' }
      const result = await adapter.controlDevice('unknown-device', 1, command)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not connected')
    })

    it('should handle rate limit errors', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 429,
          message: 'Too many requests',
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'turn_on' }
      const result = await adapter.controlDevice(testDeviceId, 1, command)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Rate limit')
    })
  })

  describe('getStatus', () => {
    beforeEach(async () => {
      // Connect first
      const credentials: GoveeCredentials = {
        type: 'govee',
        apiKey: validApiKey,
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devices: [
              {
                device: testDeviceId,
                model: testModel,
                deviceName: 'Test Device',
                controllable: true,
                retrievable: true,
                supportCmds: ['turn'],
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await adapter.connect(credentials)
      vi.clearAllMocks()
    })

    it('should return online status', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            device: testDeviceId,
            model: testModel,
            properties: [
              {
                online: true,
                powerState: 'on',
              },
            ],
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

    it('should return offline status when device is offline', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            device: testDeviceId,
            model: testModel,
            properties: [
              {
                online: false,
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const status = await adapter.getStatus(testDeviceId)

      expect(status.status).toBe('offline')
    })

    it('should return offline when device not connected', async () => {
      const status = await adapter.getStatus('unknown-device')

      expect(status.status).toBe('offline')
      expect(mockedAdapterFetch).not.toHaveBeenCalled()
    })

    it('should return error status on API failure', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const status = await adapter.getStatus(testDeviceId)

      expect(status.status).toBe('error')
      expect(status.errors).toContain('Network error')
    })
  })

  describe('disconnect', () => {
    it('should disconnect and cleanup resources', async () => {
      // Connect first
      const credentials: GoveeCredentials = {
        type: 'govee',
        apiKey: validApiKey,
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devices: [
              {
                device: testDeviceId,
                model: testModel,
                deviceName: 'Test Device',
                controllable: true,
                retrievable: true,
                supportCmds: ['turn'],
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await adapter.connect(credentials)

      // Disconnect
      await adapter.disconnect(testDeviceId)

      // Try to use disconnected device
      const status = await adapter.getStatus(testDeviceId)
      expect(status.status).toBe('offline')
    })
  })

  describe('discoverDevicesWithApiKey', () => {
    it('should discover multiple devices', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devices: [
              {
                device: 'AA:BB:CC:DD:EE:FF:GG:HH',
                model: 'H5179',
                deviceName: 'Living Room',
                controllable: false,
                retrievable: true,
                supportCmds: [],
              },
              {
                device: '11:22:33:44:55:66:77:88',
                model: 'H6159',
                deviceName: 'Bedroom Light',
                controllable: true,
                retrievable: true,
                supportCmds: ['turn', 'brightness', 'color'],
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.discoverDevicesWithApiKey(validApiKey)

      expect(result.success).toBe(true)
      expect(result.devices).toHaveLength(2)
      expect(result.totalDevices).toBe(2)

      const sensor = result.devices[0]
      expect(sensor.model).toBe('H5179')
      expect(sensor.capabilities?.sensors).toContain('temperature')
      expect(sensor.capabilities?.sensors).toContain('humidity')

      const light = result.devices[1]
      expect(light.model).toBe('H6159')
      expect(light.capabilities?.supportsDimming).toBe(true)
    })

    it('should handle empty device list', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devices: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.discoverDevicesWithApiKey(validApiKey)

      expect(result.success).toBe(true)
      expect(result.devices).toHaveLength(0)
      expect(result.totalDevices).toBe(0)
    })
  })

  describe('rate limiting', () => {
    beforeEach(async () => {
      // Connect first
      const credentials: GoveeCredentials = {
        type: 'govee',
        apiKey: validApiKey,
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devices: [
              {
                device: testDeviceId,
                model: testModel,
                deviceName: 'Test Device',
                controllable: true,
                retrievable: true,
                supportCmds: ['turn'],
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await adapter.connect(credentials)
      vi.clearAllMocks()
    })

    it('should enforce rate limit of 60 requests per minute', async () => {
      // Mock successful responses
      mockedAdapterFetch.mockResolvedValue({
        success: true,
        data: {
          code: 200,
          data: {
            device: testDeviceId,
            model: testModel,
            properties: [{ online: true }],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      // Make 60 requests (should all succeed)
      for (let i = 0; i < 60; i++) {
        const readings = await adapter.readSensors(testDeviceId)
        expect(readings).toBeDefined()
      }

      // 61st request should fail due to rate limit
      await expect(adapter.readSensors(testDeviceId)).rejects.toThrow('Rate limit')

      expect(mockedAdapterFetch).toHaveBeenCalledTimes(60) // Only 60 successful calls
    })
  })
})
