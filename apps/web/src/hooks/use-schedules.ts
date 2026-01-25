/**
 * useSchedules Hook
 *
 * Custom hook for managing device schedule data with Supabase.
 * Provides CRUD operations, loading states, and real-time updates.
 *
 * @example
 * ```tsx
 * const { schedules, loading, error, addSchedule, deleteSchedule } = useSchedules();
 * ```
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type {
  DeviceSchedule,
  DeviceScheduleWithController,
  CreateDeviceScheduleInput,
  UpdateDeviceScheduleInput,
  SchedulePreview,
  Controller,
} from "@/types";

/**
 * Result type following { success, data?, error? } pattern
 */
interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * State returned by the useSchedules hook
 */
interface UseSchedulesState {
  /** List of schedules with controller data */
  schedules: DeviceScheduleWithController[];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Available controllers for schedule assignment */
  controllers: Controller[];
  /** Loading state for controllers fetch */
  controllersLoading: boolean;
  /** Refresh schedules list */
  refresh: () => Promise<void>;
  /** Add a new schedule */
  addSchedule: (input: CreateDeviceScheduleInput) => Promise<OperationResult<DeviceSchedule>>;
  /** Update an existing schedule */
  updateSchedule: (id: string, input: UpdateDeviceScheduleInput) => Promise<OperationResult<DeviceSchedule>>;
  /** Delete a schedule */
  deleteSchedule: (id: string) => Promise<OperationResult>;
  /** Toggle schedule active state */
  toggleSchedule: (id: string, isActive: boolean) => Promise<OperationResult<DeviceSchedule>>;
  /** Get preview of upcoming executions */
  getSchedulePreview: (schedule: CreateDeviceScheduleInput | DeviceSchedule) => SchedulePreview;
  /** Fetch controllers list */
  fetchControllers: () => Promise<void>;
}

/**
 * Custom hook for device schedule management
 */
export function useSchedules(controllerId?: string): UseSchedulesState {
  const [schedules, setSchedules] = useState<DeviceScheduleWithController[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [controllersLoading, setControllersLoading] = useState(false);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  /**
   * Fetch all schedules for the current user (optionally filtered by controller)
   */
  const fetchSchedules = useCallback(async () => {
    try {
      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }

      // Get current user session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (isMounted.current) {
          setSchedules([]);
          setLoading(false);
        }
        return;
      }

      // Build query
      let query = supabase
        .from("device_schedules")
        .select(`
          *,
          controller:controllers(
            id,
            name,
            brand,
            status,
            capabilities
          )
        `)
        .order("created_at", { ascending: false });

      // Filter by controller if specified
      if (controllerId) {
        query = query.eq("controller_id", controllerId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error("Error fetching schedules:", fetchError);
        if (isMounted.current) {
          setError(fetchError.message);
          setSchedules([]);
        }
        return;
      }

      if (isMounted.current) {
        setSchedules((data as DeviceScheduleWithController[]) || []);
        setError(null);
      }
    } catch (err) {
      console.error("Unexpected error in fetchSchedules:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch schedules");
        setSchedules([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [controllerId]);

  /**
   * Fetch available controllers for schedule assignment
   */
  const fetchControllers = useCallback(async () => {
    try {
      if (isMounted.current) {
        setControllersLoading(true);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (isMounted.current) {
          setControllers([]);
          setControllersLoading(false);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("controllers")
        .select("*")
        .order("name", { ascending: true });

      if (fetchError) {
        console.error("Error fetching controllers:", fetchError);
        if (isMounted.current) {
          setControllers([]);
        }
        return;
      }

      if (isMounted.current) {
        setControllers(data || []);
      }
    } catch (err) {
      console.error("Unexpected error in fetchControllers:", err);
      if (isMounted.current) {
        setControllers([]);
      }
    } finally {
      if (isMounted.current) {
        setControllersLoading(false);
      }
    }
  }, []);

  /**
   * Add a new schedule via API
   */
  const addSchedule = useCallback(
    async (input: CreateDeviceScheduleInput): Promise<OperationResult<DeviceSchedule>> => {
      try {
        // Get auth session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          return {
            success: false,
            error: "Not authenticated",
          };
        }

        const response = await fetch("/api/schedules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(input),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          return {
            success: false,
            error: result.error || "Failed to create schedule",
          };
        }

        // Refresh list to get updated data
        await fetchSchedules();

        return {
          success: true,
          data: result.data,
        };
      } catch (err) {
        console.error("Error adding schedule:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to add schedule",
        };
      }
    },
    [fetchSchedules]
  );

  /**
   * Update an existing schedule via API
   */
  const updateSchedule = useCallback(
    async (id: string, input: UpdateDeviceScheduleInput): Promise<OperationResult<DeviceSchedule>> => {
      try {
        // Get auth session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          return {
            success: false,
            error: "Not authenticated",
          };
        }

        const response = await fetch(`/api/schedules/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(input),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          return {
            success: false,
            error: result.error || "Failed to update schedule",
          };
        }

        // Refresh list to get updated data
        await fetchSchedules();

        return {
          success: true,
          data: result.data,
        };
      } catch (err) {
        console.error("Error updating schedule:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to update schedule",
        };
      }
    },
    [fetchSchedules]
  );

  /**
   * Delete a schedule via API
   */
  const deleteSchedule = useCallback(
    async (id: string): Promise<OperationResult> => {
      try {
        // Get auth session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          return {
            success: false,
            error: "Not authenticated",
          };
        }

        const response = await fetch(`/api/schedules/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          return {
            success: false,
            error: result.error || "Failed to delete schedule",
          };
        }

        // Refresh list to reflect deletion
        await fetchSchedules();

        return { success: true };
      } catch (err) {
        console.error("Error deleting schedule:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to delete schedule",
        };
      }
    },
    [fetchSchedules]
  );

  /**
   * Toggle schedule active state
   */
  const toggleSchedule = useCallback(
    async (id: string, isActive: boolean): Promise<OperationResult<DeviceSchedule>> => {
      return updateSchedule(id, { is_active: isActive });
    },
    [updateSchedule]
  );

  /**
   * Calculate preview of upcoming schedule executions
   */
  const getSchedulePreview = useCallback((schedule: CreateDeviceScheduleInput | DeviceSchedule): SchedulePreview => {
    const upcomingExecutions: string[] = [];

    if (schedule.trigger_type === 'time' && schedule.schedule.start_time) {
      // Calculate next 5 executions for time-based schedules
      const now = new Date();
      const days = schedule.schedule.days;
      const [hours, minutes] = schedule.schedule.start_time.split(':').map(Number);

      for (let i = 0; i < 14; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);

        const dayOfWeek = date.getDay();
        if (days.includes(dayOfWeek)) {
          const execution = new Date(date);
          execution.setHours(hours, minutes, 0, 0);

          if (execution > now) {
            upcomingExecutions.push(execution.toISOString());
            if (upcomingExecutions.length >= 5) break;
          }
        }
      }
    }

    return {
      nextExecution: upcomingExecutions[0] || null,
      upcomingExecutions,
    };
  }, []);

  /**
   * Set up real-time subscription for schedule changes
   */
  useEffect(() => {
    isMounted.current = true;

    // Initial fetch
    fetchSchedules();

    // Set up real-time subscription
    const channel = supabase
      .channel("device_schedules_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_schedules",
          filter: controllerId ? `controller_id=eq.${controllerId}` : undefined,
        },
        (payload) => {
          console.log("Schedule change detected:", payload);
          // Refresh schedules on any change
          fetchSchedules();
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      isMounted.current = false;
      channel.unsubscribe();
    };
  }, [fetchSchedules, controllerId]);

  return {
    schedules,
    loading,
    error,
    controllers,
    controllersLoading,
    refresh: fetchSchedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    getSchedulePreview,
    fetchControllers,
  };
}
