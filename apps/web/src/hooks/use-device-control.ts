/**
 * Hook for controlling devices on a controller
 *
 * Provides device state and control functions for individual ports
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'

// ============================================
// Types
// ============================================

export interface DeviceState {
  port: number
  deviceType: string
  name: string
  isOn: boolean
  level: number // 0-100
  supportsDimming: boolean
  minLevel: number
  maxLevel: number
}

export interface DeviceControlResult {
  success: boolean
  actualValue?: number
  previousValue?: number
  error?: string
}

export interface UseDeviceControlReturn {
  devices: DeviceState[]
  isLoading: boolean
  error: string | null
  controlDevice: (port: number, action: string, value?: number) => Promise<DeviceControlResult>
  refreshDevices: () => Promise<void>
}

// ============================================
// Hook Implementation
// ============================================

export function useDeviceControl(controllerId: string): UseDeviceControlReturn {
  const [devices, setDevices] = useState<DeviceState[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  /**
   * Fetch devices for the controller
   */
  const fetchDevices = useCallback(async () => {
    if (!controllerId) {
      setDevices([])
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
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/controllers/${controllerId}/devices`, {
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

      if (data.success) {
        setDevices(data.ports || [])
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch devices')
        setDevices([])
      }
    } catch (err) {
      if (!isMounted.current) return

      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setDevices([])
      console.error('[useDeviceControl] Error fetching devices:', err)
    } finally {
      if (isMounted.current) {
        setIsLoading(false)
      }
    }
  }, [controllerId, supabase])

  /**
   * Send control command to a device
   */
  const controlDevice = useCallback(
    async (port: number, action: string, value?: number): Promise<DeviceControlResult> => {
      if (!controllerId) {
        return {
          success: false,
          error: 'No controller ID provided',
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

        const response = await fetch(`/api/controllers/${controllerId}/devices/${port}/control`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action, value }),
        })

        const data = await response.json()

        if (!response.ok) {
          return {
            success: false,
            error: data.error || `HTTP ${response.status}`,
          }
        }

        // Refresh devices to get updated state
        // Don't await to avoid blocking the response
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
        }
        refreshTimeoutRef.current = setTimeout(() => {
          if (isMounted.current) {
            fetchDevices()
          }
          refreshTimeoutRef.current = null
        }, 500)

        return {
          success: data.success,
          actualValue: data.actualValue,
          previousValue: data.previousValue,
          error: data.error,
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error('[useDeviceControl] Error controlling device:', err)
        return {
          success: false,
          error: errorMessage,
        }
      }
    },
    [controllerId, supabase, fetchDevices]
  )

  /**
   * Manually refresh device list
   */
  const refreshDevices = useCallback(async () => {
    await fetchDevices()
  }, [fetchDevices])

  // Initial load
  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  // Cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
    }
  }, [])

  return {
    devices,
    isLoading,
    error,
    controlDevice,
    refreshDevices,
  }
}
