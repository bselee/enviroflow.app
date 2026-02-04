/**
 * useSensors Hook
 *
 * Custom hook for managing standalone sensor data with Supabase.
 * Provides CRUD operations, loading states, and sensor reading submission.
 *
 * @example
 * ```tsx
 * const { sensors, loading, error, createSensor, updateSensor, submitReading } = useSensors();
 * ```
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type {
  Sensor,
  SensorWithRoom,
  CreateSensorInput,
  UpdateSensorInput,
  ApiResponse,
} from '@/types'

/**
 * State returned by the useSensors hook
 */
interface UseSensorsState {
  /** List of sensors with optional room data */
  sensors: SensorWithRoom[]
  /** Loading state for initial fetch */
  loading: boolean
  /** Error message from last operation */
  error: string | null
  /** Create a new sensor */
  createSensor: (input: CreateSensorInput) => Promise<ApiResponse<SensorWithRoom>>
  /** Update an existing sensor */
  updateSensor: (id: string, input: UpdateSensorInput) => Promise<ApiResponse<SensorWithRoom>>
  /** Delete a sensor */
  deleteSensor: (id: string) => Promise<ApiResponse<void>>
  /** Submit a sensor reading */
  submitReading: (sensorId: string, value: number, unit?: string) => Promise<ApiResponse<{ id: string; value: number; recorded_at: string }>>
  /** Refresh sensors list */
  refetch: () => Promise<void>
}

/**
 * Custom hook for sensor management
 */
export function useSensors(): UseSensorsState {
  const [sensors, setSensors] = useState<SensorWithRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true)

  /**
   * Fetch all sensors for the current user
   */
  const fetchSensors = useCallback(async () => {
    try {
      if (isMounted.current) {
        setLoading(true)
        setError(null)
      }

      // Get current user session
      const supabase = createClient()
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession()

      if (authError) {
        console.error('[Sensors] Auth error:', authError.message)
        if (isMounted.current) {
          setError(`Authentication error: ${authError.message}`)
          setSensors([])
          setLoading(false)
        }
        return
      }

      if (!session?.user) {
        // Return empty array for unauthenticated users
        if (isMounted.current) {
          setSensors([])
          setLoading(false)
        }
        return
      }

      const token = session.access_token

      // Fetch sensors via API route
      const response = await fetch('/api/sensors', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch sensors' }))
        throw new Error(errorData.error || 'Failed to fetch sensors')
      }

      const data = await response.json()

      if (isMounted.current) {
        setSensors(data.sensors || [])
      }
    } catch (err) {
      console.error('Error fetching sensors:', err)
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch sensors')
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [])

  /**
   * Create a new sensor
   */
  const createSensor = useCallback(
    async (input: CreateSensorInput): Promise<ApiResponse<SensorWithRoom>> => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          return { success: false, error: 'You must be logged in to create a sensor' }
        }

        const token = session.access_token

        // Call API to create sensor
        const response = await fetch('/api/sensors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        })

        const data = await response.json()

        if (!response.ok) {
          return { success: false, error: data.error || 'Failed to create sensor' }
        }

        // Refresh the sensors list
        await fetchSensors()

        return { success: true, data: data.sensor }
      } catch (err) {
        console.error('Error creating sensor:', err instanceof Error ? err.message : 'Unknown error')
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to create sensor',
        }
      }
    },
    [fetchSensors]
  )

  /**
   * Update an existing sensor
   */
  const updateSensor = useCallback(
    async (id: string, input: UpdateSensorInput): Promise<ApiResponse<SensorWithRoom>> => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          return { success: false, error: 'You must be logged in to update a sensor' }
        }

        const token = session.access_token

        // Call API to update sensor
        const response = await fetch(`/api/sensors/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        })

        const data = await response.json()

        if (!response.ok) {
          return { success: false, error: data.error || 'Failed to update sensor' }
        }

        // Update local state optimistically
        if (isMounted.current) {
          setSensors((prev) =>
            prev.map((sensor) =>
              sensor.id === id ? { ...sensor, ...data.sensor } : sensor
            )
          )
        }

        return { success: true, data: data.sensor }
      } catch (err) {
        console.error('Error updating sensor:', err instanceof Error ? err.message : 'Unknown error')
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to update sensor',
        }
      }
    },
    []
  )

  /**
   * Delete a sensor
   */
  const deleteSensor = useCallback(
    async (id: string): Promise<ApiResponse<void>> => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          return { success: false, error: 'You must be logged in to delete a sensor' }
        }

        const token = session.access_token

        // Call API to delete sensor
        const response = await fetch(`/api/sensors/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: 'Failed to delete sensor' }))
          return { success: false, error: data.error || 'Failed to delete sensor' }
        }

        // Remove from local state
        if (isMounted.current) {
          setSensors((prev) => prev.filter((sensor) => sensor.id !== id))
        }

        return { success: true }
      } catch (err) {
        console.error('Error deleting sensor:', err instanceof Error ? err.message : 'Unknown error')
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to delete sensor',
        }
      }
    },
    []
  )

  /**
   * Submit a sensor reading
   */
  const submitReading = useCallback(
    async (
      sensorId: string,
      value: number,
      unit?: string
    ): Promise<ApiResponse<{ id: string; value: number; recorded_at: string }>> => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          return { success: false, error: 'You must be logged in to submit a reading' }
        }

        const token = session.access_token

        // Call API to submit reading
        const response = await fetch(`/api/sensors/${sensorId}/readings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ value, unit }),
        })

        const data = await response.json()

        if (!response.ok) {
          return { success: false, error: data.error || 'Failed to submit reading' }
        }

        // Update the sensor's current_value in local state
        if (isMounted.current) {
          setSensors((prev) =>
            prev.map((sensor) =>
              sensor.id === sensorId
                ? {
                    ...sensor,
                    current_value: value,
                    last_reading_at: data.reading.recorded_at,
                  }
                : sensor
            )
          )
        }

        return { success: true, data: data.reading }
      } catch (err) {
        console.error('Error submitting reading:', err instanceof Error ? err.message : 'Unknown error')
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to submit reading',
        }
      }
    },
    []
  )

  // Initial data fetch
  useEffect(() => {
    isMounted.current = true
    fetchSensors()

    return () => {
      isMounted.current = false
    }
  }, [fetchSensors])

  return {
    sensors,
    loading,
    error,
    createSensor,
    updateSensor,
    deleteSensor,
    submitReading,
    refetch: fetchSensors,
  }
}
