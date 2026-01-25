"use client";

import { useMemo, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BarChart3, Table2, Download } from "lucide-react";
import {
  aggregateToHeatmap,
  aggregateTimeSeriestoHeatmap,
  getHeatmapColor,
  type HeatmapCell,
} from "@/lib/statistics";
import type { SensorReading, TimeSeriesPoint, SensorType } from "@/types";

// =============================================================================
// Types
// =============================================================================

export interface SensorHeatmapProps {
  /** Sensor readings to visualize */
  readings?: SensorReading[];
  /** Time series points to visualize */
  timeSeriesData?: TimeSeriesPoint[];
  /** Sensor type for labeling */
  sensorType: SensorType;
  /** Value unit */
  unit: string;
  /** Chart height in pixels */
  height?: number;
  /** Whether the chart is loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Show mobile table view by default */
  defaultMobileView?: "heatmap" | "table";
}

// =============================================================================
// Constants
// =============================================================================

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format hour for display (0-23 to 12AM-11PM format)
 */
function formatHour(hour: number): string {
  if (hour === 0) return "12AM";
  if (hour < 12) return `${hour}AM`;
  if (hour === 12) return "12PM";
  return `${hour - 12}PM`;
}

/**
 * Export heatmap as PNG (browser download)
 */
function exportHeatmapAsPNG(canvasRef: HTMLCanvasElement | null, filename: string) {
  if (!canvasRef) return;

  canvasRef.toBlob((blob) => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Heatmap grid visualization
 */
function HeatmapGrid({
  cells,
  min,
  max,
  unit,
  isDark,
  onExport,
}: {
  cells: HeatmapCell[];
  min: number;
  max: number;
  unit: string;
  isDark: boolean;
  onExport: (canvas: HTMLCanvasElement) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Create lookup map for cells
  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const cell of cells) {
      map.set(`${cell.day}-${cell.hour}`, cell);
    }
    return map;
  }, [cells]);

  // Draw heatmap to canvas for export
  const drawToCanvas = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellWidth = 40;
    const cellHeight = 40;
    const labelWidth = 50;
    const labelHeight = 30;

    canvas.width = HOURS.length * cellWidth + labelWidth;
    canvas.height = DAYS.length * cellHeight + labelHeight;

    // Clear canvas
    ctx.fillStyle = isDark ? "#1f2937" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    for (let day = 0; day < DAYS.length; day++) {
      for (let hour = 0; hour < HOURS.length; hour++) {
        const cell = cellMap.get(`${day}-${hour}`);
        const x = hour * cellWidth + labelWidth;
        const y = day * cellHeight + labelHeight;

        if (cell) {
          ctx.fillStyle = getHeatmapColor(cell.value, min, max);
        } else {
          ctx.fillStyle = isDark ? "#374151" : "#f3f4f6";
        }

        ctx.fillRect(x, y, cellWidth - 1, cellHeight - 1);

        // Draw value if cell exists
        if (cell) {
          ctx.fillStyle = isDark ? "#ffffff" : "#000000";
          ctx.font = "10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(cell.value.toFixed(1), x + cellWidth / 2, y + cellHeight / 2);
        }
      }
    }

    // Draw day labels
    ctx.fillStyle = isDark ? "#9ca3af" : "#6b7280";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let day = 0; day < DAYS.length; day++) {
      ctx.fillText(DAYS[day], labelWidth - 5, day * cellHeight + labelHeight + cellHeight / 2);
    }

    // Draw hour labels
    ctx.textAlign = "center";
    for (let hour = 0; hour < 24; hour += 3) {
      ctx.fillText(
        formatHour(hour),
        hour * cellWidth + labelWidth + cellWidth / 2,
        labelHeight / 2
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Visual heatmap grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid" style={{ gridTemplateColumns: "auto repeat(24, minmax(32px, 1fr))" }}>
            {/* Header row */}
            <div className="sticky left-0 bg-background z-10" />
            {HOURS.map((hour) => (
              <div
                key={hour}
                className={cn(
                  "text-xs text-center py-1 font-medium",
                  isDark ? "text-gray-400" : "text-gray-600",
                  hour % 3 !== 0 && "hidden sm:block"
                )}
              >
                {hour % 3 === 0 ? formatHour(hour) : ""}
              </div>
            ))}

            {/* Heatmap rows */}
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="contents">
                <div
                  className={cn(
                    "sticky left-0 bg-background z-10 text-xs font-medium py-2 pr-2 text-right",
                    isDark ? "text-gray-400" : "text-gray-600"
                  )}
                >
                  {day}
                </div>

                {HOURS.map((hour) => {
                  const cell = cellMap.get(`${dayIndex}-${hour}`);

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "relative aspect-square border group cursor-pointer transition-transform hover:scale-105 hover:z-20",
                        isDark ? "border-gray-700" : "border-gray-200"
                      )}
                      style={{
                        backgroundColor: cell
                          ? getHeatmapColor(cell.value, min, max)
                          : isDark
                          ? "#374151"
                          : "#f3f4f6",
                      }}
                      title={
                        cell
                          ? `${day} ${formatHour(hour)}: ${cell.value.toFixed(1)}${unit} (${cell.count} readings)`
                          : `${day} ${formatHour(hour)}: No data`
                      }
                    >
                      {/* Tooltip on hover */}
                      {cell && (
                        <div
                          className={cn(
                            "absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded shadow-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30",
                            isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900 border"
                          )}
                        >
                          <div className="font-semibold">
                            {cell.value.toFixed(1)}
                            {unit}
                          </div>
                          <div className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>
                            {cell.count} readings
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Color legend */}
      <div className="flex items-center justify-center gap-2 text-xs">
        <span className={cn("font-medium", isDark ? "text-gray-400" : "text-gray-600")}>
          {min.toFixed(1)}
          {unit}
        </span>
        <div className="flex h-4 w-48 rounded overflow-hidden">
          {Array.from({ length: 20 }, (_, i) => {
            const value = min + (i / 19) * (max - min);
            return (
              <div
                key={i}
                className="flex-1"
                style={{ backgroundColor: getHeatmapColor(value, min, max) }}
              />
            );
          })}
        </div>
        <span className={cn("font-medium", isDark ? "text-gray-400" : "text-gray-600")}>
          {max.toFixed(1)}
          {unit}
        </span>
      </div>

      {/* Export button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            drawToCanvas();
            setTimeout(() => {
              if (canvasRef.current) {
                onExport(canvasRef.current);
              }
            }, 100);
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Export as PNG
        </Button>
      </div>
    </div>
  );
}

/**
 * Table view for mobile devices
 */
function HeatmapTable({
  cells,
  unit,
  isDark,
}: {
  cells: HeatmapCell[];
  unit: string;
  isDark: boolean;
}) {
  // Sort cells by day and hour
  const sortedCells = useMemo(() => {
    return [...cells].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.hour - b.hour;
    });
  }, [cells]);

  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full text-sm">
        <thead>
          <tr className={cn("border-b", isDark ? "border-gray-700" : "border-gray-200")}>
            <th className="text-left py-2 px-3 font-medium">Day</th>
            <th className="text-left py-2 px-3 font-medium">Hour</th>
            <th className="text-right py-2 px-3 font-medium">Average</th>
            <th className="text-right py-2 px-3 font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {sortedCells.map((cell, idx) => (
            <tr
              key={`${cell.day}-${cell.hour}`}
              className={cn("border-b", isDark ? "border-gray-800" : "border-gray-100")}
            >
              <td className="py-2 px-3">{cell.dayName}</td>
              <td className="py-2 px-3">{formatHour(cell.hour)}</td>
              <td className="py-2 px-3 text-right font-medium">
                {cell.value.toFixed(1)}
                {unit}
              </td>
              <td className="py-2 px-3 text-right text-muted-foreground">{cell.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Loading skeleton
 */
function HeatmapSkeleton({ height, className }: { height: number; className?: string }) {
  return (
    <div className={cn("relative", className)} style={{ height }}>
      <Skeleton className="absolute inset-0 rounded-lg" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading heatmap...</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * SensorHeatmap - 2D heatmap visualization for sensor data patterns.
 *
 * Displays a 7-day × 24-hour grid showing average sensor values by time of day
 * and day of week. Useful for identifying patterns and optimal times.
 *
 * Features:
 * - Color-coded cells from blue (low) to red (high)
 * - Hover tooltips with exact values
 * - Toggle between heatmap and table view
 * - Export as PNG
 * - Responsive layout
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <SensorHeatmap
 *   timeSeriesData={temperatureData}
 *   sensorType="temperature"
 *   unit="°F"
 *   height={400}
 * />
 * ```
 */
export function SensorHeatmap({
  readings,
  timeSeriesData,
  sensorType,
  unit,
  height = 400,
  isLoading = false,
  className,
  defaultMobileView = "heatmap",
}: SensorHeatmapProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [view, setView] = useState<"heatmap" | "table">(defaultMobileView);

  // Aggregate data into heatmap cells
  const cells = useMemo(() => {
    if (readings) {
      return aggregateToHeatmap(readings);
    } else if (timeSeriesData) {
      return aggregateTimeSeriestoHeatmap(timeSeriesData);
    }
    return [];
  }, [readings, timeSeriesData]);

  // Calculate min/max for color scaling
  const { min, max } = useMemo(() => {
    if (cells.length === 0) {
      return { min: 0, max: 100 };
    }

    const values = cells.map((c) => c.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [cells]);

  if (isLoading) {
    return <HeatmapSkeleton height={height} className={className} />;
  }

  if (cells.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border",
          isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200",
          className
        )}
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No data available for heatmap</p>
      </div>
    );
  }

  const handleExport = (canvas: HTMLCanvasElement) => {
    const filename = `${sensorType}-heatmap-${new Date().toISOString().split("T")[0]}.png`;
    exportHeatmapAsPNG(canvas, filename);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* View toggle */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">
          {sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} Pattern (7-Day × 24-Hour)
        </h3>
        <div className="flex gap-1 sm:hidden">
          <Button
            variant={view === "heatmap" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("heatmap")}
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("table")}
          >
            <Table2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Heatmap or table */}
      <div
        className={cn(
          isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200",
          "border rounded-lg p-4"
        )}
      >
        {view === "heatmap" ? (
          <HeatmapGrid cells={cells} min={min} max={max} unit={unit} isDark={isDark} onExport={handleExport} />
        ) : (
          <HeatmapTable cells={cells} unit={unit} isDark={isDark} />
        )}
      </div>

      {/* Stats */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {cells.length} time slots with data ({cells.reduce((sum, c) => sum + c.count, 0)} total readings)
        </span>
        <span>
          Range: {min.toFixed(1)} - {max.toFixed(1)}
          {unit}
        </span>
      </div>
    </div>
  );
}
