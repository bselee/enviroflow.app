/**
 * Hook for managing device mode programming on controller ports
 *
 * Provides real-time mode configuration, updates, and sensor readings
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type {
  ModeConfiguration,
  PortModeResponse,
  SensorReading,
  UpdatePortModeInput,
} from '@/types'

// ============================================
// Types
// ============================================

export interface DeviceModeState {
  currentMode: ModeConfiguration
  supportedModes: string[]
  portName: string
  deviceType: string
}

export interface DeviceModeResult {
  success: boolean
  error?: string
  data?: PortModeResponse
}

export interface UseDeviceModeReturn {
  modeState: DeviceModeState | null
  sensorReadings: SensorReading[]
  isLoading: boolean
  error: string | null
  updateMode: (mode: ModeConfiguration) => Promise<DeviceModeResult>
  refreshMode: () => Promise<void>
  refreshSensors: () => Promise<void>
}

// ============================================
// Hook Implementation
// ============================================

export function useDeviceMode(
  controllerId: string,
  port: number | 'all'
): UseDeviceModeReturn {
  const [modeState, setModeState] = useState<DeviceModeState | null>(null)
  const [sensorReadings, setSensorReadings] = useState<SensorReading[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  const supabase = createClient()

  /**
   * Fetch current mode configuration for the port
   */
  const fetchMode = useCallback(async () => {
    if (!controllerId || port === 'all') {
      setModeState(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        // Not authenticated - exit gracefully
        setModeState(null)
        setIsLoading(false)
        return
      }

      const response = await fetch(
        `/api/controllers/${controllerId}/ports/${port}/mode`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!isMounted.current) return

      if (data.success && data.port) {
        setModeState({
          currentMode: data.port.currentMode,
          supportedModes: data.port.supportedModes,
          portName: data.port.portName,
          deviceType: data.port.deviceType,
        })
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch mode configuration')
        setModeState(null)
      }
    } catch (err) {
      if (!isMounted.current) return

      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setModeState(null)
      console.error('[useDeviceMode] Error fetching mode:', err)
    } finally {
      if (isMounted.current) {
        setIsLoading(false)
      }
    }
  }, [controllerId, port, supabase])

  /**
   * Fetch current sensor readings for the controller
   */
  const fetchSensors = useCallback(async () => {
    if (!controllerId) {
      setSensorReadings([])
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        // Not authenticated - exit gracefully
        setSensorReadings([])
        return
      }

      const response = await fetch(`/api/controllers/${controllerId}/sensors`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!isMounted.current) return

      if (data.success && data.readings) {
        setSensorReadings(data.readings)
      } else {
        setSensorReadings([])
      }
    } catch (err) {
      if (!isMounted.current) return

      console.error('[useDeviceMode] Error fetching sensors:', err)
      setSensorReadings([])
    }
  }, [controllerId, supabase])

  /**
   * Update mode configuration for the port
   */
  const updateMode = useCallback(
    async (mode: ModeConfiguration): Promise<DeviceModeResult> => {
      if (!controllerId || port === 'all') {
        return {
          success: false,
          error: 'Invalid port selection',
        }
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          return {
            success: false,
            error: 'Not authenticated',
          }
        }

        const payload: UpdatePortModeInput = {
          port: port as number,
          mode,
        }

        const response = await fetch(
          `/api/controllers/${controllerId}/ports/${port}/mode`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(payload),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          return {
            success: false,
            error: data.error || `HTTP ${response.status}`,
          }
        }

        // Update local state on success
        if (data.success && data.port && isMounted.current) {
          setModeState({
            currentMode: data.port.currentMode,
            supportedModes: data.port.supportedModes,
            portName: data.port.portName,
            deviceType: data.port.deviceType,
          })
        }

        return {
          success: data.success,
          data: data.port,
          error: data.error,
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error('[useDeviceMode] Error updating mode:', err)
        return {
          success: false,
          error: errorMessage,
        }
      }
    },
    [controllerId, port, supabase]
  )

  /**
   * Manually refresh mode configuration
   */
  const refreshMode = useCallback(async () => {
    await fetchMode()
  }, [fetchMode])

  /**
   * Manually refresh sensor readings
   */
  const refreshSensors = useCallback(async () => {
    await fetchSensors()
  }, [fetchSensors])

  // Initial load
  useEffect(() => {
    fetchMode()
    fetchSensors()
  }, [fetchMode, fetchSensors])

  // Set up realtime subscription for sensor updates
  useEffect(() => {
    if (!controllerId) return

    const channel = supabase
      .channel(`sensor-readings-${controllerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_readings',
          filter: `controller_id=eq.${controllerId}`,
        },
        (payload) => {
          if (!isMounted.current) return
          // Add new reading to the list
          setSensorReadings((prev) => [payload.new as SensorReading, ...prev].slice(0, 10))
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [controllerId, supabase])

  // Cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  return {
    modeState,
    sensorReadings,
    isLoading,
    error,
    updateMode,
    refreshMode,
    refreshSensors,
  }
}
