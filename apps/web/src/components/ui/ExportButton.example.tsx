/**
 * ExportButton Integration Examples
 *
 * This file demonstrates how to integrate the ExportButton component
 * with sensor charts in various contexts.
 */

"use client";

import { useRef } from "react";
import { ExportButton } from "@/components/ui/ExportButton";
import { SensorChart } from "@/components/charts/SensorChart";
import type { SensorReading, TimeSeriesPoint } from "@/types";

// =============================================================================
// Example 1: Basic Integration with SensorChart
// =============================================================================

interface BasicExampleProps {
  controllerName: string;
  controllerId: string;
  sensorReadings: SensorReading[];
  temperatureData: TimeSeriesPoint[];
  humidityData: TimeSeriesPoint[];
  vpdData: TimeSeriesPoint[];
  dateRange: { start: Date; end: Date };
}

export function BasicExportExample({
  controllerName,
  controllerId,
  sensorReadings,
  temperatureData,
  humidityData,
  vpdData,
  dateRange,
}: BasicExampleProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4">
      {/* Chart with ref for PDF export */}
      <div ref={chartRef}>
        <SensorChart
          temperatureData={temperatureData}
          humidityData={humidityData}
          vpdData={vpdData}
          height={300}
          showLegend
          showGrid
          variant="area"
        />
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          data={sensorReadings}
          controllerName={controllerName}
          controllerId={controllerId}
          dateRange={dateRange}
          chartRef={chartRef}
          showLabel
        />
      </div>
    </div>
  );
}

// =============================================================================
// Example 2: Integration in RoomDetailPanel
// =============================================================================

/**
 * This example shows how to add the ExportButton to the RoomDetailPanel
 * header alongside the time range selector and expand/collapse buttons.
 *
 * To integrate into RoomDetailPanel.tsx:
 *
 * 1. Import ExportButton and add necessary imports:
 *    ```tsx
 *    import { ExportButton } from "@/components/ui/ExportButton";
 *    import { useRef, useMemo } from "react";
 *    ```
 *
 * 2. Add a ref for the chart container:
 *    ```tsx
 *    const chartRef = useRef<HTMLDivElement>(null);
 *    ```
 *
 * 3. Convert TimeSeriesPoint[] to SensorReading[] for export:
 *    ```tsx
 *    const sensorReadings = useMemo(() => {
 *      const readings: SensorReading[] = [];
 *
 *      // Convert temperature data
 *      filteredData.temperature.forEach(point => {
 *        readings.push({
 *          id: crypto.randomUUID(),
 *          controller_id: roomSummary.controllers[0]?.id || "",
 *          sensor_type: "temperature",
 *          value: point.value,
 *          unit: "°F",
 *          recorded_at: point.timestamp,
 *          is_stale: false,
 *          port: null,
 *        });
 *      });
 *
 *      // Convert humidity data
 *      filteredData.humidity.forEach(point => {
 *        readings.push({
 *          id: crypto.randomUUID(),
 *          controller_id: roomSummary.controllers[0]?.id || "",
 *          sensor_type: "humidity",
 *          value: point.value,
 *          unit: "%",
 *          recorded_at: point.timestamp,
 *          is_stale: false,
 *          port: null,
 *        });
 *      });
 *
 *      // Convert VPD data
 *      filteredData.vpd.forEach(point => {
 *        readings.push({
 *          id: crypto.randomUUID(),
 *          controller_id: roomSummary.controllers[0]?.id || "",
 *          sensor_type: "vpd",
 *          value: point.value,
 *          unit: "kPa",
 *          recorded_at: point.timestamp,
 *          is_stale: false,
 *          port: null,
 *        });
 *      });
 *
 *      // Convert CO2 data if available
 *      filteredData.co2.forEach(point => {
 *        readings.push({
 *          id: crypto.randomUUID(),
 *          controller_id: roomSummary.controllers[0]?.id || "",
 *          sensor_type: "co2",
 *          value: point.value,
 *          unit: "ppm",
 *          recorded_at: point.timestamp,
 *          is_stale: false,
 *          port: null,
 *        });
 *      });
 *
 *      return readings;
 *    }, [filteredData, roomSummary.controllers]);
 *    ```
 *
 * 4. Calculate date range based on selected timeRange:
 *    ```tsx
 *    const exportDateRange = useMemo(() => {
 *      const end = new Date();
 *      let start = new Date();
 *
 *      switch (timeRange) {
 *        case "1h":
 *          start = new Date(end.getTime() - 60 * 60 * 1000);
 *          break;
 *        case "6h":
 *          start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
 *          break;
 *        case "24h":
 *          start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
 *          break;
 *        case "7d":
 *          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
 *          break;
 *      }
 *
 *      return { start, end };
 *    }, [timeRange]);
 *    ```
 *
 * 5. Add ExportButton to the header controls (around line 315-331):
 *    ```tsx
 *    <div className="flex items-center gap-2">
 *      // Export Button - NEW
 *      <ExportButton
 *        data={sensorReadings}
 *        controllerName={roomSummary.room.name}
 *        controllerId={roomSummary.controllers[0]?.id || ""}
 *        dateRange={exportDateRange}
 *        chartRef={chartRef}
 *        variant="outline"
 *        size="sm"
 *        showLabel={false}
 *      />
 *
 *      // Time Range Selector
 *      <Select
 *        value={timeRange}
 *        onValueChange={(value) => setTimeRange(value as TimeRange)}
 *      >
 *        ...
 *      </Select>
 *
 *      // ... rest of controls
 *    </div>
 *    ```
 *
 * 6. Wrap the chart section with the ref (around line 424-453):
 *    ```tsx
 *    <div
 *      ref={chartRef}  // ADD THIS REF
 *      className={cn(
 *        "rounded-lg border p-4",
 *        isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
 *      )}
 *    >
 *      <h3 className={cn(...)}>
 *        Sensor History
 *      </h3>
 *      <SensorChart
 *        temperatureData={filteredData.temperature}
 *        humidityData={filteredData.humidity}
 *        vpdData={filteredData.vpd}
 *        co2Data={filteredData.co2.length > 0 ? filteredData.co2 : undefined}
 *        visibleSensors={availableSensors}
 *        height={isExpanded ? 400 : 280}
 *        showLegend
 *        showGrid
 *        variant="area"
 *        optimalRanges={optimalRanges}
 *        timeFormat={timeRange === "7d" ? "long" : "short"}
 *        isLoading={isLoading}
 *      />
 *    </div>
 *    ```
 */

// =============================================================================
// Example 3: Standalone Page with Export
// =============================================================================

interface StandaloneExampleProps {
  controllerName: string;
  controllerId: string;
  sensorReadings: SensorReading[];
  temperatureData: TimeSeriesPoint[];
  humidityData: TimeSeriesPoint[];
  vpdData: TimeSeriesPoint[];
}

export function StandaloneExportExample({
  controllerName,
  controllerId,
  sensorReadings,
  temperatureData,
  humidityData,
  vpdData,
}: StandaloneExampleProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Calculate date range from data
  const dateRange = {
    start: new Date(
      Math.min(
        ...temperatureData.map(p => new Date(p.timestamp).getTime()),
        ...humidityData.map(p => new Date(p.timestamp).getTime()),
        ...vpdData.map(p => new Date(p.timestamp).getTime())
      )
    ),
    end: new Date(
      Math.max(
        ...temperatureData.map(p => new Date(p.timestamp).getTime()),
        ...humidityData.map(p => new Date(p.timestamp).getTime()),
        ...vpdData.map(p => new Date(p.timestamp).getTime())
      )
    ),
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{controllerName}</h1>
          <p className="text-sm text-muted-foreground">
            Sensor Data from {dateRange.start.toLocaleDateString()} to{" "}
            {dateRange.end.toLocaleDateString()}
          </p>
        </div>

        <ExportButton
          data={sensorReadings}
          controllerName={controllerName}
          controllerId={controllerId}
          dateRange={dateRange}
          chartRef={chartRef}
          variant="default"
          showLabel
        />
      </div>

      {/* Chart Container */}
      <div ref={chartRef} className="rounded-lg border bg-card p-6">
        <SensorChart
          temperatureData={temperatureData}
          humidityData={humidityData}
          vpdData={vpdData}
          height={400}
          showLegend
          showGrid
          variant="area"
          optimalRanges={{
            temperature: [70, 82],
            humidity: [50, 70],
            vpd: [0.8, 1.2],
          }}
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Temperature Range</p>
          <p className="text-2xl font-bold">
            {Math.min(...temperatureData.map(p => p.value)).toFixed(1)}° -{" "}
            {Math.max(...temperatureData.map(p => p.value)).toFixed(1)}°F
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Humidity Range</p>
          <p className="text-2xl font-bold">
            {Math.min(...humidityData.map(p => p.value)).toFixed(1)}% -{" "}
            {Math.max(...humidityData.map(p => p.value)).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">VPD Range</p>
          <p className="text-2xl font-bold">
            {Math.min(...vpdData.map(p => p.value)).toFixed(2)} -{" "}
            {Math.max(...vpdData.map(p => p.value)).toFixed(2)} kPa
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Example 4: Multiple Controllers Export
// =============================================================================

interface MultiControllerExampleProps {
  controllers: Array<{
    id: string;
    name: string;
    readings: SensorReading[];
  }>;
  dateRange: { start: Date; end: Date };
}

/**
 * Example showing how to export data from multiple controllers.
 * Each controller gets its own export button.
 */
export function MultiControllerExportExample({
  controllers,
  dateRange,
}: MultiControllerExampleProps) {
  return (
    <div className="space-y-6">
      {controllers.map(controller => (
        <div key={controller.id} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{controller.name}</h3>
            <ExportButton
              data={controller.readings}
              controllerName={controller.name}
              controllerId={controller.id}
              dateRange={dateRange}
              variant="outline"
              size="sm"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {controller.readings.length} readings
          </p>
        </div>
      ))}
    </div>
  );
}
