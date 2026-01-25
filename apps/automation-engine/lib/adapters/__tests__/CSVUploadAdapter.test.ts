/**
 * CSVUploadAdapter Unit Tests
 *
 * Tests the CSV upload adapter for manual data entry
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  CSVUploadAdapter,
  generateCSVTemplate,
  validateCSVHeaders,
} from '../CSVUploadAdapter'
import type {
  CSVUploadCredentials,
  ConnectionResult,
  SensorReading,
  CommandResult,
  ControllerStatus,
  DeviceCommand,
} from '../types'

describe('CSVUploadAdapter', () => {
  let adapter: CSVUploadAdapter
  const credentials: CSVUploadCredentials = {
    type: 'csv_upload',
  }

  beforeEach(() => {
    adapter = new CSVUploadAdapter()
  })

  describe('connect', () => {
    it('should successfully create virtual controller', async () => {
      const result: ConnectionResult = await adapter.connect(credentials)

      expect(result.success).toBe(true)
      expect(result.controllerId).toMatch(/^csv_/)
      expect(result.metadata.brand).toBe('csv_upload')
      expect(result.metadata.capabilities.sensors).toBeDefined()
      expect(result.metadata.capabilities.devices).toHaveLength(0)
      expect(result.metadata.capabilities.supportsDimming).toBe(false)
    })

    it('should fail with invalid credentials type', async () => {
      const invalidCredentials = {
        type: 'invalid',
      } as any

      const result = await adapter.connect(invalidCredentials)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid credentials type')
    })
  })

  describe('uploadCSV', () => {
    it('should parse valid CSV data', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const csvContent = `timestamp,temperature,humidity,vpd
2026-01-20T10:00:00Z,72.5,55,1.2
2026-01-20T11:00:00Z,73.0,54,1.25`

      const parseResult = await adapter.uploadCSV(controllerId, csvContent)

      expect(parseResult.success).toBe(true)
      expect(parseResult.data).toHaveLength(2)
      expect(parseResult.errors).toHaveLength(0)
      expect(parseResult.rowCount).toBe(2)
    })

    it('should handle CSV with missing timestamp column', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const csvContent = `temperature,humidity
72.5,55`

      const parseResult = await adapter.uploadCSV(controllerId, csvContent)

      expect(parseResult.success).toBe(false)
      expect(parseResult.errors.length).toBeGreaterThan(0)
      expect(parseResult.errors[0]).toContain('timestamp')
    })

    it('should handle CSV with invalid timestamp', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const csvContent = `timestamp,temperature
invalid-date,72.5`

      const parseResult = await adapter.uploadCSV(controllerId, csvContent)

      expect(parseResult.success).toBe(false)
      expect(parseResult.data).toHaveLength(0)
      expect(parseResult.errors.length).toBeGreaterThan(0)
    })

    it('should parse optional sensor columns', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const csvContent = `timestamp,temperature,humidity,vpd,co2,light,ph,ec
2026-01-20T10:00:00Z,72.5,55,1.2,450,35000,6.5,1.2`

      const parseResult = await adapter.uploadCSV(controllerId, csvContent)

      expect(parseResult.success).toBe(true)
      expect(parseResult.data).toHaveLength(1)

      const row = parseResult.data[0]
      expect(row.temperature).toBe(72.5)
      expect(row.humidity).toBe(55)
      expect(row.vpd).toBe(1.2)
      expect(row.co2).toBe(450)
      expect(row.light).toBe(35000)
      expect(row.ph).toBe(6.5)
      expect(row.ec).toBe(1.2)
    })

    it('should handle alternate column names', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const csvContent = `timestamp,temp,rh,lux
2026-01-20T10:00:00Z,72.5,55,35000`

      const parseResult = await adapter.uploadCSV(controllerId, csvContent)

      expect(parseResult.success).toBe(true)
      expect(parseResult.data[0].temperature).toBe(72.5)
      expect(parseResult.data[0].humidity).toBe(55)
      expect(parseResult.data[0].light).toBe(35000)
    })
  })

  describe('readSensors', () => {
    it('should return empty array when no data uploaded', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const readings: SensorReading[] = await adapter.readSensors(controllerId)

      expect(readings).toHaveLength(0)
    })

    it('should return latest sensor readings', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const csvContent = `timestamp,temperature,humidity
2026-01-20T10:00:00Z,72.5,55
2026-01-20T11:00:00Z,73.0,54`

      await adapter.uploadCSV(controllerId, csvContent)

      const readings: SensorReading[] = await adapter.readSensors(controllerId)

      expect(readings.length).toBeGreaterThan(0)

      const tempReading = readings.find((r) => r.type === 'temperature')
      const humidityReading = readings.find((r) => r.type === 'humidity')

      expect(tempReading).toBeDefined()
      expect(tempReading?.value).toBe(73.0) // Latest value
      expect(tempReading?.unit).toBe('F')

      expect(humidityReading).toBeDefined()
      expect(humidityReading?.value).toBe(54)
      expect(humidityReading?.unit).toBe('%')
    })

    it('should mark stale readings correctly', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      // Upload old data (more than 5 minutes ago)
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const csvContent = `timestamp,temperature
${oldTimestamp},72.5`

      await adapter.uploadCSV(controllerId, csvContent)

      const readings: SensorReading[] = await adapter.readSensors(controllerId)

      expect(readings[0].isStale).toBe(true)
    })
  })

  describe('getHistoricalData', () => {
    it('should return data within time range', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const csvContent = `timestamp,temperature
2026-01-20T10:00:00Z,72.5
2026-01-20T11:00:00Z,73.0
2026-01-20T12:00:00Z,73.5`

      await adapter.uploadCSV(controllerId, csvContent)

      const startTime = new Date('2026-01-20T10:30:00Z')
      const endTime = new Date('2026-01-20T11:30:00Z')

      const data = adapter.getHistoricalData(controllerId, startTime, endTime)

      expect(data).toHaveLength(1)
      expect(data[0].temperature).toBe(73.0)
    })
  })

  describe('controlDevice', () => {
    it('should fail with read-only error', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const command: DeviceCommand = { type: 'turn_on' }
      const cmdResult: CommandResult = await adapter.controlDevice(
        controllerId,
        1,
        command
      )

      expect(cmdResult.success).toBe(false)
      expect(cmdResult.error).toContain('read-only')
    })
  })

  describe('getStatus', () => {
    it('should return offline when no data uploaded', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const status: ControllerStatus = await adapter.getStatus(controllerId)

      expect(status.status).toBe('offline')
      expect(status.errors).toBeDefined()
      expect(status.errors?.[0]).toContain('No CSV data')
    })

    it('should return online with fresh data', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const csvContent = `timestamp,temperature
${new Date().toISOString()},72.5`

      await adapter.uploadCSV(controllerId, csvContent)

      const status: ControllerStatus = await adapter.getStatus(controllerId)

      expect(status.status).toBe('online')
    })

    it('should return offline with stale data', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const csvContent = `timestamp,temperature
${oldTimestamp},72.5`

      await adapter.uploadCSV(controllerId, csvContent)

      const status: ControllerStatus = await adapter.getStatus(controllerId)

      expect(status.status).toBe('offline')
      expect(status.errors?.[0]).toContain('stale')
    })
  })

  describe('clearData', () => {
    it('should clear all uploaded data', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const csvContent = `timestamp,temperature
2026-01-20T10:00:00Z,72.5`

      await adapter.uploadCSV(controllerId, csvContent)

      expect(adapter.getDataCount(controllerId)).toBe(1)

      adapter.clearData(controllerId)

      expect(adapter.getDataCount(controllerId)).toBe(0)
    })
  })

  describe('disconnect', () => {
    it('should cleanup data on disconnect', async () => {
      const result = await adapter.connect(credentials)
      const controllerId = result.controllerId

      const csvContent = `timestamp,temperature
2026-01-20T10:00:00Z,72.5`

      await adapter.uploadCSV(controllerId, csvContent)

      expect(adapter.getDataCount(controllerId)).toBe(1)

      await adapter.disconnect(controllerId)

      expect(adapter.getDataCount(controllerId)).toBe(0)
    })
  })
})

describe('CSV Utilities', () => {
  describe('generateCSVTemplate', () => {
    it('should generate valid template', () => {
      const template = generateCSVTemplate()

      expect(template).toContain('timestamp')
      expect(template).toContain('temperature')
      expect(template).toContain('humidity')
      expect(template.split('\n').length).toBeGreaterThan(1)
    })
  })

  describe('validateCSVHeaders', () => {
    it('should validate CSV with required headers', () => {
      const csv = `timestamp,temperature,humidity
2026-01-20T10:00:00Z,72.5,55`

      const validation = validateCSVHeaders(csv)

      expect(validation.valid).toBe(true)
      expect(validation.headers).toContain('timestamp')
      expect(validation.missing).toHaveLength(0)
      expect(validation.optional).toContain('temperature')
      expect(validation.optional).toContain('humidity')
    })

    it('should detect missing timestamp', () => {
      const csv = `temperature,humidity
72.5,55`

      const validation = validateCSVHeaders(csv)

      expect(validation.valid).toBe(false)
      expect(validation.missing).toContain('timestamp')
    })

    it('should identify optional headers found', () => {
      const csv = `timestamp,temp,rh,co2,lux
2026-01-20T10:00:00Z,72.5,55,450,35000`

      const validation = validateCSVHeaders(csv)

      expect(validation.valid).toBe(true)
      expect(validation.optional).toContain('temp')
      expect(validation.optional).toContain('rh')
      expect(validation.optional).toContain('co2')
      expect(validation.optional).toContain('lux')
    })

    it('should handle empty CSV', () => {
      const csv = ``

      const validation = validateCSVHeaders(csv)

      expect(validation.valid).toBe(false)
      expect(validation.missing).toContain('timestamp')
    })
  })
})
