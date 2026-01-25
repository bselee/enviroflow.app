/**
 * GoveeAdapter Usage Examples
 *
 * This file demonstrates how to use the GoveeAdapter in production code.
 * These are not unit tests - they're usage examples.
 */

import { GoveeAdapter } from '../GoveeAdapter'
import type { GoveeCredentials, SensorReading, DeviceCommand } from '../types'

// ============================================
// Example 1: Connect to Govee Device
// ============================================

async function connectToGoveeDevice() {
  const adapter = new GoveeAdapter()

  const credentials: GoveeCredentials = {
    type: 'govee',
    apiKey: process.env.GOVEE_API_KEY || 'your-api-key-here'
  }

  try {
    const result = await adapter.connect(credentials)

    if (result.success) {
      console.log('Connected to Govee device!')
      console.log('Device ID:', result.controllerId)
      console.log('Model:', result.metadata.model)
      console.log('Capabilities:', result.metadata.capabilities)
      return result.controllerId
    } else {
      console.error('Connection failed:', result.error)
      return null
    }
  } catch (error) {
    console.error('Exception during connection:', error)
    return null
  }
}

// ============================================
// Example 2: Read Temperature and Humidity
// ============================================

async function readEnvironmentData(controllerId: string) {
  const adapter = new GoveeAdapter()

  try {
    const readings: SensorReading[] = await adapter.readSensors(controllerId)

    console.log('Sensor Readings:')
    for (const reading of readings) {
      console.log(`  ${reading.type}: ${reading.value}${reading.unit}`)
    }

    // Find specific sensor
    const tempReading = readings.find(r => r.type === 'temperature')
    const humidityReading = readings.find(r => r.type === 'humidity')

    if (tempReading && humidityReading) {
      console.log(`\nCurrent conditions: ${tempReading.value}°F, ${humidityReading.value}% humidity`)
    }

    return readings
  } catch (error) {
    console.error('Failed to read sensors:', error)
    return []
  }
}

// ============================================
// Example 3: Control Smart Light
// ============================================

async function controlLight(controllerId: string, action: 'on' | 'off' | 'dim', brightness?: number) {
  const adapter = new GoveeAdapter()

  let command: DeviceCommand

  switch (action) {
    case 'on':
      command = { type: 'turn_on' }
      break
    case 'off':
      command = { type: 'turn_off' }
      break
    case 'dim':
      command = { type: 'set_level', value: brightness || 50 }
      break
  }

  try {
    const result = await adapter.controlDevice(controllerId, 1, command)

    if (result.success) {
      console.log(`Light ${action} command sent successfully`)
      if (result.actualValue !== undefined) {
        console.log(`Brightness set to: ${result.actualValue}%`)
      }
    } else {
      console.error(`Command failed: ${result.error}`)
    }

    return result
  } catch (error) {
    console.error('Exception during control:', error)
    return { success: false, error: String(error), timestamp: new Date() }
  }
}

// ============================================
// Example 4: Discover All Devices
// ============================================

async function discoverAllDevices(apiKey: string) {
  const adapter = new GoveeAdapter()

  try {
    const result = await adapter.discoverDevicesWithApiKey(apiKey)

    if (result.success) {
      console.log(`Found ${result.totalDevices} Govee device(s):`)

      for (const device of result.devices) {
        console.log(`\n  ${device.name} (${device.model})`)
        console.log(`    Device ID: ${device.deviceId}`)
        console.log(`    Online: ${device.isOnline}`)
        console.log(`    Controllable: ${device.controllable}`)
        console.log(`    Sensors: ${device.capabilities?.sensors?.join(', ') || 'none'}`)
        console.log(`    Devices: ${device.capabilities?.devices?.join(', ') || 'none'}`)
      }
    } else {
      console.error('Discovery failed:', result.error)
    }

    return result
  } catch (error) {
    console.error('Exception during discovery:', error)
    return {
      success: false,
      devices: [],
      totalDevices: 0,
      alreadyRegisteredCount: 0,
      error: String(error),
      timestamp: new Date(),
      source: 'cloud_api' as const
    }
  }
}

// ============================================
// Example 5: Monitor Temperature with Auto-Control
// ============================================

async function temperatureMonitoringLoop(controllerId: string, targetTemp: number, fanControllerId: string) {
  const adapter = new GoveeAdapter()

  console.log(`Starting temperature monitoring (target: ${targetTemp}°F)`)

  // Monitor every 5 minutes (respect rate limit: 60 req/min = max 1 req/sec)
  const interval = setInterval(async () => {
    try {
      const readings = await adapter.readSensors(controllerId)
      const tempReading = readings.find(r => r.type === 'temperature')

      if (tempReading) {
        console.log(`Current temperature: ${tempReading.value}°F`)

        // Auto-control fan based on temperature
        if (tempReading.value > targetTemp + 2) {
          console.log('Temperature too high - turning fan ON')
          await adapter.controlDevice(fanControllerId, 1, { type: 'turn_on' })
        } else if (tempReading.value < targetTemp - 2) {
          console.log('Temperature optimal - turning fan OFF')
          await adapter.controlDevice(fanControllerId, 1, { type: 'turn_off' })
        }
      }
    } catch (error) {
      console.error('Monitoring error:', error)
    }
  }, 5 * 60 * 1000) // 5 minutes

  // Return cleanup function
  return () => {
    clearInterval(interval)
    console.log('Stopped temperature monitoring')
  }
}

// ============================================
// Example 6: Check Device Status
// ============================================

async function checkDeviceHealth(controllerId: string) {
  const adapter = new GoveeAdapter()

  try {
    const status = await adapter.getStatus(controllerId)

    console.log('Device Health Check:')
    console.log(`  Status: ${status.status}`)
    console.log(`  Last Seen: ${status.lastSeen}`)

    if (status.errors && status.errors.length > 0) {
      console.log(`  Errors: ${status.errors.join(', ')}`)
    }

    return status.status === 'online'
  } catch (error) {
    console.error('Status check failed:', error)
    return false
  }
}

// ============================================
// Example 7: Complete Workflow
// ============================================

async function completeWorkflow() {
  const apiKey = process.env.GOVEE_API_KEY
  if (!apiKey) {
    console.error('GOVEE_API_KEY environment variable not set')
    return
  }

  // Step 1: Discover devices
  console.log('Step 1: Discovering devices...')
  const discovery = await discoverAllDevices(apiKey)
  if (!discovery.success || discovery.devices.length === 0) {
    console.error('No devices found')
    return
  }

  // Step 2: Connect to first device
  console.log('\nStep 2: Connecting to first device...')
  const controllerId = await connectToGoveeDevice()
  if (!controllerId) {
    console.error('Connection failed')
    return
  }

  // Step 3: Check device status
  console.log('\nStep 3: Checking device status...')
  const isOnline = await checkDeviceHealth(controllerId)
  if (!isOnline) {
    console.error('Device is offline')
    return
  }

  // Step 4: Read sensors
  console.log('\nStep 4: Reading sensors...')
  const readings = await readEnvironmentData(controllerId)
  if (readings.length === 0) {
    console.log('No sensor data available (device may be a light/plug)')
  }

  // Step 5: Control device (if controllable)
  const device = discovery.devices[0]
  if (device.controllable) {
    console.log('\nStep 5: Testing device control...')
    await controlLight(controllerId, 'on')
    await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
    await controlLight(controllerId, 'dim', 50)
    await new Promise(resolve => setTimeout(resolve, 2000))
    await controlLight(controllerId, 'off')
  } else {
    console.log('\nStep 5: Skipped (device is not controllable)')
  }

  console.log('\n✅ Workflow complete!')
}

// ============================================
// Example 8: Error Handling Best Practices
// ============================================

async function robustSensorRead(controllerId: string, maxRetries = 3): Promise<SensorReading[]> {
  const adapter = new GoveeAdapter()
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}`)
      const readings = await adapter.readSensors(controllerId)
      return readings // Success!
    } catch (error) {
      lastError = error as Error
      console.warn(`Attempt ${attempt} failed: ${error}`)

      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes('Rate limit')) {
        console.log('Rate limited - waiting 60 seconds...')
        await new Promise(resolve => setTimeout(resolve, 60000))
      } else if (attempt < maxRetries) {
        // Exponential backoff for other errors
        const delay = Math.pow(2, attempt) * 1000
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('All retry attempts failed')
}

// ============================================
// Example 9: Rate Limit Aware Batch Operations
// ============================================

async function batchReadSensors(controllerIds: string[]) {
  const adapter = new GoveeAdapter()
  const results = new Map<string, SensorReading[]>()

  // Govee allows 60 req/min per device
  // Safe rate: 1 request per second per device
  const delayBetweenRequests = 1000

  for (const controllerId of controllerIds) {
    try {
      console.log(`Reading sensors for ${controllerId}...`)
      const readings = await adapter.readSensors(controllerId)
      results.set(controllerId, readings)

      // Wait before next request to respect rate limit
      if (controllerIds.indexOf(controllerId) < controllerIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests))
      }
    } catch (error) {
      console.error(`Failed to read ${controllerId}:`, error)
      results.set(controllerId, [])
    }
  }

  return results
}

// ============================================
// Usage Examples (Commented Out)
// ============================================

// Run complete workflow
// completeWorkflow().catch(console.error)

// Or run individual examples:
// connectToGoveeDevice().then(id => {
//   if (id) {
//     readEnvironmentData(id)
//   }
// })

export {
  connectToGoveeDevice,
  readEnvironmentData,
  controlLight,
  discoverAllDevices,
  temperatureMonitoringLoop,
  checkDeviceHealth,
  completeWorkflow,
  robustSensorRead,
  batchReadSensors
}
