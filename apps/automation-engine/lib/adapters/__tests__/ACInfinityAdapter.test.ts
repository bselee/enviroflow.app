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

    it('should handle discovery login failure', async () => {
      // Mock failed login
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

      const result = await adapter.discoverDevices({
        brand: 'ac_infinity',
        email: 'test@example.com',
        password: 'wrongpass',
      })

      expect(result.success).toBe(false)
      expect(result.devices).toHaveLength(0)
      expect(result.error).toContain('Invalid email or password')
    })

    it('should handle discovery API error', async () => {
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

      // Mock device list error
      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
        attempts: 3,
        totalTimeMs: 5000,
        circuitState: 'closed',
      })

      const result = await adapter.discoverDevices({
        brand: 'ac_infinity',
        email: 'test@example.com',
        password: 'testpass',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('readSensors - advanced scenarios', () => {
    beforeEach(async () => {
      // Setup connection for all tests
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

    it('should handle VPD sensor readings', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            sensorData: [
              {
                sensorType: 3,
                sensorName: 'VPD',
                sensorValue: 120, // 1.2 kPa
                unit: 'kPa',
              },
            ],
            portData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings = await adapter.readSensors(testDeviceId)

      const vpdReading = readings.find((r) => r.type === 'vpd')
      expect(vpdReading).toBeDefined()
      expect(vpdReading?.value).toBeCloseTo(1.2, 2)
      expect(vpdReading?.unit).toBe('kPa')
    })

    it('should handle device-level temperature and humidity', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            temperature: 2000, // 20°C
            humidity: 5000, // 50%
            sensorData: [],
            portData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings = await adapter.readSensors(testDeviceId)

      const tempReading = readings.find((r) => r.type === 'temperature')
      const humReading = readings.find((r) => r.type === 'humidity')

      expect(tempReading).toBeDefined()
      expect(tempReading?.value).toBeCloseTo(68, 1) // 20°C = 68°F
      expect(humReading).toBeDefined()
      expect(humReading?.value).toBeCloseTo(50, 1)
    })

    it('should handle port-based sensor readings', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            sensorData: [],
            portData: [
              {
                portId: 1,
                portName: 'Sensor Port 1',
                portType: 7,
                devType: 10,
                surplus: 2200, // 22°C
                speak: 0,
                onOff: 0,
                isSupport: true,
                supportDim: 0,
              },
            ],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings = await adapter.readSensors(testDeviceId)

      expect(readings.length).toBeGreaterThan(0)
      const portReading = readings.find((r) => r.port === 1)
      expect(portReading).toBeDefined()
      expect(portReading?.type).toBe('temperature')
      expect(portReading?.value).toBeCloseTo(71.6, 1) // 22°C ≈ 71.6°F
    })

    it('should handle zero sensor values correctly', async () => {
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
                sensorValue: 0, // 0°C (freezing point)
                unit: 'C',
              },
            ],
            portData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings = await adapter.readSensors(testDeviceId)

      const tempReading = readings.find((r) => r.type === 'temperature')
      expect(tempReading).toBeDefined()
      expect(tempReading?.value).toBeCloseTo(32, 1) // 0°C = 32°F
    })

    it('should handle token expiry error', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 1001,
          msg: 'Token expired',
          data: null,
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      await expect(adapter.readSensors(testDeviceId)).rejects.toThrow(
        'Authentication token expired'
      )
    })

    it('should handle CO2 sensor readings', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            sensorData: [
              {
                sensorType: 4,
                sensorName: 'CO2',
                sensorValue: 850, // 850 ppm (not scaled)
                unit: 'ppm',
              },
            ],
            portData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings = await adapter.readSensors(testDeviceId)

      const co2Reading = readings.find((r) => r.type === 'co2')
      expect(co2Reading).toBeDefined()
      expect(co2Reading?.value).toBe(850)
      expect(co2Reading?.unit).toBe('ppm')
    })

    it('should handle light sensor readings', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            sensorData: [
              {
                sensorType: 5,
                sensorName: 'Light',
                sensorValue: 45000, // 45000 lux (not scaled)
                unit: 'lux',
              },
            ],
            portData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings = await adapter.readSensors(testDeviceId)

      const lightReading = readings.find((r) => r.type === 'light')
      expect(lightReading).toBeDefined()
      expect(lightReading?.value).toBe(45000)
      expect(lightReading?.unit).toBe('lux')
    })

    it('should handle multiple sensor types simultaneously', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: {
            devId: testDeviceId,
            temperature: 2400, // 24°C
            humidity: 6000, // 60%
            vpd: 150, // 1.5 kPa
            sensorData: [
              {
                sensorType: 4,
                sensorName: 'CO2',
                sensorValue: 900,
                unit: 'ppm',
              },
              {
                sensorType: 5,
                sensorName: 'Light',
                sensorValue: 35000,
                unit: 'lux',
              },
            ],
            portData: [],
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings = await adapter.readSensors(testDeviceId)

      expect(readings.length).toBe(5)
      expect(readings.find((r) => r.type === 'temperature')).toBeDefined()
      expect(readings.find((r) => r.type === 'humidity')).toBeDefined()
      expect(readings.find((r) => r.type === 'vpd')).toBeDefined()
      expect(readings.find((r) => r.type === 'co2')).toBeDefined()
      expect(readings.find((r) => r.type === 'light')).toBeDefined()
    })
  })

  describe('controlDevice - advanced scenarios', () => {
    beforeEach(async () => {
      // Setup connection for all tests
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

    it('should handle toggle command', async () => {
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

      const command: DeviceCommand = { type: 'toggle' }
      const result = await adapter.controlDevice(testDeviceId, 1, command)

      expect(result.success).toBe(true)
      expect(result.actualValue).toBe(100)
    })

    it('should clamp dimmer levels to valid range', async () => {
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

      const command: DeviceCommand = { type: 'set_level', value: 150 } // Over max
      const result = await adapter.controlDevice(testDeviceId, 1, command)

      expect(result.success).toBe(true)
      expect(result.actualValue).toBe(100) // Clamped to max
    })

    it('should handle API error during control', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 500,
          msg: 'Internal server error',
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'turn_on' }
      const result = await adapter.controlDevice(testDeviceId, 1, command)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle network error during control', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
        attempts: 3,
        totalTimeMs: 5000,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'turn_on' }
      const result = await adapter.controlDevice(testDeviceId, 1, command)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })

  describe('connect - advanced scenarios', () => {
    it('should connect to specific device when deviceId provided', async () => {
      const credentialsWithDeviceId: ACInfinityCredentials = {
        type: 'ac_infinity',
        email: 'test@example.com',
        password: 'testpass123',
        deviceId: 'dev_specific',
      }

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

      // Mock device list with multiple devices
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 200,
          data: [
            {
              devId: 'dev_other',
              devName: 'Other Device',
              devType: 3,
              online: true,
            },
            {
              devId: 'dev_specific',
              devName: 'Specific Device',
              devType: 4,
              online: true,
            },
          ],
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      // Mock capabilities
      mockedAdapterFetch.mockResolvedValueOnce({
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

      const result = await adapter.connect(credentialsWithDeviceId)

      expect(result.success).toBe(true)
      expect(result.controllerId).toBe('dev_specific')
      expect(result.metadata.model).toBe('Specific Device')
    })

    it('should fail when requested deviceId not found', async () => {
      const credentialsWithInvalidDeviceId: ACInfinityCredentials = {
        type: 'ac_infinity',
        email: 'test@example.com',
        password: 'testpass123',
        deviceId: 'dev_nonexistent',
      }

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
              devId: 'dev_other',
              devName: 'Other Device',
              devType: 3,
              online: true,
            },
          ],
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.connect(credentialsWithInvalidDeviceId)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should handle API error during device list fetch', async () => {
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

      // Mock device list failure
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 500,
          msg: 'Server error',
          data: null,
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.connect(validCredentials)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('circuit breaker integration', () => {
    it('should expose circuit breaker state', () => {
      const state = adapter.getCircuitBreakerState()
      expect(state).toBeDefined()
      expect(state.state).toBe('closed')
    })

    it('should allow manual circuit breaker reset', () => {
      expect(() => adapter.resetCircuitBreaker()).not.toThrow()
    })
  })
})
