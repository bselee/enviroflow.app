/**
 * Workflow Conflict Detection API Tests
 *
 * Tests GET /api/workflows/conflicts
 * Validates port conflict detection logic across active workflows.
 *
 * @jest-environment node
 */

const mockAuthGetUser = jest.fn()
const mockFrom = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: mockAuthGetUser },
    from: mockFrom,
  })),
}))

import { NextRequest } from 'next/server'

let GET: (request: NextRequest) => Promise<Response>

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  const mod = await import('@/app/api/workflows/conflicts/route')
  GET = mod.GET
})

function authRequest(path = '/api/workflows/conflicts') {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    headers: { Authorization: 'Bearer valid-token' },
  })
}

function setupAuth(userId = 'user-123') {
  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  })
}

function setupWorkflows(workflows: { id: string; name: string; nodes: unknown[]; is_active: boolean }[]) {
  const mockEq2 = jest.fn().mockResolvedValue({ data: workflows, error: null })
  mockEq.mockReturnValue({ eq: mockEq2 })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

describe('GET /api/workflows/conflicts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 without auth header', async () => {
    const req = new NextRequest(new URL('/api/workflows/conflicts', 'http://localhost:3000'))
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } })
    const res = await GET(authRequest())
    expect(res.status).toBe(401)
  })

  it('returns empty conflicts when no active workflows', async () => {
    setupAuth()
    setupWorkflows([])

    const res = await GET(authRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.conflicts).toEqual({})
  })

  it('returns no conflicts when workflows target different ports', async () => {
    setupAuth()
    setupWorkflows([
      {
        id: 'wf-1',
        name: 'Fan Control',
        is_active: true,
        nodes: [
          { id: 'n1', type: 'trigger', data: {} },
          { id: 'n2', type: 'action', data: { controllerId: 'ctrl-1', port: 1 } },
        ],
      },
      {
        id: 'wf-2',
        name: 'Light Control',
        is_active: true,
        nodes: [
          { id: 'n3', type: 'trigger', data: {} },
          { id: 'n4', type: 'action', data: { controllerId: 'ctrl-1', port: 2 } },
        ],
      },
    ])

    const res = await GET(authRequest())
    const body = await res.json()

    expect(body.conflicts['wf-1'].hasConflict).toBe(false)
    expect(body.conflicts['wf-2'].hasConflict).toBe(false)
  })

  it('detects conflicts when workflows target the same port', async () => {
    setupAuth()
    setupWorkflows([
      {
        id: 'wf-1',
        name: 'Fan Auto',
        is_active: true,
        nodes: [
          { id: 'n1', type: 'trigger', data: {} },
          { id: 'n2', type: 'action', data: { controllerId: 'ctrl-1', port: 1 } },
        ],
      },
      {
        id: 'wf-2',
        name: 'Fan Manual',
        is_active: true,
        nodes: [
          { id: 'n3', type: 'trigger', data: {} },
          { id: 'n4', type: 'action', data: { controllerId: 'ctrl-1', port: 1 } },
        ],
      },
    ])

    const res = await GET(authRequest())
    const body = await res.json()

    expect(body.conflicts['wf-1'].hasConflict).toBe(true)
    expect(body.conflicts['wf-1'].conflictingWorkflows).toEqual([
      { id: 'wf-2', name: 'Fan Manual' },
    ])
    expect(body.conflicts['wf-1'].conflictingPorts).toEqual(['ctrl-1:1'])

    expect(body.conflicts['wf-2'].hasConflict).toBe(true)
    expect(body.conflicts['wf-2'].conflictingWorkflows).toEqual([
      { id: 'wf-1', name: 'Fan Auto' },
    ])
  })

  it('detects conflicts with config-nested port data', async () => {
    setupAuth()
    setupWorkflows([
      {
        id: 'wf-1',
        name: 'WF1',
        is_active: true,
        nodes: [
          { id: 'n1', type: 'trigger', data: {} },
          { id: 'n2', type: 'dimmer', data: { config: { controllerId: 'ctrl-1', port: 3 } } },
        ],
      },
      {
        id: 'wf-2',
        name: 'WF2',
        is_active: true,
        nodes: [
          { id: 'n3', type: 'trigger', data: {} },
          { id: 'n4', type: 'verified_action', data: { controllerId: 'ctrl-1', port: 3 } },
        ],
      },
    ])

    const res = await GET(authRequest())
    const body = await res.json()

    expect(body.conflicts['wf-1'].hasConflict).toBe(true)
    expect(body.conflicts['wf-2'].hasConflict).toBe(true)
    expect(body.conflicts['wf-1'].conflictingPorts).toEqual(['ctrl-1:3'])
  })

  it('handles three-way conflicts', async () => {
    setupAuth()
    setupWorkflows([
      {
        id: 'wf-1', name: 'A', is_active: true,
        nodes: [{ id: 'n1', type: 'action', data: { controllerId: 'c', port: 1 } }],
      },
      {
        id: 'wf-2', name: 'B', is_active: true,
        nodes: [{ id: 'n2', type: 'action', data: { controllerId: 'c', port: 1 } }],
      },
      {
        id: 'wf-3', name: 'C', is_active: true,
        nodes: [{ id: 'n3', type: 'action', data: { controllerId: 'c', port: 1 } }],
      },
    ])

    const res = await GET(authRequest())
    const body = await res.json()

    // All 3 should conflict
    expect(body.conflicts['wf-1'].conflictingWorkflows).toHaveLength(2)
    expect(body.conflicts['wf-2'].conflictingWorkflows).toHaveLength(2)
    expect(body.conflicts['wf-3'].conflictingWorkflows).toHaveLength(2)
  })

  it('ignores non-action nodes for conflict detection', async () => {
    setupAuth()
    setupWorkflows([
      {
        id: 'wf-1', name: 'A', is_active: true,
        nodes: [
          { id: 'n1', type: 'trigger', data: { controllerId: 'c', port: 1 } },
          { id: 'n2', type: 'condition', data: { controllerId: 'c', port: 1 } },
        ],
      },
      {
        id: 'wf-2', name: 'B', is_active: true,
        nodes: [
          { id: 'n3', type: 'sensor', data: { controllerId: 'c', port: 1 } },
        ],
      },
    ])

    const res = await GET(authRequest())
    const body = await res.json()

    expect(body.conflicts['wf-1'].hasConflict).toBe(false)
    expect(body.conflicts['wf-2'].hasConflict).toBe(false)
  })

  it('handles database error gracefully', async () => {
    setupAuth()
    const mockEq2 = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB down' } })
    mockEq.mockReturnValue({ eq: mockEq2 })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET(authRequest())
    expect(res.status).toBe(500)
  })
})
