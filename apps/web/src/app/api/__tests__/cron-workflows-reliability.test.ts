// @jest-environment node
/**
 * Workflow Cron Reliability Helpers Tests
 */

jest.mock('@enviroflow/automation-engine/adapters', () => ({
  getAdapter: jest.fn(),
  isBrandSupported: jest.fn(() => true),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}))

jest.mock('@/lib/push-notification-service', () => ({
  sendPushNotification: jest.fn(),
  createWorkflowNotification: jest.fn(() => ({
    title: 'test',
    body: 'test',
    category: 'workflow',
    priority: 'normal',
    data: {},
  })),
}))
describe('cron workflow reliability helpers', () => {
  const getHelpers = async () => {
    const mod = await import('../cron/workflows/route')
    return mod.__test__
  }

  it('buildActionLockKey is deterministic and value-aware', async () => {
    const helpers = await getHelpers()

    const key1 = helpers.buildActionLockKey('u1', 'wf1', 'c1', 1, 'set_level', 50)
    const key2 = helpers.buildActionLockKey('u1', 'wf1', 'c1', 1, 'set_level', 50)
    const key3 = helpers.buildActionLockKey('u1', 'wf1', 'c1', 1, 'set_level', 60)

    expect(key1).toBe(key2)
    expect(key1).not.toBe(key3)
  })

  it('getReadingTimestamp supports timestamp and recorded_at fallback', async () => {
    const helpers = await getHelpers()

    expect(
      helpers.getReadingTimestamp({
        controller_id: 'c1',
        sensor_type: 'temperature',
        value: 25,
        timestamp: '2026-02-17T12:00:00.000Z',
      }),
    ).toBe('2026-02-17T12:00:00.000Z')

    expect(
      helpers.getReadingTimestamp({
        controller_id: 'c1',
        sensor_type: 'temperature',
        value: 25,
        recorded_at: '2026-02-17T12:01:00.000Z',
      }),
    ).toBe('2026-02-17T12:01:00.000Z')
  })

  it('isReadingFresh returns expected freshness state', async () => {
    const helpers = await getHelpers()

    const now = Date.now()
    const fresh = new Date(now - 30_000).toISOString()
    const stale = new Date(now - 20 * 60_000).toISOString()

    expect(helpers.isReadingFresh(fresh, 60_000)).toBe(true)
    expect(helpers.isReadingFresh(stale, 60_000)).toBe(false)
    expect(helpers.isReadingFresh(undefined, 60_000)).toBe(false)
    expect(helpers.isReadingFresh('not-a-date', 60_000)).toBe(false)
  })
})
