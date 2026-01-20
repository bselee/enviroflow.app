/**
 * Controller API Routes
 * 
 * GET    /api/controllers         - List user's controllers
 * POST   /api/controllers         - Add new controller
 * GET    /api/controllers/brands  - List supported brands
 * 
 * Note: TypeScript errors about 'never' types occur because Supabase
 * doesn't have generated types for these tables yet. Run migrations first,
 * then regenerate types with: npx supabase gen types typescript
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// Lazy initialization of Supabase client
let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!url || !key) {
      throw new Error('Supabase credentials not configured')
    }
    
    supabase = createClient(url, key)
  }
  return supabase
}

// Import adapter functions (we'll need to copy these to a shared location)
// For now, inline the supported brands data
const SUPPORTED_BRANDS = [
  {
    id: 'ac_infinity',
    name: 'AC Infinity',
    description: 'Controller 69, Controller 67, UIS Inline Fans & Lights',
    requiresCredentials: true,
    credentialFields: [
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true }
    ],
    capabilities: {
      sensors: ['temperature', 'humidity', 'vpd'],
      devices: ['fan', 'light', 'outlet'],
      supportsDimming: true
    },
    status: 'available'
  },
  {
    id: 'inkbird',
    name: 'Inkbird',
    description: 'ITC-308, ITC-310T, IHC-200 Temperature & Humidity Controllers',
    requiresCredentials: true,
    credentialFields: [
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true }
    ],
    capabilities: {
      sensors: ['temperature', 'humidity'],
      devices: ['heater', 'cooler', 'humidifier', 'dehumidifier'],
      supportsDimming: false
    },
    status: 'available'
  },
  {
    id: 'csv_upload',
    name: 'CSV Upload (Manual)',
    description: 'Upload sensor data manually. Works with any controller.',
    requiresCredentials: false,
    credentialFields: [],
    capabilities: {
      sensors: ['temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec'],
      devices: [],
      supportsDimming: false
    },
    status: 'available',
    note: 'Read-only - cannot control devices'
  },
  {
    id: 'govee',
    name: 'Govee',
    description: 'H5179 WiFi Hygrometer (Bluetooth, mobile app only)',
    status: 'coming_soon'
  },
  {
    id: 'mqtt',
    name: 'MQTT Generic',
    description: 'Any MQTT-compatible controller or sensor',
    status: 'coming_soon'
  }
]

/**
 * GET /api/controllers
 * List all controllers for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    // Get user from auth header or session
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }
    
    // For development, allow x-user-id header
    if (!userId) {
      userId = request.headers.get('x-user-id')
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide Authorization header or x-user-id for testing.' },
        { status: 401 }
      )
    }
    
    // Fetch controllers
    const { data, error } = await supabase
      .from('controllers')
      .select(`
        id,
        brand,
        controller_id,
        name,
        capabilities,
        is_online,
        last_seen,
        last_error,
        firmware_version,
        model,
        room_id,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch controllers', details: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      controllers: data || [],
      count: data?.length || 0
    })
    
  } catch (error) {
    console.error('Controllers GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/controllers
 * Add a new controller
 * 
 * Body: {
 *   brand: 'ac_infinity' | 'inkbird' | 'csv_upload',
 *   name: string,
 *   credentials: { email, password } | {},
 *   room_id?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    // Get user
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }
    
    if (!userId) {
      userId = request.headers.get('x-user-id')
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Parse body
    const body = await request.json()
    const { brand, name, credentials, room_id } = body
    
    // Validate brand
    const brandInfo = SUPPORTED_BRANDS.find(b => b.id === brand)
    if (!brandInfo) {
      return NextResponse.json(
        { error: `Unsupported brand: ${brand}` },
        { status: 400 }
      )
    }
    
    if (brandInfo.status === 'coming_soon') {
      return NextResponse.json(
        { error: `${brandInfo.name} support is coming soon. Use CSV Upload as a fallback.` },
        { status: 400 }
      )
    }
    
    // Validate name
    if (!name || typeof name !== 'string' || name.length < 1) {
      return NextResponse.json(
        { error: 'Controller name is required' },
        { status: 400 }
      )
    }
    
    // Test connection based on brand
    let controllerId: string
    let capabilities: Record<string, unknown> = {}
    let model: string | undefined
    let firmwareVersion: string | undefined
    
    if (brand === 'ac_infinity' || brand === 'inkbird') {
      // For real controllers, we'd call the adapter here
      // For now, generate a placeholder ID (actual implementation would connect)
      
      if (!credentials?.email || !credentials?.password) {
        return NextResponse.json(
          { error: 'Email and password are required for this controller' },
          { status: 400 }
        )
      }
      
      // In production: Call adapter.connect(credentials)
      // For now, use placeholder
      controllerId = `${brand}_${Date.now()}`
      capabilities = brandInfo.capabilities || {}
      model = brand === 'ac_infinity' ? 'Controller 69' : 'ITC-308'
      
      // TODO: Actually test connection
      // const adapter = getAdapter(brand)
      // const result = await adapter.connect({ type: brand, ...credentials })
      // if (!result.success) {
      //   return NextResponse.json({ error: result.error }, { status: 400 })
      // }
      // controllerId = result.controllerId
      // capabilities = result.metadata.capabilities
      
    } else if (brand === 'csv_upload') {
      // CSV upload doesn't need connection test
      controllerId = `csv_${Date.now()}_${Math.random().toString(36).substring(7)}`
      capabilities = brandInfo.capabilities || {}
      model = 'Manual CSV Data'
    } else {
      return NextResponse.json(
        { error: 'Unsupported brand' },
        { status: 400 }
      )
    }
    
    // Insert into database
    const { data, error } = await supabase
      .from('controllers')
      .insert({
        user_id: userId,
        brand,
        controller_id: controllerId,
        name,
        credentials: credentials || {},
        capabilities,
        model,
        firmware_version: firmwareVersion,
        is_online: brand !== 'csv_upload', // CSV is "offline" until data uploaded
        last_seen: new Date().toISOString(),
        room_id: room_id || null
      })
      .select()
      .single()
    
    if (error) {
      console.error('Database insert error:', error)
      
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'A controller with this ID already exists' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to save controller', details: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      controller: data,
      message: `${brandInfo.name} controller added successfully`
    }, { status: 201 })
    
  } catch (error) {
    console.error('Controllers POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
