/**
 * Export Utilities for EnviroFlow
 *
 * Provides functions to export sensor data in multiple formats:
 * - CSV: Comma-separated values with all sensor readings
 * - JSON: Structured data with metadata
 * - PDF: Visual report with charts and summary statistics
 */

import { format } from "date-fns";
import type { SensorReading, SensorType } from "@/types";

// =============================================================================
// Types
// =============================================================================

export type ExportFormat = "csv" | "json" | "pdf";

export interface ExportMetadata {
  controllerName: string;
  controllerId: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  exportedAt: Date;
  totalReadings: number;
  sensorTypes: SensorType[];
}

export interface ExportOptions {
  format: ExportFormat;
  data: SensorReading[];
  metadata: ExportMetadata;
  chartElement?: HTMLElement | null;
}

export interface SummaryStats {
  sensorType: SensorType;
  count: number;
  min: number;
  max: number;
  avg: number;
  latest: number;
  unit: string;
}

// =============================================================================
// Constants
// =============================================================================

const LARGE_EXPORT_THRESHOLD = 100000; // Warn if more than 100k rows
const CSV_HEADERS = ["timestamp", "temperature", "humidity", "vpd", "co2", "light", "ph", "ec", "soil_moisture", "pressure"];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generates a standardized filename for exports.
 * Format: enviroflow_sensors_[controllername]_[startdate]_[enddate].[ext]
 */
export function generateExportFilename(
  controllerName: string,
  startDate: Date,
  endDate: Date,
  format: ExportFormat
): string {
  const cleanName = controllerName.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return `enviroflow_sensors_${cleanName}_${startStr}_${endStr}.${format}`;
}

/**
 * Checks if the export is large and returns a warning message if needed.
 */
export function checkExportSize(rowCount: number): { isLarge: boolean; warning?: string } {
  if (rowCount > LARGE_EXPORT_THRESHOLD) {
    return {
      isLarge: true,
      warning: `This export contains ${rowCount.toLocaleString()} rows, which may affect browser performance. Consider reducing the date range.`,
    };
  }
  return { isLarge: false };
}

/**
 * Calculates summary statistics for each sensor type in the dataset.
 */
export function calculateSummaryStats(readings: SensorReading[]): SummaryStats[] {
  const statsByType = new Map<SensorType, {
    values: number[];
    unit: string;
    latest: { value: number; timestamp: Date };
  }>();

  // Group readings by sensor type
  for (const reading of readings) {
    if (!statsByType.has(reading.sensor_type)) {
      statsByType.set(reading.sensor_type, {
        values: [],
        unit: reading.unit,
        latest: { value: reading.value, timestamp: new Date(reading.recorded_at) },
      });
    }

    const stats = statsByType.get(reading.sensor_type)!;
    stats.values.push(reading.value);

    // Track latest reading
    const readingTime = new Date(reading.recorded_at);
    if (readingTime > stats.latest.timestamp) {
      stats.latest = { value: reading.value, timestamp: readingTime };
    }
  }

  // Calculate stats for each sensor type
  const summaries: SummaryStats[] = [];
  for (const [sensorType, data] of statsByType.entries()) {
    const values = data.values;
    const sum = values.reduce((acc, v) => acc + v, 0);

    summaries.push({
      sensorType,
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      latest: data.latest.value,
      unit: data.unit,
    });
  }

  return summaries;
}

/**
 * Organizes sensor readings by timestamp for CSV export.
 * Creates a row-based structure where each row represents a timestamp
 * with all sensor readings for that time.
 */
function organizeReadingsByTimestamp(readings: SensorReading[]): Array<Record<string, unknown>> {
  const rowMap = new Map<string, Record<string, unknown>>();

  for (const reading of readings) {
    const timestamp = reading.recorded_at;

    if (!rowMap.has(timestamp)) {
      rowMap.set(timestamp, { timestamp });
    }

    const row = rowMap.get(timestamp)!;
    row[reading.sensor_type] = reading.value;
  }

  // Sort by timestamp
  return Array.from(rowMap.values()).sort((a, b) => {
    const timeA = new Date(a.timestamp as string).getTime();
    const timeB = new Date(b.timestamp as string).getTime();
    return timeA - timeB;
  });
}

/**
 * Triggers a client-side download of a blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// =============================================================================
// Export Functions
// =============================================================================

/**
 * Exports sensor readings to CSV format.
 *
 * Creates a CSV file with columns for timestamp and all sensor types.
 * Missing sensor values for a given timestamp are left empty.
 *
 * @param readings - Array of sensor readings to export
 * @param metadata - Export metadata including controller info and date range
 * @returns Promise that resolves when download is triggered
 */
export async function exportToCSV(
  readings: SensorReading[],
  metadata: ExportMetadata
): Promise<void> {
  // Organize readings by timestamp
  const rows = organizeReadingsByTimestamp(readings);

  // Build CSV header
  const headers = CSV_HEADERS.filter(header => {
    if (header === "timestamp") return true;
    return metadata.sensorTypes.includes(header as SensorType);
  });

  // Build CSV content
  const csvLines: string[] = [headers.join(",")];

  for (const row of rows) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === undefined || value === null) return "";
      if (header === "timestamp") {
        return format(new Date(value as string), "yyyy-MM-dd HH:mm:ss");
      }
      return String(value);
    });
    csvLines.push(values.join(","));
  }

  const csvContent = csvLines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = generateExportFilename(
    metadata.controllerName,
    metadata.dateRange.start,
    metadata.dateRange.end,
    "csv"
  );

  downloadBlob(blob, filename);
}

/**
 * Exports sensor readings to JSON format.
 *
 * Creates a structured JSON file with:
 * - Metadata (controller, date range, export time)
 * - Summary statistics
 * - Full readings array
 *
 * @param readings - Array of sensor readings to export
 * @param metadata - Export metadata including controller info and date range
 * @returns Promise that resolves when download is triggered
 */
export async function exportToJSON(
  readings: SensorReading[],
  metadata: ExportMetadata
): Promise<void> {
  const summaryStats = calculateSummaryStats(readings);

  const jsonData = {
    metadata: {
      controller: {
        id: metadata.controllerId,
        name: metadata.controllerName,
      },
      dateRange: {
        start: metadata.dateRange.start.toISOString(),
        end: metadata.dateRange.end.toISOString(),
      },
      exportedAt: metadata.exportedAt.toISOString(),
      totalReadings: metadata.totalReadings,
      sensorTypes: metadata.sensorTypes,
    },
    summary: summaryStats.map(stat => ({
      sensorType: stat.sensorType,
      count: stat.count,
      min: stat.min,
      max: stat.max,
      average: stat.avg,
      latest: stat.latest,
      unit: stat.unit,
    })),
    readings: readings.map(reading => ({
      timestamp: reading.recorded_at,
      sensorType: reading.sensor_type,
      value: reading.value,
      unit: reading.unit,
      port: reading.port,
      isStale: reading.is_stale,
    })),
  };

  const jsonContent = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  const filename = generateExportFilename(
    metadata.controllerName,
    metadata.dateRange.start,
    metadata.dateRange.end,
    "json"
  );

  downloadBlob(blob, filename);
}

/**
 * Exports sensor data to PDF format.
 *
 * Creates a PDF report including:
 * - Chart image (if provided)
 * - Summary statistics table
 * - Metadata header
 *
 * Note: Requires jsPDF and html2canvas libraries.
 * This is a client-side implementation that works in the browser.
 *
 * @param readings - Array of sensor readings to export
 * @param metadata - Export metadata including controller info and date range
 * @param chartElement - Optional chart DOM element to capture as image
 * @returns Promise that resolves when download is triggered
 */
export async function exportToPDF(
  readings: SensorReading[],
  metadata: ExportMetadata,
  chartElement?: HTMLElement | null
): Promise<void> {
  // Dynamically import jsPDF and html2canvas to reduce bundle size
  const [jsPDFModule, html2canvasModule] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const jsPDF = (jsPDFModule as any).default || jsPDFModule;
  const html2canvas = (html2canvasModule as any).default || html2canvasModule;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("EnviroFlow Sensor Data Export", margin, yPosition);
  yPosition += 10;

  // Metadata
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Controller: ${metadata.controllerName}`, margin, yPosition);
  yPosition += 5;
  doc.text(
    `Date Range: ${format(metadata.dateRange.start, "MMM d, yyyy")} - ${format(metadata.dateRange.end, "MMM d, yyyy")}`,
    margin,
    yPosition
  );
  yPosition += 5;
  doc.text(`Exported: ${format(metadata.exportedAt, "MMM d, yyyy HH:mm:ss")}`, margin, yPosition);
  yPosition += 5;
  doc.text(`Total Readings: ${metadata.totalReadings.toLocaleString()}`, margin, yPosition);
  yPosition += 10;

  // Summary Statistics
  const summaryStats = calculateSummaryStats(readings);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Summary Statistics", margin, yPosition);
  yPosition += 8;

  // Create table for summary stats
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const tableHeaders = ["Sensor", "Count", "Min", "Max", "Avg", "Latest"];
  const colWidths = [35, 20, 25, 25, 25, 25];
  let xPos = margin;

  // Table header
  tableHeaders.forEach((header, i) => {
    doc.text(header, xPos, yPosition);
    xPos += colWidths[i];
  });
  yPosition += 5;

  // Table rows
  doc.setFont("helvetica", "normal");
  for (const stat of summaryStats) {
    if (yPosition > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    xPos = margin;
    const rowData = [
      stat.sensorType.toUpperCase(),
      String(stat.count),
      `${stat.min.toFixed(1)}${stat.unit}`,
      `${stat.max.toFixed(1)}${stat.unit}`,
      `${stat.avg.toFixed(1)}${stat.unit}`,
      `${stat.latest.toFixed(1)}${stat.unit}`,
    ];

    rowData.forEach((cell, i) => {
      doc.text(cell, xPos, yPosition);
      xPos += colWidths[i];
    });
    yPosition += 5;
  }

  // Chart image (if provided)
  if (chartElement) {
    yPosition += 10;

    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Sensor Chart", margin, yPosition);
    yPosition += 8;

    try {
      const canvas = await html2canvas(chartElement, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Check if we need a new page for the chart
      if (yPosition + imgHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      doc.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
    } catch (error) {
      console.error("Failed to capture chart image:", error);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text("Chart image could not be generated", margin, yPosition);
    }
  }

  // Save PDF
  const filename = generateExportFilename(
    metadata.controllerName,
    metadata.dateRange.start,
    metadata.dateRange.end,
    "pdf"
  );

  doc.save(filename);
}

/**
 * Main export function that routes to the appropriate format handler.
 *
 * @param options - Export options including format, data, and metadata
 * @returns Promise that resolves when export is complete
 */
export async function exportSensorData(options: ExportOptions): Promise<void> {
  const { format, data, metadata, chartElement } = options;

  // Check for large exports
  const sizeCheck = checkExportSize(data.length);
  if (sizeCheck.isLarge && sizeCheck.warning) {
    console.warn(sizeCheck.warning);
  }

  switch (format) {
    case "csv":
      return exportToCSV(data, metadata);
    case "json":
      return exportToJSON(data, metadata);
    case "pdf":
      return exportToPDF(data, metadata, chartElement);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
