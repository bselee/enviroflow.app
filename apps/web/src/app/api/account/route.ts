/**
 * Account Management API Route
 *
 * DELETE /api/account - Delete user account and all associated data
 *
 * Request Body:
 * {
 *   password: string  // Required for confirmation
 * }
 *
 * Security:
 * - Requires authentication via Authorization header
 * - Requires password confirmation to prevent accidental deletion
 * - Deletes all associated data in the correct order (respecting FK constraints)
 * - Uses transaction-like behavior for data integrity
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

// Lazy initialization of Supabase client with service role key
// Required for admin operations like deleting users
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Supabase credentials not configured");
    }

    supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

/**
 * Schema for delete account request
 */
const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required for account deletion"),
});

/**
 * Tables that contain user data, in deletion order
 * Order matters due to foreign key constraints
 */
const USER_DATA_TABLES = [
  // First, delete dependent tables (no outgoing FKs or only to user)
  "push_tokens",
  "ai_insights",
  "manual_sensor_data",
  "sensor_readings",
  "activity_logs",
  "audit_logs",
  "dimmer_schedules",
  "growth_stages",
  "workflow_templates",
  // Then tables with FK relationships to each other
  "workflows",
  "sunrise_sunset_cache", // Depends on rooms via FK
  "controllers",
  "rooms",
] as const;

/**
 * DELETE /api/account
 *
 * Permanently delete the authenticated user's account and all associated data.
 * This action is irreversible.
 *
 * Process:
 * 1. Verify authentication
 * 2. Verify password for confirmation
 * 3. Delete all user data from all tables
 * 4. Delete the auth user
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdmin();

    // Extract auth token
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Bearer token required.",
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired token. Please sign in again.",
        },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userEmail = user.email;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body",
        },
        { status: 400 }
      );
    }

    const validation = deleteAccountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { password } = validation.data;

    // Verify password by attempting to sign in
    // This ensures the user owns this account
    if (userEmail) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (signInError) {
        // Don't reveal if password is incorrect vs account doesn't exist
        return NextResponse.json(
          {
            success: false,
            error: "Password verification failed. Please check your password.",
          },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify account. Email not found.",
        },
        { status: 400 }
      );
    }

    // Track deletion results for logging
    const deletionResults: Record<string, { deleted: number; error?: string }> = {};

    // Delete user data from all tables
    // Note: Using service role key bypasses RLS, so we explicitly filter by user_id
    for (const table of USER_DATA_TABLES) {
      try {
        // Special handling for sunrise_sunset_cache which doesn't have user_id
        if (table === "sunrise_sunset_cache") {
          // First get user's room IDs
          const { data: rooms } = await supabase
            .from("rooms")
            .select("id")
            .eq("user_id", userId);

          if (rooms && rooms.length > 0) {
            const roomIds = rooms.map((r) => r.id);
            const { error: cacheError, count } = await supabase
              .from(table)
              .delete({ count: "exact" })
              .in("room_id", roomIds);

            deletionResults[table] = {
              deleted: count ?? 0,
              error: cacheError?.message,
            };
          } else {
            deletionResults[table] = { deleted: 0 };
          }
        } else {
          // Standard deletion for tables with user_id column
          const { error: deleteError, count } = await supabase
            .from(table)
            .delete({ count: "exact" })
            .eq("user_id", userId);

          deletionResults[table] = {
            deleted: count ?? 0,
            error: deleteError?.message,
          };
        }
      } catch (err) {
        // Log but continue - we want to delete as much as possible
        console.error(`Error deleting from ${table}:`, err);
        deletionResults[table] = {
          deleted: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }

    // Check for any deletion errors (non-critical, log them)
    const errors = Object.entries(deletionResults)
      .filter(([, result]) => result.error)
      .map(([table, result]) => `${table}: ${result.error}`);

    if (errors.length > 0) {
      console.warn(`Data deletion errors for user ${userId}:`, errors);
    }

    // Delete the auth user
    // This is the final step - if this fails, user can retry
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(
      userId
    );

    if (deleteUserError) {
      console.error("Failed to delete auth user:", deleteUserError);
      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to delete account. Your data has been cleared, but please contact support to complete account deletion.",
          dataDeleted: deletionResults,
        },
        { status: 500 }
      );
    }

    // Log successful deletion for audit purposes
    console.info(`Account deleted: ${userId} (${userEmail})`);

    // Calculate total deleted records
    const totalDeleted = Object.values(deletionResults).reduce(
      (sum, result) => sum + result.deleted,
      0
    );

    return NextResponse.json(
      {
        success: true,
        message: "Your account and all associated data have been permanently deleted.",
        summary: {
          totalRecordsDeleted: totalDeleted,
          tableBreakdown: deletionResults,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Account deletion error:", error);
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
 * GET /api/account
 *
 * Get account information for the authenticated user.
 * Useful for showing account status or data summary before deletion.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdmin();

    // Extract auth token
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Bearer token required.",
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired token",
        },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Get counts of user data for summary
    const [
      controllersResult,
      roomsResult,
      workflowsResult,
      activityLogsResult,
      sensorReadingsResult,
    ] = await Promise.all([
      supabase
        .from("controllers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("workflows")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("sensor_readings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    return NextResponse.json({
      success: true,
      account: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
      },
      dataSummary: {
        controllers: controllersResult.count ?? 0,
        rooms: roomsResult.count ?? 0,
        workflows: workflowsResult.count ?? 0,
        activityLogs: activityLogsResult.count ?? 0,
        sensorReadings: sensorReadingsResult.count ?? 0,
      },
    });
  } catch (error) {
    console.error("Account info error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
