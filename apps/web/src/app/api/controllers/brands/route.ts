/**
 * Controller Brands API
 * 
 * GET /api/controllers/brands - List all supported controller brands
 */

import { NextResponse } from 'next/server'

const SUPPORTED_BRANDS = [
  {
    id: 'ac_infinity',
    name: 'AC Infinity',
    description: 'Controller 69, Controller 67, UIS Inline Fans & Lights',
    logo: '/logos/ac-infinity.svg',
    requiresCredentials: true,
    credentialFields: [
      { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'your@email.com' },
      { name: 'password', label: 'Password', type: 'password', required: true, placeholder: '••••••••' }
    ],
    capabilities: {
      sensors: ['temperature', 'humidity', 'vpd'],
      devices: ['fan', 'light', 'outlet'],
      supportsDimming: true,
      supportsScheduling: true
    },
    marketShare: 40,
    status: 'available',
    helpUrl: 'https://acinfinity.com/support'
  },
  {
    id: 'inkbird',
    name: 'Inkbird',
    description: 'ITC-308, ITC-310T, IHC-200 Temperature & Humidity Controllers',
    logo: '/logos/inkbird.svg',
    requiresCredentials: true,
    credentialFields: [
      { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'your@email.com' },
      { name: 'password', label: 'Password', type: 'password', required: true, placeholder: '••••••••' }
    ],
    capabilities: {
      sensors: ['temperature', 'humidity'],
      devices: ['heater', 'cooler', 'humidifier', 'dehumidifier'],
      supportsDimming: false,
      supportsScheduling: true
    },
    marketShare: 25,
    status: 'available',
    helpUrl: 'https://www.ink-bird.com/support'
  },
  {
    id: 'csv_upload',
    name: 'CSV Upload',
    description: 'Upload sensor data manually. Works with any controller or sensor.',
    logo: '/logos/csv.svg',
    requiresCredentials: false,
    credentialFields: [],
    capabilities: {
      sensors: ['temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec'],
      devices: [],
      supportsDimming: false,
      supportsScheduling: false
    },
    marketShare: 10,
    status: 'available',
    note: 'Read-only mode - cannot control devices. Perfect for monitoring or brands without API access.',
    templateUrl: '/api/controllers/csv-template'
  },
  {
    id: 'govee',
    name: 'Govee',
    description: 'H5179 WiFi Hygrometer, H5075 Bluetooth Hygrometer',
    logo: '/logos/govee.svg',
    requiresCredentials: false,
    credentialFields: [],
    capabilities: {
      sensors: ['temperature', 'humidity'],
      devices: [],
      supportsDimming: false,
      supportsScheduling: false
    },
    marketShare: 15,
    status: 'coming_soon',
    note: 'Requires mobile app for Bluetooth pairing. Coming in Phase 2.'
  },
  {
    id: 'mqtt',
    name: 'MQTT Generic',
    description: 'Any MQTT-compatible controller, sensor, or home automation hub',
    logo: '/logos/mqtt.svg',
    requiresCredentials: true,
    credentialFields: [
      { name: 'brokerUrl', label: 'Broker URL', type: 'text', required: true, placeholder: 'mqtt://localhost:1883' },
      { name: 'username', label: 'Username', type: 'text', required: false, placeholder: 'Optional' },
      { name: 'password', label: 'Password', type: 'password', required: false, placeholder: 'Optional' },
      { name: 'topic', label: 'Topic Prefix', type: 'text', required: true, placeholder: 'sensors/room1' }
    ],
    capabilities: {
      sensors: ['temperature', 'humidity', 'vpd', 'co2', 'light'],
      devices: ['fan', 'light', 'outlet'],
      supportsDimming: true,
      supportsScheduling: true
    },
    marketShare: 5,
    status: 'coming_soon',
    note: 'For DIY builds, Home Assistant, and custom setups. Coming in Phase 2.'
  },
  {
    id: 'ecowitt',
    name: 'Ecowitt',
    description: 'GW1100/GW2000/GW3000 Gateways, Weather Sensors, IoT Devices',
    logo: '/logos/ecowitt.svg',
    requiresCredentials: true,
    credentialFields: [
      { name: 'connectionMethod', label: 'Connection Method', type: 'select', required: true },
      { name: 'gatewayIP', label: 'Gateway IP', type: 'text', required: false, placeholder: '192.168.1.100' },
      { name: 'macAddress', label: 'MAC Address', type: 'text', required: false, placeholder: 'XX:XX:XX:XX:XX:XX' },
      { name: 'apiKey', label: 'API Key', type: 'password', required: false },
      { name: 'applicationKey', label: 'Application Key', type: 'password', required: false }
    ],
    capabilities: {
      sensors: ['temperature', 'humidity', 'pressure', 'soil_moisture', 'wind_speed', 'uv', 'solar_radiation', 'rain', 'pm25', 'co2'],
      devices: ['valve', 'outlet'],
      supportsDimming: false,
      supportsScheduling: true
    },
    marketShare: 8,
    status: 'available',
    note: 'Multiple connection methods: Cloud API, Push/Webhook, TCP Direct, or HTTP Local. Push mode requires gateway configuration.',
    helpUrl: 'https://api.ecowitt.net'
  }
]

// Disable caching for this route to ensure fresh brand list
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  // Filter to show available brands first, then coming soon
  const sortedBrands = [...SUPPORTED_BRANDS].sort((a, b) => {
    if (a.status === 'available' && b.status !== 'available') return -1
    if (a.status !== 'available' && b.status === 'available') return 1
    return (b.marketShare || 0) - (a.marketShare || 0)
  })

  return NextResponse.json({
    brands: sortedBrands,
    totalBrands: sortedBrands.length,
    availableCount: sortedBrands.filter(b => b.status === 'available').length,
    comingSoonCount: sortedBrands.filter(b => b.status === 'coming_soon').length
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  })
}
