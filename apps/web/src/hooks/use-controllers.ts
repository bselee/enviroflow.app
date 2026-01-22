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
import { redactCredentials } from "@/lib/encryption";

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

  /**
   * Fetch all controllers for the current user
   */
  const fetchControllers = useCallback(async () => {
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
        // For development, return empty array instead of error
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
          is_online,
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const roomsArray = controller.rooms as any;
            const room = Array.isArray(roomsArray) && roomsArray.length > 0
              ? { id: roomsArray[0].id, name: roomsArray[0].name }
              : roomsArray && typeof roomsArray === 'object'
                ? { id: roomsArray.id, name: roomsArray.name }
                : null;
            // Omit the 'rooms' property and add 'room'
            // is_online is already a boolean in the database
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { rooms: _rooms, ...controllerData } = controller;
            return {
              ...controllerData,
              room,
            };
          }
        ) as ControllerWithRoom[];
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
    try {
      if (isMounted.current) {
        setBrandsLoading(true);
      }

      const response = await fetch("/api/controllers/brands");
      if (!response.ok) {
        throw new Error("Failed to fetch brands");
      }

      const data = await response.json();
      if (isMounted.current) {
        setBrands(data.brands || []);
      }
    } catch (err) {
      console.error("Error fetching brands:", err);
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
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
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
        });

        const data = await response.json();

        if (!response.ok) {
          return { success: false, error: data.error || "Failed to add controller" };
        }

        // Refresh the controllers list
        await fetchControllers();

        return { success: true, data: data.controller };
      } catch (err) {
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

        // Build update object, excluding undefined values
        const updateData: Record<string, unknown> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.room_id !== undefined) updateData.room_id = input.room_id;
        if (input.credentials !== undefined) updateData.credentials = input.credentials;

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

        // Refresh the controllers list
        await fetchControllers();

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

        // Refresh the controllers list
        await fetchControllers();

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
   * Test connection for a controller
   */
  const testConnection = useCallback(
    async (id: string): Promise<OperationResult<{ isOnline: boolean }>> => {
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
            is_online: isOnline,
            last_seen: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", id);

        // Refresh controllers
        await fetchControllers();

        return { success: true, data: { isOnline } };
      } catch (err) {
        // Log error message only - controller object may contain credentials
        console.error("Error testing connection:", err instanceof Error ? err.message : "Unknown error");
        return {
          success: false,
          error: err instanceof Error ? err.message : "Connection test failed",
        };
      }
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

        // Search workflows that reference this controller in their nodes
        const { data: workflows, error: fetchError } = await supabase
          .from("workflows")
          .select("id, name, nodes")
          .eq("user_id", session.user.id);

        if (fetchError) {
          return { success: false, error: fetchError.message };
        }

        // Filter workflows that contain this controller in their nodes
        const associatedWorkflows = (workflows || []).filter((workflow) => {
          const nodes = workflow.nodes as Array<{ data?: { controllerId?: string } }>;
          return nodes?.some((node) => node.data?.controllerId === controllerId);
        });

        return {
          success: true,
          data: {
            count: associatedWorkflows.length,
            names: associatedWorkflows.map((w) => w.name),
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
    fetchControllers();
    fetchBrands();
    fetchRooms();

    return () => {
      isMounted.current = false;
    };
  }, [fetchControllers, fetchBrands, fetchRooms]);

  // Set up real-time subscription for controllers
  useEffect(() => {
    const channel = supabase
      .channel("controllers-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "controllers",
        },
        () => {
          // Refresh on any change
          fetchControllers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchControllers]);

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
