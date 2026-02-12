/**
 * useSensorData Hook
 *
 * Unified hook for fetching sensor data with intelligent aggregation.
 * Supports all time ranges (1h-60d) with automatic server-side downsampling for long ranges.
 * Also fetches device state data for waveform charts.
 *
 * Key features:
 * - 300ms debounce on time range changes (prevents rapid API calls)
 * - Refetches when timeRange changes (fixes the core "buttons don't work" issue)
 * - Returns both sensor data and device state data
 *
 * Usage:
 * const { sensorData, deviceStateData, loading, error, refetch } = useSensorData({
 *   controllerId: 'uuid',
 *   timeRange: '7d',
 *   includeDeviceState: true
 * })
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { TimeRange } from '@/components/dashboard/IntelligentTimeline'

// =============================================================================
// Types
// =============================================================================

export interface SensorDataPoint {
  timestamp: string
  temperature: number | null
  humidity: number | null
  vpd: number | null
  tempMin?: number | null
  tempMax?: number | null
  humidityMin?: number | null
  humidityMax?: number | null
}

export interface DeviceStatePoint {
  timestamp: string
  state: boolean
  speed: number
}

export interface DeviceStateData {
  [deviceName: string]: DeviceStatePoint[]
}

export interface SensorDataMetadata {
  range: TimeRange
  intervalMinutes: number
  pointCount: number
  controllerId: string | null
  startDate: string
  endDate: string
  useRPC: boolean
}

export interface UseSensorDataOptions {
  controllerId?: string | null
  timeRange: TimeRange
  includeDeviceState?: boolean
  enabled?: boolean
  /** Debounce time in ms for range changes (default: 300) */
  debounceMs?: number
}

export interface UseSensorDataResult {
  sensorData: SensorDataPoint[]
  deviceStateData: DeviceStateData
  loading: boolean
  error: string | null
  metadata: SensorDataMetadata | null
  refetch: () => Promise<void>
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useSensorData(
  options: UseSensorDataOptions
): UseSensorDataResult {
  const {
    controllerId,
    timeRange,
    includeDeviceState = false,
    enabled = true,
    debounceMs = 300
  } = options

  // State
  const [sensorData, setSensorData] = useState<SensorDataPoint[]>([])
  const [deviceStateData, setDeviceStateData] = useState<DeviceStateData>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<SensorDataMetadata | null>(null)

  // Refs for debouncing and cancellation
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  /**
   * Core fetch function
   */
  const fetchData = useCallback(async () => {
    if (!enabled) {
      return
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    setError(null)

    try {
      // Get auth token
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        if (mountedRef.current) {
          setError('Not authenticated')
          setLoading(false)
        }
        return
      }

      // Build query params
      const params = new URLSearchParams()
      params.set('range', timeRange)
      params.set('includeDeviceState', String(includeDeviceState))

      if (controllerId) {
        params.set('controllerId', controllerId)
      }

      // Fetch from API
      const response = await fetch(`/api/sensors/data?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: abortController.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch sensor data')
      }

      // Update state only if still mounted
      if (mountedRef.current) {
        setSensorData(result.sensorData || [])
        setDeviceStateData(result.deviceStateData || {})
        setMetadata(result.metadata || null)
      }
    } catch (err) {
      // Don't report abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }

      console.error('[useSensorData] Fetch error:', err)
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch sensor data')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [controllerId, timeRange, includeDeviceState, enabled])

  /**
   * Debounced fetch - called when dependencies change
   */
  const debouncedFetch = useCallback(() => {
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      fetchData()
    }, debounceMs)
  }, [fetchData, debounceMs])

  /**
   * Effect: Refetch when dependencies change (with debounce)
   * This is the key fix - timeRange changes trigger refetch
   */
  useEffect(() => {
    if (!enabled) {
      return
    }

    debouncedFetch()

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [controllerId, timeRange, includeDeviceState, enabled, debouncedFetch])

  /**
   * Manual refetch (bypasses debounce)
   */
  const refetch = useCallback(async () => {
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    await fetchData()
  }, [fetchData])

  return {
    sensorData,
    deviceStateData,
    loading,
    error,
    metadata,
    refetch
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert sensor data to TimeSeriesData format for IntelligentTimeline
 */
export interface TimeSeriesData {
  timestamp: string
  temperature?: number
  humidity?: number
  vpd?: number
  controllerId?: string
}

export function toTimeSeriesData(
  sensorData: SensorDataPoint[],
  controllerId?: string
): TimeSeriesData[] {
  return sensorData.map(point => ({
    timestamp: point.timestamp,
    temperature: point.temperature ?? undefined,
    humidity: point.humidity ?? undefined,
    vpd: point.vpd ?? undefined,
    controllerId
  }))
}

/**
 * Get device colors for waveform chart
 */
export const DEVICE_COLORS: Record<string, string> = {
  'Exhaust Fan': '#3b82f6',
  'Intake Fan': '#06b6d4',
  'Circ Fan': '#8b5cf6',
  'Humidifier': '#06b6d4',
  'Dehumidifier': '#f97316',
  'Heater': '#ef4444',
  'Cooler': '#22c55e',
  'Light': '#eab308',
  'Pump': '#6366f1',
}

export function getDeviceColor(deviceName: string): string {
  // Check for exact match
  if (DEVICE_COLORS[deviceName]) {
    return DEVICE_COLORS[deviceName]
  }

  // Check for partial match
  const lowerName = deviceName.toLowerCase()
  if (lowerName.includes('fan')) return '#3b82f6'
  if (lowerName.includes('humidifier')) return '#06b6d4'
  if (lowerName.includes('dehumidifier')) return '#f97316'
  if (lowerName.includes('heater') || lowerName.includes('heat')) return '#ef4444'
  if (lowerName.includes('cooler') || lowerName.includes('ac')) return '#22c55e'
  if (lowerName.includes('light')) return '#eab308'
  if (lowerName.includes('pump')) return '#6366f1'

  // Default color
  return '#64748b'
}

/**
 * Calculate statistics for sensor data
 */
export interface SensorStats {
  current: number | null
  min: number
  max: number
  avg: number
}

export function calculateStats(
  data: SensorDataPoint[],
  key: 'temperature' | 'humidity' | 'vpd'
): SensorStats | null {
  const values = data
    .map(d => d[key])
    .filter((v): v is number => v !== null && v !== undefined)

  if (values.length === 0) {
    return null
  }

  // Use single pass for min/max/avg calculation for better performance
  let min = Infinity
  let max = -Infinity
  let sum = 0

  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
    sum += value
  }

  return {
    current: values[values.length - 1],
    min,
    max,
    avg: sum / values.length
  }
}
