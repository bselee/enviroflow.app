// @jest-environment node
/**
 * Workflow Cron Reliability Helpers Tests
 */

import {
  buildActionLockKey,
  getReadingTimestamp,
  isReadingFresh,
} from '@/lib/workflow-test-utils'

describe('cron workflow reliability helpers', () => {
  it('buildActionLockKey is deterministic and value-aware', () => {
    const key1 = buildActionLockKey('u1', 'wf1', 'c1', 1, 'set_level', 50)
    const key2 = buildActionLockKey('u1', 'wf1', 'c1', 1, 'set_level', 50)
    const key3 = buildActionLockKey('u1', 'wf1', 'c1', 1, 'set_level', 60)

    expect(key1).toBe(key2)
    expect(key1).not.toBe(key3)
  })

  it('getReadingTimestamp supports timestamp and recorded_at fallback', () => {
    expect(
      getReadingTimestamp({
        controller_id: 'c1',
        sensor_type: 'temperature',
        value: 25,
        timestamp: '2026-02-17T12:00:00.000Z',
      }),
    ).toBe('2026-02-17T12:00:00.000Z')

    expect(
      getReadingTimestamp({
        controller_id: 'c1',
        sensor_type: 'temperature',
        value: 25,
        recorded_at: '2026-02-17T12:01:00.000Z',
      }),
    ).toBe('2026-02-17T12:01:00.000Z')
  })

  it('isReadingFresh returns expected freshness state', () => {
    const now = Date.now()
    const fresh = new Date(now - 30_000).toISOString()
    const stale = new Date(now - 20 * 60_000).toISOString()

    expect(isReadingFresh(fresh, 60_000)).toBe(true)
    expect(isReadingFresh(stale, 60_000)).toBe(false)
    expect(isReadingFresh(undefined, 60_000)).toBe(false)
    expect(isReadingFresh('not-a-date', 60_000)).toBe(false)
  })
})
