/**
 * EcowittAdapter Unit Tests
 *
 * Tests the Ecowitt adapter with mocked responses for different connection methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EcowittAdapter } from '../EcowittAdapter'
import type {
  EcowittCredentials,
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

// Mock the net module for TCP connections
vi.mock('net', () => ({
  default: {
    createConnection: vi.fn(),
  },
}))

import { adapterFetch } from '../retry'
import * as net from 'net'

const mockedAdapterFetch = adapterFetch as any
const mockedNet = net as any

describe('EcowittAdapter', () => {
  let adapter: EcowittAdapter

  beforeEach(() => {
    adapter = new EcowittAdapter()
    vi.clearAllMocks()
  })

  describe('connect - Push method', () => {
    it('should successfully connect via push method', async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'push',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      }

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(true)
      expect(result.controllerId).toContain('ecowitt-push')
      expect(result.metadata.brand).toBe('ecowitt')
      expect(result.metadata.model).toContain('Push Mode')
      expect(result.metadata.capabilities.maxPorts).toBe(8)
    })

    it('should accept push method without MAC address', async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'push',
      }

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(true)
      expect(result.controllerId).toContain('unknown')
    })
  })

  describe('connect - HTTP method', () => {
    it('should successfully connect via HTTP', async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'http',
        gatewayIP: '192.168.1.100',
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          indoor: {
            temperature: { value: 72.5 },
            humidity: { value: 55 },
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(true)
      expect(result.controllerId).toContain('ecowitt-http')
      expect(result.metadata.model).toContain('HTTP Mode')
    })

    it('should fail when gateway IP is missing', async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'http',
      }

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Gateway IP address is required')
    })

    it('should handle HTTP connection failure', async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'http',
        gatewayIP: '192.168.1.100',
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'Connection timeout',
        attempts: 2,
        totalTimeMs: 15000,
        circuitState: 'closed',
      })

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('connect - Cloud method', () => {
    it('should successfully connect via cloud API', async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'cloud',
        apiKey: 'test-api-key',
        applicationKey: 'test-app-key',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 0,
          msg: 'Success',
          data: {
            indoor: {
              temperature: { value: '72.5' },
              humidity: { value: '55' },
            },
          },
        },
        attempts: 1,
        totalTimeMs: 200,
        circuitState: 'closed',
      })

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(true)
      expect(result.controllerId).toContain('ecowitt-cloud')
      expect(result.metadata.model).toContain('Cloud Mode')
    })

    it('should fail when cloud credentials are incomplete', async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'cloud',
        apiKey: 'test-api-key',
        // Missing applicationKey and macAddress
      }

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('API key, application key, and MAC address')
    })

    it('should handle cloud API error', async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'cloud',
        apiKey: 'test-api-key',
        applicationKey: 'test-app-key',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 40001,
          msg: 'Invalid API key',
        },
        attempts: 1,
        totalTimeMs: 200,
        circuitState: 'closed',
      })

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid API key')
    })
  })

  describe('connect - Invalid credentials', () => {
    it('should fail with invalid credentials type', async () => {
      const credentials = {
        type: 'invalid',
        connectionMethod: 'push',
      } as any

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid credentials type')
    })

    it('should fail with unsupported connection method', async () => {
      const credentials = {
        type: 'ecowitt',
        connectionMethod: 'unsupported',
      } as any

      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported connection method')
    })
  })

  describe('readSensors - Push method', () => {
    beforeEach(async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'push',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      }
      await adapter.connect(credentials)
    })

    it('should return empty array for push method', async () => {
      const controllerId = 'ecowitt-push-AA:BB:CC:DD:EE:FF'
      const readings = await adapter.readSensors(controllerId)

      expect(readings).toEqual([])
    })
  })

  describe('readSensors - HTTP method', () => {
    let controllerId: string

    beforeEach(async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'http',
        gatewayIP: '192.168.1.100',
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {},
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.connect(credentials)
      controllerId = result.controllerId
      vi.clearAllMocks()
    })

    it('should read sensors via HTTP', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          indoor: {
            temperature: { value: 72.5 },
            humidity: { value: 55 },
          },
          outdoor: {
            temperature: { value: 68.0 },
            humidity: { value: 60 },
          },
          pressure: {
            absolute: { value: 30.12 },
          },
        },
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const readings: SensorReading[] = await adapter.readSensors(controllerId)

      expect(readings.length).toBeGreaterThan(0)

      const indoorTemp = readings.find(
        (r) => r.port === 0 && r.type === 'temperature'
      )
      expect(indoorTemp?.value).toBe(72.5)
      expect(indoorTemp?.unit).toBe('F')

      const outdoorTemp = readings.find(
        (r) => r.port === 1 && r.type === 'temperature'
      )
      expect(outdoorTemp?.value).toBe(68.0)

      const pressure = readings.find((r) => r.type === 'pressure')
      expect(pressure?.value).toBe(30.12)
      expect(pressure?.unit).toBe('inHg')
    })

    it('should handle HTTP read error', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: false,
        error: 'Connection timeout',
        attempts: 2,
        totalTimeMs: 15000,
        circuitState: 'closed',
      })

      await expect(adapter.readSensors(controllerId)).rejects.toThrow()
    })
  })

  describe('readSensors - Cloud method', () => {
    let controllerId: string

    beforeEach(async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'cloud',
        apiKey: 'test-api-key',
        applicationKey: 'test-app-key',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 0,
          data: {},
        },
        attempts: 1,
        totalTimeMs: 200,
        circuitState: 'closed',
      })

      const result = await adapter.connect(credentials)
      controllerId = result.controllerId
      vi.clearAllMocks()
    })

    it('should read sensors via cloud API', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 0,
          msg: 'Success',
          data: {
            indoor: {
              temperature: { value: '72.5' },
              humidity: { value: '55' },
            },
            outdoor: {
              temperature: { value: '68.0' },
              humidity: { value: '60' },
            },
          },
        },
        attempts: 1,
        totalTimeMs: 200,
        circuitState: 'closed',
      })

      const readings: SensorReading[] = await adapter.readSensors(controllerId)

      expect(readings.length).toBeGreaterThan(0)

      const indoorTemp = readings.find(
        (r) => r.port === 0 && r.type === 'temperature'
      )
      expect(indoorTemp?.value).toBe(72.5)
    })

    it('should handle cloud API error', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 40002,
          msg: 'Invalid request',
        },
        attempts: 1,
        totalTimeMs: 200,
        circuitState: 'closed',
      })

      await expect(adapter.readSensors(controllerId)).rejects.toThrow('Invalid request')
    })
  })

  describe('controlDevice', () => {
    let controllerId: string

    beforeEach(async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'http',
        gatewayIP: '192.168.1.100',
      }

      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {},
        attempts: 1,
        totalTimeMs: 100,
        circuitState: 'closed',
      })

      const result = await adapter.connect(credentials)
      controllerId = result.controllerId
      vi.clearAllMocks()
    })

    it('should turn IoT device on', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 0,
          message: 'Success',
          data: {
            ac_status: 1,
          },
        },
        attempts: 1,
        totalTimeMs: 200,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'turn_on' }
      const result: CommandResult = await adapter.controlDevice(
        controllerId,
        1,
        command
      )

      expect(result.success).toBe(true)
      expect(result.actualValue).toBe(100)
    })

    it('should turn IoT device off', async () => {
      mockedAdapterFetch.mockResolvedValueOnce({
        success: true,
        data: {
          code: 0,
          message: 'Success',
          data: {
            ac_status: 0,
          },
        },
        attempts: 1,
        totalTimeMs: 200,
        circuitState: 'closed',
      })

      const command: DeviceCommand = { type: 'turn_off' }
      const result: CommandResult = await adapter.controlDevice(
        controllerId,
        1,
        command
      )

      expect(result.success).toBe(true)
      expect(result.actualValue).toBe(0)
    })

    it('should fail when gateway IP not available', async () => {
      // Connect via push method (no IP)
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'push',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      }
      const result = await adapter.connect(credentials)

      const command: DeviceCommand = { type: 'turn_on' }
      const cmdResult = await adapter.controlDevice(result.controllerId, 1, command)

      expect(cmdResult.success).toBe(false)
      expect(cmdResult.error).toContain('requires gateway IP')
    })
  })

  describe('getStatus', () => {
    it('should return offline when not connected', async () => {
      const status: ControllerStatus = await adapter.getStatus('unknown_id')

      expect(status.status).toBe('offline')
    })

    it('should return online when connected and readable', async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'push',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      }
      const result = await adapter.connect(credentials)

      const status: ControllerStatus = await adapter.getStatus(
        result.controllerId
      )

      // Push method returns empty array, so status check should succeed
      expect(status.status).toBe('online')
    })
  })

  describe('disconnect', () => {
    it('should cleanup on disconnect', async () => {
      const credentials: EcowittCredentials = {
        type: 'ecowitt',
        connectionMethod: 'push',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      }
      const result = await adapter.connect(credentials)

      await adapter.disconnect(result.controllerId)

      const status = await adapter.getStatus(result.controllerId)
      expect(status.status).toBe('offline')
    })
  })

  describe('readSensors - Not connected', () => {
    it('should throw error when not connected', async () => {
      await expect(adapter.readSensors('unknown_id')).rejects.toThrow(
        'Controller not connected'
      )
    })
  })
})
