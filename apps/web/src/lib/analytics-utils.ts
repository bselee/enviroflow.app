/**
 * Analytics calculation utilities for dashboard summary cards.
 *
 * This module provides functions to calculate aggregated sensor analytics
 * across time periods, including averages, ranges, trends, and compliance metrics.
 */

import { calculateVPD } from "./vpd-utils";
import type { SensorReading, DateRangeValue, RoomSettings } from "@/types";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Metric statistics for a single sensor type over a period.
 */
export interface MetricStats {
  /** Average value across the period */
  avg: number;
  /** Minimum value in the period */
  min: number;
  /** Maximum value in the period */
  max: number;
  /** Trend percentage vs previous period (-100 to +100) */
  trend: number;
}

/**
 * Summary analytics for all sensor metrics.
 */
export interface AnalyticsSummary {
  temperature: MetricStats | null;
  humidity: MetricStats | null;
  vpd: MetricStats | null;
  co2: MetricStats | null;
  /** Percentage of readings within target ranges (0-100) */
  compliance: {
    percentage: number;
    trend: number;
  };
}

/**
 * Options for calculating analytics.
 */
export interface CalculateAnalyticsOptions {
  /** Current period sensor readings */
  readings: SensorReading[];
  /** Date range for the current period */
  period: DateRangeValue;
  /** Optional target ranges for compliance calculation */
  targetRanges?: RoomSettings;
  /** Optional previous period readings for trend calculation */
  previousReadings?: SensorReading[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Filters sensor readings by date range.
 */
export function filterByDateRange(
  readings: SensorReading[],
  dateRange: DateRangeValue
): SensorReading[] {
  const startTime = dateRange.from.getTime();
  const endTime = dateRange.to.getTime();

  return readings.filter((reading) => {
    const readingTime = new Date(reading.recorded_at).getTime();
    return readingTime >= startTime && readingTime <= endTime;
  });
}

/**
 * Gets the previous period date range (same duration, immediately before current period).
 */
export function getPreviousPeriod(period: DateRangeValue): DateRangeValue {
  const duration = period.to.getTime() - period.from.getTime();
  const previousEnd = new Date(period.from);
  const previousStart = new Date(period.from.getTime() - duration);

  return {
    from: previousStart,
    to: previousEnd,
  };
}

/**
 * Calculates average value for a specific sensor type from readings.
 */
function calculateAverage(
  readings: SensorReading[],
  sensorType: string
): number | null {
  const filtered = readings.filter((r) => r.sensor_type === sensorType);
  if (filtered.length === 0) return null;

  const sum = filtered.reduce((acc, r) => acc + r.value, 0);
  return Math.round((sum / filtered.length) * 100) / 100;
}

/**
 * Calculates min/max values for a specific sensor type from readings.
 */
function calculateMinMax(
  readings: SensorReading[],
  sensorType: string
): { min: number; max: number } | null {
  const filtered = readings.filter((r) => r.sensor_type === sensorType);
  if (filtered.length === 0) return null;

  const values = filtered.map((r) => r.value);
  return {
    min: Math.round(Math.min(...values) * 100) / 100,
    max: Math.round(Math.max(...values) * 100) / 100,
  };
}

/**
 * Calculates trend percentage comparing current to previous average.
 * Returns value between -100 and +100 (capped at ±100%).
 */
function calculateTrend(currentAvg: number, previousAvg: number): number {
  if (previousAvg === 0) return 0;

  const percentChange = ((currentAvg - previousAvg) / previousAvg) * 100;
  // Cap at ±100% for readability
  return Math.round(Math.max(-100, Math.min(100, percentChange)) * 10) / 10;
}

// VPD calculation is now imported from vpd-utils.ts for consistency

/**
 * Calculates compliance percentage for a sensor type against target range.
 */
function calculateComplianceForSensor(
  readings: SensorReading[],
  sensorType: string,
  min: number | null,
  max: number | null
): number | null {
  if (min === null || max === null) return null;

  const filtered = readings.filter((r) => r.sensor_type === sensorType);
  if (filtered.length === 0) return null;

  const inRange = filtered.filter(
    (r) => r.value >= min && r.value <= max
  ).length;

  return Math.round((inRange / filtered.length) * 100);
}

// =============================================================================
// Main Analytics Calculation
// =============================================================================

/**
 * Calculates analytics summary for sensor readings over a time period.
 *
 * This function aggregates sensor data and calculates:
 * - Average, min, max for each sensor type
 * - Trend percentages vs previous period
 * - Compliance percentage against target ranges
 *
 * @param options - Configuration with readings and date ranges
 * @returns Analytics summary with all metrics
 *
 * @example
 * ```ts
 * const summary = calculateAnalytics({
 *   readings: currentReadings,
 *   period: { from: weekAgo, to: now },
 *   targetRanges: room.settings,
 *   previousReadings: lastWeekReadings
 * });
 *
 * console.log(summary.temperature.avg); // 78.5
 * console.log(summary.temperature.trend); // +2.3% vs last week
 * console.log(summary.compliance.percentage); // 87% in range
 * ```
 */
export function calculateAnalytics(
  options: CalculateAnalyticsOptions
): AnalyticsSummary {
  const { readings, previousReadings, targetRanges } = options;

  // Calculate stats for each sensor type
  const calculateMetricStats = (sensorType: string): MetricStats | null => {
    const avg = calculateAverage(readings, sensorType);
    const minMax = calculateMinMax(readings, sensorType);

    if (avg === null || minMax === null) return null;

    let trend = 0;
    if (previousReadings) {
      const previousAvg = calculateAverage(previousReadings, sensorType);
      if (previousAvg !== null) {
        trend = calculateTrend(avg, previousAvg);
      }
    }

    return {
      avg,
      min: minMax.min,
      max: minMax.max,
      trend,
    };
  };

  // Calculate compliance
  const calculateCompliance = (): { percentage: number; trend: number } => {
    const complianceScores: number[] = [];

    // Temperature compliance
    if (targetRanges?.target_temp_min && targetRanges?.target_temp_max) {
      const tempCompliance = calculateComplianceForSensor(
        readings,
        "temperature",
        targetRanges.target_temp_min,
        targetRanges.target_temp_max
      );
      if (tempCompliance !== null) complianceScores.push(tempCompliance);
    }

    // Humidity compliance
    if (targetRanges?.target_humidity_min && targetRanges?.target_humidity_max) {
      const humCompliance = calculateComplianceForSensor(
        readings,
        "humidity",
        targetRanges.target_humidity_min,
        targetRanges.target_humidity_max
      );
      if (humCompliance !== null) complianceScores.push(humCompliance);
    }

    // VPD compliance
    if (targetRanges?.target_vpd_min && targetRanges?.target_vpd_max) {
      const vpdCompliance = calculateComplianceForSensor(
        readings,
        "vpd",
        targetRanges.target_vpd_min,
        targetRanges.target_vpd_max
      );
      if (vpdCompliance !== null) complianceScores.push(vpdCompliance);
    }

    // Average across all available compliance metrics
    const percentage =
      complianceScores.length > 0
        ? Math.round(
            complianceScores.reduce((sum, score) => sum + score, 0) /
              complianceScores.length
          )
        : 0;

    // Calculate trend vs previous period
    let trend = 0;
    if (previousReadings && targetRanges) {
      const prevComplianceScores: number[] = [];

      if (targetRanges.target_temp_min && targetRanges.target_temp_max) {
        const prev = calculateComplianceForSensor(
          previousReadings,
          "temperature",
          targetRanges.target_temp_min,
          targetRanges.target_temp_max
        );
        if (prev !== null) prevComplianceScores.push(prev);
      }

      if (
        targetRanges.target_humidity_min &&
        targetRanges.target_humidity_max
      ) {
        const prev = calculateComplianceForSensor(
          previousReadings,
          "humidity",
          targetRanges.target_humidity_min,
          targetRanges.target_humidity_max
        );
        if (prev !== null) prevComplianceScores.push(prev);
      }

      if (targetRanges.target_vpd_min && targetRanges.target_vpd_max) {
        const prev = calculateComplianceForSensor(
          previousReadings,
          "vpd",
          targetRanges.target_vpd_min,
          targetRanges.target_vpd_max
        );
        if (prev !== null) prevComplianceScores.push(prev);
      }

      const previousPercentage =
        prevComplianceScores.length > 0
          ? Math.round(
              prevComplianceScores.reduce((sum, score) => sum + score, 0) /
                prevComplianceScores.length
            )
          : 0;

      if (previousPercentage > 0) {
        trend = percentage - previousPercentage; // Absolute difference for compliance
      }
    }

    return { percentage, trend };
  };

  return {
    temperature: calculateMetricStats("temperature"),
    humidity: calculateMetricStats("humidity"),
    vpd: calculateMetricStats("vpd"),
    co2: calculateMetricStats("co2"),
    compliance: calculateCompliance(),
  };
}

/**
 * Gets default date range presets.
 */
export function getDateRangePreset(preset: string): DateRangeValue {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return {
        from: today,
        to: now,
        preset: "today",
      };

    case "7d":
      return {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now,
        preset: "7d",
      };

    case "30d":
      return {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: now,
        preset: "30d",
      };

    case "90d":
      return {
        from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        to: now,
        preset: "90d",
      };

    default:
      return {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now,
        preset: "7d",
      };
  }
}
