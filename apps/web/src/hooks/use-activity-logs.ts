"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type {
  ActivityLog,
  ActivityLogResult,
  FormattedActivityLog,
  ActivityLogsOptions,
} from "@/types";

/**
 * Hook return type.
 */
interface UseActivityLogsReturn {
  logs: ActivityLog[];
  formattedLogs: FormattedActivityLog[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Get logs filtered by room */
  getLogsForRoom: (roomId: string) => FormattedActivityLog[];
  /** Get logs filtered by workflow */
  getLogsForWorkflow: (workflowId: string) => FormattedActivityLog[];
}

/**
 * Formats a timestamp into a relative time string.
 * Examples: "Just now", "2 min ago", "1 hour ago", "Yesterday"
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return then.toLocaleDateString();
  }
}

/**
 * Determines the log type based on result and action type.
 * Used for color-coding log entries in the UI.
 */
function determineLogType(log: ActivityLog): FormattedActivityLog["type"] {
  if (log.result === "failed" || log.error_message) {
    return "error";
  }
  if (log.result === "success") {
    return "success";
  }
  if (log.result === "skipped" || log.result === "dry_run") {
    return "warning";
  }
  return "info";
}

/**
 * Generates a human-readable message from the activity log.
 * Parses action_data to create meaningful descriptions.
 */
function generateLogMessage(log: ActivityLog): string {
  const actionData = log.action_data || {};
  const actionType = log.action_type;

  // Common action type patterns
  switch (actionType) {
    case "workflow_executed":
      return `Workflow "${log.workflow?.name || "Unknown"}" executed`;
    case "device_control":
      return `Device control: ${actionData.command || "Unknown command"}`;
    case "sensor_read":
      return `Sensor data collected`;
    case "vpd_adjustment":
      return `VPD adjusted to ${actionData.target_vpd || "optimal"} kPa`;
    case "fan_speed_change":
      return `Fan speed changed to ${actionData.speed || actionData.value || "?"}%`;
    case "light_level_change":
      return `Light level adjusted to ${actionData.level || actionData.value || "?"}%`;
    case "temperature_alert":
      return `Temperature alert: ${actionData.current || "?"}°F (target: ${actionData.target || "?"}°F)`;
    case "humidity_alert":
      return `Humidity alert: ${actionData.current || "?"}% (target: ${actionData.target || "?"}%)`;
    case "connection_lost":
      return `Controller connection lost`;
    case "connection_restored":
      return `Controller connection restored`;
    case "schedule_triggered":
      return `Schedule triggered: ${actionData.schedule_name || "Unnamed schedule"}`;
    case "dimmer_adjusted":
      return `Dimmer adjusted from ${actionData.from || 0}% to ${actionData.to || 100}%`;
    default:
      // Fallback to action type with formatting
      return actionType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/**
 * Custom hook for managing activity logs with Supabase.
 *
 * Fetches activity log data and provides utilities for filtering
 * and formatting logs for display in the UI.
 *
 * @param options - Configuration options for fetching logs
 *
 * @example
 * ```tsx
 * const { formattedLogs, isLoading, refetch } = useActivityLogs({
 *   limit: 50,
 *   timeRangeHours: 12,
 * });
 *
 * return (
 *   <ul>
 *     {formattedLogs.map(log => (
 *       <li key={log.id}>{log.message} - {log.relativeTime}</li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useActivityLogs(options: ActivityLogsOptions = {}): UseActivityLogsReturn {
  const {
    roomId,
    workflowId,
    result,
    limit = 50,
    timeRangeHours = 24,
  } = options;

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to prevent state updates after unmount
  const isMounted = useRef(true);

  /**
   * Fetches activity logs based on the provided options.
   * Includes joins for workflow, room, and controller names.
   */
  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Calculate time range
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - timeRangeHours);

      let query = supabase
        .from("activity_logs")
        .select(`
          *,
          workflow:workflows(name),
          room:rooms(name),
          controller:controllers(name)
        `)
        .gte("timestamp", startTime.toISOString())
        .order("timestamp", { ascending: false })
        .limit(limit);

      // Apply filters
      if (roomId) {
        query = query.eq("room_id", roomId);
      }
      if (workflowId) {
        query = query.eq("workflow_id", workflowId);
      }
      if (result) {
        query = query.eq("result", result);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (isMounted.current) {
        setLogs(data || []);
      }
    } catch (err) {
      if (!isMounted.current) return;
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch activity logs";
      setError(errorMessage);
      console.error("useActivityLogs fetch error:", err);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [roomId, workflowId, result, limit, timeRangeHours]);

  /**
   * Transforms raw logs into formatted display objects.
   * Memoized to prevent unnecessary recalculations.
   */
  const formattedLogs: FormattedActivityLog[] = logs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    relativeTime: formatRelativeTime(log.timestamp),
    type: determineLogType(log),
    message: generateLogMessage(log),
    workflowName: log.workflow?.name || null,
    roomName: log.room?.name || null,
    controllerName: log.controller?.name || null,
    actionType: log.action_type,
    result: log.result,
    errorMessage: log.error_message,
  }));

  /**
   * Filters formatted logs by room ID.
   */
  const getLogsForRoom = useCallback((filterRoomId: string): FormattedActivityLog[] => {
    return formattedLogs.filter(
      (_, index) => logs[index]?.room_id === filterRoomId
    );
  }, [formattedLogs, logs]);

  /**
   * Filters formatted logs by workflow ID.
   */
  const getLogsForWorkflow = useCallback((filterWorkflowId: string): FormattedActivityLog[] => {
    return formattedLogs.filter(
      (_, index) => logs[index]?.workflow_id === filterWorkflowId
    );
  }, [formattedLogs, logs]);

  // Initial fetch on mount or when options change
  useEffect(() => {
    isMounted.current = true;
    fetchLogs();

    return () => {
      isMounted.current = false;
    };
  }, [fetchLogs]);

  // Set up real-time subscription for activity log changes
  useEffect(() => {
    const channel = supabase
      .channel("activity_logs_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
        },
        () => {
          // Refetch to get the new log with relations
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  return {
    logs,
    formattedLogs,
    isLoading,
    error,
    refetch: fetchLogs,
    getLogsForRoom,
    getLogsForWorkflow,
  };
}
