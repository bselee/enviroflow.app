/**
 * Tests for Home Assistant MQTT Bridge
 */

import {
  mapSensorTypeToHADeviceClass,
  mapSensorTypeToHAIcon,
  mapDeviceTypeToHAComponent,
  buildDiscoveryTopic,
  buildSensorStateTopic,
  buildDeviceStateTopic,
  buildDeviceCommandTopic,
  buildAvailabilityTopic,
  parseHACommand,
  resolveConflict,
  validateMQTTConfig,
  validateBridgeConfig,
  isValidIPAddress,
  sanitizeEntityName,
  type SyncState,
  type HomeAssistantBridgeConfig,
} from '../homeassistant-bridge'

describe('homeassistant-bridge', () => {
  describe('Sensor Type Mapping', () => {
    it('should map temperature to HA device class', () => {
      expect(mapSensorTypeToHADeviceClass('temperature')).toBe('temperature')
    })

    it('should map humidity to HA device class', () => {
      expect(mapSensorTypeToHADeviceClass('humidity')).toBe('humidity')
    })

    it('should return undefined for VPD (custom sensor)', () => {
      expect(mapSensorTypeToHADeviceClass('vpd')).toBeUndefined()
    })

    it('should return correct icons for all sensor types', () => {
      expect(mapSensorTypeToHAIcon('temperature')).toBe('mdi:thermometer')
      expect(mapSensorTypeToHAIcon('humidity')).toBe('mdi:water-percent')
      expect(mapSensorTypeToHAIcon('co2')).toBe('mdi:molecule-co2')
    })
  })

  describe('Device Type Mapping', () => {
    it('should map fan to fan component', () => {
      expect(mapDeviceTypeToHAComponent('fan')).toBe('fan')
    })

    it('should map light to light component', () => {
      expect(mapDeviceTypeToHAComponent('light')).toBe('light')
    })

    it('should map outlet to switch component', () => {
      expect(mapDeviceTypeToHAComponent('outlet')).toBe('switch')
    })

    it('should map pump to switch component', () => {
      expect(mapDeviceTypeToHAComponent('pump')).toBe('switch')
    })
  })

  describe('Topic Builders', () => {
    it('should build discovery topic correctly', () => {
      const topic = buildDiscoveryTopic('sensor', 'abc123', 'temperature_1')
      expect(topic).toBe('homeassistant/sensor/enviroflow_abc123_temperature_1/config')
    })

    it('should build sensor state topic correctly', () => {
      const topic = buildSensorStateTopic('abc123', 'temperature', 1)
      expect(topic).toBe('enviroflow/abc123/sensors/temperature/1')
    })

    it('should build device state topic correctly', () => {
      const topic = buildDeviceStateTopic('abc123', 1)
      expect(topic).toBe('enviroflow/abc123/devices/1/state')
    })

    it('should build device command topic correctly', () => {
      const topic = buildDeviceCommandTopic('abc123', 1)
      expect(topic).toBe('enviroflow/abc123/devices/1/set')
    })

    it('should build availability topic correctly', () => {
      const topic = buildAvailabilityTopic('abc123')
      expect(topic).toBe('enviroflow/abc123/availability')
    })

    it('should support custom prefixes', () => {
      const topic = buildDiscoveryTopic('sensor', 'abc123', 'temp_1', 'ha')
      expect(topic).toBe('ha/sensor/enviroflow_abc123_temp_1/config')
    })
  })

  describe('Command Parsing', () => {
    it('should parse ON command', () => {
      const cmd = parseHACommand('ON')
      expect(cmd.action).toBe('turn_on')
    })

    it('should parse OFF command', () => {
      const cmd = parseHACommand('OFF')
      expect(cmd.action).toBe('turn_off')
    })

    it('should parse brightness JSON', () => {
      const cmd = parseHACommand('{"brightness": 75}')
      expect(cmd.action).toBe('set_level')
      expect(cmd.level).toBe(75)
    })

    it('should parse numeric brightness', () => {
      const cmd = parseHACommand('50')
      expect(cmd.action).toBe('set_level')
      expect(cmd.level).toBe(50)
    })

    it('should handle case-insensitive commands', () => {
      expect(parseHACommand('on').action).toBe('turn_on')
      expect(parseHACommand('off').action).toBe('turn_off')
    })
  })

  describe('Conflict Resolution', () => {
    it('should prefer more recent timestamp', () => {
      const oldState: SyncState = {
        source: 'enviroflow',
        timestamp: 1000,
        value: 'old',
      }
      const newState: SyncState = {
        source: 'homeassistant',
        timestamp: 2000,
        value: 'new',
      }
      const result = resolveConflict(oldState, newState)
      expect(result).toBe('homeassistant')
    })

    it('should treat near-simultaneous updates as same', () => {
      const state1: SyncState = {
        source: 'enviroflow',
        timestamp: 1000,
        value: 'value1',
      }
      const state2: SyncState = {
        source: 'homeassistant',
        timestamp: 1500,
        value: 'value2',
      }
      const result = resolveConflict(state1, state2)
      expect(result).toBe('same')
    })
  })

  describe('Validation', () => {
    it('should validate valid MQTT config', () => {
      const config = {
        brokerUrl: 'mqtt://localhost:1883',
        username: 'user',
        password: 'pass',
      }
      const result = validateMQTTConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject missing broker URL', () => {
      const config = {
        brokerUrl: '',
      }
      const result = validateMQTTConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('MQTT broker URL is required')
    })

    it('should reject invalid port', () => {
      const config = {
        brokerUrl: 'mqtt://localhost',
        port: 99999,
      }
      const result = validateMQTTConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should validate valid bridge config', () => {
      const config: HomeAssistantBridgeConfig = {
        mqtt: {
          brokerUrl: 'mqtt://localhost:1883',
        },
        enabled: true,
        discoveryPrefix: 'homeassistant',
        statePrefix: 'enviroflow',
        updateInterval: 30000,
      }
      const result = validateBridgeConfig(config)
      expect(result.valid).toBe(true)
    })

    it('should reject invalid discovery prefix', () => {
      const config: HomeAssistantBridgeConfig = {
        mqtt: {
          brokerUrl: 'mqtt://localhost:1883',
        },
        enabled: true,
        discoveryPrefix: 'invalid prefix!',
      }
      const result = validateBridgeConfig(config)
      expect(result.valid).toBe(false)
    })

    it('should reject update interval too short', () => {
      const config: HomeAssistantBridgeConfig = {
        mqtt: {
          brokerUrl: 'mqtt://localhost:1883',
        },
        enabled: true,
        updateInterval: 500,
      }
      const result = validateBridgeConfig(config)
      expect(result.valid).toBe(false)
    })
  })

  describe('Entity Name Sanitization', () => {
    it('should sanitize entity names', () => {
      expect(sanitizeEntityName('My Room')).toBe('my_room')
      expect(sanitizeEntityName('AC Infinity Controller')).toBe('ac_infinity_controller')
      expect(sanitizeEntityName('Temperature (°F)')).toBe('temperature_f')
    })

    it('should remove special characters', () => {
      expect(sanitizeEntityName('Test!@#$%')).toBe('test')
    })

    it('should collapse multiple underscores', () => {
      expect(sanitizeEntityName('test___name')).toBe('test_name')
    })

    it('should trim leading/trailing underscores', () => {
      expect(sanitizeEntityName('_test_')).toBe('test')
    })
  })
})
