/**
 * Middleware Unit Tests
 *
 * Tests authentication middleware routing logic.
 * Mocks Supabase SSR to isolate routing decisions.
 *
 * @jest-environment node
 */

const mockGetUser = jest.fn()
const mockGetSession = jest.fn()

// Mock @supabase/ssr before importing middleware
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  })),
}))

import { NextRequest } from 'next/server'

// Dynamically import middleware after mocks are applied
let middleware: (request: NextRequest) => Promise<import('next/server').NextResponse>

beforeAll(async () => {
  const mod = await import('@/middleware')
  middleware = mod.middleware
})

function createRequest(path: string, options?: { searchParams?: Record<string, string> }) {
  const url = new URL(path, 'http://localhost:3000')
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url)
}

describe('Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Set env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  describe('static/API routes - skip auth', () => {
    it('passes through /_next requests', async () => {
      const response = await middleware(createRequest('/_next/static/chunk.js'))
      expect(response.status).toBe(200)
      expect(mockGetUser).not.toHaveBeenCalled()
    })

    it('passes through /api requests', async () => {
      const response = await middleware(createRequest('/api/controllers'))
      expect(response.status).toBe(200)
      expect(mockGetUser).not.toHaveBeenCalled()
    })

    it('passes through static files', async () => {
      const response = await middleware(createRequest('/logo.svg'))
      expect(response.status).toBe(200)
      expect(mockGetUser).not.toHaveBeenCalled()
    })
  })

  describe('public routes', () => {
    it('passes through root /', async () => {
      const response = await middleware(createRequest('/'))
      expect(response.status).toBe(200)
    })

    it('passes through auth callback', async () => {
      const response = await middleware(createRequest('/auth/callback'))
      expect(response.status).toBe(200)
    })
  })

  describe('protected routes - unauthenticated', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } })
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    })

    it('redirects /dashboard to /login', async () => {
      const response = await middleware(createRequest('/dashboard'))
      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/login')
      expect(location).toContain('redirect=%2Fdashboard')
    })

    it('redirects /controllers to /login', async () => {
      const response = await middleware(createRequest('/controllers'))
      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/login')
    })

    it('redirects nested protected routes', async () => {
      const response = await middleware(createRequest('/settings/profile'))
      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/login')
      expect(location).toContain('redirect=%2Fsettings%2Fprofile')
    })
  })

  describe('protected routes - authenticated', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@test.com' } },
        error: null,
      })
    })

    it('allows access to /dashboard', async () => {
      const response = await middleware(createRequest('/dashboard'))
      expect(response.status).toBe(200)
    })

    it('allows access to /controllers', async () => {
      const response = await middleware(createRequest('/controllers'))
      expect(response.status).toBe(200)
    })

    it('allows access to /automations', async () => {
      const response = await middleware(createRequest('/automations'))
      expect(response.status).toBe(200)
    })
  })

  describe('auth routes', () => {
    it('allows unauthenticated users to /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } })
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      const response = await middleware(createRequest('/login'))
      expect(response.status).toBe(200)
    })

    it('redirects authenticated users from /login to /dashboard', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      const response = await middleware(createRequest('/login'))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/dashboard')
    })

    it('respects redirect param when redirecting from /login', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      const response = await middleware(
        createRequest('/login', { searchParams: { redirect: '/controllers' } })
      )
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/controllers')
    })
  })

  describe('dev mode - missing env vars', () => {
    it('passes through all requests when Supabase not configured', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const response = await middleware(createRequest('/dashboard'))
      expect(response.status).toBe(200)
      expect(mockGetUser).not.toHaveBeenCalled()
    })
  })
})
