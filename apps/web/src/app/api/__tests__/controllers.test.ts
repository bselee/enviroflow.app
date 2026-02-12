/**
 * Controllers API Route Tests
 *
 * Tests GET /api/controllers and POST /api/controllers
 * Validates auth, error handling, and response shapes.
 *
 * @jest-environment node
 */

const mockAuthGetUser = jest.fn()
const mockFrom = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockInsert = jest.fn()

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: mockAuthGetUser },
    from: mockFrom,
  })),
}))

// Mock server-encryption
jest.mock('@/lib/server-encryption', () => ({
  encryptCredentials: jest.fn(() => 'encrypted_creds'),
  EncryptionError: class EncryptionError extends Error {},
}))

// Mock poll-sensors
jest.mock('@/lib/poll-sensors', () => ({
  pollController: jest.fn(),
}))

// Mock adapter factory
jest.mock('@enviroflow/automation-engine/adapters', () => ({
  getAdapter: jest.fn(() => ({
    connect: jest.fn(() => ({
      success: true,
      controllerId: 'ctrl-123',
    })),
    disconnect: jest.fn(),
    getCapabilities: jest.fn(() => ({
      sensors: [],
      devices: [],
      supportsDimming: false,
      supportsScheduling: true,
      maxPorts: 4,
    })),
  })),
  getSupportedBrands: jest.fn(() => [
    { id: 'ac_infinity', name: 'AC Infinity' },
    { id: 'inkbird', name: 'Inkbird' },
  ]),
  isBrandSupported: jest.fn((brand: string) => ['ac_infinity', 'inkbird', 'csv_upload', 'ecowitt'].includes(brand)),
}))

import { NextRequest } from 'next/server'

// Import after mocks
let GET: (request: NextRequest) => Promise<Response>
let POST: (request: NextRequest) => Promise<Response>

beforeAll(async () => {
  // Set required env vars
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  process.env.ENCRYPTION_KEY = '0'.repeat(64)

  const mod = await import('@/app/api/controllers/route')
  GET = mod.GET
  POST = mod.POST
})

function makeRequest(path: string, options?: RequestInit) {
  return new NextRequest(new URL(path, 'http://localhost:3000'), options)
}

function makeAuthRequest(path: string, token = 'valid-token') {
  return makeRequest(path, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

describe('GET /api/controllers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default chain: from().select().eq().order()
    mockOrder.mockResolvedValue({ data: [], error: null })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('rejects unauthenticated requests with 401', async () => {
    const response = await GET(makeRequest('/api/controllers'))
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('Unauthorized')
  })

  it('rejects requests without Bearer prefix', async () => {
    const request = makeRequest('/api/controllers', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    })
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('rejects expired/invalid tokens', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    })

    const response = await GET(makeAuthRequest('/api/controllers'))
    expect(response.status).toBe(401)
  })

  it('returns controllers for authenticated user', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })

    const mockControllers = [
      { id: 'c1', brand: 'ac_infinity', name: 'Test Controller', status: 'online' },
    ]
    mockOrder.mockResolvedValue({ data: mockControllers, error: null })

    const response = await GET(makeAuthRequest('/api/controllers'))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.controllers).toEqual(mockControllers)
    expect(body.count).toBe(1)
  })

  it('returns empty array when no controllers', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockOrder.mockResolvedValue({ data: [], error: null })

    const response = await GET(makeAuthRequest('/api/controllers'))
    const body = await response.json()
    expect(body.controllers).toEqual([])
    expect(body.count).toBe(0)
  })

  it('handles database errors gracefully', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: 'Connection refused' },
    })

    const response = await GET(makeAuthRequest('/api/controllers'))
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.error).toContain('Failed to fetch controllers')
    expect(body.details).toBe('Connection refused')
  })

  it('filters by user_id (not returning other users data)', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockOrder.mockResolvedValue({ data: [], error: null })

    await GET(makeAuthRequest('/api/controllers'))

    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
  })
})

describe('POST /api/controllers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock insert chain
    const mockSingle = jest.fn().mockResolvedValue({
      data: { id: 'new-ctrl-1', brand: 'ac_infinity', name: 'My Controller' },
      error: null,
    })
    const mockSelectAfterInsert = jest.fn().mockReturnValue({ single: mockSingle })
    mockInsert.mockReturnValue({ select: mockSelectAfterInsert })
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({ data: [], error: null })
  })

  it('rejects unauthenticated requests', async () => {
    const request = new NextRequest(new URL('/api/controllers', 'http://localhost:3000'), {
      method: 'POST',
      body: JSON.stringify({ brand: 'ac_infinity', name: 'Test', credentials: {} }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('rejects unsupported brands', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })

    const request = new NextRequest(new URL('/api/controllers', 'http://localhost:3000'), {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'unsupported_brand', name: 'Test', credentials: {} }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Unsupported')
  })

  it('requires name field', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })

    const request = new NextRequest(new URL('/api/controllers', 'http://localhost:3000'), {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: 'ac_infinity', credentials: { email: 'a@b.com', password: 'x' } }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
