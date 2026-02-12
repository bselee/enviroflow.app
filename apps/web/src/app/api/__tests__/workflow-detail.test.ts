/**
 * Workflow Detail API Route Tests — GET/PUT/DELETE /api/workflows/[id]
 *
 * @jest-environment node
 */

const mockAuthGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: mockAuthGetUser },
    from: mockFrom,
  })),
}))

import { NextRequest } from 'next/server'

let GET: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>
let PUT: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>
let DELETE: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>

const VALID_UUID = '11111111-1111-1111-1111-111111111111'

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  const mod = await import('@/app/api/workflows/[id]/route')
  GET = mod.GET
  PUT = mod.PUT
  DELETE = mod.DELETE
})

function ctx(id = VALID_UUID) {
  return { params: Promise.resolve({ id }) }
}

function authReq(path: string, init?: RequestInit) {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    ...init,
    headers: {
      Authorization: 'Bearer valid-token',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
}

function setupAuth(userId = 'user-123') {
  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  })
}

// ============================================
// GET /api/workflows/[id]
// ============================================

describe('GET /api/workflows/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 without auth', async () => {
    const req = new NextRequest(new URL('/api/workflows/' + VALID_UUID, 'http://localhost:3000'))
    const res = await GET(req, ctx())
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid UUID', async () => {
    setupAuth()
    const res = await GET(authReq('/api/workflows/not-a-uuid'), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid workflow ID')
  })

  it('returns 404 when workflow not found', async () => {
    setupAuth()
    const mockSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    })
    const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET(authReq('/api/workflows/' + VALID_UUID), ctx())
    expect(res.status).toBe(404)
  })

  it('returns workflow with execution history and stats', async () => {
    setupAuth()

    const workflow = {
      id: VALID_UUID,
      name: 'Test WF',
      nodes: [
        { id: 't1', type: 'trigger', data: {} },
        { id: 'a1', type: 'action', data: {} },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'a1' }],
      is_active: true,
    }

    const history = [
      { id: 'h1', action_type: 'workflow_executed', result: 'success', timestamp: '2025-01-01' },
      { id: 'h2', action_type: 'workflow_executed', result: 'failed', timestamp: '2025-01-02' },
    ]

    // Workflow fetch chain: from('workflows').select().eq().eq().single()
    const mockWfSingle = jest.fn().mockResolvedValue({ data: workflow, error: null })
    const mockWfEq2 = jest.fn().mockReturnValue({ single: mockWfSingle })
    const mockWfEq1 = jest.fn().mockReturnValue({ eq: mockWfEq2 })
    const mockWfSelect = jest.fn().mockReturnValue({ eq: mockWfEq1 })

    // History chain: from('activity_logs').select().eq().order().limit()
    const mockLimit = jest.fn().mockResolvedValue({ data: history, error: null })
    const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockHistEq = jest.fn().mockReturnValue({ order: mockOrder })
    const mockHistSelect = jest.fn().mockReturnValue({ eq: mockHistEq })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workflows') return { select: mockWfSelect }
      if (table === 'activity_logs') return { select: mockHistSelect }
      return {}
    })

    const res = await GET(authReq('/api/workflows/' + VALID_UUID), ctx())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.workflow.id).toBe(VALID_UUID)
    expect(body.workflow.node_count).toBe(2)
    expect(body.workflow.trigger_count).toBe(1)
    expect(body.workflow.action_count).toBe(1)
    expect(body.execution_history).toHaveLength(2)
    expect(body.execution_stats.success).toBe(1)
    expect(body.execution_stats.failed).toBe(1)
  })
})

// ============================================
// PUT /api/workflows/[id]
// ============================================

describe('PUT /api/workflows/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 without auth', async () => {
    const req = new NextRequest(new URL('/api/workflows/' + VALID_UUID, 'http://localhost:3000'), {
      method: 'PUT',
      body: JSON.stringify({ name: 'x' }),
    })
    const res = await PUT(req, ctx())
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid UUID', async () => {
    setupAuth()
    const res = await PUT(
      authReq('/api/workflows/bad', { method: 'PUT', body: JSON.stringify({ name: 'x' }) }),
      ctx('bad')
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    setupAuth()
    const req = new NextRequest(new URL('/api/workflows/' + VALID_UUID, 'http://localhost:3000'), {
      method: 'PUT',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: 'bad{json',
    })
    const res = await PUT(req, ctx())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid JSON')
  })

  it('returns 400 for Zod validation errors', async () => {
    setupAuth()
    const res = await PUT(
      authReq('/api/workflows/' + VALID_UUID, {
        method: 'PUT',
        body: JSON.stringify({ name: '' }), // empty name
      }),
      ctx()
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 404 when workflow not found', async () => {
    setupAuth()
    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await PUT(
      authReq('/api/workflows/' + VALID_UUID, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      }),
      ctx()
    )
    expect(res.status).toBe(404)
  })

  it('validates workflow structure on node/edge update', async () => {
    setupAuth()

    // Existing workflow fetch
    const existing = {
      id: VALID_UUID,
      name: 'WF',
      nodes: [{ id: 't1', type: 'trigger', data: {} }],
      edges: [],
      is_active: false,
      dry_run_enabled: true,
    }
    const mockSingle = jest.fn().mockResolvedValue({ data: existing, error: null })
    const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    // Update with nodes that have no action node → invalid
    const res = await PUT(
      authReq('/api/workflows/' + VALID_UUID, {
        method: 'PUT',
        body: JSON.stringify({
          nodes: [{ id: 't1', type: 'trigger', data: {} }], // no action node
        }),
      }),
      ctx()
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('invalid')
    expect(body.validation.errors.length).toBeGreaterThan(0)
  })

  it('rejects simultaneous activate + disable dry-run', async () => {
    setupAuth()

    const existing = {
      id: VALID_UUID,
      name: 'WF',
      nodes: [],
      edges: [],
      is_active: false,
      dry_run_enabled: true, // was in dry-run
    }
    const mockSingle = jest.fn().mockResolvedValue({ data: existing, error: null })
    const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await PUT(
      authReq('/api/workflows/' + VALID_UUID, {
        method: 'PUT',
        body: JSON.stringify({ is_active: true, dry_run_enabled: false }),
      }),
      ctx()
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('dry-run')
    expect(body.suggestion).toBeDefined()
  })

  it('updates workflow successfully', async () => {
    setupAuth()

    const existing = {
      id: VALID_UUID,
      name: 'Old',
      nodes: [],
      edges: [],
      is_active: true,
      dry_run_enabled: false,
    }

    const updated = { ...existing, name: 'New Name' }

    // First call: select existing workflow
    const mockExistSingle = jest.fn().mockResolvedValue({ data: existing, error: null })
    const mockExistEq2 = jest.fn().mockReturnValue({ single: mockExistSingle })
    const mockExistEq1 = jest.fn().mockReturnValue({ eq: mockExistEq2 })
    const mockExistSelect = jest.fn().mockReturnValue({ eq: mockExistEq1 })

    // Second call: update
    const mockUpdSingle = jest.fn().mockResolvedValue({ data: updated, error: null })
    const mockUpdSelect = jest.fn().mockReturnValue({ single: mockUpdSingle })
    const mockUpdEq2 = jest.fn().mockReturnValue({ select: mockUpdSelect })
    const mockUpdEq1 = jest.fn().mockReturnValue({ eq: mockUpdEq2 })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdEq1 })

    // Activity log insert
    const mockLogInsert = jest.fn().mockResolvedValue({ error: null })

    let wfCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workflows') {
        wfCallCount++
        if (wfCallCount === 1) return { select: mockExistSelect }
        return { update: mockUpdate }
      }
      if (table === 'activity_logs') return { insert: mockLogInsert }
      return {}
    })

    const res = await PUT(
      authReq('/api/workflows/' + VALID_UUID, {
        method: 'PUT',
        body: JSON.stringify({ name: 'New Name' }),
      }),
      ctx()
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toContain('updated successfully')
    expect(body.workflow.name).toBe('New Name')
  })
})

// ============================================
// DELETE /api/workflows/[id]
// ============================================

describe('DELETE /api/workflows/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 without auth', async () => {
    const req = new NextRequest(new URL('/api/workflows/' + VALID_UUID, 'http://localhost:3000'), {
      method: 'DELETE',
    })
    const res = await DELETE(req, ctx())
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid UUID', async () => {
    setupAuth()
    const res = await DELETE(authReq('/api/workflows/bad', { method: 'DELETE' }), ctx('bad'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when workflow not found', async () => {
    setupAuth()
    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await DELETE(authReq('/api/workflows/' + VALID_UUID, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(404)
  })

  it('deletes workflow with dimmer schedule cleanup', async () => {
    setupAuth()

    const existing = {
      id: VALID_UUID,
      name: 'To Delete',
      nodes: [
        { id: 't1', type: 'trigger', data: {} },
        { id: 'd1', type: 'dimmer', data: { controllerId: 'ctrl-1', port: 1 } },
      ],
      is_active: false,
    }

    // Fetch existing workflow
    const mockExistSingle = jest.fn().mockResolvedValue({ data: existing, error: null })
    const mockExistEq2 = jest.fn().mockReturnValue({ single: mockExistSingle })
    const mockExistEq1 = jest.fn().mockReturnValue({ eq: mockExistEq2 })
    const mockExistSelect = jest.fn().mockReturnValue({ eq: mockExistEq1 })

    // Delete dimmer schedules chain: .delete().eq().eq().eq()
    const mockDimmerEq3 = jest.fn().mockResolvedValue({ count: 2, error: null })
    const mockDimmerEq2 = jest.fn().mockReturnValue({ eq: mockDimmerEq3 })
    const mockDimmerEq1 = jest.fn().mockReturnValue({ eq: mockDimmerEq2 })
    const mockDimmerDel = jest.fn().mockReturnValue({ eq: mockDimmerEq1 })

    // Delete workflow chain: .delete().eq().eq()
    const mockWfDelEq2 = jest.fn().mockResolvedValue({ error: null })
    const mockWfDelEq1 = jest.fn().mockReturnValue({ eq: mockWfDelEq2 })
    const mockWfDel = jest.fn().mockReturnValue({ eq: mockWfDelEq1 })

    // Activity log insert
    const mockLogInsert = jest.fn().mockResolvedValue({ error: null })

    let wfCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workflows') {
        wfCallCount++
        if (wfCallCount === 1) return { select: mockExistSelect }
        return { delete: mockWfDel }
      }
      if (table === 'dimmer_schedules') return { delete: mockDimmerDel }
      if (table === 'activity_logs') return { insert: mockLogInsert }
      return {}
    })

    const res = await DELETE(authReq('/api/workflows/' + VALID_UUID, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toContain('deleted successfully')
    expect(body.deleted_dimmer_schedules).toBe(2)
  })

  it('deletes workflow without dimmer nodes', async () => {
    setupAuth()

    const existing = {
      id: VALID_UUID,
      name: 'Simple WF',
      nodes: [
        { id: 't1', type: 'trigger', data: {} },
        { id: 'a1', type: 'action', data: {} },
      ],
      is_active: false,
    }

    const mockExistSingle = jest.fn().mockResolvedValue({ data: existing, error: null })
    const mockExistEq2 = jest.fn().mockReturnValue({ single: mockExistSingle })
    const mockExistEq1 = jest.fn().mockReturnValue({ eq: mockExistEq2 })
    const mockExistSelect = jest.fn().mockReturnValue({ eq: mockExistEq1 })

    const mockWfDelEq2 = jest.fn().mockResolvedValue({ error: null })
    const mockWfDelEq1 = jest.fn().mockReturnValue({ eq: mockWfDelEq2 })
    const mockWfDel = jest.fn().mockReturnValue({ eq: mockWfDelEq1 })

    const mockLogInsert = jest.fn().mockResolvedValue({ error: null })

    let wfCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workflows') {
        wfCallCount++
        if (wfCallCount === 1) return { select: mockExistSelect }
        return { delete: mockWfDel }
      }
      if (table === 'activity_logs') return { insert: mockLogInsert }
      return {}
    })

    const res = await DELETE(authReq('/api/workflows/' + VALID_UUID, { method: 'DELETE' }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toContain('deleted successfully')
    expect(body.deleted_dimmer_schedules).toBe(0)
  })
})
