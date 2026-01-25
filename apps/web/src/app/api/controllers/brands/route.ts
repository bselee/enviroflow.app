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
    description: 'WiFi Hygrometers, Smart Lights & Plugs',
    logo: '/logos/govee.svg',
    requiresCredentials: true,
    credentialFields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Enter your Govee API key' }
    ],
    capabilities: {
      sensors: ['temperature', 'humidity'],
      devices: ['light', 'outlet'],
      supportsDimming: true,
      supportsScheduling: false
    },
    marketShare: 15,
    status: 'available',
    helpUrl: 'https://govee-public.s3.amazonaws.com/developer-docs/GoveeDeveloperAPIReference.pdf',
    note: 'API key required. Get your key from Govee Home app: Account > About Us > Apply for API Key.'
  },
  {
    id: 'mqtt',
    name: 'MQTT',
    description: 'Generic MQTT broker for custom IoT devices (Tasmota, ESPHome, Home Assistant)',
    logo: '/logos/mqtt.svg',
    requiresCredentials: true,
    credentialFields: [
      { name: 'brokerUrl', label: 'Broker URL', type: 'text', required: true, placeholder: 'mqtt://broker.example.com' },
      { name: 'port', label: 'Port', type: 'text', required: true, placeholder: '1883' },
      { name: 'username', label: 'Username', type: 'text', required: false, placeholder: 'Optional' },
      { name: 'password', label: 'Password', type: 'password', required: false, placeholder: 'Optional' },
      { name: 'topicPrefix', label: 'Topic Prefix', type: 'text', required: true, placeholder: 'enviroflow' },
      { name: 'useTls', label: 'Use TLS', type: 'text', required: false, placeholder: 'false' }
    ],
    capabilities: {
      sensors: ['temperature', 'humidity', 'vpd', 'co2', 'light'],
      devices: ['fan', 'light', 'outlet'],
      supportsDimming: true,
      supportsScheduling: true
    },
    marketShare: 5,
    status: 'available',
    helpUrl: 'https://docs.enviroflow.app/mqtt',
    note: 'For DIY builds, Home Assistant, Tasmota, ESPHome, and custom MQTT devices'
  },
  {
    id: 'ecowitt',
    name: 'Ecowitt',
    description: 'GW1100/GW2000/GW3000 Gateways with soil, weather & air quality sensors',
    logo: '/logos/ecowitt.svg',
    requiresCredentials: true,
    credentialFields: [
      { name: 'connectionMethod', label: 'Connection Method', type: 'text', required: true, placeholder: 'push' },
      { name: 'macAddress', label: 'Gateway MAC Address', type: 'text', required: true, placeholder: 'AA:BB:CC:DD:EE:FF' },
      { name: 'gatewayIP', label: 'Gateway IP (for TCP/HTTP)', type: 'text', required: false, placeholder: '192.168.1.100' }
    ],
    capabilities: {
      sensors: ['temperature', 'humidity', 'pressure', 'soil_moisture', 'uv', 'wind_speed', 'pm25', 'co2'],
      devices: ['valve', 'outlet'],
      supportsDimming: false,
      supportsScheduling: false
    },
    marketShare: 8,
    status: 'available',
    helpUrl: 'https://www.ecowitt.com/shop/homePage'
  }
]

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
  })
}
