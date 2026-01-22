/**
 * Data Export API Route
 *
 * GET /api/export?type=sensor_readings&format=csv
 * GET /api/export?type=activity_logs&format=csv
 *
 * Query Parameters:
 * - type: 'sensor_readings' | 'activity_logs' (required)
 * - format: 'csv' | 'json' (default: 'csv')
 * - start_date: ISO date string (optional, defaults to 30 days ago)
 * - end_date: ISO date string (optional, defaults to now)
 * - room_id: UUID (optional, filter by room)
 * - controller_id: UUID (optional, filter by controller)
 *
 * Security:
 * - Requires authentication via Authorization header or x-user-id
 * - Only returns data belonging to the authenticated user
 * - Validates all input parameters
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering since this route uses request headers
export const dynamic = "force-dynamic";

// Valid export types
const VALID_TYPES = ["sensor_readings", "activity_logs"] as const;
type ExportType = (typeof VALID_TYPES)[number];

// Valid export formats
const VALID_FORMATS = ["csv", "json"] as const;
type ExportFormat = (typeof VALID_FORMATS)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

// Lazy initialization of Supabase client
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Supabase credentials not configured");
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * Validate UUID format
 */
function isValidUUID(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate ISO date string
 */
function isValidDateString(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Escape CSV value to handle special characters
 * Follows RFC 4180 for CSV formatting
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // If the value contains special characters, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert array of objects to CSV string
 */
function convertToCSV(data: Record<string, unknown>[], columns: string[]): string {
  if (data.length === 0) {
    return columns.join(",") + "\n";
  }

  // Header row
  const header = columns.map(escapeCsvValue).join(",");

  // Data rows
  const rows = data.map((row) =>
    columns.map((col) => escapeCsvValue(row[col])).join(",")
  );

  return [header, ...rows].join("\n");
}

/**
 * GET /api/export
 *
 * Export user data as CSV or JSON
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabase();

    // Authenticate user
    const authHeader = request.headers.get("authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Development fallback: x-user-id header
    if (!userId) {
      userId = request.headers.get("x-user-id");
    }

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Provide Authorization header or x-user-id for testing.",
        },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as ExportType | null;
    const format = (searchParams.get("format") || "csv") as ExportFormat;
    const startDateParam = searchParams.get("start_date");
    const endDateParam = searchParams.get("end_date");
    const roomId = searchParams.get("room_id");
    const controllerId = searchParams.get("controller_id");

    // Validate type parameter
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate format parameter
    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid format. Must be one of: ${VALID_FORMATS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Default date range: last 30 days
    const endDate = endDateParam && isValidDateString(endDateParam)
      ? new Date(endDateParam)
      : new Date();
    const startDate = startDateParam && isValidDateString(startDateParam)
      ? new Date(startDateParam)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Validate optional UUIDs
    if (roomId && !isValidUUID(roomId)) {
      return NextResponse.json(
        { success: false, error: "Invalid room_id format" },
        { status: 400 }
      );
    }

    if (controllerId && !isValidUUID(controllerId)) {
      return NextResponse.json(
        { success: false, error: "Invalid controller_id format" },
        { status: 400 }
      );
    }

    let data: Record<string, unknown>[];
    let columns: string[];
    let filename: string;

    if (type === "sensor_readings") {
      // Fetch sensor readings with filters
      let query = supabase
        .from("sensor_readings")
        .select(
          `
          id,
          controller_id,
          port,
          sensor_type,
          value,
          unit,
          is_stale,
          timestamp
        `
        )
        .eq("user_id", userId)
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", endDate.toISOString())
        .order("timestamp", { ascending: false });

      if (controllerId) {
        query = query.eq("controller_id", controllerId);
      }

      const { data: readings, error } = await query.limit(10000); // Safety limit

      if (error) {
        console.error("Sensor readings export error:", error);
        return NextResponse.json(
          { success: false, error: "Failed to fetch sensor readings" },
          { status: 500 }
        );
      }

      data = readings || [];
      columns = [
        "id",
        "controller_id",
        "port",
        "sensor_type",
        "value",
        "unit",
        "is_stale",
        "timestamp",
      ];
      filename = `sensor_readings_${format === "csv" ? "csv" : "json"}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}`;
    } else {
      // Fetch activity logs with filters
      let query = supabase
        .from("activity_logs")
        .select(
          `
          id,
          workflow_id,
          room_id,
          controller_id,
          action_type,
          action_data,
          result,
          error_message,
          timestamp
        `
        )
        .eq("user_id", userId)
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", endDate.toISOString())
        .order("timestamp", { ascending: false });

      if (roomId) {
        query = query.eq("room_id", roomId);
      }

      if (controllerId) {
        query = query.eq("controller_id", controllerId);
      }

      const { data: logs, error } = await query.limit(10000); // Safety limit

      if (error) {
        console.error("Activity logs export error:", error);
        return NextResponse.json(
          { success: false, error: "Failed to fetch activity logs" },
          { status: 500 }
        );
      }

      // Flatten action_data for CSV export
      data = (logs || []).map((log) => ({
        ...log,
        // Convert JSONB to string for CSV compatibility
        action_data:
          format === "csv"
            ? JSON.stringify(log.action_data)
            : log.action_data,
      }));
      columns = [
        "id",
        "workflow_id",
        "room_id",
        "controller_id",
        "action_type",
        "action_data",
        "result",
        "error_message",
        "timestamp",
      ];
      filename = `activity_logs_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}`;
    }

    // Generate response based on format
    if (format === "csv") {
      const csvContent = convertToCSV(data, columns);

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    } else {
      // JSON format
      return NextResponse.json(
        {
          success: true,
          type,
          count: data.length,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          data,
        },
        {
          status: 200,
          headers: {
            "Content-Disposition": `attachment; filename="${filename}.json"`,
            "Cache-Control": "no-store",
          },
        }
      );
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}
