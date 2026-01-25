/**
 * EnviroFlow Statistical Analysis Utilities
 *
 * Provides statistical calculations for sensor data analysis including:
 * - Pearson correlation coefficient
 * - Linear regression
 * - Data aggregation for heatmaps
 * - Correlation insights generation
 */

import { parseISO, getDay, getHours } from "date-fns";
import type { SensorReading, TimeSeriesPoint } from "@/types";

// =============================================================================
// Types
// =============================================================================

/**
 * Heatmap cell representing aggregated sensor data for a specific hour and day.
 */
export interface HeatmapCell {
  /** Day of week (0-6, Sunday-Saturday) */
  day: number;
  /** Hour of day (0-23) */
  hour: number;
  /** Average sensor value for this time slot */
  value: number;
  /** Number of readings aggregated */
  count: number;
  /** Day name (Sunday-Saturday) */
  dayName?: string;
}

/**
 * Correlation result with statistical measures.
 */
export interface CorrelationResult {
  /** Pearson correlation coefficient (-1 to 1) */
  coefficient: number;
  /** R-squared value (0 to 1) */
  rSquared: number;
  /** Linear regression slope */
  slope: number;
  /** Linear regression y-intercept */
  intercept: number;
  /** Number of data points used */
  count: number;
  /** Strength description */
  strength: "very weak" | "weak" | "moderate" | "strong" | "very strong";
  /** Direction description */
  direction: "positive" | "negative" | "none";
}

/**
 * Data point for correlation scatter plot.
 */
export interface CorrelationPoint {
  /** X-axis value */
  x: number;
  /** Y-axis value */
  y: number;
  /** Timestamp of the reading */
  timestamp: string;
  /** Hour of day (0-23) for color coding */
  hour: number;
}

/**
 * Insight generated from correlation analysis.
 */
export interface CorrelationInsight {
  /** Insight text */
  message: string;
  /** Severity level */
  severity: "info" | "warning" | "success";
  /** Correlation strength */
  strength: CorrelationResult["strength"];
}

// =============================================================================
// Constants
// =============================================================================

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// =============================================================================
// Correlation Calculations
// =============================================================================

/**
 * Calculate Pearson correlation coefficient between two arrays.
 *
 * Formula: r = Σ((x - x̄)(y - ȳ)) / √(Σ(x - x̄)² × Σ(y - ȳ)²)
 *
 * @param x - Array of x values
 * @param y - Array of y values
 * @returns Correlation coefficient between -1 and 1, or 0 if invalid
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) {
    return 0;
  }

  const n = x.length;

  // Calculate means
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;

  // Calculate correlation components
  let numerator = 0;
  let sumXSquared = 0;
  let sumYSquared = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;

    numerator += diffX * diffY;
    sumXSquared += diffX * diffX;
    sumYSquared += diffY * diffY;
  }

  const denominator = Math.sqrt(sumXSquared * sumYSquared);

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

/**
 * Calculate linear regression for two arrays.
 *
 * Returns slope (m) and intercept (b) for y = mx + b
 *
 * @param x - Array of x values
 * @param y - Array of y values
 * @returns Object with slope and intercept
 */
export function calculateLinearRegression(
  x: number[],
  y: number[]
): { slope: number; intercept: number } {
  if (x.length !== y.length || x.length === 0) {
    return { slope: 0, intercept: 0 };
  }

  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumXSquared = x.reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXSquared - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Calculate comprehensive correlation analysis.
 *
 * @param x - Array of x values
 * @param y - Array of y values
 * @returns Complete correlation result with statistics
 */
export function calculateCorrelation(x: number[], y: number[]): CorrelationResult {
  const coefficient = calculatePearsonCorrelation(x, y);
  const rSquared = coefficient * coefficient;
  const { slope, intercept } = calculateLinearRegression(x, y);

  // Determine strength based on absolute correlation
  const absCoeff = Math.abs(coefficient);
  let strength: CorrelationResult["strength"];
  if (absCoeff >= 0.8) strength = "very strong";
  else if (absCoeff >= 0.6) strength = "strong";
  else if (absCoeff >= 0.4) strength = "moderate";
  else if (absCoeff >= 0.2) strength = "weak";
  else strength = "very weak";

  // Determine direction
  let direction: CorrelationResult["direction"];
  if (coefficient > 0.1) direction = "positive";
  else if (coefficient < -0.1) direction = "negative";
  else direction = "none";

  return {
    coefficient,
    rSquared,
    slope,
    intercept,
    count: x.length,
    strength,
    direction,
  };
}

// =============================================================================
// Heatmap Data Aggregation
// =============================================================================

/**
 * Aggregate sensor readings into a 7-day × 24-hour heatmap structure.
 *
 * @param readings - Array of sensor readings
 * @returns Array of heatmap cells with aggregated values
 */
export function aggregateToHeatmap(readings: SensorReading[]): HeatmapCell[] {
  // Create a map to group readings by day and hour
  const aggregationMap = new Map<string, { values: number[]; day: number; hour: number }>();

  for (const reading of readings) {
    try {
      const date = parseISO(reading.recorded_at);
      const day = getDay(date);
      const hour = getHours(date);
      const key = `${day}-${hour}`;

      if (!aggregationMap.has(key)) {
        aggregationMap.set(key, { values: [], day, hour });
      }

      aggregationMap.get(key)!.values.push(reading.value);
    } catch {
      // Skip invalid timestamps
      continue;
    }
  }

  // Convert to heatmap cells with averages
  const cells: HeatmapCell[] = [];

  for (const [, data] of aggregationMap.entries()) {
    const average = data.values.reduce((sum, val) => sum + val, 0) / data.values.length;

    cells.push({
      day: data.day,
      hour: data.hour,
      value: average,
      count: data.values.length,
      dayName: DAY_NAMES[data.day],
    });
  }

  return cells;
}

/**
 * Aggregate time series points into a 7-day × 24-hour heatmap structure.
 *
 * @param points - Array of time series points
 * @returns Array of heatmap cells with aggregated values
 */
export function aggregateTimeSeriestoHeatmap(points: TimeSeriesPoint[]): HeatmapCell[] {
  const aggregationMap = new Map<string, { values: number[]; day: number; hour: number }>();

  for (const point of points) {
    try {
      const date = parseISO(point.timestamp);
      const day = getDay(date);
      const hour = getHours(date);
      const key = `${day}-${hour}`;

      if (!aggregationMap.has(key)) {
        aggregationMap.set(key, { values: [], day, hour });
      }

      aggregationMap.get(key)!.values.push(point.value);
    } catch (_error) {
      // Skip invalid timestamps
      continue;
    }
  }

  const cells: HeatmapCell[] = [];

  for (const [, data] of aggregationMap.entries()) {
    const average = data.values.reduce((sum, val) => sum + val, 0) / data.values.length;

    cells.push({
      day: data.day,
      hour: data.hour,
      value: average,
      count: data.values.length,
      dayName: DAY_NAMES[data.day],
    });
  }

  return cells;
}

// =============================================================================
// Correlation Data Preparation
// =============================================================================

/**
 * Prepare correlation scatter plot data from two sensor reading arrays.
 *
 * @param xReadings - Readings for x-axis sensor
 * @param yReadings - Readings for y-axis sensor
 * @returns Array of correlation points with matched timestamps
 */
export function prepareCorrelationData(
  xReadings: SensorReading[],
  yReadings: SensorReading[]
): CorrelationPoint[] {
  // Create a map of timestamps to x values
  const xMap = new Map<string, number>();
  for (const reading of xReadings) {
    xMap.set(reading.recorded_at, reading.value);
  }

  // Find matching y values and create points
  const points: CorrelationPoint[] = [];

  for (const yReading of yReadings) {
    const xValue = xMap.get(yReading.recorded_at);
    if (xValue !== undefined) {
      try {
        const date = parseISO(yReading.recorded_at);
        const hour = getHours(date);

        points.push({
          x: xValue,
          y: yReading.value,
          timestamp: yReading.recorded_at,
          hour,
        });
      } catch (_error) {
        // Skip invalid timestamps
        continue;
      }
    }
  }

  return points;
}

/**
 * Prepare correlation data from time series points.
 *
 * @param xPoints - Time series for x-axis
 * @param yPoints - Time series for y-axis
 * @returns Array of correlation points with matched timestamps
 */
export function prepareCorrelationFromTimeSeries(
  xPoints: TimeSeriesPoint[],
  yPoints: TimeSeriesPoint[]
): CorrelationPoint[] {
  const xMap = new Map<string, number>();
  for (const point of xPoints) {
    xMap.set(point.timestamp, point.value);
  }

  const points: CorrelationPoint[] = [];

  for (const yPoint of yPoints) {
    const xValue = xMap.get(yPoint.timestamp);
    if (xValue !== undefined) {
      try {
        const date = parseISO(yPoint.timestamp);
        const hour = getHours(date);

        points.push({
          x: xValue,
          y: yPoint.value,
          timestamp: yPoint.timestamp,
          hour,
        });
      } catch (_error) {
        // Skip invalid timestamps
        continue;
      }
    }
  }

  return points;
}

// =============================================================================
// Insight Generation
// =============================================================================

/**
 * Generate human-readable insights from correlation analysis.
 *
 * @param correlation - Correlation result
 * @param xLabel - Label for x-axis sensor
 * @param yLabel - Label for y-axis sensor
 * @returns Array of insights
 */
export function generateCorrelationInsights(
  correlation: CorrelationResult,
  xLabel: string,
  yLabel: string
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = [];

  // Main correlation insight
  if (correlation.strength !== "very weak") {
    const directionText =
      correlation.direction === "positive"
        ? `Higher ${xLabel} → Higher ${yLabel}`
        : `Higher ${xLabel} → Lower ${yLabel}`;

    insights.push({
      message: `${
        correlation.strength.charAt(0).toUpperCase() + correlation.strength.slice(1)
      } ${correlation.direction} correlation (R² = ${correlation.rSquared.toFixed(
        2
      )}): ${directionText}`,
      severity: correlation.strength === "very strong" || correlation.strength === "strong" ? "success" : "info",
      strength: correlation.strength,
    });
  } else {
    insights.push({
      message: `No significant correlation detected between ${xLabel} and ${yLabel}`,
      severity: "info",
      strength: correlation.strength,
    });
  }

  // Data quality insight
  if (correlation.count < 50) {
    insights.push({
      message: `Limited data: Only ${correlation.count} readings. Collect more data for reliable correlation analysis.`,
      severity: "warning",
      strength: correlation.strength,
    });
  }

  // Strong correlation action insight
  if (correlation.strength === "very strong" && correlation.direction === "positive") {
    insights.push({
      message: `Strong relationship detected. Consider automating ${yLabel} control based on ${xLabel} readings.`,
      severity: "success",
      strength: correlation.strength,
    });
  }

  return insights;
}

// =============================================================================
// Color Mapping
// =============================================================================

/**
 * Get color for a heatmap cell value.
 *
 * Maps value to a color gradient from blue (low) to red (high).
 *
 * @param value - Cell value
 * @param min - Minimum value in dataset
 * @param max - Maximum value in dataset
 * @returns RGB color string
 */
export function getHeatmapColor(value: number, min: number, max: number): string {
  if (min === max) {
    return "rgb(59, 130, 246)"; // Blue
  }

  // Normalize value to 0-1 range
  const normalized = (value - min) / (max - min);

  // Blue (low) to Red (high) gradient
  // Blue: rgb(59, 130, 246)
  // Red: rgb(239, 68, 68)

  const r = Math.round(59 + normalized * (239 - 59));
  const g = Math.round(130 - normalized * (130 - 68));
  const b = Math.round(246 - normalized * (246 - 68));

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get color for a scatter plot point based on hour of day.
 *
 * @param hour - Hour of day (0-23)
 * @returns RGB color string
 */
export function getHourColor(hour: number): string {
  // Map hours to a gradient
  // Midnight: dark blue
  // Noon: bright yellow
  // Evening: orange

  if (hour >= 0 && hour < 6) {
    // Midnight to dawn: dark blue to light blue
    const t = hour / 6;
    return `rgb(${Math.round(30 + t * 30)}, ${Math.round(58 + t * 72)}, ${Math.round(
      138 + t * 108
    )})`;
  } else if (hour >= 6 && hour < 12) {
    // Dawn to noon: light blue to yellow
    const t = (hour - 6) / 6;
    return `rgb(${Math.round(60 + t * 190)}, ${Math.round(130 + t * 100)}, ${Math.round(
      246 - t * 138
    )})`;
  } else if (hour >= 12 && hour < 18) {
    // Noon to evening: yellow to orange
    const t = (hour - 12) / 6;
    return `rgb(${Math.round(250 - t * 5)}, ${Math.round(230 - t * 140)}, ${Math.round(
      108 - t * 40
    )})`;
  } else {
    // Evening to midnight: orange to dark blue
    const t = (hour - 18) / 6;
    return `rgb(${Math.round(245 - t * 215)}, ${Math.round(90 - t * 32)}, ${Math.round(
      68 + t * 70
    )})`;
  }
}

// =============================================================================
// Export Utilities
// =============================================================================

/**
 * Convert correlation data to CSV format.
 *
 * @param points - Correlation points
 * @param xLabel - X-axis label
 * @param yLabel - Y-axis label
 * @param correlation - Correlation result
 * @returns CSV string
 */
export function correlationToCSV(
  points: CorrelationPoint[],
  xLabel: string,
  yLabel: string,
  correlation: CorrelationResult
): string {
  const headers = ["Timestamp", xLabel, yLabel, "Hour of Day"];
  const rows = points.map((p) => [p.timestamp, p.x.toString(), p.y.toString(), p.hour.toString()]);

  // Add correlation statistics as footer
  const footer = [
    "",
    ["# Correlation Statistics"],
    [`# Coefficient: ${correlation.coefficient.toFixed(4)}`],
    [`# R-Squared: ${correlation.rSquared.toFixed(4)}`],
    [`# Slope: ${correlation.slope.toFixed(4)}`],
    [`# Intercept: ${correlation.intercept.toFixed(4)}`],
    [`# Sample Size: ${correlation.count}`],
    [`# Strength: ${correlation.strength}`],
    [`# Direction: ${correlation.direction}`],
  ];

  return [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
    ...footer.map((line) => (Array.isArray(line) ? line[0] : line)),
  ].join("\n");
}
