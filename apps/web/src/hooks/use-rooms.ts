"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Room,
  RoomWithControllers,
  CreateRoomInput,
  UpdateRoomInput,
  ApiResponse,
} from "@/types";

/**
 * Hook return type with all room operations and state.
 */
interface UseRoomsReturn {
  /** List of rooms with their controllers */
  rooms: RoomWithControllers[];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Refresh rooms list */
  refetch: () => Promise<void>;
  /** Create a new room */
  createRoom: (input: CreateRoomInput) => Promise<ApiResponse<Room>>;
  /** Update an existing room */
  updateRoom: (id: string, input: UpdateRoomInput) => Promise<ApiResponse<Room>>;
  /** Delete a room */
  deleteRoom: (id: string) => Promise<ApiResponse<void>>;
  /** Get a room by ID from local state */
  getRoomById: (id: string) => RoomWithControllers | undefined;
}

/**
 * Custom hook for managing rooms with Supabase.
 *
 * Provides CRUD operations for rooms with automatic refetching,
 * error handling, and loading states. Supports real-time updates
 * via Supabase subscriptions.
 *
 * @example
 * ```tsx
 * const { rooms, isLoading, createRoom } = useRooms();
 *
 * // Create a new room
 * const result = await createRoom({ name: "Veg Room A" });
 * if (result.success) {
 *   console.log("Created room:", result.data);
 * }
 * ```
 */
export function useRooms(): UseRoomsReturn {
  const [rooms, setRooms] = useState<RoomWithControllers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches all rooms for the current user with their associated controllers.
   * Uses a left join to include controller data for display purposes.
   */
  const fetchRooms = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch rooms with controllers in a single query using Supabase relations
      const { data: roomsData, error: fetchError } = await supabase
        .from("rooms")
        .select(`
          *,
          controllers (
            id,
            user_id,
            brand,
            controller_id,
            name,
            status,
            last_seen,
            room_id,
            model,
            firmware_version
          )
        `)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Map database 'status' to frontend 'is_online' for controllers
      const roomsWithMappedControllers = (roomsData || []).map(room => ({
        ...room,
        controllers: (room.controllers || []).map((c: { status?: string }) => ({
          ...c,
          is_online: c.status === 'online',
        })),
      }));

      setRooms(roomsWithMappedControllers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch rooms";
      setError(errorMessage);
      console.error("useRooms fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Creates a new room with the provided input.
   * Validates input and returns the created room on success.
   */
  const createRoom = useCallback(async (input: CreateRoomInput): Promise<ApiResponse<Room>> => {
    try {
      // Validate required fields
      if (!input.name?.trim()) {
        return { success: false, error: "Room name is required" };
      }

      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        return { success: false, error: "You must be logged in to create a room" };
      }

      const { data, error: insertError } = await supabase
        .from("rooms")
        .insert({
          user_id: session.user.id,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          settings: input.settings || {},
          latitude: input.latitude || null,
          longitude: input.longitude || null,
          timezone: input.timezone || "UTC",
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Refresh the rooms list to include the new room with relations
      await fetchRooms();

      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create room";
      console.error("createRoom error:", err);
      return { success: false, error: errorMessage };
    }
  }, [fetchRooms]);

  /**
   * Updates an existing room with the provided input.
   * Only updates fields that are provided in the input.
   */
  const updateRoom = useCallback(async (
    id: string,
    input: UpdateRoomInput
  ): Promise<ApiResponse<Room>> => {
    try {
      if (!id) {
        return { success: false, error: "Room ID is required" };
      }

      // Build update object with only defined fields
      const updateData: Record<string, unknown> = {};

      if (input.name !== undefined) {
        updateData.name = input.name.trim();
      }
      if (input.description !== undefined) {
        updateData.description = input.description?.trim() || null;
      }
      if (input.settings !== undefined) {
        updateData.settings = input.settings;
      }
      if (input.current_stage !== undefined) {
        updateData.current_stage = input.current_stage;
      }
      if (input.latitude !== undefined) {
        updateData.latitude = input.latitude;
      }
      if (input.longitude !== undefined) {
        updateData.longitude = input.longitude;
      }
      if (input.timezone !== undefined) {
        updateData.timezone = input.timezone;
      }

      if (Object.keys(updateData).length === 0) {
        return { success: false, error: "No fields to update" };
      }

      const { data, error: updateError } = await supabase
        .from("rooms")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Refresh rooms list
      await fetchRooms();

      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update room";
      console.error("updateRoom error:", err);
      return { success: false, error: errorMessage };
    }
  }, [fetchRooms]);

  /**
   * Deletes a room by ID.
   * This will cascade delete associated data based on database constraints.
   */
  const deleteRoom = useCallback(async (id: string): Promise<ApiResponse<void>> => {
    try {
      if (!id) {
        return { success: false, error: "Room ID is required" };
      }

      const { error: deleteError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Update local state immediately for better UX
      setRooms(prev => prev.filter(room => room.id !== id));

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete room";
      console.error("deleteRoom error:", err);
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Retrieves a room by ID from the local state.
   * Useful for accessing room data without an additional API call.
   */
  const getRoomById = useCallback((id: string): RoomWithControllers | undefined => {
    return rooms.find(room => room.id === id);
  }, [rooms]);

  // Initial fetch on mount
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Set up real-time subscription for rooms changes
  useEffect(() => {
    const channel = supabase
      .channel("rooms_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
        },
        () => {
          // Refetch on any change to get updated data with relations
          fetchRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRooms]);

  return {
    rooms,
    isLoading,
    error,
    refetch: fetchRooms,
    createRoom,
    updateRoom,
    deleteRoom,
    getRoomById,
  };
}
