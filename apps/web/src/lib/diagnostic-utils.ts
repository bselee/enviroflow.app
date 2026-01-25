/**
 * Diagnostic Utilities for Controller Connection Quality Metrics
 *
 * Provides functions for:
 * - Running connection diagnostics (ping, response time measurement)
 * - Calculating diagnostic metrics (packet loss, sync lag, success rate)
 * - Color-coding based on performance thresholds
 * - Generating contextual recommendations
 */

import type { Controller } from '@/types'

// ============================================
// Types
// ============================================

/**
 * Comprehensive diagnostic metrics for a controller
 */
export interface DiagnosticMetrics {
  /** Response time in milliseconds */
  responseTime: number
  /** Packet loss percentage (0-100) */
  packetLoss: number
  /** Sync lag in seconds since last sync */
  syncLag: number
  /** API call success rate percentage (0-100) */
  successRate: number
  /** ISO timestamp of when diagnostics were run */
  lastChecked: string
  /** Additional diagnostic details */
  details?: {
    totalAttempts: number
    successfulAttempts: number
    failedAttempts: number
    averageResponseTime: number
    minResponseTime: number
    maxResponseTime: number
  }
}

/**
 * Status color based on metric thresholds
 */
export type MetricStatus = 'green' | 'yellow' | 'red'

/**
 * Historical diagnostic data point for trend charts
 */
export interface DiagnosticHistoryPoint {
  timestamp: string
  responseTime: number
  packetLoss: number
  syncLag: number
  successRate: number
}

/**
 * Result of running a diagnostic test
 */
export interface DiagnosticTestResult {
  success: boolean
  metrics: DiagnosticMetrics
  error?: string
}

// ============================================
// Status Color Helpers
// ============================================

/**
 * Get color status based on response time thresholds
 * - Green: < 500ms (excellent)
 * - Yellow: 500-1000ms (acceptable)
 * - Red: > 1000ms (poor)
 */
export function getResponseTimeStatus(responseTime: number): MetricStatus {
  if (responseTime < 500) return 'green'
  if (responseTime < 1000) return 'yellow'
  return 'red'
}

/**
 * Get color status based on packet loss percentage
 * - Green: 0% (no loss)
 * - Yellow: 1-10% (some loss)
 * - Red: > 10% (significant loss)
 */
export function getPacketLossStatus(packetLoss: number): MetricStatus {
  if (packetLoss === 0) return 'green'
  if (packetLoss <= 10) return 'yellow'
  return 'red'
}

/**
 * Get color status based on sync lag in seconds
 * - Green: < 60s (under 1 minute)
 * - Yellow: 60-300s (1-5 minutes)
 * - Red: > 300s (over 5 minutes)
 */
export function getSyncLagStatus(syncLag: number): MetricStatus {
  if (syncLag < 60) return 'green'
  if (syncLag < 300) return 'yellow'
  return 'red'
}

/**
 * Get color status based on success rate percentage
 * - Green: >= 95% (excellent)
 * - Yellow: 75-94% (acceptable)
 * - Red: < 75% (poor)
 */
export function getSuccessRateStatus(successRate: number): MetricStatus {
  if (successRate >= 95) return 'green'
  if (successRate >= 75) return 'yellow'
  return 'red'
}

/**
 * Get overall health status based on all metrics
 * Returns worst status among all metrics
 */
export function getOverallStatus(metrics: DiagnosticMetrics): MetricStatus {
  const statuses = [
    getResponseTimeStatus(metrics.responseTime),
    getPacketLossStatus(metrics.packetLoss),
    getSyncLagStatus(metrics.syncLag),
    getSuccessRateStatus(metrics.successRate),
  ]

  if (statuses.includes('red')) return 'red'
  if (statuses.includes('yellow')) return 'yellow'
  return 'green'
}

// ============================================
// Visual Styling Helpers
// ============================================

/**
 * Get Tailwind CSS classes for a metric status
 */
export function getStatusClasses(status: MetricStatus) {
  switch (status) {
    case 'green':
      return {
        bg: 'bg-green-50 dark:bg-green-950/30',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
        dot: 'bg-green-500',
        badge: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200/50',
      }
    case 'yellow':
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-950/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        border: 'border-yellow-200 dark:border-yellow-800',
        dot: 'bg-yellow-500',
        badge: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200/50',
      }
    case 'red':
      return {
        bg: 'bg-red-50 dark:bg-red-950/30',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
        dot: 'bg-red-500',
        badge: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200/50',
      }
  }
}

/**
 * Get human-readable label for status
 */
export function getStatusLabel(status: MetricStatus): string {
  switch (status) {
    case 'green':
      return 'Excellent'
    case 'yellow':
      return 'Fair'
    case 'red':
      return 'Poor'
  }
}

// ============================================
// Recommendation Engine
// ============================================

/**
 * Generate contextual recommendations based on diagnostic metrics
 * Returns prioritized list of recommendations
 */
export function getRecommendations(
  metrics: DiagnosticMetrics,
  controller: Controller
): string[] {
  const recommendations: string[] = []

  // Check success rate first (most critical)
  if (metrics.successRate < 50) {
    recommendations.push('Connection unreliable. Try reconnecting the controller.')
  } else if (metrics.successRate < 75) {
    recommendations.push('Connection stability issues detected. Monitor for further degradation.')
  }

  // Check response time
  if (metrics.responseTime > 1000) {
    recommendations.push('Slow response detected. Check WiFi signal strength or move closer to router.')
  } else if (metrics.responseTime > 500) {
    recommendations.push('Response time is acceptable but could be improved. Check network congestion.')
  }

  // Check sync lag
  if (metrics.syncLag > 300) {
    recommendations.push('Data not syncing. Check device power and network connection.')
  } else if (metrics.syncLag > 120) {
    recommendations.push('Sync lag detected. Device may be experiencing connectivity issues.')
  }

  // Check packet loss
  if (metrics.packetLoss > 10) {
    recommendations.push('High packet loss. Check for WiFi interference or signal obstructions.')
  } else if (metrics.packetLoss > 0) {
    recommendations.push('Minor packet loss detected. Consider improving WiFi coverage.')
  }

  // Brand-specific recommendations
  if (controller.brand === 'ac_infinity' && recommendations.length > 0) {
    recommendations.push('For AC Infinity: Ensure controller is on 2.4GHz WiFi, not 5GHz.')
  } else if (controller.brand === 'inkbird' && recommendations.length > 0) {
    recommendations.push('For Inkbird: Verify WiFi credentials are correct in device settings.')
  } else if (controller.brand === 'ecowitt' && recommendations.length > 0) {
    recommendations.push('For Ecowitt: Check that data is uploading to ecowitt.net portal.')
  }

  // If everything is good
  if (recommendations.length === 0) {
    recommendations.push('Connection is healthy. No action required.')
  }

  return recommendations
}

// ============================================
// Metric Calculation Helpers
// ============================================

/**
 * Calculate sync lag in seconds based on last_seen timestamp
 */
export function calculateSyncLag(lastSeen: string | null): number {
  if (!lastSeen) {
    return Infinity // No sync ever
  }

  const lastSeenDate = new Date(lastSeen)
  const now = new Date()
  const lagMs = now.getTime() - lastSeenDate.getTime()

  return Math.floor(lagMs / 1000)
}

/**
 * Format sync lag for display
 */
export function formatSyncLag(syncLag: number): string {
  if (!isFinite(syncLag)) {
    return 'Never synced'
  }

  if (syncLag < 60) {
    return `${syncLag}s ago`
  }

  const minutes = Math.floor(syncLag / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Format response time for display
 */
export function formatResponseTime(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Format packet loss for display
 */
export function formatPacketLoss(percentage: number): string {
  return `${percentage.toFixed(1)}%`
}

/**
 * Format success rate for display
 */
export function formatSuccessRate(percentage: number): string {
  return `${percentage.toFixed(1)}%`
}

// ============================================
// Historical Data Helpers
// ============================================

/**
 * Generate mock historical data for demo purposes
 * In production, this would fetch from database
 */
export function generateMockHistoricalData(
  days: number = 7
): DiagnosticHistoryPoint[] {
  const data: DiagnosticHistoryPoint[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)

    // Generate realistic fluctuating metrics
    const baseResponseTime = 300 + Math.random() * 200
    const basePacketLoss = Math.random() * 5
    const baseSyncLag = 30 + Math.random() * 60
    const baseSuccessRate = 90 + Math.random() * 10

    data.push({
      timestamp: date.toISOString(),
      responseTime: Math.round(baseResponseTime),
      packetLoss: Math.round(basePacketLoss * 10) / 10,
      syncLag: Math.round(baseSyncLag),
      successRate: Math.round(baseSuccessRate * 10) / 10,
    })
  }

  return data
}

/**
 * Calculate average metrics from historical data
 */
export function calculateAverageMetrics(
  history: DiagnosticHistoryPoint[]
): Omit<DiagnosticMetrics, 'lastChecked'> {
  if (history.length === 0) {
    return {
      responseTime: 0,
      packetLoss: 0,
      syncLag: 0,
      successRate: 0,
    }
  }

  const sum = history.reduce(
    (acc, point) => ({
      responseTime: acc.responseTime + point.responseTime,
      packetLoss: acc.packetLoss + point.packetLoss,
      syncLag: acc.syncLag + point.syncLag,
      successRate: acc.successRate + point.successRate,
    }),
    { responseTime: 0, packetLoss: 0, syncLag: 0, successRate: 0 }
  )

  return {
    responseTime: Math.round(sum.responseTime / history.length),
    packetLoss: Math.round((sum.packetLoss / history.length) * 10) / 10,
    syncLag: Math.round(sum.syncLag / history.length),
    successRate: Math.round((sum.successRate / history.length) * 10) / 10,
  }
}
