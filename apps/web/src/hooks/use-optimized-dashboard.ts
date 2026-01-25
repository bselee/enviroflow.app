/**
 * Optimized Dashboard Data Hook
 *
 * Enhanced version of useDashboardData with performance optimizations:
 * - Memoized expensive calculations
 * - Reduced re-render frequency
 * - Optimized data structures
 * - Smart batching and debouncing
 */

'use client'

import { useMemo, useCallback } from 'react'
import { useDashboardData } from './use-dashboard-data'
import { memoize, downsampleTimeSeries } from '@/lib/performance-utils'
import type { RoomSummary, DashboardMetrics } from './use-dashboard-data'
import type { TimeSeriesPoint } from '@/types'

// =============================================================================
// Memoized Calculations
// =============================================================================

/**
 * Memoized VPD calculation to avoid redundant computation.
 * Uses LRU cache with key based on temp and humidity.
 */
const calculateVPDMemoized = memoize(
  (temp: number, humidity: number): number | null => {
    // Validate inputs
    if (!Number.isFinite(temp) || !Number.isFinite(humidity)) {
      return null
    }
    if (temp < 32 || temp > 140 || humidity < 0 || humidity > 100) {
      return null
    }

    // Convert F to C
    const tempC = (temp - 32) * 5 / 9

    // Calculate VPD
    const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
    const vpd = svp * (1 - humidity / 100)

    if (!Number.isFinite(vpd) || vpd < 0 || vpd > 5) {
      return null
    }

    return Math.round(vpd * 100) / 100
  },
  (temp, humidity) => `${temp.toFixed(1)}_${humidity.toFixed(1)}`,
  200 // Cache last 200 calculations
)

/**
 * Memoized room summary aggregation.
 * Reduces recalculation when room data hasn't changed.
 */
const aggregateRoomDataMemoized = memoize(
  (summaries: RoomSummary[]) => {
    const temps = summaries
      .map(s => s.latestSensorData.temperature)
      .filter((t): t is number => t !== null)

    const humidities = summaries
      .map(s => s.latestSensorData.humidity)
      .filter((h): h is number => h !== null)

    const vpds = summaries
      .map(s => s.latestSensorData.vpd)
      .filter((v): v is number => v !== null)

    return {
      avgTemp: temps.length > 0
        ? temps.reduce((a, b) => a + b, 0) / temps.length
        : null,
      avgHumidity: humidities.length > 0
        ? humidities.reduce((a, b) => a + b, 0) / humidities.length
        : null,
      avgVPD: vpds.length > 0
        ? vpds.reduce((a, b) => a + b, 0) / vpds.length
        : null,
      totalRooms: summaries.length,
      roomsWithData: summaries.filter(s => s.latestSensorData.temperature !== null).length,
    }
  },
  (summaries) => summaries.map(s => `${s.room.id}_${s.lastUpdateTimestamp}`).join('|'),
  50
)

// =============================================================================
// Optimized Hook
// =============================================================================

/**
 * Configuration for optimized dashboard data.
 */
export interface OptimizedDashboardOptions {
  /** Maximum data points for charts (default: 100) */
  maxChartPoints?: number
  /** Enable aggressive memoization (default: true) */
  enableMemoization?: boolean
  /** Downsample time series data (default: true) */
  downsampleData?: boolean
  /** Refresh interval in ms (default: 10000) */
  refreshInterval?: number
}

/**
 * Optimized dashboard data hook with performance enhancements.
 *
 * Features:
 * - Memoized VPD calculations
 * - Downsampled chart data
 * - Reduced re-renders
 * - Smart caching
 *
 * @param options - Configuration options
 * @returns Optimized dashboard data and methods
 *
 * @example
 * ```tsx
 * const { roomSummaries, metrics, chartData } = useOptimizedDashboard({
 *   maxChartPoints: 100,
 *   downsampleData: true,
 * })
 * ```
 */
export function useOptimizedDashboard(options: OptimizedDashboardOptions = {}) {
  const {
    maxChartPoints = 100,
    enableMemoization = true,
    downsampleData = true,
    refreshInterval = 10000,
  } = options

  // Get base dashboard data
  const dashboardData = useDashboardData({ refreshInterval })

  /**
   * Optimized room summaries with memoized calculations.
   */
  const optimizedRoomSummaries = useMemo(() => {
    if (!enableMemoization) {
      return dashboardData.roomSummaries
    }

    // Add memoized VPD calculations to room summaries
    return dashboardData.roomSummaries.map(summary => {
      const { temperature, humidity } = summary.latestSensorData

      if (temperature !== null && humidity !== null) {
        const memoizedVPD = calculateVPDMemoized(temperature, humidity)
        return {
          ...summary,
          latestSensorData: {
            ...summary.latestSensorData,
            vpd: memoizedVPD,
          },
        }
      }

      return summary
    })
  }, [dashboardData.roomSummaries, enableMemoization])

  /**
   * Optimized metrics with memoized aggregations.
   */
  const optimizedMetrics = useMemo<DashboardMetrics>(() => {
    if (!enableMemoization) {
      return dashboardData.metrics
    }

    const aggregated = aggregateRoomDataMemoized(optimizedRoomSummaries)

    return {
      ...dashboardData.metrics,
      averageTemperature: aggregated.avgTemp,
      averageHumidity: aggregated.avgHumidity,
      averageVPD: aggregated.avgVPD,
    }
  }, [dashboardData.metrics, optimizedRoomSummaries, enableMemoization])

  /**
   * Optimized timeline data with downsampling for charts.
   */
  const optimizedTimelineData = useMemo(() => {
    if (!downsampleData || dashboardData.timelineData.length <= maxChartPoints) {
      return dashboardData.timelineData
    }

    // Downsample to maxChartPoints
    return downsampleTimeSeries(
      dashboardData.timelineData.map(d => ({
        timestamp: d.timestamp,
        value: d.temperature || d.humidity || d.vpd || 0,
        ...d,
      })),
      maxChartPoints
    )
  }, [dashboardData.timelineData, downsampleData, maxChartPoints])

  /**
   * Optimized environment snapshot with downsampled historical VPD.
   */
  const optimizedEnvironmentSnapshot = useMemo(() => {
    const snapshot = dashboardData.environmentSnapshot

    if (!downsampleData || snapshot.historicalVpd.length <= maxChartPoints) {
      return snapshot
    }

    return {
      ...snapshot,
      historicalVpd: downsampleTimeSeries(snapshot.historicalVpd, maxChartPoints),
    }
  }, [dashboardData.environmentSnapshot, downsampleData, maxChartPoints])

  /**
   * Get optimized chart data for a specific room.
   * Includes downsampling and caching.
   */
  const getOptimizedChartData = useCallback(
    (roomId: string): TimeSeriesPoint[] => {
      const summary = optimizedRoomSummaries.find(s => s.room.id === roomId)
      if (!summary) return []

      const data = summary.temperatureTimeSeries

      if (!downsampleData || data.length <= maxChartPoints) {
        return data
      }

      return downsampleTimeSeries(data, maxChartPoints)
    },
    [optimizedRoomSummaries, downsampleData, maxChartPoints]
  )

  /**
   * Performance metrics for debugging.
   */
  const performanceMetrics = useMemo(() => ({
    totalRooms: optimizedRoomSummaries.length,
    totalControllers: dashboardData.controllers.length,
    timelineDataPoints: optimizedTimelineData.length,
    historicalVpdPoints: optimizedEnvironmentSnapshot.historicalVpd.length,
    downsampled: downsampleData && dashboardData.timelineData.length > maxChartPoints,
    cacheEnabled: enableMemoization,
  }), [
    optimizedRoomSummaries,
    dashboardData.controllers,
    optimizedTimelineData,
    optimizedEnvironmentSnapshot,
    downsampleData,
    enableMemoization,
    dashboardData.timelineData,
    maxChartPoints,
  ])

  return {
    // Optimized data
    roomSummaries: optimizedRoomSummaries,
    metrics: optimizedMetrics,
    timelineData: optimizedTimelineData,
    environmentSnapshot: optimizedEnvironmentSnapshot,

    // Original data pass-through
    rooms: dashboardData.rooms,
    controllers: dashboardData.controllers,
    alerts: dashboardData.alerts,
    automations: dashboardData.automations,
    offlineControllers: dashboardData.offlineControllers,
    unassignedControllers: dashboardData.unassignedControllers,
    offlineControllerSummaries: dashboardData.offlineControllerSummaries,
    nextScheduledEvent: dashboardData.nextScheduledEvent,

    // State
    isLoading: dashboardData.isLoading,
    isRefreshing: dashboardData.isRefreshing,
    error: dashboardData.error,
    isDemoMode: dashboardData.isDemoMode,
    isTransitioningFromDemo: dashboardData.isTransitioningFromDemo,

    // Methods
    refetch: dashboardData.refetch,
    getRoomSummary: dashboardData.getRoomSummary,
    dismissAlert: dashboardData.dismissAlert,
    toggleAutomation: dashboardData.toggleAutomation,
    getOptimizedChartData,

    // Performance metrics
    performanceMetrics,
  }
}

/**
 * Export memoized calculation utilities for use in other components.
 */
export { calculateVPDMemoized }
