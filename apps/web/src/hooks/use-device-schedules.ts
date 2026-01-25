"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type {
  DeviceSchedule,
  CreateDeviceScheduleInput,
  UpdateDeviceScheduleInput,
} from "@/types/schedules";
import type { ApiResponse } from "@/types";

interface UseDeviceSchedulesReturn {
  schedules: DeviceSchedule[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createSchedule: (input: CreateDeviceScheduleInput) => Promise<ApiResponse<DeviceSchedule>>;
  updateSchedule: (id: string, input: UpdateDeviceScheduleInput) => Promise<ApiResponse<DeviceSchedule>>;
  deleteSchedule: (id: string) => Promise<ApiResponse<void>>;
  toggleActive: (id: string, isActive: boolean) => Promise<ApiResponse<void>>;
  getScheduleById: (id: string) => DeviceSchedule | undefined;
  getSchedulesByController: (controllerId: string) => DeviceSchedule[];
  getSchedulesByRoom: (roomId: string) => DeviceSchedule[];
  activeCount: number;
}

interface UseDeviceSchedulesOptions {
  roomId?: string;
  controllerId?: string;
}

/**
 * Hook for managing device schedules
 */
export function useDeviceSchedules(
  options: UseDeviceSchedulesOptions = {}
): UseDeviceSchedulesReturn {
  const [schedules, setSchedules] = useState<DeviceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchSchedules = useCallback(async () => {
    try {
      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.user) {
        if (isMounted.current) {
          setSchedules([]);
          setLoading(false);
        }
        return;
      }

      let query = supabase
        .from("device_schedules")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply filters if provided
      if (options.roomId) {
        query = query.eq("room_id", options.roomId);
      }

      if (options.controllerId) {
        query = query.eq("controller_id", options.controllerId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (isMounted.current) {
        setSchedules(data || []);
      }
    } catch (err) {
      console.error("Error fetching device schedules:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch schedules");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [options.roomId, options.controllerId]);

  const createSchedule = useCallback(
    async (input: CreateDeviceScheduleInput): Promise<ApiResponse<DeviceSchedule>> => {
      try {
        if (!input.name?.trim()) {
          return { success: false, error: "Schedule name is required" };
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          return {
            success: false,
            error: "You must be logged in to create a schedule",
          };
        }

        const { data, error: insertError } = await supabase
          .from("device_schedules")
          .insert({
            user_id: session.user.id,
            controller_id: input.controller_id,
            room_id: input.room_id || null,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            device_port: input.device_port,
            trigger_type: input.trigger_type,
            schedule: input.schedule,
            is_active: input.is_active ?? true,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        await fetchSchedules();

        return { success: true, data };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create schedule";
        console.error("createSchedule error:", err);
        return { success: false, error: errorMessage };
      }
    },
    [fetchSchedules]
  );

  const updateSchedule = useCallback(
    async (
      id: string,
      input: UpdateDeviceScheduleInput
    ): Promise<ApiResponse<DeviceSchedule>> => {
      try {
        if (!id) {
          return { success: false, error: "Schedule ID is required" };
        }

        const updateData: Record<string, unknown> = {};

        if (input.name !== undefined) {
          updateData.name = input.name.trim();
        }
        if (input.description !== undefined) {
          updateData.description = input.description?.trim() || null;
        }
        if (input.device_port !== undefined) {
          updateData.device_port = input.device_port;
        }
        if (input.trigger_type !== undefined) {
          updateData.trigger_type = input.trigger_type;
        }
        if (input.schedule !== undefined) {
          updateData.schedule = input.schedule;
        }
        if (input.is_active !== undefined) {
          updateData.is_active = input.is_active;
        }

        if (Object.keys(updateData).length === 0) {
          return { success: false, error: "No fields to update" };
        }

        const { data, error: updateError } = await supabase
          .from("device_schedules")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        await fetchSchedules();

        return { success: true, data };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update schedule";
        console.error("updateSchedule error:", err);
        return { success: false, error: errorMessage };
      }
    },
    [fetchSchedules]
  );

  const deleteSchedule = useCallback(
    async (id: string): Promise<ApiResponse<void>> => {
      try {
        if (!id) {
          return { success: false, error: "Schedule ID is required" };
        }

        const { error: deleteError } = await supabase
          .from("device_schedules")
          .delete()
          .eq("id", id);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        if (isMounted.current) {
          setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
        }

        return { success: true };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete schedule";
        console.error("deleteSchedule error:", err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<ApiResponse<void>> => {
      try {
        if (!id) {
          return { success: false, error: "Schedule ID is required" };
        }

        const { error: updateError } = await supabase
          .from("device_schedules")
          .update({ is_active: isActive })
          .eq("id", id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        if (isMounted.current) {
          setSchedules((prev) =>
            prev.map((schedule) =>
              schedule.id === id ? { ...schedule, is_active: isActive } : schedule
            )
          );
        }

        return { success: true };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to toggle schedule";
        console.error("toggleActive error:", err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const getScheduleById = useCallback(
    (id: string): DeviceSchedule | undefined => {
      return schedules.find((schedule) => schedule.id === id);
    },
    [schedules]
  );

  const getSchedulesByController = useCallback(
    (controllerId: string): DeviceSchedule[] => {
      return schedules.filter((schedule) => schedule.controller_id === controllerId);
    },
    [schedules]
  );

  const getSchedulesByRoom = useCallback(
    (roomId: string): DeviceSchedule[] => {
      return schedules.filter((schedule) => schedule.room_id === roomId);
    },
    [schedules]
  );

  const activeCount = schedules.filter((s) => s.is_active).length;

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    fetchSchedules();

    return () => {
      isMounted.current = false;
    };
  }, [fetchSchedules]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("device_schedules_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_schedules",
        },
        () => {
          fetchSchedules();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSchedules]);

  return {
    schedules,
    loading,
    error,
    refetch: fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleActive,
    getScheduleById,
    getSchedulesByController,
    getSchedulesByRoom,
    activeCount,
  };
}
