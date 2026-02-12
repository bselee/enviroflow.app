/**
 * Workflows API Route Tests
 *
 * Tests GET /api/workflows and POST /api/workflows
 * Validates listing, creation, Zod validation, and workflow structure checks.
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

let GET: (request: NextRequest) => Promise<Response>
let POST: (request: NextRequest) => Promise<Response>

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  const mod = await import('@/app/api/workflows/route')
  GET = mod.GET
  POST = mod.POST
})

function authRequest(path: string, init?: RequestInit) {
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

// Helper to build Supabase mock chain
function chainMock(finalResult: { data: unknown; error: unknown }) {
  // Construct a chainable mock that returns the final result for any terminal call
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        // Make it thenable — resolve with finalResult
        return (resolve: (v: unknown) => void) => resolve(finalResult)
      }
      return new Proxy(jest.fn().mockReturnValue(new Proxy({}, handler)), handler)
    },
    apply() {
      return new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

// ============================================
// GET /api/workflows
// ============================================

describe('GET /api/workflows', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 without auth', async () => {
    const req = new NextRequest(new URL('/api/workflows', 'http://localhost:3000'))
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } })
    const res = await GET(authRequest('/api/workflows'))
    expect(res.status).toBe(401)
  })

  it('returns workflows for authenticated user', async () => {
    setupAuth()

    const mockWorkflows = [
      {
        id: 'wf-1',
        name: 'Test Workflow',
        nodes: [
          { id: 'n1', type: 'trigger', data: {} },
          { id: 'n2', type: 'action', data: {} },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        is_active: true,
      },
    ]

    // Build a semi-realistic chain: from().select().eq().order() -> data
    const mockOrder = jest.fn().mockResolvedValue({ data: mockWorkflows, error: null })
    const mockEqUserId = jest.fn().mockReturnValue({ order: mockOrder })
    const mockSelectWorkflows = jest.fn().mockReturnValue({ eq: mockEqUserId })

    // Activity logs query (for stats)
    const mockGte = jest.fn().mockResolvedValue({ data: [], error: null })
    const mockIn = jest.fn().mockReturnValue({ gte: mockGte })
    const mockSelectActivity = jest.fn().mockReturnValue({ in: mockIn })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workflows') return { select: mockSelectWorkflows }
      if (table === 'activity_logs') return { select: mockSelectActivity }
      return chainMock({ data: null, error: null })
    })

    const res = await GET(authRequest('/api/workflows'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.workflows).toHaveLength(1)
    expect(body.count).toBe(1)
    expect(body.workflows[0].node_count).toBe(2)
    expect(body.workflows[0].edge_count).toBe(1)
    expect(body.workflows[0].trigger_count).toBe(1)
    expect(body.workflows[0].action_count).toBe(1)
  })

  it('returns empty when user has no workflows', async () => {
    setupAuth()
    const mockOrder = jest.fn().mockResolvedValue({ data: [], error: null })
    const mockEqId = jest.fn().mockReturnValue({ order: mockOrder })
    const mockSel = jest.fn().mockReturnValue({ eq: mockEqId })
    mockFrom.mockReturnValue({ select: mockSel })

    const res = await GET(authRequest('/api/workflows'))
    const body = await res.json()
    expect(body.workflows).toEqual([])
    expect(body.count).toBe(0)
  })
})

// ============================================
// POST /api/workflows
// ============================================

describe('POST /api/workflows', () => {
  beforeEach(() => jest.clearAllMocks())

  const validWorkflow = {
    name: 'Test Workflow',
    nodes: [
      { id: 'trigger-1', type: 'trigger', data: { triggerType: 'manual' } },
      { id: 'action-1', type: 'action', data: { controllerId: 'ctrl-1', port: 1 } },
    ],
    edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
  }

  it('returns 401 without auth', async () => {
    const req = new NextRequest(new URL('/api/workflows', 'http://localhost:3000'), {
      method: 'POST',
      body: JSON.stringify(validWorkflow),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON', async () => {
    setupAuth()
    const req = new NextRequest(new URL('/api/workflows', 'http://localhost:3000'), {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid JSON')
  })

  it('returns 400 for missing name', async () => {
    setupAuth()
    mockFrom.mockReturnValue(chainMock({ data: null, error: null }))

    const req = authRequest('/api/workflows', {
      method: 'POST',
      body: JSON.stringify({ nodes: validWorkflow.nodes, edges: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 for empty nodes array', async () => {
    setupAuth()
    mockFrom.mockReturnValue(chainMock({ data: null, error: null }))

    const req = authRequest('/api/workflows', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', nodes: [], edges: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for workflow without trigger node', async () => {
    setupAuth()
    mockFrom.mockReturnValue(chainMock({ data: null, error: null }))

    const req = authRequest('/api/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: 'No Trigger',
        nodes: [{ id: 'a1', type: 'action', data: {} }],
        edges: [],
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('invalid')
  })

  it('returns 400 for workflow without action node', async () => {
    setupAuth()
    mockFrom.mockReturnValue(chainMock({ data: null, error: null }))

    const req = authRequest('/api/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: 'No Action',
        nodes: [{ id: 't1', type: 'trigger', data: {} }],
        edges: [],
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('invalid')
  })

  it('creates workflow successfully', async () => {
    setupAuth()

    const createdWorkflow = { id: 'wf-new', ...validWorkflow }

    // Mock workflow count check
    const mockCountHead = jest.fn().mockResolvedValue({ count: 5, error: null })
    const mockCountEq = jest.fn().mockReturnValue(mockCountHead)
    const mockCountSelect = jest.fn().mockReturnValue({ eq: mockCountEq })

    // Mock insert chain
    const mockSingle = jest.fn().mockResolvedValue({ data: createdWorkflow, error: null })
    const mockInsertSelect = jest.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = jest.fn().mockReturnValue({ select: mockInsertSelect })

    // Mock activity log insert
    const mockLogInsert = jest.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workflows') {
        // First call is count, second is insert
        return { select: mockCountSelect, insert: mockInsert }
      }
      if (table === 'activity_logs') return { insert: mockLogInsert }
      return chainMock({ data: null, error: null })
    })

    const req = authRequest('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(validWorkflow),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.workflow.id).toBe('wf-new')
    expect(body.message).toContain('created successfully')
    expect(body.validation.valid).toBe(true)
  })

  it('enforces dry-run when activating on creation', async () => {
    setupAuth()

    const createdWorkflow = { id: 'wf-dr', ...validWorkflow, is_active: true, dry_run_enabled: true }

    const mockSingle = jest.fn().mockResolvedValue({ data: createdWorkflow, error: null })
    const mockInsertSelect = jest.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = jest.fn().mockReturnValue({ select: mockInsertSelect })
    const mockCountHead = jest.fn().mockResolvedValue({ count: 1, error: null })
    const mockCountEq = jest.fn().mockReturnValue(mockCountHead)
    const mockCountSelect = jest.fn().mockReturnValue({ eq: mockCountEq })
    const mockLogInsert = jest.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workflows') return { select: mockCountSelect, insert: mockInsert }
      if (table === 'activity_logs') return { insert: mockLogInsert }
      return chainMock({ data: null, error: null })
    })

    const req = authRequest('/api/workflows', {
      method: 'POST',
      body: JSON.stringify({
        ...validWorkflow,
        is_active: true,
        dry_run_enabled: false, // trying to disable dry-run on active creation
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)

    const body = await res.json()
    // Should have warning about dry-run being enforced
    expect(body.validation.warnings.some((w: string) => w.toLowerCase().includes('dry-run'))).toBe(true)
  })

  it('returns 400 for invalid node type', async () => {
    setupAuth()
    mockFrom.mockReturnValue(chainMock({ data: null, error: null }))

    const req = authRequest('/api/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bad Nodes',
        nodes: [{ id: 'x', type: 'invalid_type', data: {} }],
        edges: [],
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
