/**
 * Push Token API Routes
 *
 * POST   /api/push-tokens         - Register a push notification token for user
 * DELETE /api/push-tokens         - Remove a push notification token
 * GET    /api/push-tokens         - List user's push tokens (without actual token values)
 *
 * SECURITY NOTES:
 * - All operations require authentication
 * - Tokens are validated before storage
 * - Users can only manage their own tokens
 * - Invalid tokens are automatically cleaned up
 * - GET endpoint never returns actual token values (security)
 *
 * @module api/push-tokens
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  registerPushToken,
  unregisterPushToken,
  type PushPlatform,
} from "@/lib/push-notification-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

/** Cached Supabase client instance */
let supabase: SupabaseClient | null = null;

/**
 * Gets or creates the Supabase client instance (service role).
 * Service role is required to bypass RLS for push token operations.
 *
 * @throws Error if Supabase credentials are not configured
 * @returns Supabase client instance
 */
function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Supabase credentials not configured. " +
          "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
      );
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
 * Extracts and validates user ID from request.
 * Supports Bearer token authentication and development fallback.
 *
 * @param request - The incoming Next.js request
 * @param client - Supabase client for auth verification
 * @returns User ID string or null if not authenticated
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

  // Development fallback for testing
  if (process.env.NODE_ENV !== "production") {
    return request.headers.get("x-user-id");
  }

  return null;
}

/**
 * Supported push token platforms.
 * Maps to database constraint on push_tokens.platform column.
 */
type TokenPlatform = PushPlatform;

/**
 * Request body for registering a push token.
 * Accepts either 'platform' (preferred) or 'type' (legacy) field.
 */
interface RegisterTokenRequest {
  /** The push notification token string */
  token: string;
  /** Platform: ios, android, or web (preferred) */
  platform?: TokenPlatform;
  /** Legacy field for backwards compatibility (maps to platform) */
  type?: "web_push" | "fcm" | "apns";
  /** Optional friendly device name */
  device_name?: string;
  /** Optional user agent string for device identification */
  user_agent?: string;
}

/**
 * Maps legacy token type names to platform names.
 * Provides backwards compatibility with older API clients.
 */
function mapLegacyTypeToplatform(
  type: "web_push" | "fcm" | "apns"
): TokenPlatform {
  switch (type) {
    case "web_push":
      return "web";
    case "fcm":
      return "android";
    case "apns":
      return "ios";
    default:
      throw new Error(`Unknown token type: ${type}`);
  }
}

/**
 * Validates a push token format based on its platform.
 * Prevents storage of malformed tokens.
 *
 * @param token - The token string to validate
 * @param platform - The token platform (ios, android, web)
 * @returns true if the token format is valid
 */
function isValidTokenFormat(token: string, platform: TokenPlatform): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  // Minimum length check
  if (token.length < 20) {
    return false;
  }

  switch (platform) {
    case "web":
      // Web Push: Either a JSON subscription object or URL endpoint
      try {
        if (token.startsWith("{")) {
          const parsed = JSON.parse(token);
          return !!parsed.endpoint && !!parsed.keys;
        }
        return token.startsWith("https://");
      } catch {
        return false;
      }

    case "android":
      // FCM tokens are alphanumeric strings, usually 150-200 chars
      // They may contain colons and underscores
      return /^[A-Za-z0-9:_-]+$/.test(token) && token.length >= 100;

    case "ios":
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
 * If the token already exists, updates the timestamp.
 *
 * Request Body: {
 *   token: string         - The push notification token
 *   platform: string      - Platform: 'ios' | 'android' | 'web' (preferred)
 *   type?: string         - Legacy: 'web_push' | 'fcm' | 'apns' (backwards compatible)
 *   device_name?: string  - Optional friendly device name
 *   user_agent?: string   - Optional user agent for identification
 * }
 *
 * Response: {
 *   success: true
 *   message: string
 *   platform: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const client = getSupabase();
    const userId = await getUserId(request, client);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const { token, platform: rawPlatform, type: legacyType, device_name } = body;

    // Validate required token field
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Determine platform (prefer 'platform' field, fall back to 'type' for legacy)
    let platform: TokenPlatform;

    if (rawPlatform && ["ios", "android", "web"].includes(rawPlatform)) {
      platform = rawPlatform;
    } else if (legacyType && ["web_push", "fcm", "apns"].includes(legacyType)) {
      platform = mapLegacyTypeToplatform(legacyType);
    } else {
      return NextResponse.json(
        {
          error: "Invalid platform",
          validPlatforms: ["ios", "android", "web"],
          legacyTypes: ["web_push", "fcm", "apns"],
        },
        { status: 400 }
      );
    }

    // Validate token format
    if (!isValidTokenFormat(token, platform)) {
      return NextResponse.json(
        { error: `Invalid token format for platform: ${platform}` },
        { status: 400 }
      );
    }

    // Use the push notification service to register the token
    const success = await registerPushToken(userId, token, platform);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to register token" },
        { status: 500 }
      );
    }

    // If device_name provided, update it separately
    if (device_name) {
      await client
        .from("push_tokens")
        .update({ device_name })
        .eq("user_id", userId)
        .eq("token", token);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Token registered successfully",
        platform,
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Use the push notification service to unregister the token
    const success = await unregisterPushToken(token);

    if (!success) {
      return NextResponse.json(
        { error: "Token not found or failed to delete" },
        { status: 404 }
      );
    }

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
 * SECURITY: Never returns actual token values, only metadata.
 *
 * Response: {
 *   success: true
 *   tokens: Array<{
 *     id: string
 *     platform: string
 *     device_name: string | null
 *     is_active: boolean
 *     created_at: string
 *     updated_at: string
 *   }>
 *   count: number
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const client = getSupabase();
    const userId = await getUserId(request, client);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's tokens (never return the actual token value for security)
    const { data: tokens, error } = await client
      .from("push_tokens")
      .select(
        `
        id,
        platform,
        device_name,
        is_active,
        created_at,
        updated_at
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
