/**
 * useSensorHistory Hook
 *
 * Fetches historical sensor data for charting.
 * Supports 10, 30, and 60 day ranges with appropriate aggregation.
 *
 * Usage:
 * const { data, loading, error, refetch } = useSensorHistory({
 *   days: 30,
 *   controllerIds: ['uuid1', 'uuid2'],
 *   sensorType: 'temperature'
 * })
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'

export interface AggregatedReading {
  controller_id: string
  sensor_type: 'temperature' | 'humidity' | 'vpd'
  avg_value: number
  min_value: number
  max_value: number
  unit: string
  bucket_start: string
  reading_count: number
}

export interface HistoryMetadata {
  days: number
  startDate: string
  endDate: string
  aggregation: string
  totalPoints: number
  controllers: string[]
}

export interface HistoryResponse {
  success: boolean
  data: AggregatedReading[]
  metadata: HistoryMetadata
  error?: string
}

export interface UseSensorHistoryOptions {
  days?: 10 | 30 | 60
  controllerIds?: string[]
  sensorType?: 'temperature' | 'humidity' | 'vpd'
  enabled?: boolean
}

export interface UseSensorHistoryResult {
  data: AggregatedReading[]
  metadata: HistoryMetadata | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useSensorHistory(
  options: UseSensorHistoryOptions = {}
): UseSensorHistoryResult {
  const {
    days = 30,
    controllerIds,
    sensorType,
    enabled = true
  } = options

  const [data, setData] = useState<AggregatedReading[]>([])
  const [metadata, setMetadata] = useState<HistoryMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Use ref to track if we've already fetched
  const fetchedRef = useRef(false)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Get auth token from singleton client
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Build query params
      const params = new URLSearchParams()
      params.set('days', days.toString())
      
      if (controllerIds && controllerIds.length > 0) {
        params.set('controllerIds', controllerIds.join(','))
      }
      
      if (sensorType) {
        params.set('sensorType', sensorType)
      }

      // Fetch from API
      const response = await fetch(`/api/sensors/history?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result: HistoryResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch history')
      }

      setData(result.data)
      setMetadata(result.metadata)
    } catch (err) {
      console.error('[useSensorHistory] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch history')
    } finally {
      setLoading(false)
    }
  }, [days, controllerIds, sensorType])

  // Track previous values to detect changes
  const prevDaysRef = useRef(days)
  const prevEnabledRef = useRef(enabled)

  // Initial fetch and refetch when options change
  useEffect(() => {
    if (!enabled) {
      return
    }

    // Fetch if: first time, or days changed, or just became enabled
    const shouldFetch = !fetchedRef.current || 
                        prevDaysRef.current !== days ||
                        (!prevEnabledRef.current && enabled)

    if (shouldFetch) {
      fetchedRef.current = true
      prevDaysRef.current = days
      prevEnabledRef.current = enabled
      fetchHistory()
    }
  }, [days, enabled, fetchHistory])

  return {
    data,
    metadata,
    loading,
    error,
    refetch: fetchHistory
  }
}

/**
 * Helper: Group history data by sensor type for multi-line charts
 */
export function groupBySensorType(data: AggregatedReading[]): Record<string, AggregatedReading[]> {
  const grouped: Record<string, AggregatedReading[]> = {}
  
  for (const reading of data) {
    if (!grouped[reading.sensor_type]) {
      grouped[reading.sensor_type] = []
    }
    grouped[reading.sensor_type].push(reading)
  }
  
  return grouped
}

/**
 * Helper: Group history data by controller for comparison charts
 */
export function groupByController(data: AggregatedReading[]): Record<string, AggregatedReading[]> {
  const grouped: Record<string, AggregatedReading[]> = {}
  
  for (const reading of data) {
    if (!grouped[reading.controller_id]) {
      grouped[reading.controller_id] = []
    }
    grouped[reading.controller_id].push(reading)
  }
  
  return grouped
}

/**
 * Helper: Format data for chart libraries (Recharts, Chart.js, etc.)
 */
export interface ChartDataPoint {
  timestamp: string
  date: Date
  temperature?: number
  humidity?: number
  vpd?: number
  temp_min?: number
  temp_max?: number
  humidity_min?: number
  humidity_max?: number
  vpd_min?: number
  vpd_max?: number
}

export function formatForChart(data: AggregatedReading[]): ChartDataPoint[] {
  // Group by timestamp
  const byTimestamp = new Map<string, ChartDataPoint>()
  
  for (const reading of data) {
    if (!byTimestamp.has(reading.bucket_start)) {
      byTimestamp.set(reading.bucket_start, {
        timestamp: reading.bucket_start,
        date: new Date(reading.bucket_start)
      })
    }
    
    const point = byTimestamp.get(reading.bucket_start)!
    
    switch (reading.sensor_type) {
      case 'temperature':
        point.temperature = reading.avg_value
        point.temp_min = reading.min_value
        point.temp_max = reading.max_value
        break
      case 'humidity':
        point.humidity = reading.avg_value
        point.humidity_min = reading.min_value
        point.humidity_max = reading.max_value
        break
      case 'vpd':
        point.vpd = reading.avg_value
        point.vpd_min = reading.min_value
        point.vpd_max = reading.max_value
        break
    }
  }
  
  // Sort by timestamp
  return Array.from(byTimestamp.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  )
}
