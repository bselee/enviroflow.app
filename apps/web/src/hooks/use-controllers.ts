/**
 * useControllers Hook
 *
 * Custom hook for managing controller data with Supabase.
 * Provides CRUD operations, loading states, and real-time updates.
 *
 * @example
 * ```tsx
 * const { controllers, loading, error, addController, deleteController } = useControllers();
 * ```
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Controller,
  ControllerWithRoom,
  AddControllerInput,
  UpdateControllerInput,
  Brand,
  RoomBasic,
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
 * State returned by the useControllers hook
 */
interface UseControllersState {
  /** List of controllers with room data */
  controllers: ControllerWithRoom[];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Available brands from API */
  brands: Brand[];
  /** Available rooms for assignment */
  rooms: RoomBasic[];
  /** Loading state for brands fetch */
  brandsLoading: boolean;
  /** Loading state for rooms fetch */
  roomsLoading: boolean;
  /** Refresh controllers list */
  refresh: () => Promise<void>;
  /** Add a new controller */
  addController: (input: AddControllerInput) => Promise<OperationResult<Controller>>;
  /** Update an existing controller */
  updateController: (id: string, input: UpdateControllerInput) => Promise<OperationResult<Controller>>;
  /** Delete a controller */
  deleteController: (id: string) => Promise<OperationResult>;
  /** Test connection for a controller */
  testConnection: (id: string) => Promise<OperationResult<{ isOnline: boolean }>>;
  /** Fetch brands list */
  fetchBrands: () => Promise<void>;
  /** Fetch rooms list */
  fetchRooms: () => Promise<void>;
  /** Check if a controller has associated workflows */
  getAssociatedWorkflows: (controllerId: string) => Promise<OperationResult<{ count: number; names: string[] }>>;
}

/**
 * Custom hook for controller management
 */
export function useControllers(): UseControllersState {
  const [controllers, setControllers] = useState<ControllerWithRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [rooms, setRooms] = useState<RoomBasic[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  // Debounce flag to prevent multiple rapid refetches
  const lastFetchTime = useRef(0);
  const FETCH_DEBOUNCE_MS = 500; // Minimum time between fetches

  /**
   * Fetch all controllers for the current user
   */
  const fetchControllers = useCallback(async (skipDebounce = false) => {
    // Debounce rapid refetches to prevent race conditions
    const now = Date.now();
    if (!skipDebounce && now - lastFetchTime.current < FETCH_DEBOUNCE_MS) {
      return;
    }
    lastFetchTime.current = now;

    try {
      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }

      // Get current user session
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError) {
        console.error("[Controllers] Auth error:", authError.message);
        if (isMounted.current) {
          setError(`Authentication error: ${authError.message}`);
          setControllers([]);
          setLoading(false);
        }
        return;
      }

      if (!session?.user) {
        // Return empty array for unauthenticated users - dashboard will show demo mode
        if (isMounted.current) {
          setControllers([]);
          setLoading(false);
        }
        return;
      }

      // Fetch controllers with room join
      const { data, error: fetchError } = await supabase
        .from("controllers")
        .select(
          `
          id,
          brand,
          controller_id,
          name,
          capabilities,
          status,
          last_seen,
          last_error,
          firmware_version,
          model,
          room_id,
          created_at,
          updated_at,
          rooms:room_id (
            id,
            name
          )
        `
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (isMounted.current) {
        // Transform data to include room as a flat object
        // Supabase returns rooms as an array, we need the first element or null
        const controllersWithRooms = (data || []).map(
          (controller) => {
            // Runtime validation: check if rooms field exists and has valid structure
            const roomsData = controller.rooms;
            let room: { id: string; name: string } | null = null;

            if (Array.isArray(roomsData) && roomsData.length > 0) {
              const firstRoom = roomsData[0];
              if (firstRoom && typeof firstRoom === 'object' && 'id' in firstRoom && 'name' in firstRoom) {
                room = { id: String(firstRoom.id), name: String(firstRoom.name) };
              }
            } else if (roomsData && typeof roomsData === 'object' && 'id' in roomsData && 'name' in roomsData) {
              room = { id: String(roomsData.id), name: String(roomsData.name) };
            }

            // Omit the 'rooms' property and add 'room'
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { rooms: _rooms, ...controllerData } = controller;
            return {
              ...controllerData,
              room,
            } as ControllerWithRoom;
          }
        );

        setControllers(controllersWithRooms);
      }
    } catch (err) {
      console.error("Error fetching controllers:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch controllers");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Fetch available brands from API
   */
  const fetchBrands = useCallback(async () => {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30 second timeout

    try {
      if (isMounted.current) {
        setBrandsLoading(true);
      }

      const response = await fetch("/api/controllers/brands", {
        signal: abortController.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Failed to fetch brands");
      }

      const data = await response.json();
      if (isMounted.current) {
        setBrands(data.brands || []);
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error && err.name === 'AbortError') {
        // Brands fetch timed out
      } else {
        console.error("Error fetching brands:", err);
      }
      // Don't set error state for brands fetch failure
    } finally {
      if (isMounted.current) {
        setBrandsLoading(false);
      }
    }
  }, []);

  /**
   * Fetch available rooms for assignment
   */
  const fetchRooms = useCallback(async () => {
    try {
      if (isMounted.current) {
        setRoomsLoading(true);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (isMounted.current) {
          setRooms([]);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("rooms")
        .select("id, name, description")
        .eq("user_id", session.user.id)
        .order("name");

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (isMounted.current) {
        setRooms(data || []);
      }
    } catch (err) {
      console.error("Error fetching rooms:", err);
    } finally {
      if (isMounted.current) {
        setRoomsLoading(false);
      }
    }
  }, []);

  /**
   * Add a new controller
   */
  const addController = useCallback(
    async (input: AddControllerInput): Promise<OperationResult<Controller>> => {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30 second timeout

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          clearTimeout(timeoutId);
          return { success: false, error: "You must be logged in to add a controller" };
        }

        // Call API to add controller (handles validation and connection testing)
        const response = await fetch("/api/controllers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(input),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
          return { success: false, error: data.error || "Failed to add controller" };
        }

        // Refresh the controllers list - skip debounce for immediate update
        await fetchControllers(true);

        return { success: true, data: data.controller };
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof Error && err.name === 'AbortError') {
          return { success: false, error: 'Request timed out. Please try again.' };
        }

        // Log error without potentially sensitive input data
        console.error("Error adding controller:", err instanceof Error ? err.message : "Unknown error");
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to add controller",
        };
      }
    },
    [fetchControllers]
  );

  /**
   * Update an existing controller
   */
  const updateController = useCallback(
    async (id: string, input: UpdateControllerInput): Promise<OperationResult<Controller>> => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          return { success: false, error: "You must be logged in to update a controller" };
        }

        // SECURITY: Block direct credential updates
        // Credentials must be updated through the API route (PUT /api/controllers/[id])
        // which handles encryption properly with server-side key
        if (input.credentials !== undefined) {
          return {
            success: false,
            error: "Credentials cannot be updated directly. Use the API endpoint to ensure proper encryption."
          };
        }

        // Build update object, excluding undefined values
        const updateData: Record<string, unknown> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.room_id !== undefined) updateData.room_id = input.room_id;

        const { data, error: updateError } = await supabase
          .from("controllers")
          .update(updateData)
          .eq("id", id)
          .eq("user_id", session.user.id)
          .select()
          .single();

        if (updateError) {
          return { success: false, error: updateError.message };
        }

        // Refresh the controllers list - skip debounce for immediate update
        await fetchControllers(true);

        return { success: true, data };
      } catch (err) {
        // Log error without potentially sensitive input data
        console.error("Error updating controller:", err instanceof Error ? err.message : "Unknown error");
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to update controller",
        };
      }
    },
    [fetchControllers]
  );

  /**
   * Delete a controller
   */
  const deleteController = useCallback(
    async (id: string): Promise<OperationResult> => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          return { success: false, error: "You must be logged in to delete a controller" };
        }

        const { error: deleteError } = await supabase
          .from("controllers")
          .delete()
          .eq("id", id)
          .eq("user_id", session.user.id);

        if (deleteError) {
          return { success: false, error: deleteError.message };
        }

        // Refresh the controllers list - skip debounce for immediate update
        await fetchControllers(true);

        return { success: true };
      } catch (err) {
        // Log error message only, not full error object
        console.error("Error deleting controller:", err instanceof Error ? err.message : "Unknown error");
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to delete controller",
        };
      }
    },
    [fetchControllers]
  );

  /**
   * Test connection for a controller with automatic retry
   */
  const testConnection = useCallback(
    async (id: string): Promise<OperationResult<{ isOnline: boolean }>> => {
      const maxAttempts = 3;
      const baseDelay = 2000; // 2 seconds

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session?.user) {
            return { success: false, error: "You must be logged in" };
          }

          // Get controller details
          const { data: controller, error: fetchError } = await supabase
            .from("controllers")
            .select("brand, credentials")
            .eq("id", id)
            .eq("user_id", session.user.id)
            .single();

          if (fetchError || !controller) {
            return { success: false, error: "Controller not found" };
          }

          // For now, simulate connection test
          // In production, this would call the adapter
          const isOnline = controller.brand !== "csv_upload";

          // Update the controller's online status
          await supabase
            .from("controllers")
            .update({
              status: isOnline ? 'online' : 'offline',
              last_seen: new Date().toISOString(),
              last_error: null,
            })
            .eq("id", id);

          // Refresh controllers - skip debounce for immediate update
          await fetchControllers(true);

          return { success: true, data: { isOnline } };
        } catch (err) {
          // Log error with attempt number
          console.error(`Error testing connection (attempt ${attempt}/${maxAttempts}):`,
            err instanceof Error ? err.message : "Unknown error");

          // If not the last attempt, wait and retry with exponential backoff
          if (attempt < maxAttempts) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // All retries exhausted
          return {
            success: false,
            error: err instanceof Error
              ? `Connection test failed after ${maxAttempts} attempts: ${err.message}`
              : "Connection test failed",
          };
        }
      }

      // Fallback (should never reach here)
      return {
        success: false,
        error: "Connection test failed",
      };
    },
    [fetchControllers]
  );

  /**
   * Get workflows associated with a controller
   */
  const getAssociatedWorkflows = useCallback(
    async (controllerId: string): Promise<OperationResult<{ count: number; names: string[] }>> => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          return { success: false, error: "You must be logged in" };
        }

        // Use PostgreSQL JSONB operators for server-side filtering
        // The @> operator checks if the left JSONB contains the right JSONB
        // This filters workflows where nodes array contains an element with matching controllerId
        const { data: workflows, error: fetchError } = await supabase
          .from("workflows")
          .select("id, name")
          .eq("user_id", session.user.id)
          .contains("nodes", [{ data: { controllerId } }]);

        if (fetchError) {
          return { success: false, error: fetchError.message };
        }

        return {
          success: true,
          data: {
            count: workflows?.length || 0,
            names: (workflows || []).map((w) => w.name),
          },
        };
      } catch (err) {
        console.error("Error fetching associated workflows:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to fetch workflows",
        };
      }
    },
    []
  );

  // Initial data fetch
  useEffect(() => {
    isMounted.current = true;
    fetchControllers(true); // Initial fetch, skip debounce
    fetchBrands();
    fetchRooms();

    return () => {
      isMounted.current = false;
    };
  }, [fetchControllers, fetchBrands, fetchRooms]);

  // Set up real-time subscription for controllers
  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      // Get the current user's ID first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return null;
      }

      const channel = supabase
        .channel("controllers-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "controllers",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            // Refresh on any change - use debouncing to prevent race conditions
            fetchControllers(); // Use debounced version
          }
        )
        .subscribe();

      return channel;
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    setupRealtimeSubscription().then((ch) => {
      channel = ch;
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ FIX: Only subscribe once on mount, not on every fetchControllers change

  return {
    controllers,
    loading,
    error,
    brands,
    rooms,
    brandsLoading,
    roomsLoading,
    refresh: fetchControllers,
    addController,
    updateController,
    deleteController,
    testConnection,
    fetchBrands,
    fetchRooms,
    getAssociatedWorkflows,
  };
}
