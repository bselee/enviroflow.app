/**
 * useWorkflowConflicts Hook
 * 
 * Fetches conflict status for active workflows.
 * Used to display warnings when multiple workflows target the same device port.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

// Conflict info for a single workflow
export interface WorkflowConflictInfo {
  hasConflict: boolean;
  conflictingWorkflows: { id: string; name: string }[];
  conflictingPorts: string[];
}

// Return type for the hook
export interface UseWorkflowConflictsReturn {
  /** Map of workflow ID to conflict info */
  conflicts: Record<string, WorkflowConflictInfo>;
  /** Whether we're currently loading conflict data */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refresh conflict data */
  refresh: () => Promise<void>;
}

/**
 * Hook to check for conflicts among active workflows.
 * 
 * @example
 * ```tsx
 * const { conflicts, loading } = useWorkflowConflicts();
 * 
 * // Check if a specific workflow has conflicts
 * const hasConflict = conflicts[workflowId]?.hasConflict;
 * const conflictingWorkflows = conflicts[workflowId]?.conflictingWorkflows;
 * ```
 */
export function useWorkflowConflicts(): UseWorkflowConflictsReturn {
  const [conflicts, setConflicts] = useState<Record<string, WorkflowConflictInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchConflicts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setConflicts({});
        setLoading(false);
        return;
      }

      const response = await fetch("/api/workflows/conflicts", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setConflicts(data.conflicts || {});
    } catch (err) {
      console.error("[useWorkflowConflicts] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setConflicts({});
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  return {
    conflicts,
    loading,
    error,
    refresh: fetchConflicts,
  };
}

export default useWorkflowConflicts;
