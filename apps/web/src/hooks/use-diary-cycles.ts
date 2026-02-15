"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  DiaryCycleWithCounts,
  CreateDiaryCycleInput,
  UpdateDiaryCycleInput,
  DiaryCycleStatus,
  ApiResponse,
} from "@/types";

/**
 * Hook return type with all diary cycle operations and state.
 */
interface UseDiaryCyclesReturn {
  /** List of diary cycles with counts */
  cycles: DiaryCycleWithCounts[];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Refresh cycles list */
  fetchCycles: (filters?: { status?: DiaryCycleStatus; room_id?: string }) => Promise<void>;
  /** Create a new diary cycle */
  createCycle: (input: CreateDiaryCycleInput) => Promise<ApiResponse<DiaryCycleWithCounts>>;
  /** Update an existing diary cycle */
  updateCycle: (id: string, input: UpdateDiaryCycleInput) => Promise<ApiResponse<DiaryCycleWithCounts>>;
  /** Delete a diary cycle */
  deleteCycle: (id: string) => Promise<ApiResponse<void>>;
}

/**
 * Custom hook for managing diary cycles.
 *
 * Provides CRUD operations for diary cycles with automatic state management,
 * error handling, and loading states.
 *
 * @example
 * ```tsx
 * const { cycles, loading, createCycle, fetchCycles } = useDiaryCycles();
 *
 * // Fetch cycles with filters
 * await fetchCycles({ status: 'active' });
 *
 * // Create a new cycle
 * const result = await createCycle({ name: "Spring 2026" });
 * if (result.success) {
 *   console.log("Created cycle:", result.data);
 * }
 * ```
 */
export function useDiaryCycles(): UseDiaryCyclesReturn {
  const [cycles, setCycles] = useState<DiaryCycleWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Track component mount status
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Fetches all diary cycles for the current user with optional filters.
   */
  const fetchCycles = useCallback(async (filters?: { status?: DiaryCycleStatus; room_id?: string }) => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      if (filters?.status) {
        params.set('status', filters.status);
      }
      if (filters?.room_id) {
        params.set('room_id', filters.room_id);
      }
      params.set('include_counts', 'true');

      const response = await fetch(`/api/diaries?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch cycles: ${response.status}`);
      }

      const data = await response.json();

      if (!isMounted.current) return;

      setCycles(data.cycles || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch diary cycles";
      if (isMounted.current) {
        setError(errorMessage);
      }
      console.error("useDiaryCycles fetch error:", err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Creates a new diary cycle with the provided input.
   */
  const createCycle = useCallback(async (
    input: CreateDiaryCycleInput
  ): Promise<ApiResponse<DiaryCycleWithCounts>> => {
    try {
      // Validate required fields
      if (!input.name?.trim()) {
        return { success: false, error: "Cycle name is required" };
      }

      const response = await fetch('/api/diaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Failed to create cycle: ${response.status}`,
        };
      }

      // Refresh the cycles list to include the new cycle
      if (isMounted.current) {
        await fetchCycles();
      }

      return { success: true, data: data.cycle };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create diary cycle";
      console.error("createCycle error:", err);
      return { success: false, error: errorMessage };
    }
  }, [fetchCycles]);

  /**
   * Updates an existing diary cycle with the provided input.
   */
  const updateCycle = useCallback(async (
    id: string,
    input: UpdateDiaryCycleInput
  ): Promise<ApiResponse<DiaryCycleWithCounts>> => {
    try {
      if (!id) {
        return { success: false, error: "Cycle ID is required" };
      }

      const response = await fetch(`/api/diaries/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Failed to update cycle: ${response.status}`,
        };
      }

      // Refresh cycles list
      if (isMounted.current) {
        await fetchCycles();
      }

      return { success: true, data: data.cycle };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update diary cycle";
      console.error("updateCycle error:", err);
      return { success: false, error: errorMessage };
    }
  }, [fetchCycles]);

  /**
   * Deletes a diary cycle by ID.
   * This will cascade delete associated entries and photos.
   */
  const deleteCycle = useCallback(async (id: string): Promise<ApiResponse<void>> => {
    try {
      if (!id) {
        return { success: false, error: "Cycle ID is required" };
      }

      const response = await fetch(`/api/diaries/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `Failed to delete cycle: ${response.status}`,
        };
      }

      // Update local state immediately for better UX
      if (isMounted.current) {
        setCycles(prev => prev.filter(cycle => cycle.id !== id));
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete diary cycle";
      console.error("deleteCycle error:", err);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  return {
    cycles,
    loading,
    error,
    fetchCycles,
    createCycle,
    updateCycle,
    deleteCycle,
  };
}
