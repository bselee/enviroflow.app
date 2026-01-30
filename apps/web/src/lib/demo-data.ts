"use client";

/**
 * Demo Data Generation for EnviroFlow Dashboard
 *
 * Provides realistic synthetic environmental data for demo mode when no real
 * controllers are connected. This allows users to experience the dashboard
 * functionality before connecting their hardware.
 *
 * Data Patterns:
 * - Temperature: sine wave 72-82F peaking at noon (light hours)
 * - Humidity: inverse correlation to temperature 52-65%
 * - VPD: calculated from temp/humidity with realistic noise
 * - Update cycle: 3 seconds (accelerated from 5s production)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { calculateVPD } from "./vpd-utils";
import type {
  Room,
  Controller,
  ControllerCapabilities,
  RoomSettings,
  TimeSeriesPoint,
} from "@/types";
import type { RoomSummary, TrendData, LatestSensorData } from "@/hooks/use-dashboard-data";
import type { TimeSeriesData } from "@/components/dashboard/IntelligentTimeline";

// =============================================================================
// Constants
// =============================================================================

/** Demo mode update interval in milliseconds (3 seconds for accelerated demo) */
const DEMO_UPDATE_INTERVAL_MS = 3000;

/** Number of hours of historical data to generate */
const HISTORICAL_DATA_HOURS = 24;

/** Temperature range in Fahrenheit */
const TEMP_MIN_F = 72;
const TEMP_MAX_F = 82;
const TEMP_AMPLITUDE = (TEMP_MAX_F - TEMP_MIN_F) / 2;
const TEMP_MIDPOINT = (TEMP_MAX_F + TEMP_MIN_F) / 2;

/** Humidity range in percent (inverse correlation to temperature) */
const HUMIDITY_MIN = 52;
const HUMIDITY_MAX = 65;

/** Noise levels for realistic variance */
const TEMP_NOISE = 1.0; // +/- 1F
const HUMIDITY_NOISE = 2.0; // +/- 2%
const VPD_NOISE = 0.1; // +/- 0.1 kPa

// =============================================================================
// Demo Room Definitions
// =============================================================================

/**
 * Demo room configurations with unique names and characteristics.
 * Each room has slightly different baseline values for variety.
 */
interface DemoRoomConfig {
  name: string;
  description: string;
  controllerCount: number;
  tempOffset: number; // Offset from base temperature curve
  humidityOffset: number; // Offset from base humidity curve
  currentStage: string;
}

const DEMO_ROOM_CONFIGS: DemoRoomConfig[] = [
  {
    name: "Veg Room A",
    description: "Main vegetative growth room",
    controllerCount: 2,
    tempOffset: 0,
    humidityOffset: 0,
    currentStage: "vegetative",
  },
  {
    name: "Flower Room 1",
    description: "Primary flowering chamber",
    controllerCount: 1,
    tempOffset: -2, // Slightly cooler
    humidityOffset: -3, // Slightly drier
    currentStage: "flowering",
  },
  {
    name: "Clone Tent",
    description: "Propagation and cloning area",
    controllerCount: 1,
    tempOffset: 2, // Warmer
    humidityOffset: 5, // More humid
    currentStage: "seedling",
  },
];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a deterministic UUID-like string from a seed.
 * Used to create consistent IDs for demo entities.
 *
 * @param seed - Seed string for ID generation
 * @returns UUID-formatted string
 */
function generateDemoId(seed: string): string {
  // Simple hash function for deterministic ID generation
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `demo-${hex.slice(0, 4)}-${hex.slice(4, 8)}-0000-000000000000`;
}

/**
 * Calculates temperature at a given hour using a sine wave.
 * Peak temperature occurs at noon (hour 12).
 *
 * @param hour - Hour of day (0-23)
 * @param offset - Temperature offset for room variation
 * @returns Temperature in Fahrenheit
 */
function calculateBaseTemperature(hour: number, offset: number = 0): number {
  // Sine wave peaks at noon (hour 12)
  // Phase shift: sin(x - pi/2) peaks at x = pi, so we shift to peak at hour 12
  const hourAngle = ((hour - 6) / 24) * 2 * Math.PI;
  const baseTemp = TEMP_MIDPOINT + TEMP_AMPLITUDE * Math.sin(hourAngle);
  return baseTemp + offset;
}

/**
 * Calculates humidity based on inverse correlation with temperature.
 * As temperature rises, humidity falls (and vice versa).
 *
 * @param temperature - Current temperature in Fahrenheit
 * @param offset - Humidity offset for room variation
 * @returns Humidity as percentage (0-100)
 */
function calculateBaseHumidity(temperature: number, offset: number = 0): number {
  // Linear inverse relationship: as temp increases, humidity decreases
  const normalizedTemp = (temperature - TEMP_MIN_F) / (TEMP_MAX_F - TEMP_MIN_F);
  const humidity = HUMIDITY_MAX - normalizedTemp * (HUMIDITY_MAX - HUMIDITY_MIN);
  return Math.max(HUMIDITY_MIN, Math.min(HUMIDITY_MAX, humidity + offset));
}

// VPD calculation is now imported from vpd-utils.ts for consistency

/**
 * Adds realistic random noise to a value.
 *
 * @param value - Base value
 * @param maxNoise - Maximum noise amplitude (+/-)
 * @returns Value with added noise
 */
function addNoise(value: number, maxNoise: number): number {
  const noise = (Math.random() - 0.5) * 2 * maxNoise;
  return value + noise;
}

/**
 * Gets the current simulated hour for demo data.
 * Uses actual time but can be accelerated for demo purposes.
 *
 * @returns Current hour (0-23)
 */
function getCurrentSimulatedHour(): number {
  return new Date().getHours();
}

// =============================================================================
// Demo Data Generation
// =============================================================================

/**
 * Generates demo rooms with controllers for the dashboard.
 * Creates consistent IDs for each room and associated controllers.
 *
 * @returns Array of demo Room objects
 */
export function generateDemoRooms(): Room[] {
  const now = new Date().toISOString();
  const userId = "demo-user-0000-0000-000000000000";

  return DEMO_ROOM_CONFIGS.map((config, index) => {
    const roomId = generateDemoId(`room-${index}-${config.name}`);

    const settings: RoomSettings = {
      target_temp_min: 70,
      target_temp_max: 85,
      target_humidity_min: 50,
      target_humidity_max: 70,
      target_vpd_min: 0.8,
      target_vpd_max: 1.2,
    };

    return {
      id: roomId,
      user_id: userId,
      name: config.name,
      description: config.description,
      settings,
      current_stage: config.currentStage,
      stage_started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      latitude: null,
      longitude: null,
      timezone: "America/Los_Angeles",
      created_at: now,
      updated_at: now,
    };
  });
}

/**
 * Generates demo controllers for a given room.
 *
 * @param roomId - ID of the room to assign controllers to
 * @param roomIndex - Index of the room in the demo rooms array
 * @returns Array of demo Controller objects
 */
export function generateDemoControllers(roomId: string, roomIndex: number): Controller[] {
  const config = DEMO_ROOM_CONFIGS[roomIndex];
  if (!config) return [];

  const now = new Date().toISOString();
  const userId = "demo-user-0000-0000-000000000000";

  const controllers: Controller[] = [];

  for (let i = 0; i < config.controllerCount; i++) {
    const controllerId = generateDemoId(`controller-${roomIndex}-${i}`);

    const capabilities: ControllerCapabilities = {
      sensors: ["temperature", "humidity"],
      devices: ["fan", "light"],
      supportsDimming: true,
      supportsScheduling: true,
    };

    controllers.push({
      id: controllerId,
      user_id: userId,
      brand: "ac_infinity",
      controller_id: `DEMO-${roomIndex}-${i}`,
      name: `Demo Controller ${i + 1}`,
      capabilities,
      status: "online",
      last_seen: now,
      last_error: null,
      firmware_version: "2.4.1",
      model: "Controller 69 Pro",
      room_id: roomId,
      created_at: now,
      updated_at: now,
    });
  }

  return controllers;
}

/**
 * Generates current sensor data for a demo room.
 *
 * @param roomIndex - Index of the room for offset calculation
 * @returns LatestSensorData with current values
 */
export function generateCurrentSensorData(roomIndex: number): LatestSensorData {
  const config = DEMO_ROOM_CONFIGS[roomIndex];
  if (!config) {
    return { temperature: null, humidity: null, vpd: null };
  }

  const hour = getCurrentSimulatedHour();
  const baseTemp = calculateBaseTemperature(hour, config.tempOffset);
  const temperature = Math.round(addNoise(baseTemp, TEMP_NOISE) * 10) / 10;

  const baseHumidity = calculateBaseHumidity(baseTemp, config.humidityOffset);
  const humidity = Math.round(addNoise(baseHumidity, HUMIDITY_NOISE));

  const vpd = Math.round(addNoise(calculateVPD(temperature, humidity) ?? 1.0, VPD_NOISE) * 100) / 100;

  return { temperature, humidity, vpd };
}

/**
 * Generates trend data comparing current value to 1 hour ago.
 *
 * @param roomIndex - Index of the room
 * @returns Trend data for temperature, humidity, and VPD
 */
export function generateTrendData(roomIndex: number): {
  temperature?: TrendData;
  humidity?: TrendData;
  vpd?: TrendData;
} {
  const config = DEMO_ROOM_CONFIGS[roomIndex];
  if (!config) return {};

  const currentHour = getCurrentSimulatedHour();
  const pastHour = (currentHour - 1 + 24) % 24;

  const currentTemp = calculateBaseTemperature(currentHour, config.tempOffset);
  const pastTemp = calculateBaseTemperature(pastHour, config.tempOffset);

  const currentHumidity = calculateBaseHumidity(currentTemp, config.humidityOffset);
  const pastHumidity = calculateBaseHumidity(pastTemp, config.humidityOffset);

  const currentVpd = calculateVPD(currentTemp, currentHumidity) ?? 1.0;
  const pastVpd = calculateVPD(pastTemp, pastHumidity) ?? 1.0;

  return {
    temperature: {
      delta: Math.round((currentTemp - pastTemp) * 10) / 10,
      period: "1h ago",
    },
    humidity: {
      delta: Math.round(currentHumidity - pastHumidity),
      period: "1h ago",
    },
    vpd: {
      delta: Math.round((currentVpd - pastVpd) * 100) / 100,
      period: "1h ago",
    },
  };
}

/**
 * Generates 24 hours of historical sensor data for charts.
 *
 * @param roomIndex - Index of the room for offset calculation
 * @returns Array of TimeSeriesPoint for temperature history
 */
export function generateTemperatureTimeSeries(roomIndex: number): TimeSeriesPoint[] {
  const config = DEMO_ROOM_CONFIGS[roomIndex];
  if (!config) return [];

  const now = new Date();
  const points: TimeSeriesPoint[] = [];

  // Generate points every 5 minutes for the last 24 hours
  for (let minutesAgo = HISTORICAL_DATA_HOURS * 60; minutesAgo >= 0; minutesAgo -= 5) {
    const timestamp = new Date(now.getTime() - minutesAgo * 60 * 1000);
    const hour = timestamp.getHours() + timestamp.getMinutes() / 60;

    const baseTemp = calculateBaseTemperature(hour, config.tempOffset);
    const value = Math.round(addNoise(baseTemp, TEMP_NOISE * 0.5) * 10) / 10;

    points.push({
      timestamp: timestamp.toISOString(),
      value,
    });
  }

  return points;
}

/**
 * Generates TimeSeriesData for the IntelligentTimeline component.
 * Includes temperature, humidity, and VPD data.
 *
 * @returns Array of TimeSeriesData points
 */
export function generateTimelineData(): TimeSeriesData[] {
  const now = new Date();
  const data: TimeSeriesData[] = [];

  // Aggregate data from all rooms, using first room's pattern as base
  const config = DEMO_ROOM_CONFIGS[0];
  if (!config) return [];

  // Generate points every 5 minutes for the last 24 hours
  for (let minutesAgo = HISTORICAL_DATA_HOURS * 60; minutesAgo >= 0; minutesAgo -= 5) {
    const timestamp = new Date(now.getTime() - minutesAgo * 60 * 1000);
    const hour = timestamp.getHours() + timestamp.getMinutes() / 60;

    const baseTemp = calculateBaseTemperature(hour, config.tempOffset);
    const temperature = Math.round(addNoise(baseTemp, TEMP_NOISE * 0.3) * 10) / 10;

    const baseHumidity = calculateBaseHumidity(baseTemp, config.humidityOffset);
    const humidity = Math.round(addNoise(baseHumidity, HUMIDITY_NOISE * 0.3));

    const vpd = Math.round((calculateVPD(temperature, humidity) ?? 1.0) * 100) / 100;

    data.push({
      timestamp: timestamp.toISOString(),
      temperature,
      humidity,
      vpd,
    });
  }

  return data;
}

/**
 * Generates historical VPD data for the VPD dial component.
 *
 * @returns Array of TimeSeriesPoint for VPD history
 */
export function generateHistoricalVpd(): TimeSeriesPoint[] {
  const now = new Date();
  const points: TimeSeriesPoint[] = [];
  const config = DEMO_ROOM_CONFIGS[0];

  if (!config) return [];

  // Generate points every 5 minutes for the last 24 hours
  for (let minutesAgo = HISTORICAL_DATA_HOURS * 60; minutesAgo >= 0; minutesAgo -= 5) {
    const timestamp = new Date(now.getTime() - minutesAgo * 60 * 1000);
    const hour = timestamp.getHours() + timestamp.getMinutes() / 60;

    const baseTemp = calculateBaseTemperature(hour, config.tempOffset);
    const baseHumidity = calculateBaseHumidity(baseTemp, config.humidityOffset);
    const vpd = calculateVPD(baseTemp, baseHumidity) ?? 1.0;

    points.push({
      timestamp: timestamp.toISOString(),
      value: Math.round(addNoise(vpd, VPD_NOISE * 0.3) * 100) / 100,
    });
  }

  return points;
}

// =============================================================================
// Demo Data Aggregation
// =============================================================================

/**
 * Generates complete room summaries for demo mode.
 * These match the RoomSummary interface used by the dashboard.
 *
 * @returns Array of RoomSummary objects with demo data
 */
export function generateDemoRoomSummaries(): RoomSummary[] {
  const rooms = generateDemoRooms();

  return rooms.map((room, index) => {
    const controllers = generateDemoControllers(room.id, index);
    const sensorData = generateCurrentSensorData(index);
    const trends = generateTrendData(index);
    const temperatureTimeSeries = generateTemperatureTimeSeries(index);

    return {
      room,
      controllers,
      onlineCount: controllers.length,
      offlineCount: 0,
      latestSensorData: sensorData,
      trends,
      hasStaleData: false,
      lastUpdateTimestamp: new Date().toISOString(),
      temperatureTimeSeries,
    };
  });
}

// =============================================================================
// Demo Data Update Hook
// =============================================================================

/**
 * State returned by the useDemoDataUpdater hook.
 */
export interface DemoDataState {
  /** Complete room summaries with sensor data */
  roomSummaries: RoomSummary[];
  /** All demo rooms */
  rooms: Room[];
  /** All demo controllers */
  controllers: Controller[];
  /** Current average temperature across rooms */
  averageTemperature: number | null;
  /** Current average humidity across rooms */
  averageHumidity: number | null;
  /** Current average VPD across rooms */
  averageVPD: number | null;
  /** Timeline data for charts */
  timelineData: TimeSeriesData[];
  /** Historical VPD for dial */
  historicalVpd: TimeSeriesPoint[];
  /** Aggregated trends */
  trends: {
    temperature?: TrendData;
    humidity?: TrendData;
    vpd?: TrendData;
  };
}

/**
 * Hook that provides auto-updating demo data for the dashboard.
 * Updates every 3 seconds with realistic variance to showcase live capabilities.
 *
 * @param enabled - Whether demo mode is active
 * @returns Demo data state that updates automatically
 *
 * @example
 * ```tsx
 * const { roomSummaries, averageTemperature } = useDemoDataUpdater(isDemoMode);
 *
 * if (isDemoMode) {
 *   // Use demo data
 * }
 * ```
 */
export function useDemoDataUpdater(enabled: boolean): DemoDataState {
  // Initialize with demo data
  const [roomSummaries, setRoomSummaries] = useState<RoomSummary[]>(() =>
    enabled ? generateDemoRoomSummaries() : []
  );

  const [timelineData, setTimelineData] = useState<TimeSeriesData[]>(() =>
    enabled ? generateTimelineData() : []
  );

  const [historicalVpd, setHistoricalVpd] = useState<TimeSeriesPoint[]>(() =>
    enabled ? generateHistoricalVpd() : []
  );

  // Track update interval
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Updates all demo data with new values.
   * Called on an interval to simulate live updates.
   */
  const updateDemoData = useCallback(() => {
    if (!enabled) return;

    setRoomSummaries(generateDemoRoomSummaries());
    setTimelineData(generateTimelineData());
    setHistoricalVpd(generateHistoricalVpd());
  }, [enabled]);

  // Set up auto-update interval
  useEffect(() => {
    if (!enabled) {
      // Clear interval and reset state when disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setRoomSummaries([]);
      setTimelineData([]);
      setHistoricalVpd([]);
      return;
    }

    // Initial data generation
    updateDemoData();

    // Set up 3-second update interval
    intervalRef.current = setInterval(updateDemoData, DEMO_UPDATE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, updateDemoData]);

  // Compute derived values
  const rooms = roomSummaries.map((s) => s.room);
  const controllers = roomSummaries.flatMap((s) => s.controllers);

  // Calculate averages across all rooms
  const temperatures = roomSummaries
    .map((s) => s.latestSensorData.temperature)
    .filter((t): t is number => t !== null);
  const humidities = roomSummaries
    .map((s) => s.latestSensorData.humidity)
    .filter((h): h is number => h !== null);
  const vpds = roomSummaries
    .map((s) => s.latestSensorData.vpd)
    .filter((v): v is number => v !== null);

  const averageTemperature =
    temperatures.length > 0
      ? Math.round((temperatures.reduce((a, b) => a + b, 0) / temperatures.length) * 10) / 10
      : null;

  const averageHumidity =
    humidities.length > 0
      ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length)
      : null;

  const averageVPD =
    vpds.length > 0
      ? Math.round((vpds.reduce((a, b) => a + b, 0) / vpds.length) * 100) / 100
      : null;

  // Aggregate trends (use first room's trends as representative)
  const trends = roomSummaries.length > 0 ? roomSummaries[0].trends : {};

  return {
    roomSummaries,
    rooms,
    controllers,
    averageTemperature,
    averageHumidity,
    averageVPD,
    timelineData,
    historicalVpd,
    trends,
  };
}

/**
 * Export the update interval for testing purposes.
 */
export const DEMO_UPDATE_INTERVAL = DEMO_UPDATE_INTERVAL_MS;
