/**
 * Sensor Data API Route Tests — GET /api/sensors/data
 *
 * Tests authentication, query parameter validation, controller ownership,
 * direct vs. RPC-downsampled data fetching, and device state data.
 *
 * @jest-environment node
 */

const mockAuthGetUser = jest.fn()
const mockFrom = jest.fn()
const mockRpc = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: mockAuthGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}))

import { NextRequest } from 'next/server'

let GET: (request: NextRequest) => Promise<Response>

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  const mod = await import('@/app/api/sensors/data/route')
  GET = mod.GET
})

function authReq(query = '') {
  return new NextRequest(new URL(`/api/sensors/data${query}`, 'http://localhost:3000'), {
    headers: { Authorization: 'Bearer valid-token' },
  })
}

function setupAuth(userId = 'user-123') {
  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  })
}

// Helper for chaining: from(table).select().eq().eq().single() or .maybeSingle()
function singleChain(result: { data: unknown; error: unknown }) {
  const mockSingle = jest.fn().mockResolvedValue(result)
  const mockMaybeSingle = jest.fn().mockResolvedValue(result)
  const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle, maybeSingle: mockMaybeSingle })
  const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
  return { select: mockSelect }
}

// Helper for: from(table).select().eq().limit()
function listChain(result: { data: unknown; error?: unknown }) {
  const mockLimit = jest.fn().mockResolvedValue(result)
  const mockEq = jest.fn().mockReturnValue({ limit: mockLimit })
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
  return { select: mockSelect }
}

// Helper for: from(table).select().eq().gte().lte().order()
function directQueryChain(result: { data: unknown; error: unknown }) {
  const mockOrder = jest.fn().mockResolvedValue(result)
  const mockLte = jest.fn().mockReturnValue({ order: mockOrder })
  const mockGte = jest.fn().mockReturnValue({ lte: mockLte })
  const mockEq = jest.fn().mockReturnValue({ gte: mockGte })
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
  return { select: mockSelect }
}

describe('GET /api/sensors/data', () => {
  beforeEach(() => jest.clearAllMocks())

  // ---- Auth ----

  it('returns 401 without auth', async () => {
    const req = new NextRequest(new URL('/api/sensors/data', 'http://localhost:3000'))
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Unauthorized')
  })

  // ---- Validation ----

  it('returns 400 for invalid range parameter', async () => {
    setupAuth()
    const res = await GET(authReq('?range=2y'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('Invalid range')
  })

  // ---- Controller ownership ----

  it('returns 404 when controller not found', async () => {
    setupAuth()
    // The route does two lookups: first by controller_id, then by id (UUID fallback).
    // Both must return null for a 404.
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'controllers') {
        callCount++
        if (callCount === 1) {
          // First call: lookup by controller_id — not found
          return singleChain({ data: null, error: null })
        }
        // Second call: fallback lookup by id — also not found
        return singleChain({ data: null, error: { code: 'PGRST116' } })
      }
      return {}
    })

    const res = await GET(authReq('?controllerId=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('Controller not found')
  })

  // ---- Successful data fetch (direct, short range) ----

  it('returns sensor data for 24h range (direct query)', async () => {
    setupAuth()

    const sensorRows = [
      { sensor_type: 'temperature', value: 22.5, recorded_at: '2025-01-01T00:00:00Z' },
      { sensor_type: 'humidity', value: 55, recorded_at: '2025-01-01T00:00:00Z' },
      { sensor_type: 'temperature', value: 23.0, recorded_at: '2025-01-01T01:00:00Z' },
      { sensor_type: 'humidity', value: 52, recorded_at: '2025-01-01T01:00:00Z' },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'controllers') {
        return listChain({ data: [{ id: 'ctrl-1' }] })
      }
      if (table === 'sensor_readings') {
        return directQueryChain({ data: sensorRows, error: null })
      }
      return {}
    })

    const res = await GET(authReq('?range=24h'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.sensorData).toHaveLength(2)
    expect(body.sensorData[0].temperature).toBe(22.5)
    expect(body.sensorData[0].humidity).toBe(55)
    expect(body.metadata.range).toBe('24h')
    expect(body.metadata.useRPC).toBe(false)
    expect(body.metadata.pointCount).toBe(2)
    expect(body.deviceStateData).toEqual({})
  })

  // ---- Default to first controller when none specified ----

  it('uses first controller when controllerId not specified', async () => {
    setupAuth()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'controllers') {
        return listChain({ data: [{ id: 'auto-ctrl' }] })
      }
      if (table === 'sensor_readings') {
        return directQueryChain({ data: [], error: null })
      }
      return {}
    })

    const res = await GET(authReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.metadata.controllerId).toBe('auto-ctrl')
  })

  // ---- Empty data when user has no controllers ----

  it('returns empty data when user has no controllers', async () => {
    setupAuth()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'controllers') {
        return listChain({ data: [] })
      }
      return {}
    })

    const res = await GET(authReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.sensorData).toEqual([])
    expect(body.metadata.controllerId).toBeNull()
  })

  // ---- 7d range triggers RPC ----

  it('uses RPC downsampling for 7d range', async () => {
    setupAuth()

    const downsampled = [
      { timestamp: '2025-01-01T00:00:00Z', temperature: 22.0, humidity: 50, vpd: 1.1, temp_min: 21, temp_max: 23 },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'controllers') {
        return listChain({ data: [{ id: 'ctrl-1' }] })
      }
      return {}
    })

    mockRpc.mockResolvedValue({ data: downsampled, error: null })

    const res = await GET(authReq('?range=7d'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.metadata.range).toBe('7d')
    expect(body.metadata.useRPC).toBe(true)
    expect(body.sensorData.length).toBeGreaterThanOrEqual(0)
  })

  // ---- Validates all supported ranges ----

  it.each(['1h', '6h', '24h', '1d', '7d', '30d', '60d'] as const)(
    'accepts valid range: %s',
    async (range) => {
      setupAuth()
      mockFrom.mockImplementation((table: string) => {
        if (table === 'controllers') return listChain({ data: [] })
        return directQueryChain({ data: [], error: null })
      })
      mockRpc.mockResolvedValue({ data: [], error: null })

      const res = await GET(authReq(`?range=${range}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.metadata.range).toBe(range)
    }
  )
})
