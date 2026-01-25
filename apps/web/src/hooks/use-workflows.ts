"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Workflow,
  WorkflowWithRoom,
  WorkflowNode,
  WorkflowEdge,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ApiResponse,
} from "@/types";

/**
 * Hook return type with all workflow operations and state.
 */
interface UseWorkflowsReturn {
  /** List of workflows with room data */
  workflows: WorkflowWithRoom[];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Refresh workflows list */
  refetch: () => Promise<void>;
  /** Create a new workflow */
  createWorkflow: (input: CreateWorkflowInput) => Promise<ApiResponse<Workflow>>;
  /** Update an existing workflow */
  updateWorkflow: (id: string, input: UpdateWorkflowInput) => Promise<ApiResponse<Workflow>>;
  /** Delete a workflow */
  deleteWorkflow: (id: string) => Promise<ApiResponse<void>>;
  /** Toggle workflow active state */
  toggleActive: (id: string, isActive: boolean) => Promise<ApiResponse<void>>;
  /** Get a workflow by ID from local state */
  getWorkflowById: (id: string) => WorkflowWithRoom | undefined;
  /** Get workflows for a specific room */
  getWorkflowsByRoom: (roomId: string) => WorkflowWithRoom[];
  /** Get active workflows count */
  activeCount: number;
  /** Get total run count across all workflows */
  totalRunCount: number;
}

/**
 * Custom hook for managing workflows with Supabase.
 *
 * Provides CRUD operations for automation workflows including
 * React Flow node/edge management, active state toggling,
 * and real-time updates via Supabase subscriptions.
 *
 * @example
 * ```tsx
 * const {
 *   workflows,
 *   loading,
 *   createWorkflow,
 *   toggleActive
 * } = useWorkflows();
 *
 * // Create a new workflow
 * const result = await createWorkflow({
 *   name: "VPD Controller",
 *   nodes: [],
 *   edges: [],
 *   is_active: false
 * });
 *
 * // Toggle active state
 * await toggleActive(workflowId, true);
 * ```
 */
export function useWorkflows(): UseWorkflowsReturn {
  const [workflows, setWorkflows] = useState<WorkflowWithRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  /**
   * Fetches all workflows for the current user with their associated room data.
   * Uses a left join to include room names for display purposes.
   */
  const fetchWorkflows = useCallback(async () => {
    try {
      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }

      // Get current user session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.user) {
        // For development, return empty array instead of error
        if (isMounted.current) {
          setWorkflows([]);
          setLoading(false);
        }
        return;
      }

      // Fetch workflows with room join
      const { data, error: fetchError } = await supabase
        .from("workflows")
        .select(`
          id,
          user_id,
          room_id,
          name,
          description,
          nodes,
          edges,
          is_active,
          trigger_state,
          last_executed,
          last_error,
          run_count,
          dry_run_enabled,
          growth_stage,
          created_at,
          updated_at,
          room:rooms!room_id (
            id,
            name
          )
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (isMounted.current) {
        // Transform data to include room as a flat object
        // Handle both array (from some joins) and object (from others) room results
        const workflowsWithRooms: WorkflowWithRoom[] = (data || []).map(
          (workflow) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const roomData = workflow.room as any;
            const room = Array.isArray(roomData) && roomData.length > 0
              ? { id: roomData[0].id, name: roomData[0].name }
              : roomData && typeof roomData === 'object'
                ? { id: roomData.id, name: roomData.name }
                : null;
            return {
              ...workflow,
              // Cast the JSON arrays to proper types
              nodes: (workflow.nodes || []) as WorkflowNode[],
              edges: (workflow.edges || []) as WorkflowEdge[],
              room,
            };
          }
        );
        setWorkflows(workflowsWithRooms);
      }
    } catch (err) {
      console.error("Error fetching workflows:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch workflows");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Creates a new workflow with the provided input.
   * Validates required fields and returns the created workflow on success.
   */
  const createWorkflow = useCallback(
    async (input: CreateWorkflowInput): Promise<ApiResponse<Workflow>> => {
      try {
        // Validate required fields
        if (!input.name?.trim()) {
          return { success: false, error: "Workflow name is required" };
        }

        // Get current user session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          return {
            success: false,
            error: "You must be logged in to create a workflow",
          };
        }

        const { data, error: insertError } = await supabase
          .from("workflows")
          .insert({
            user_id: session.user.id,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            room_id: input.room_id || null,
            nodes: input.nodes || [],
            edges: input.edges || [],
            is_active: input.is_active ?? false,
            dry_run_enabled: input.dry_run_enabled ?? false,
            growth_stage: input.growth_stage || null,
            run_count: 0,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        // Refresh the workflows list to include the new workflow with relations
        await fetchWorkflows();

        return { success: true, data };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create workflow";
        console.error("createWorkflow error:", err);
        return { success: false, error: errorMessage };
      }
    },
    [fetchWorkflows]
  );

  /**
   * Updates an existing workflow with the provided input.
   * Only updates fields that are provided in the input.
   */
  const updateWorkflow = useCallback(
    async (
      id: string,
      input: UpdateWorkflowInput
    ): Promise<ApiResponse<Workflow>> => {
      try {
        if (!id) {
          return { success: false, error: "Workflow ID is required" };
        }

        // Build update object with only defined fields
        const updateData: Record<string, unknown> = {};

        if (input.name !== undefined) {
          updateData.name = input.name.trim();
        }
        if (input.description !== undefined) {
          updateData.description = input.description?.trim() || null;
        }
        if (input.room_id !== undefined) {
          updateData.room_id = input.room_id;
        }
        if (input.nodes !== undefined) {
          updateData.nodes = input.nodes;
        }
        if (input.edges !== undefined) {
          updateData.edges = input.edges;
        }
        if (input.is_active !== undefined) {
          updateData.is_active = input.is_active;
        }
        if (input.dry_run_enabled !== undefined) {
          updateData.dry_run_enabled = input.dry_run_enabled;
        }
        if (input.growth_stage !== undefined) {
          updateData.growth_stage = input.growth_stage;
        }

        if (Object.keys(updateData).length === 0) {
          return { success: false, error: "No fields to update" };
        }

        const { data, error: updateError } = await supabase
          .from("workflows")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Refresh workflows list
        await fetchWorkflows();

        return { success: true, data };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update workflow";
        console.error("updateWorkflow error:", err);
        return { success: false, error: errorMessage };
      }
    },
    [fetchWorkflows]
  );

  /**
   * Deletes a workflow by ID.
   * This will cascade delete associated activity logs based on database constraints.
   */
  const deleteWorkflow = useCallback(
    async (id: string): Promise<ApiResponse<void>> => {
      try {
        if (!id) {
          return { success: false, error: "Workflow ID is required" };
        }

        const { error: deleteError } = await supabase
          .from("workflows")
          .delete()
          .eq("id", id);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        // Update local state immediately for better UX
        if (isMounted.current) {
          setWorkflows((prev) => prev.filter((workflow) => workflow.id !== id));
        }

        return { success: true };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete workflow";
        console.error("deleteWorkflow error:", err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  /**
   * Toggles the active state of a workflow.
   * Convenience method for quickly enabling/disabling automation.
   */
  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<ApiResponse<void>> => {
      try {
        if (!id) {
          return { success: false, error: "Workflow ID is required" };
        }

        const { error: updateError } = await supabase
          .from("workflows")
          .update({ is_active: isActive })
          .eq("id", id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Update local state immediately for better UX
        if (isMounted.current) {
          setWorkflows((prev) =>
            prev.map((workflow) =>
              workflow.id === id ? { ...workflow, is_active: isActive } : workflow
            )
          );
        }

        return { success: true };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to toggle workflow";
        console.error("toggleActive error:", err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  /**
   * Retrieves a workflow by ID from the local state.
   * Useful for accessing workflow data without an additional API call.
   */
  const getWorkflowById = useCallback(
    (id: string): WorkflowWithRoom | undefined => {
      return workflows.find((workflow) => workflow.id === id);
    },
    [workflows]
  );

  /**
   * Retrieves workflows for a specific room from local state.
   */
  const getWorkflowsByRoom = useCallback(
    (roomId: string): WorkflowWithRoom[] => {
      return workflows.filter((workflow) => workflow.room_id === roomId);
    },
    [workflows]
  );

  /**
   * Computed: Count of active workflows.
   */
  const activeCount = workflows.filter((w) => w.is_active).length;

  /**
   * Computed: Total run count across all workflows.
   */
  const totalRunCount = workflows.reduce((sum, w) => sum + (w.run_count || 0), 0);

  // Initial fetch on mount
  useEffect(() => {
    isMounted.current = true;
    fetchWorkflows();

    return () => {
      isMounted.current = false;
    };
  }, [fetchWorkflows]);

  // Set up real-time subscription for workflows changes
  useEffect(() => {
    const channel = supabase
      .channel("workflows_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workflows",
        },
        () => {
          // Refetch on any change to get updated data with relations
          fetchWorkflows();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchWorkflows]);

  return {
    workflows,
    loading,
    error,
    refetch: fetchWorkflows,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    toggleActive,
    getWorkflowById,
    getWorkflowsByRoom,
    activeCount,
    totalRunCount,
  };
}
