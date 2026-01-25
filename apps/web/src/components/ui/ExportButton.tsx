"use client";

import { useState, useRef } from "react";
import { Download, FileText, FileJson, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { SensorReading, SensorType } from "@/types";
import {
  exportSensorData,
  checkExportSize,
  type ExportFormat,
  type ExportMetadata,
} from "@/lib/export-utils";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface ExportButtonProps {
  /** Sensor readings to export */
  data: SensorReading[];
  /** Controller name for filename generation */
  controllerName: string;
  /** Controller ID for metadata */
  controllerId: string;
  /** Date range for the data */
  dateRange: {
    start: Date;
    end: Date;
  };
  /** Optional ref to the chart element for PDF export */
  chartRef?: React.RefObject<HTMLElement>;
  /** Button variant */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Whether to show text label */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when export starts */
  onExportStart?: (format: ExportFormat) => void;
  /** Callback when export completes */
  onExportComplete?: (format: ExportFormat) => void;
  /** Callback when export fails */
  onExportError?: (format: ExportFormat, error: Error) => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ExportButton - Allows users to export sensor data in multiple formats.
 *
 * Provides a dropdown menu with options to export data as:
 * - CSV: Comma-separated values with timestamp and sensor columns
 * - JSON: Structured data with metadata and summary statistics
 * - PDF: Visual report with chart image and summary tables
 *
 * Features:
 * - Client-side export (no server round-trip)
 * - Large dataset warning (>100k rows)
 * - Format-specific icons
 * - Toast notifications for success/error
 * - Configurable appearance
 *
 * @example
 * ```tsx
 * const chartRef = useRef<HTMLDivElement>(null);
 *
 * <div ref={chartRef}>
 *   <SensorChart {...chartProps} />
 * </div>
 *
 * <ExportButton
 *   data={sensorReadings}
 *   controllerName="Grow Tent A"
 *   controllerId="ctrl_123"
 *   dateRange={{ start: new Date("2024-01-01"), end: new Date() }}
 *   chartRef={chartRef}
 *   showLabel
 * />
 * ```
 */
export function ExportButton({
  data,
  controllerName,
  controllerId,
  dateRange,
  chartRef,
  variant = "outline",
  size = "default",
  showLabel = true,
  className,
  onExportStart,
  onExportComplete,
  onExportError,
}: ExportButtonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [showLargeExportWarning, setShowLargeExportWarning] = useState(false);
  const pendingExportFormat = useRef<ExportFormat | null>(null);

  // Calculate metadata
  const sensorTypes = Array.from(
    new Set(data.map(reading => reading.sensor_type))
  ) as SensorType[];

  const metadata: ExportMetadata = {
    controllerName,
    controllerId,
    dateRange,
    exportedAt: new Date(),
    totalReadings: data.length,
    sensorTypes,
  };

  /**
   * Handles the export process for a given format.
   */
  const handleExport = async (format: ExportFormat) => {
    // Check if data is empty
    if (data.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no sensor readings available for the selected date range.",
        variant: "destructive",
      });
      return;
    }

    // Check for large exports and show warning
    const sizeCheck = checkExportSize(data.length);
    if (sizeCheck.isLarge && sizeCheck.warning) {
      pendingExportFormat.current = format;
      setShowLargeExportWarning(true);
      return;
    }

    // Proceed with export
    await performExport(format);
  };

  /**
   * Performs the actual export operation.
   */
  const performExport = async (format: ExportFormat) => {
    setIsExporting(true);
    onExportStart?.(format);

    try {
      await exportSensorData({
        format,
        data,
        metadata,
        chartElement: format === "pdf" ? chartRef?.current : undefined,
      });

      toast({
        title: "Export successful",
        description: `Sensor data exported as ${format.toUpperCase()}`,
      });

      onExportComplete?.(format);
    } catch (error) {
      console.error(`Export failed (${format}):`, error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      toast({
        title: "Export failed",
        description: `Failed to export data: ${errorMessage}`,
        variant: "destructive",
      });

      onExportError?.(format, error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Handles confirmation of large export.
   */
  const handleLargeExportConfirm = async () => {
    setShowLargeExportWarning(false);
    if (pendingExportFormat.current) {
      await performExport(pendingExportFormat.current);
      pendingExportFormat.current = null;
    }
  };

  /**
   * Handles cancellation of large export.
   */
  const handleLargeExportCancel = () => {
    setShowLargeExportWarning(false);
    pendingExportFormat.current = null;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={isExporting || data.length === 0}
            className={cn("gap-2", className)}
          >
            <Download className="h-4 w-4" />
            {showLabel && (isExporting ? "Exporting..." : "Export")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Export Format</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleExport("csv")}
            disabled={isExporting}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            <div className="flex flex-col">
              <span>CSV</span>
              <span className="text-xs text-muted-foreground">Spreadsheet format</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport("json")}
            disabled={isExporting}
            className="gap-2"
          >
            <FileJson className="h-4 w-4" />
            <div className="flex flex-col">
              <span>JSON</span>
              <span className="text-xs text-muted-foreground">Structured data</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
            className="gap-2"
          >
            <FileType className="h-4 w-4" />
            <div className="flex flex-col">
              <span>PDF</span>
              <span className="text-xs text-muted-foreground">Report with chart</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Large export warning dialog */}
      <AlertDialog open={showLargeExportWarning} onOpenChange={setShowLargeExportWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Large Export Warning</AlertDialogTitle>
            <AlertDialogDescription>
              This export contains {data.length.toLocaleString()} rows, which may affect browser
              performance and take some time to process.
              <br />
              <br />
              Consider reducing the date range for better performance. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleLargeExportCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLargeExportConfirm}>
              Continue Export
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Export button with icon-only variant for compact layouts.
 */
export function ExportButtonIcon(props: Omit<ExportButtonProps, "showLabel">) {
  return <ExportButton {...props} showLabel={false} size="icon" />;
}
