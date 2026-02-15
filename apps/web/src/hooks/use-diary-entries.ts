"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  DiaryEntryWithPhotos,
  CreateDiaryEntryInput,
  UpdateDiaryEntryInput,
  ApiResponse,
} from "@/types";

interface UseDiaryEntriesReturn {
  entries: DiaryEntryWithPhotos[];
  loading: boolean;
  error: string | null;
  fetchEntries: () => Promise<void>;
  createEntry: (input: Omit<CreateDiaryEntryInput, "cycle_id">) => Promise<ApiResponse<DiaryEntryWithPhotos>>;
  updateEntry: (entryId: string, input: UpdateDiaryEntryInput) => Promise<ApiResponse<DiaryEntryWithPhotos>>;
  deleteEntry: (entryId: string) => Promise<ApiResponse<void>>;
}

/**
 * Custom hook for managing diary entries within a diary cycle.
 *
 * @param cycleId - The diary cycle ID
 */
export function useDiaryEntries(cycleId: string | null): UseDiaryEntriesReturn {
  const [entries, setEntries] = useState<DiaryEntryWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!cycleId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/diaries/${cycleId}/entries`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch entries: ${response.status}`);
      }

      const data = await response.json();

      if (!isMounted.current) return;

      setEntries(data.entries || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch diary entries";
      if (isMounted.current) {
        setError(errorMessage);
      }
      console.error("useDiaryEntries fetch error:", err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [cycleId]);

  const createEntry = useCallback(
    async (input: Omit<CreateDiaryEntryInput, "cycle_id">): Promise<ApiResponse<DiaryEntryWithPhotos>> => {
      if (!cycleId) {
        return { success: false, error: "No cycle selected" };
      }

      try {
        const response = await fetch(`/api/diaries/${cycleId}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(input),
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: data.error || `Failed to create entry: ${response.status}`,
          };
        }

        // Refresh entries list
        if (isMounted.current) {
          await fetchEntries();
        }

        return { success: true, data: data.entry };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create diary entry";
        console.error("createEntry error:", err);
        return { success: false, error: errorMessage };
      }
    },
    [cycleId, fetchEntries]
  );

  const updateEntry = useCallback(
    async (entryId: string, input: UpdateDiaryEntryInput): Promise<ApiResponse<DiaryEntryWithPhotos>> => {
      if (!cycleId) {
        return { success: false, error: "No cycle selected" };
      }

      try {
        const response = await fetch(`/api/diaries/${cycleId}/entries/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(input),
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: data.error || `Failed to update entry: ${response.status}`,
          };
        }

        // Refresh entries list
        if (isMounted.current) {
          await fetchEntries();
        }

        return { success: true, data: data.entry };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update diary entry";
        console.error("updateEntry error:", err);
        return { success: false, error: errorMessage };
      }
    },
    [cycleId, fetchEntries]
  );

  const deleteEntry = useCallback(
    async (entryId: string): Promise<ApiResponse<void>> => {
      if (!cycleId) {
        return { success: false, error: "No cycle selected" };
      }

      try {
        const response = await fetch(`/api/diaries/${cycleId}/entries/${entryId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            error: errorData.error || `Failed to delete entry: ${response.status}`,
          };
        }

        // Remove from local state immediately
        if (isMounted.current) {
          setEntries((prev) => prev.filter((e) => e.id !== entryId));
        }

        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete diary entry";
        console.error("deleteEntry error:", err);
        return { success: false, error: errorMessage };
      }
    },
    [cycleId]
  );

  // Fetch on mount / cycleId change
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return {
    entries,
    loading,
    error,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}
