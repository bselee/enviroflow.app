"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type {
  AnalyticsData,
  DateRange,
  SensorTrendPoint,
  WorkflowStat,
  ExecutionBreakdown,
  RoomCompliance,
  UseAnalyticsOptions,
} from "@/types";

/**
 * Hook return type
 */
interface UseAnalyticsReturn {
  data: AnalyticsData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Default date range: last 7 days
function getDefaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return { start, end };
}

/**
 * useAnalytics Hook
 *
 * Fetches and aggregates analytics data from Supabase for the EnviroFlow dashboard.
 * Supports date range filtering, room/controller filtering, and auto-refresh.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useAnalytics({
 *   dateRange: { start: new Date('2024-01-01'), end: new Date() },
 *   roomId: 'room-123',
 * });
 * ```
 */
export function useAnalytics(options: UseAnalyticsOptions = {}): UseAnalyticsReturn {
  const {
    dateRange = getDefaultDateRange(),
    roomId,
    controllerId,
    userId,
    refreshInterval = 0,
  } = options;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize date strings to prevent unnecessary re-fetches
  const dateRangeKey = useMemo(
    () => `${dateRange.start.toISOString()}-${dateRange.end.toISOString()}`,
    [dateRange.start, dateRange.end]
  );

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const startDate = dateRange.start.toISOString();
      const endDate = dateRange.end.toISOString();
      const daysDiff = Math.ceil(
        (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Fetch all required data in parallel for performance
      const [
        activityLogsResult,
        workflowsResult,
        controllersResult,
        sensorReadingsResult,
        roomsResult,
      ] = await Promise.all([
        // Activity logs for execution stats
        supabase
          .from("activity_logs")
          .select("id, workflow_id, room_id, action_type, action_data, result, timestamp")
          .gte("timestamp", startDate)
          .lte("timestamp", endDate)
          .order("timestamp", { ascending: false }),

        // Workflows for names and active count
        supabase
          .from("workflows")
          .select("id, name, is_active, last_run, run_count"),

        // Controllers for uptime calculation
        supabase.from("controllers").select("id, status, room_id"),

        // Sensor readings for trends and compliance
        supabase
          .from("sensor_readings")
          .select("controller_id, sensor_type, value, unit, recorded_at")
          .gte("recorded_at", startDate)
          .lte("recorded_at", endDate)
          .order("recorded_at", { ascending: true }),

        // Rooms for compliance data
        supabase.from("rooms").select("id, name, settings"),
      ]);

      // Handle errors from any query
      if (activityLogsResult.error) throw activityLogsResult.error;
      if (workflowsResult.error) throw workflowsResult.error;
      if (controllersResult.error) throw controllersResult.error;
      if (sensorReadingsResult.error) throw sensorReadingsResult.error;
      if (roomsResult.error) throw roomsResult.error;

      const activityLogs = activityLogsResult.data || [];
      const workflows = workflowsResult.data || [];
      const controllers = controllersResult.data || [];
      const sensorReadings = sensorReadingsResult.data || [];
      const rooms = roomsResult.data || [];

      // Apply room/controller filters if specified
      let filteredLogs = activityLogs;
      let filteredReadings = sensorReadings;

      if (roomId) {
        filteredLogs = filteredLogs.filter((log) => log.room_id === roomId);
        const roomControllers = controllers
          .filter((c) => c.room_id === roomId)
          .map((c) => c.id);
        filteredReadings = filteredReadings.filter((r) =>
          roomControllers.includes(r.controller_id)
        );
      }

      if (controllerId) {
        filteredLogs = filteredLogs.filter((log) =>
          log.action_data?.controller_id === controllerId
        );
        filteredReadings = filteredReadings.filter(
          (r) => r.controller_id === controllerId
        );
      }

      // Calculate execution rate (executions per day)
      const totalExecutions = filteredLogs.filter(
        (log) => log.action_type === "workflow_execution"
      ).length;
      const executionRate = daysDiff > 0 ? totalExecutions / daysDiff : totalExecutions;

      // Calculate today's executions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayExecutions = filteredLogs.filter((log) => {
        const logDate = new Date(log.timestamp);
        return (
          logDate >= today && log.action_type === "workflow_execution"
        );
      }).length;

      // Calculate execution breakdown
      const executionCounts = {
        success: 0,
        failed: 0,
        skipped: 0,
        dry_run: 0,
      };

      filteredLogs.forEach((log) => {
        if (log.result && log.result in executionCounts) {
          executionCounts[log.result as keyof typeof executionCounts]++;
        }
      });

      const totalResults = Object.values(executionCounts).reduce((a, b) => a + b, 0);
      const executionBreakdown: ExecutionBreakdown[] = Object.entries(executionCounts).map(
        ([status, count]) => ({
          status: status as ExecutionBreakdown["status"],
          count,
          percentage: totalResults > 0 ? (count / totalResults) * 100 : 0,
        })
      );

      // Calculate target compliance from sensor readings
      // This requires comparing readings against room target settings
      const targetCompliance = calculateTargetCompliance(
        filteredReadings,
        rooms,
        controllers
      );

      // Calculate automation value (estimated hours saved)
      // Assumption: Each automation execution saves ~2 minutes of manual work
      const minutesSaved = totalExecutions * 2;
      const automationValue = minutesSaved / 60;

      // Calculate uptime (% of controllers online)
      const relevantControllers = roomId
        ? controllers.filter((c) => c.room_id === roomId)
        : controllerId
        ? controllers.filter((c) => c.id === controllerId)
        : controllers;
      const onlineCount = relevantControllers.filter((c) => c.status === 'online').length;
      const uptime =
        relevantControllers.length > 0
          ? (onlineCount / relevantControllers.length) * 100
          : 100;

      // Generate sensor trends (daily aggregates)
      const sensorTrends = aggregateSensorTrends(filteredReadings, dateRange);

      // Calculate workflow stats
      const workflowStats = calculateWorkflowStats(workflows, filteredLogs);

      // Calculate per-room compliance
      const roomCompliance = calculateRoomCompliance(
        rooms,
        filteredReadings,
        controllers
      );

      // Active workflows count
      const activeWorkflows = workflows.filter((w) => w.is_active).length;

      setData({
        executionRate: Math.round(executionRate * 10) / 10,
        targetCompliance: Math.round(targetCompliance * 10) / 10,
        automationValue: Math.round(automationValue * 10) / 10,
        uptime: Math.round(uptime * 10) / 10,
        sensorTrends,
        workflowStats,
        executionBreakdown,
        roomCompliance,
        totalExecutions,
        todayExecutions,
        activeWorkflows,
      });
    } catch (err) {
      console.error("Analytics fetch error:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch analytics"));
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, roomId, controllerId]);

  // Initial fetch and refresh interval
  useEffect(() => {
    fetchAnalytics();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchAnalytics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchAnalytics, refreshInterval]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchAnalytics,
  };
}

/**
 * Calculate target compliance percentage based on sensor readings vs room targets.
 * Returns the percentage of readings that were within target ranges.
 */
function calculateTargetCompliance(
  readings: Array<{
    controller_id: string;
    sensor_type: string;
    value: number;
    recorded_at: string;
  }>,
  rooms: Array<{ id: string; settings: Record<string, unknown> | null }>,
  controllers: Array<{ id: string; room_id: string | null }>
): number {
  if (readings.length === 0) return 100;

  // Create a map of controller_id to room settings
  const controllerRoomMap = new Map<string, Record<string, unknown>>();
  controllers.forEach((controller) => {
    if (controller.room_id) {
      const room = rooms.find((r) => r.id === controller.room_id);
      if (room?.settings) {
        controllerRoomMap.set(controller.id, room.settings);
      }
    }
  });

  let inRangeCount = 0;
  let totalChecked = 0;

  readings.forEach((reading) => {
    const settings = controllerRoomMap.get(reading.controller_id);
    if (!settings) return;

    // Extract target ranges from settings
    const targets = extractTargets(settings, reading.sensor_type);
    if (!targets) return;

    totalChecked++;
    if (reading.value >= targets.min && reading.value <= targets.max) {
      inRangeCount++;
    }
  });

  return totalChecked > 0 ? (inRangeCount / totalChecked) * 100 : 100;
}

/**
 * Extract min/max targets for a sensor type from room settings.
 */
function extractTargets(
  settings: Record<string, unknown>,
  sensorType: string
): { min: number; max: number } | null {
  // Handle both flat and nested settings structures
  const minKey = `target_${sensorType}_min`;
  const maxKey = `target_${sensorType}_max`;

  // Type-safe access with validation
  const min = typeof settings[minKey] === "number" ? settings[minKey] : null;
  const max = typeof settings[maxKey] === "number" ? settings[maxKey] : null;

  // Default ranges if not specified
  const defaults: Record<string, { min: number; max: number }> = {
    temperature: { min: 65, max: 85 },
    humidity: { min: 40, max: 70 },
    vpd: { min: 0.8, max: 1.4 },
    co2: { min: 400, max: 1500 },
  };

  if (min !== null && max !== null) {
    return { min, max };
  }

  return defaults[sensorType] || null;
}

/**
 * Aggregate sensor readings into daily data points for trend charts.
 */
function aggregateSensorTrends(
  readings: Array<{
    sensor_type: string;
    value: number;
    recorded_at: string;
  }>,
  dateRange: DateRange
): SensorTrendPoint[] {
  const dailyData = new Map<
    string,
    { temps: number[]; humidities: number[]; vpds: number[] }
  >();

  // Initialize all dates in range
  const current = new Date(dateRange.start);
  while (current <= dateRange.end) {
    const dateKey = current.toISOString().split("T")[0];
    dailyData.set(dateKey, { temps: [], humidities: [], vpds: [] });
    current.setDate(current.getDate() + 1);
  }

  // Group readings by date and type
  readings.forEach((reading) => {
    const dateKey = reading.recorded_at.split("T")[0];
    const dayData = dailyData.get(dateKey);
    if (!dayData) return;

    switch (reading.sensor_type) {
      case "temperature":
        dayData.temps.push(reading.value);
        break;
      case "humidity":
        dayData.humidities.push(reading.value);
        break;
      case "vpd":
        dayData.vpds.push(reading.value);
        break;
    }
  });

  // Calculate daily averages
  const trends: SensorTrendPoint[] = [];
  dailyData.forEach((data, date) => {
    trends.push({
      date,
      temp: data.temps.length > 0
        ? Math.round(average(data.temps) * 10) / 10
        : null,
      humidity: data.humidities.length > 0
        ? Math.round(average(data.humidities) * 10) / 10
        : null,
      vpd: data.vpds.length > 0
        ? Math.round(average(data.vpds) * 100) / 100
        : null,
    });
  });

  return trends.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate per-workflow execution statistics.
 */
function calculateWorkflowStats(
  workflows: Array<{
    id: string;
    name: string;
    is_active: boolean;
    last_run: string | null;
    run_count: number;
  }>,
  logs: Array<{
    workflow_id: string | null;
    result: string | null;
  }>
): WorkflowStat[] {
  return workflows.map((workflow) => {
    const workflowLogs = logs.filter((log) => log.workflow_id === workflow.id);
    const successCount = workflowLogs.filter(
      (log) => log.result === "success"
    ).length;
    const totalCount = workflowLogs.length;

    return {
      id: workflow.id,
      name: workflow.name,
      executions: totalCount,
      successRate: totalCount > 0 ? (successCount / totalCount) * 100 : 100,
      lastRun: workflow.last_run,
    };
  });
}

/**
 * Calculate per-room environmental compliance.
 */
function calculateRoomCompliance(
  rooms: Array<{ id: string; name: string; settings: Record<string, unknown> | null }>,
  readings: Array<{
    controller_id: string;
    sensor_type: string;
    value: number;
  }>,
  controllers: Array<{ id: string; room_id: string | null }>
): RoomCompliance[] {
  return rooms.map((room) => {
    const roomControllers = controllers
      .filter((c) => c.room_id === room.id)
      .map((c) => c.id);

    const roomReadings = readings.filter((r) =>
      roomControllers.includes(r.controller_id)
    );

    if (roomReadings.length === 0 || !room.settings) {
      return {
        roomId: room.id,
        roomName: room.name,
        compliance: 100,
        tempCompliance: 100,
        humidityCompliance: 100,
        vpdCompliance: 100,
      };
    }

    const tempCompliance = calculateTypeCompliance(
      roomReadings.filter((r) => r.sensor_type === "temperature"),
      room.settings,
      "temperature"
    );
    const humidityCompliance = calculateTypeCompliance(
      roomReadings.filter((r) => r.sensor_type === "humidity"),
      room.settings,
      "humidity"
    );
    const vpdCompliance = calculateTypeCompliance(
      roomReadings.filter((r) => r.sensor_type === "vpd"),
      room.settings,
      "vpd"
    );

    // Overall compliance is the average of all types
    const compliance =
      (tempCompliance + humidityCompliance + vpdCompliance) / 3;

    return {
      roomId: room.id,
      roomName: room.name,
      compliance: Math.round(compliance * 10) / 10,
      tempCompliance: Math.round(tempCompliance * 10) / 10,
      humidityCompliance: Math.round(humidityCompliance * 10) / 10,
      vpdCompliance: Math.round(vpdCompliance * 10) / 10,
    };
  });
}

/**
 * Calculate compliance for a specific sensor type.
 */
function calculateTypeCompliance(
  readings: Array<{ value: number }>,
  settings: Record<string, unknown>,
  sensorType: string
): number {
  if (readings.length === 0) return 100;

  const targets = extractTargets(settings, sensorType);
  if (!targets) return 100;

  const inRangeCount = readings.filter(
    (r) => r.value >= targets.min && r.value <= targets.max
  ).length;

  return (inRangeCount / readings.length) * 100;
}

/**
 * Calculate the average of an array of numbers.
 */
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

// Re-export types from @/types for backwards compatibility
export type {
  AnalyticsData,
  SensorTrendPoint,
  WorkflowStat,
  ExecutionBreakdown,
  RoomCompliance,
  DateRange,
  UseAnalyticsOptions,
} from "@/types";
