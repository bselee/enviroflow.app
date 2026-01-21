/**
 * Push Token API Routes
 *
 * POST   /api/push-tokens         - Register a push notification token for user
 * DELETE /api/push-tokens         - Remove a push notification token
 *
 * SECURITY NOTES:
 * - All operations require authentication
 * - Tokens are validated before storage
 * - Users can only manage their own tokens
 * - Invalid tokens are automatically cleaned up
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

// Lazy Supabase client
let supabase: SupabaseClient | null = null;

/**
 * Gets or creates the Supabase client instance (service role)
 */
function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Supabase credentials not configured");
    }

    supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
}

/**
 * Extracts and validates user ID from request
 */
async function getUserId(
  request: NextRequest,
  client: SupabaseClient
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const {
      data: { user },
    } = await client.auth.getUser(token);
    return user?.id || null;
  }

  // Development fallback
  if (process.env.NODE_ENV !== "production") {
    return request.headers.get("x-user-id");
  }

  return null;
}

/**
 * Supported push token types
 */
type TokenType = "web_push" | "fcm" | "apns";

/**
 * Request body for registering a push token
 */
interface RegisterTokenRequest {
  token: string;
  type: TokenType;
  device_name?: string;
  user_agent?: string;
}

/**
 * Validates a push token format based on its type
 *
 * @param token - The token string to validate
 * @param type - The token type (web_push, fcm, apns)
 * @returns true if the token format is valid
 */
function isValidTokenFormat(token: string, type: TokenType): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  // Minimum length check
  if (token.length < 20) {
    return false;
  }

  switch (type) {
    case "web_push":
      // Web Push tokens are typically URL-safe base64 or JSON endpoints
      // They often start with https:// or contain base64 characters
      return (
        token.startsWith("https://") ||
        /^[A-Za-z0-9_-]+$/.test(token.replace(/[:.]/g, ""))
      );

    case "fcm":
      // FCM tokens are alphanumeric strings, usually 150-200 chars
      // They may contain colons and underscores
      return /^[A-Za-z0-9:_-]+$/.test(token) && token.length >= 100;

    case "apns":
      // APNS tokens are 64-character hex strings (32 bytes)
      return /^[a-f0-9]{64}$/i.test(token);

    default:
      return false;
  }
}

/**
 * POST /api/push-tokens
 *
 * Register a push notification token for the authenticated user.
 * If the token already exists, updates the last_seen timestamp.
 *
 * Request Body: {
 *   token: string       - The push notification token
 *   type: string        - Token type: 'web_push' | 'fcm' | 'apns'
 *   device_name?: string - Optional friendly device name
 *   user_agent?: string  - Optional user agent for identification
 * }
 *
 * Response: {
 *   success: true
 *   message: string
 *   token_id: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const client = getSupabase();
    const userId = await getUserId(request, client);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    let body: RegisterTokenRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { token, type, device_name, user_agent } = body;

    // Validate required fields
    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    if (!type || !["web_push", "fcm", "apns"].includes(type)) {
      return NextResponse.json(
        {
          error: "Invalid token type",
          validTypes: ["web_push", "fcm", "apns"],
        },
        { status: 400 }
      );
    }

    // Validate token format
    if (!isValidTokenFormat(token, type as TokenType)) {
      return NextResponse.json(
        { error: "Invalid token format for the specified type" },
        { status: 400 }
      );
    }

    // Check if token already exists for this user
    const { data: existingToken, error: findError } = await client
      .from("push_tokens")
      .select("id")
      .eq("user_id", userId)
      .eq("token", token)
      .single();

    if (findError && findError.code !== "PGRST116") {
      // PGRST116 = no rows returned (which is fine)
      console.error("[Push Tokens POST] Find error:", {
        code: findError.code,
        message: findError.message,
      });
    }

    if (existingToken) {
      // Token exists, update last_seen
      const { error: updateError } = await client
        .from("push_tokens")
        .update({
          last_seen: new Date().toISOString(),
          is_valid: true,
          device_name: device_name || null,
          user_agent: user_agent || null,
        })
        .eq("id", existingToken.id);

      if (updateError) {
        console.error("[Push Tokens POST] Update error:", {
          code: updateError.code,
          message: updateError.message,
        });
        return NextResponse.json(
          { error: "Failed to update token" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Token refreshed successfully",
        token_id: existingToken.id,
        is_new: false,
      });
    }

    // Insert new token
    const { data: insertedToken, error: insertError } = await client
      .from("push_tokens")
      .insert({
        user_id: userId,
        token,
        token_type: type,
        device_name: device_name || null,
        user_agent: user_agent || request.headers.get("user-agent") || null,
        is_valid: true,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[Push Tokens POST] Insert error:", {
        code: insertError.code,
        message: insertError.message,
      });

      // Handle duplicate token (race condition)
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Token already registered" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to register token" },
        { status: 500 }
      );
    }

    console.log("[Push Tokens POST] Token registered:", {
      userId: `${userId.substring(0, 8)}...`,
      tokenType: type,
      tokenId: insertedToken.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Token registered successfully",
        token_id: insertedToken.id,
        is_new: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Push Tokens POST] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push-tokens
 *
 * Remove a push notification token for the authenticated user.
 *
 * Request Body: {
 *   token: string - The push notification token to remove
 * }
 *
 * OR Query Parameter: ?token=xxx
 *
 * Response: {
 *   success: true
 *   message: string
 * }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const client = getSupabase();
    const userId = await getUserId(request, client);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get token from query params or body
    let token: string | null = null;

    // Try query parameter first
    const url = new URL(request.url);
    token = url.searchParams.get("token");

    // If not in query, try body
    if (!token) {
      try {
        const body = await request.json();
        token = body.token;
      } catch {
        // Body parsing failed, that's okay if we have query param
      }
    }

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token is required (in query param or body)" },
        { status: 400 }
      );
    }

    // Delete the token (only if it belongs to this user)
    const { data: deletedToken, error: deleteError } = await client
      .from("push_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("token", token)
      .select("id")
      .single();

    if (deleteError) {
      if (deleteError.code === "PGRST116") {
        // No rows returned - token doesn't exist or doesn't belong to user
        return NextResponse.json(
          { error: "Token not found or does not belong to you" },
          { status: 404 }
        );
      }

      console.error("[Push Tokens DELETE] Error:", {
        code: deleteError.code,
        message: deleteError.message,
      });

      return NextResponse.json(
        { error: "Failed to delete token" },
        { status: 500 }
      );
    }

    console.log("[Push Tokens DELETE] Token removed:", {
      userId: `${userId.substring(0, 8)}...`,
      tokenId: deletedToken?.id,
    });

    return NextResponse.json({
      success: true,
      message: "Token removed successfully",
    });
  } catch (error) {
    console.error("[Push Tokens DELETE] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/push-tokens
 *
 * List all push tokens for the authenticated user.
 * Useful for managing notification settings.
 *
 * Response: {
 *   success: true
 *   tokens: Array<{
 *     id: string
 *     token_type: string
 *     device_name: string | null
 *     is_valid: boolean
 *     last_seen: string
 *     created_at: string
 *   }>
 *   count: number
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const client = getSupabase();
    const userId = await getUserId(request, client);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch user's tokens (never return the actual token value)
    const { data: tokens, error } = await client
      .from("push_tokens")
      .select(
        `
        id,
        token_type,
        device_name,
        is_valid,
        last_seen,
        created_at
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Push Tokens GET] Error:", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Failed to fetch tokens" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tokens: tokens || [],
      count: tokens?.length || 0,
    });
  } catch (error) {
    console.error("[Push Tokens GET] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
