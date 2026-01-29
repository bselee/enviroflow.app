/**
 * useControllerPorts Hook
 *
 * Custom hook for fetching port data for a specific controller.
 * Used by workflow builder to populate port dropdowns and display current port states.
 *
 * @example
 * ```tsx
 * const { ports, loading, error, refetch } = useControllerPorts({
 *   controllerId: 'abc-123',
 *   enabled: true
 * });
 * ```
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { ControllerPort } from "@/types";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Configuration options for the useControllerPorts hook.
 */
export interface UseControllerPortsOptions {
  /** Controller ID to fetch ports for. If undefined, returns empty array. */
  controllerId?: string;
  /** Whether to enable data fetching. Defaults to true. */
  enabled?: boolean;
}

/**
 * Return type for the useControllerPorts hook.
 */
export interface UseControllerPortsReturn {
  /** Array of port data for the controller */
  ports: ControllerPort[];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error message from last operation, or null */
  error: string | null;
  /** Manually trigger a data refresh */
  refetch: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Fetches port data for a specific controller with real-time updates.
 *
 * Features:
 * - Returns empty array if no controllerId provided
 * - Can be disabled via enabled option
 * - Sets up real-time subscription for live updates
 * - Provides refetch function for manual refresh
 * - Handles loading and error states
 * - Prevents state updates after unmount
 *
 * @param options - Configuration options
 * @returns Port data, loading state, error state, and refetch function
 */
export function useControllerPorts(
  options: UseControllerPortsOptions = {}
): UseControllerPortsReturn {
  const { controllerId, enabled = true } = options;

  // State
  const [ports, setPorts] = useState<ControllerPort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to prevent state updates after unmount
  const isMounted = useRef(true);

  /**
   * Fetch ports for the specified controller.
   */
  const fetchPorts = useCallback(async () => {
    // Don't fetch if disabled or no controllerId provided
    if (!enabled || !controllerId) {
      if (isMounted.current) {
        setPorts([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    try {
      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }

      // Fetch ports for the controller, ordered by port number
      const { data, error: fetchError } = await supabase
        .from("controller_ports")
        .select("*")
        .eq("controller_id", controllerId)
        .order("port_number", { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (isMounted.current) {
        setPorts((data as ControllerPort[]) || []);
      }
    } catch (err) {
      console.error("[useControllerPorts] Error fetching ports:", err);
      if (isMounted.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch controller ports"
        );
        setPorts([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [controllerId, enabled]);

  /**
   * Public refetch function for manual refresh.
   */
  const refetch = useCallback(async () => {
    await fetchPorts();
  }, [fetchPorts]);

  // Initial fetch on mount or when controllerId/enabled changes
  useEffect(() => {
    isMounted.current = true;
    fetchPorts();

    return () => {
      isMounted.current = false;
    };
  }, [fetchPorts]);

  // Set up real-time subscription for port changes
  useEffect(() => {
    // Don't subscribe if disabled or no controllerId
    if (!enabled || !controllerId) {
      return;
    }

    const channel = supabase
      .channel(`controller_ports_${controllerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "controller_ports",
          filter: `controller_id=eq.${controllerId}`,
        },
        () => {
          // Refresh on any change (INSERT, UPDATE, DELETE)
          fetchPorts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [controllerId, enabled, fetchPorts]);

  return {
    ports,
    loading,
    error,
    refetch,
  };
}
