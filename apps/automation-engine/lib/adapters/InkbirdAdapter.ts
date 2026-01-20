/**
 * Inkbird Controller Adapter (Stub)
 * Implements the ControllerAdapter interface for Inkbird controllers
 *
 * Note: Inkbird has limited official API documentation.
 * This is a stub implementation that will need reverse engineering
 * or partnership with Inkbird to complete.
 */

import { BaseControllerAdapter } from './ControllerAdapter'
import type {
  ControllerCredentials,
  ControllerMetadata,
  ControllerStatus,
  DeviceCommand,
  CommandResult,
} from '../types/controller'
import type { SensorReading } from '../types/sensor'

/**
 * Inkbird Controller Adapter
 *
 * Supported devices (planned):
 * - ITC-308 (Temperature controller)
 * - ITC-608T (Temperature + Humidity)
 * - IHC-200 (Humidity controller)
 * - IBT-6XS (Bluetooth thermometer)
 *
 * Note: Most Inkbird devices use Bluetooth, not WiFi.
 * WiFi-enabled models may use Tuya/Smart Life platform.
 */
export class InkbirdAdapter extends BaseControllerAdapter {
  constructor() {
    super('InkbirdAdapter')
  }

  async connect(_credentials: ControllerCredentials): Promise<ControllerMetadata> {
    this.log('Inkbird adapter not yet implemented')
    throw new Error(
      'Inkbird adapter not yet implemented. ' +
        'Inkbird devices primarily use Bluetooth, which requires a different integration approach. ' +
        'WiFi-enabled models may use Tuya platform - consider using Generic WiFi adapter with Tuya credentials.'
    )
  }

  async readSensors(_controllerId: string): Promise<SensorReading[]> {
    throw new Error('Inkbird adapter not yet implemented')
  }

  async controlDevice(
    _controllerId: string,
    _port: number,
    _command: DeviceCommand
  ): Promise<CommandResult> {
    return {
      success: false,
      error: 'Inkbird adapter not yet implemented',
    }
  }

  async getStatus(_controllerId: string): Promise<ControllerStatus> {
    return {
      isOnline: false,
      lastSeen: new Date(),
    }
  }

  async disconnect(_controllerId: string): Promise<void> {
    // No-op for stub
  }
}

/**
 * Implementation notes for future development:
 *
 * 1. Bluetooth Integration:
 *    - Most Inkbird devices are Bluetooth-only
 *    - Would require a local bridge/gateway (Raspberry Pi, etc.)
 *    - Use Noble or similar BLE library
 *
 * 2. Tuya/Smart Life Integration:
 *    - Some WiFi models use Tuya platform
 *    - Can use tuyapi or similar library
 *    - Requires Tuya Developer Account
 *
 * 3. Known API endpoints (unverified):
 *    - Cloud: https://api.inkbird.com/
 *    - May require Chinese region server
 *
 * 4. Alternative approaches:
 *    - MQTT broker integration
 *    - Local polling via mDNS discovery
 *    - Tasmota/ESPHome flashing for local control
 */
