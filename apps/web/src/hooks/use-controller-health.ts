"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Controller,
  ControllerHealth,
  HealthScore,
  HealthScoreWithController,
} from "@/types";

/**
 * Options for useControllerHealth hook
 */
interface UseControllerHealthOptions {
  /** Controller ID to fetch health for (if fetching single controller) */
  controllerId?: string;
  /** Whether to enable realtime updates */
  realtime?: boolean;
  /** Polling interval in milliseconds (0 to disable) */
  pollingInterval?: number;
}

/**
 * Hook return type with health data and operations
 */
interface UseControllerHealthReturn {
  /** Health scores mapped by controller ID */
  healthScores: Map<string, HealthScore>;
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Refresh health scores */
  refetch: () => Promise<void>;
  /** Get health score for a specific controller */
  getHealthScore: (controllerId: string) => HealthScore | undefined;
  /** Get all health scores with controller names */
  getAllHealthScores: () => HealthScoreWithController[];
}

/**
 * Custom hook for fetching and managing controller health scores.
 *
 * Provides real-time health score data with automatic updates via
 * Supabase subscriptions. Supports both single-controller and
 * multi-controller modes.
 *
 * @example
 * ```tsx
 * // Fetch all health scores
 * const { healthScores, loading } = useControllerHealth();
 *
 * // Fetch health for specific controller
 * const { healthScores, getHealthScore } = useControllerHealth({
 *   controllerId: "123",
 *   realtime: true
 * });
 *
 * const score = getHealthScore("123");
 * ```
 */
export function useControllerHealth(
  options: UseControllerHealthOptions = {}
): UseControllerHealthReturn {
  const { controllerId, realtime = true, pollingInterval = 0 } = options;

  const [healthScores, setHealthScores] = useState<Map<string, HealthScore>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  // Fetch latest health scores
  const fetchHealthScores = useCallback(async () => {
    try {
      let query = supabase
        .from("controller_health")
        .select("*")
        .order("calculated_at", { ascending: false });

      // If specific controller requested, filter for it
      if (controllerId) {
        query = query.eq("controller_id", controllerId).limit(1);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      if (!isMounted.current) return;

      if (data) {
        // Get the latest score for each controller
        const latestScores = new Map<string, HealthScore>();

        // Group by controller_id and take the first (latest) for each
        const controllerGroups = new Map<string, ControllerHealth>();
        data.forEach((record) => {
          const existing = controllerGroups.get(record.controller_id);
          if (
            !existing ||
            new Date(record.calculated_at) >
              new Date(existing.calculated_at)
          ) {
            controllerGroups.set(record.controller_id, record);
          }
        });

        // Convert to HealthScore format
        controllerGroups.forEach((record, controllerId) => {
          latestScores.set(controllerId, {
            score: record.score,
            metrics: record.metrics_snapshot,
            calculatedAt: record.calculated_at,
          });
        });

        setHealthScores(latestScores);
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching health scores:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch health scores");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [controllerId]);

  // Initial fetch
  useEffect(() => {
    fetchHealthScores();
  }, [fetchHealthScores]);

  // Set up realtime subscription
  useEffect(() => {
    if (!realtime) return;

    const channel = supabase
      .channel("controller_health_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "controller_health",
          ...(controllerId ? { filter: `controller_id=eq.${controllerId}` } : {}),
        },
        (payload) => {
          if (!isMounted.current) return;

          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const record = payload.new as ControllerHealth;

            setHealthScores((prev) => {
              const updated = new Map(prev);

              // Check if this is newer than existing
              const existing = updated.get(record.controller_id);
              if (
                !existing ||
                new Date(record.calculated_at) >
                  new Date(existing.calculatedAt)
              ) {
                updated.set(record.controller_id, {
                  score: record.score,
                  metrics: record.metrics_snapshot,
                  calculatedAt: record.calculated_at,
                });
              }

              return updated;
            });
          } else if (payload.eventType === "DELETE") {
            const record = payload.old as ControllerHealth;

            setHealthScores((prev) => {
              const updated = new Map(prev);
              updated.delete(record.controller_id);
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [realtime, controllerId]);

  // Set up polling if enabled
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const interval = setInterval(() => {
      fetchHealthScores();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingInterval, fetchHealthScores]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Get health score for a specific controller
  const getHealthScore = useCallback(
    (controllerId: string): HealthScore | undefined => {
      return healthScores.get(controllerId);
    },
    [healthScores]
  );

  // Get all health scores with controller names
  const getAllHealthScores = useCallback((): HealthScoreWithController[] => {
    const scores: HealthScoreWithController[] = [];

    healthScores.forEach((score, controllerId) => {
      scores.push({
        ...score,
        controllerId,
        controllerName: "", // Will need to join with controllers table if name needed
      });
    });

    return scores.sort((a, b) => a.score - b.score); // Sort by score (worst first)
  }, [healthScores]);

  return {
    healthScores,
    loading,
    error,
    refetch: fetchHealthScores,
    getHealthScore,
    getAllHealthScores,
  };
}

/**
 * Hook for fetching health scores with controller details joined.
 *
 * This variant joins controller_health with controllers table to
 * provide complete information including controller names.
 */
export function useControllerHealthWithDetails(): {
  healthScores: HealthScoreWithController[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [healthScores, setHealthScores] = useState<HealthScoreWithController[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);

  const fetchHealthScoresWithDetails = useCallback(async () => {
    try {
      // Fetch latest health score for each controller
      // Using a subquery approach since Supabase doesn't support window functions directly
      const { data: healthData, error: healthError } = await supabase
        .from("controller_health")
        .select("*")
        .order("calculated_at", { ascending: false });

      if (healthError) throw healthError;

      // Get controllers
      const { data: controllers, error: controllersError } = await supabase
        .from("controllers")
        .select("id, name");

      if (controllersError) throw controllersError;

      if (!isMounted.current) return;

      // Create a map of controller names
      const controllerNames = new Map<string, string>();
      controllers?.forEach((c) => controllerNames.set(c.id, c.name));

      // Get latest health score for each controller
      const latestScores = new Map<string, ControllerHealth>();
      healthData?.forEach((record) => {
        const existing = latestScores.get(record.controller_id);
        if (
          !existing ||
          new Date(record.calculated_at) > new Date(existing.calculated_at)
        ) {
          latestScores.set(record.controller_id, record);
        }
      });

      // Convert to HealthScoreWithController format
      const scores: HealthScoreWithController[] = [];
      latestScores.forEach((record, controllerId) => {
        scores.push({
          score: record.score,
          metrics: record.metrics_snapshot,
          calculatedAt: record.calculated_at,
          controllerId,
          controllerName: controllerNames.get(controllerId) || "Unknown",
        });
      });

      // Sort by score (worst first for priority)
      scores.sort((a, b) => a.score - b.score);

      setHealthScores(scores);
      setError(null);
    } catch (err) {
      console.error("Error fetching health scores with details:", err);
      if (isMounted.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch health scores with details"
        );
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchHealthScoresWithDetails();
  }, [fetchHealthScoresWithDetails]);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("controller_health_with_details")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "controller_health",
        },
        () => {
          // Refetch on any change
          fetchHealthScoresWithDetails();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchHealthScoresWithDetails]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    healthScores,
    loading,
    error,
    refetch: fetchHealthScoresWithDetails,
  };
}
