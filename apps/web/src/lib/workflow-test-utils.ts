/**
 * Workflow test utilities - extracted from cron/workflows/route.ts
 * to avoid Next.js route validation errors with __test__ exports
 */

import type { SensorReading } from '@/types'

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

export function getReadingTimestamp(reading: SensorReading | undefined): string | undefined {
  if (!reading) return undefined
  return reading.timestamp || reading.recorded_at
}
