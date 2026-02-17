/**
 * Workflow helper utilities shared by cron/workflows route and tests.
 */

export interface TimestampedReading {
  timestamp?: string
  recorded_at?: string
}

export function buildActionLockKey(
  userId: string,
  workflowId: string,
  controllerId: string,
  port: number,
  variant: string | undefined,
  value: number | undefined,
): string {
  const actionVariant = variant || 'set_level'
  const actionValue = value ?? 0
  return [userId, workflowId, controllerId, port, actionVariant, actionValue].join(':')
}

export function isReadingFresh(readingTimestamp: string | undefined, maxAgeMs: number): boolean {
  if (!readingTimestamp) return false
  const ts = new Date(readingTimestamp).getTime()
  if (!Number.isFinite(ts)) return false
  return (Date.now() - ts) <= maxAgeMs
}

export function getReadingTimestamp(reading: TimestampedReading | undefined): string | undefined {
  if (!reading) return undefined
  return reading.timestamp || reading.recorded_at
}
