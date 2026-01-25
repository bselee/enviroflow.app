/**
 * Push Notification Service
 *
 * Comprehensive push notification service supporting:
 * - Web Push (VAPID-based browser notifications)
 * - Firebase Cloud Messaging (Android)
 * - Apple Push Notification Service (iOS) - placeholder for future implementation
 * - In-app notification fallback for MVP
 *
 * SECURITY NOTES:
 * - Uses Supabase service role for database access (bypasses RLS)
 * - VAPID/FCM keys stored securely in environment variables
 * - Failed delivery attempts are logged and tokens are marked invalid
 * - Sensitive notification content is never logged
 * - Token validation prevents injection attacks
 *
 * ARCHITECTURE:
 * - Abstracts platform-specific push implementations
 * - Provides unified interface for workflow executor
 * - Automatic token cleanup for expired/invalid tokens
 * - Batch sending for multi-device users
 *
 * @module lib/push-notification-service
 */

import { createClient } from "@supabase/supabase-js";

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Platform types for push notification tokens.
 * Matches the database constraint on push_tokens.platform column.
 */
export type PushPlatform = "ios" | "android" | "web";

/**
 * Notification categories for styling and filtering.
 * - alert: Critical alerts requiring immediate attention (high priority)
 * - warning: Non-critical warnings (normal priority)
 * - info: Informational updates (normal priority)
 * - success: Confirmation of successful actions (normal priority)
 */
export type NotificationCategory = "alert" | "info" | "warning" | "success";

/**
 * Priority levels for push notifications.
 * - high: Immediate delivery, wakes device (use sparingly)
 * - normal: Standard delivery, may be batched by OS
 */
export type NotificationPriority = "high" | "normal";

/**
 * Payload structure for sending push notifications.
 *
 * @example
 * ```typescript
 * const payload: PushNotificationPayload = {
 *   userId: "user-uuid-123",
 *   title: "Temperature Alert",
 *   body: "Flower Room temperature exceeded 85F",
 *   category: "alert",
 *   priority: "high",
 *   data: {
 *     roomId: "room-uuid-456",
 *     actionUrl: "/dashboard?room=flower"
 *   }
 * };
 * ```
 */
export interface PushNotificationPayload {
  /** Target user's Supabase UUID */
  userId: string;
  /** Notification title (displayed prominently) */
  title: string;
  /** Notification body text (main message content) */
  body: string;
  /** Notification category for styling/filtering */
  category?: NotificationCategory;
  /** Custom data to include with notification (not displayed, available to app) */
  data?: Record<string, string>;
  /** Delivery priority (affects OS batching behavior) */
  priority?: NotificationPriority;
}

/**
 * Result of sending a push notification to a user.
 * Contains success status and detailed delivery statistics.
 */
export interface SendResult {
  /** Overall success: true if at least one notification was delivered */
  success: boolean;
  /** Number of tokens that received the notification successfully */
  sentCount: number;
  /** Number of tokens that failed to receive the notification */
  failedCount: number;
  /** Error messages from failed deliveries (never includes sensitive data) */
  errors?: string[];
}

/**
 * Database record for push tokens.
 * Matches the push_tokens table schema.
 */
interface PushTokenRecord {
  id: string;
  user_id: string;
  token: string;
  platform: PushPlatform;
  device_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Database record for in-app notifications.
 * Used as MVP fallback when push delivery fails or is unavailable.
 */
interface _InAppNotification {
  id?: string;
  user_id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  data: Record<string, string>;
  is_read: boolean;
  created_at: string;
}

// =============================================================================
// Module Configuration
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

/** Cached Supabase service client instance */
let supabaseClient: SupabaseClient | null = null;

/** Whether VAPID keys have been configured for Web Push */
let vapidConfigured = false;

/**
 * Gets or creates a Supabase client with service role privileges.
 * Service role is required to bypass RLS for push notification operations.
 *
 * @throws Error if Supabase credentials are not configured
 * @returns Supabase client instance
 */
function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Supabase credentials not configured. " +
          "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
      );
    }

    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * Configures VAPID keys for Web Push notifications.
 * Called lazily on first Web Push send attempt.
 *
 * VAPID (Voluntary Application Server Identification) allows
 * the push service to verify the application server's identity.
 */
async function configureVapid(): Promise<boolean> {
  if (vapidConfigured) return true;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject =
    process.env.VAPID_SUBJECT || "mailto:notifications@enviroflow.app";

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn(
      "[PushService] VAPID keys not configured. " +
        "Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY for Web Push support."
    );
    return false;
  }

  try {
    // Dynamic import to avoid bundling web-push in client code
    const webPush = await import("web-push");
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    vapidConfigured = true;
    console.log("[PushService] VAPID configured successfully");
    return true;
  } catch (error) {
    console.error("[PushService] Failed to configure VAPID:", error);
    return false;
  }
}

// =============================================================================
// Core Push Notification Functions
// =============================================================================

/**
 * Sends a push notification to a user across all their registered devices.
 *
 * This function:
 * 1. Retrieves all active push tokens for the user
 * 2. Attempts delivery to each platform (Web, Android, iOS)
 * 3. Marks invalid tokens as inactive
 * 4. Falls back to in-app notification if push delivery fails
 * 5. Returns detailed delivery statistics
 *
 * @param payload - The notification payload containing user, title, body, and options
 * @returns Promise resolving to delivery result with success status and statistics
 *
 * @example
 * ```typescript
 * const result = await sendPushNotification({
 *   userId: "user-uuid-123",
 *   title: "Temperature Alert",
 *   body: "Flower Room temperature exceeded 85F",
 *   category: "alert",
 *   priority: "high",
 *   data: { roomId: "room-123", actionUrl: "/dashboard" }
 * });
 *
 * if (result.success) {
 *   console.log(`Delivered to ${result.sentCount} devices`);
 * } else {
 *   console.error("Delivery failed:", result.errors);
 * }
 * ```
 */
export async function sendPushNotification(
  payload: PushNotificationPayload
): Promise<SendResult> {
  const {
    userId,
    title,
    body,
    category = "info",
    data = {},
    priority = "normal",
  } = payload;

  const result: SendResult = {
    success: false,
    sentCount: 0,
    failedCount: 0,
    errors: [],
  };

  // Validate inputs
  if (!userId || typeof userId !== "string") {
    result.errors?.push("Invalid userId: must be a non-empty string");
    return result;
  }

  if (!title || typeof title !== "string") {
    result.errors?.push("Invalid title: must be a non-empty string");
    return result;
  }

  if (!body || typeof body !== "string") {
    result.errors?.push("Invalid body: must be a non-empty string");
    return result;
  }

  try {
    const supabase = getSupabase();

    // Fetch user's active push tokens
    const { data: tokens, error: fetchError } = await supabase
      .from("push_tokens")
      .select("id, user_id, token, platform, device_name, is_active")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (fetchError) {
      console.error("[PushService] Failed to fetch tokens:", {
        code: fetchError.code,
        message: fetchError.message,
      });
      result.errors?.push("Failed to fetch push tokens from database");

      // Store as in-app notification as fallback
      await storeInAppNotification(supabase, userId, title, body, category, data);
      result.success = true; // In-app fallback succeeded
      return result;
    }

    // If no tokens registered, store as in-app notification
    if (!tokens || tokens.length === 0) {
      console.log(
        `[PushService] No active tokens for user ${userId.substring(0, 8)}..., using in-app fallback`
      );
      await storeInAppNotification(supabase, userId, title, body, category, data);
      result.success = true;
      return result;
    }

    // Track invalid tokens for cleanup
    const invalidTokenIds: string[] = [];

    // Send to each token based on platform
    const sendPromises = (tokens as PushTokenRecord[]).map(async (tokenRecord) => {
      try {
        await sendToToken(tokenRecord, {
          title,
          body,
          category,
          data: {
            ...data,
            timestamp: new Date().toISOString(),
            category,
          },
          priority,
        });
        result.sentCount++;
      } catch (error) {
        result.failedCount++;

        // Check if error indicates invalid/expired token
        if (isTokenInvalidError(error)) {
          invalidTokenIds.push(tokenRecord.id);
        } else {
          result.errors?.push(
            error instanceof Error ? error.message : "Unknown delivery error"
          );
        }
      }
    });

    await Promise.allSettled(sendPromises);

    // Mark invalid tokens as inactive
    if (invalidTokenIds.length > 0) {
      await markTokensInactive(supabase, invalidTokenIds);
      console.log(
        `[PushService] Marked ${invalidTokenIds.length} tokens as inactive`
      );
    }

    // Determine success - at least one delivery or we store in-app
    if (result.sentCount > 0) {
      result.success = true;
    } else {
      // All push deliveries failed - use in-app fallback
      await storeInAppNotification(supabase, userId, title, body, category, data);
      result.success = true; // In-app fallback counts as success
    }

    // Log summary (never log content)
    console.log("[PushService] Notification sent:", {
      userId: `${userId.substring(0, 8)}...`,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      invalidTokens: invalidTokenIds.length,
      category,
      priority,
    });

    return result;
  } catch (error) {
    console.error("[PushService] Unexpected error:", error);
    result.errors?.push(
      error instanceof Error ? error.message : "Unexpected error occurred"
    );
    return result;
  }
}

/**
 * Sends notification to a specific token based on its platform.
 *
 * @param tokenRecord - Database record containing token and platform info
 * @param notification - Notification content to send
 * @throws Error if delivery fails
 */
async function sendToToken(
  tokenRecord: PushTokenRecord,
  notification: {
    title: string;
    body: string;
    category: NotificationCategory;
    data: Record<string, string>;
    priority: NotificationPriority;
  }
): Promise<void> {
  const { token, platform } = tokenRecord;

  switch (platform) {
    case "web":
      await sendWebPush(token, notification);
      break;

    case "android":
      await sendFCM(token, notification);
      break;

    case "ios":
      await sendAPNS(token, notification);
      break;

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Sends a Web Push notification using the VAPID protocol.
 *
 * Web Push requires:
 * - Service worker registered in browser
 * - VAPID keys configured on server
 * - PushSubscription JSON stored as token
 *
 * @param subscriptionJson - Web Push subscription JSON string
 * @param notification - Notification content
 * @throws Error if VAPID not configured or delivery fails
 */
async function sendWebPush(
  subscriptionJson: string,
  notification: {
    title: string;
    body: string;
    category: NotificationCategory;
    data: Record<string, string>;
    priority: NotificationPriority;
  }
): Promise<void> {
  const isConfigured = await configureVapid();
  if (!isConfigured) {
    throw new Error("VAPID not configured - cannot send Web Push");
  }

  // Parse subscription from stored JSON
  let subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  try {
    subscription = JSON.parse(subscriptionJson);
    if (!subscription.endpoint || !subscription.keys) {
      throw new Error("Invalid subscription format");
    }
  } catch {
    throw new Error("Failed to parse Web Push subscription JSON");
  }

  // Build notification payload
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: `enviroflow-${notification.category}-${Date.now()}`,
    data: notification.data,
    requireInteraction: notification.category === "alert",
    actions:
      notification.category === "alert"
        ? [
            { action: "view", title: "View Details" },
            { action: "dismiss", title: "Dismiss" },
          ]
        : undefined,
  });

  // Dynamic import to avoid bundling in client code
  const webPush = await import("web-push");

  await webPush.sendNotification(subscription, payload, {
    TTL: notification.priority === "high" ? 86400 : 3600, // 24h for high, 1h for normal
    urgency: notification.priority === "high" ? "high" : "normal",
  });
}

/**
 * Sends a Firebase Cloud Messaging notification (Android).
 *
 * Uses FCM HTTP v1 API with OAuth2 authentication.
 * Falls back to legacy API if v1 credentials not available.
 *
 * @param token - FCM device registration token
 * @param notification - Notification content
 * @throws Error if FCM credentials not configured or delivery fails
 */
async function sendFCM(
  token: string,
  notification: {
    title: string;
    body: string;
    category: NotificationCategory;
    data: Record<string, string>;
    priority: NotificationPriority;
  }
): Promise<void> {
  // Check for FCM v1 API credentials (preferred)
  const fcmProjectId = process.env.FIREBASE_PROJECT_ID;
  const fcmPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const fcmClientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  // Fallback to legacy server key
  const fcmServerKey = process.env.FCM_SERVER_KEY;

  if (fcmProjectId && fcmPrivateKey && fcmClientEmail) {
    // Use FCM v1 API (recommended)
    await sendFCMv1(token, notification, {
      projectId: fcmProjectId,
      privateKey: fcmPrivateKey,
      clientEmail: fcmClientEmail,
    });
  } else if (fcmServerKey) {
    // Fallback to legacy API
    await sendFCMLegacy(token, notification, fcmServerKey);
  } else {
    throw new Error(
      "FCM credentials not configured. " +
        "Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL " +
        "or FCM_SERVER_KEY for Android push support."
    );
  }
}

/**
 * Sends FCM notification using v1 API with OAuth2.
 */
async function sendFCMv1(
  token: string,
  notification: {
    title: string;
    body: string;
    category: NotificationCategory;
    data: Record<string, string>;
    priority: NotificationPriority;
  },
  credentials: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
  }
): Promise<void> {
  // Get OAuth2 access token for FCM
  const accessToken = await getFCMAccessToken(credentials);

  const fcmPayload = {
    message: {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data,
      android: {
        priority: notification.priority === "high" ? "HIGH" : "NORMAL",
        notification: {
          channelId:
            notification.category === "alert"
              ? "enviroflow_alerts"
              : "enviroflow_notifications",
          icon: "ic_notification",
          color: getCategoryColor(notification.category),
        },
      },
    },
  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(fcmPayload),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`FCM v1 API error: ${response.status} ${errorBody}`);
  }
}

/**
 * Sends FCM notification using legacy HTTP API.
 * Deprecated but still supported by Google.
 */
async function sendFCMLegacy(
  token: string,
  notification: {
    title: string;
    body: string;
    category: NotificationCategory;
    data: Record<string, string>;
    priority: NotificationPriority;
  },
  serverKey: string
): Promise<void> {
  const fcmPayload = {
    to: token,
    notification: {
      title: notification.title,
      body: notification.body,
      icon: "ic_notification",
      color: getCategoryColor(notification.category),
    },
    data: notification.data,
    priority: notification.priority === "high" ? "high" : "normal",
  };

  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${serverKey}`,
    },
    body: JSON.stringify(fcmPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FCM legacy API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  if (result.failure > 0) {
    const errorResult = result.results?.[0];
    throw new Error(
      `FCM delivery failed: ${errorResult?.error || "Unknown error"}`
    );
  }
}

/**
 * Gets an OAuth2 access token for FCM v1 API.
 * Uses Google Service Account credentials.
 *
 * @param credentials - Service account credentials
 * @returns Access token string
 */
async function getFCMAccessToken(credentials: {
  privateKey: string;
  clientEmail: string;
}): Promise<string> {
  // Create JWT for service account authentication
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: credentials.clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
  };

  // Sign JWT with private key
  const signedJwt = await signJWT(header, payload, credentials.privateKey);

  // Exchange JWT for access token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get FCM access token: ${errorText}`);
  }

  const tokenResponse = await response.json();
  return tokenResponse.access_token;
}

/**
 * Signs a JWT using RS256 algorithm.
 * Note: In production, consider using a library like jose for better security.
 */
async function signJWT(
  header: object,
  payload: object,
  privateKey: string
): Promise<string> {
  // For MVP, we'll use a simplified approach
  // In production, use the `jose` library for proper JWT signing

  const base64UrlEncode = (data: string): string => {
    return Buffer.from(data)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Use Node.js crypto for RS256 signing
  const crypto = await import("crypto");

  // Handle escaped newlines in private key (common in env vars)
  const formattedKey = privateKey.replace(/\\n/g, "\n");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(formattedKey, "base64url");

  return `${signingInput}.${signature}`;
}

/**
 * Sends an Apple Push Notification Service notification (iOS).
 *
 * APNS requires either:
 * - Certificate-based authentication (.p12 file)
 * - Token-based authentication (JWT with .p8 key)
 *
 * For MVP, this is a placeholder that stores notifications in-app.
 * Full APNS support requires additional infrastructure.
 *
 * @param token - APNS device token (64-char hex string)
 * @param notification - Notification content
 * @throws Error - Always throws for MVP (not implemented)
 */
async function sendAPNS(
  _token: string,
  _notification: {
    title: string;
    body: string;
    category: NotificationCategory;
    data: Record<string, string>;
    priority: NotificationPriority;
  }
): Promise<void> {
  // APNS implementation requires either:
  // 1. Certificate-based auth: Requires .p12 file and HTTP/2 connection
  // 2. Token-based auth: Requires .p8 key from Apple Developer Console

  // For MVP, we log a warning and throw to trigger in-app fallback
  console.warn(
    "[PushService] APNS not implemented for MVP. " +
      "iOS users will receive in-app notifications instead."
  );

  throw new Error(
    "APNS support coming in a future release. " +
      "Notification stored as in-app message."
  );
}

// =============================================================================
// Token Registration Functions
// =============================================================================

/**
 * Registers a push notification token for a user.
 *
 * If the token already exists, updates the timestamp.
 * Validates token format based on platform before storage.
 *
 * @param userId - User's Supabase UUID
 * @param token - Platform-specific push token
 * @param platform - Token platform (ios, android, web)
 * @returns Promise resolving to true if registration succeeded
 *
 * @example
 * ```typescript
 * // Register a Web Push subscription
 * const subscription = await navigator.serviceWorker.ready
 *   .then(reg => reg.pushManager.subscribe({ userVisibleOnly: true }));
 * await registerPushToken(userId, JSON.stringify(subscription), "web");
 *
 * // Register an FCM token
 * const fcmToken = await getToken(messaging);
 * await registerPushToken(userId, fcmToken, "android");
 * ```
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: PushPlatform
): Promise<boolean> {
  // Validate inputs
  if (!userId || typeof userId !== "string") {
    console.error("[PushService] Invalid userId for token registration");
    return false;
  }

  if (!token || typeof token !== "string") {
    console.error("[PushService] Invalid token for registration");
    return false;
  }

  if (!["ios", "android", "web"].includes(platform)) {
    console.error("[PushService] Invalid platform:", platform);
    return false;
  }

  // Validate token format
  if (!isValidTokenFormat(token, platform)) {
    console.error("[PushService] Token format validation failed for platform:", platform);
    return false;
  }

  try {
    const supabase = getSupabase();

    // Check if token already exists
    const { data: existing } = await supabase
      .from("push_tokens")
      .select("id")
      .eq("user_id", userId)
      .eq("token", token)
      .single();

    if (existing) {
      // Update existing token timestamp
      const { error: updateError } = await supabase
        .from("push_tokens")
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("[PushService] Failed to update token:", updateError);
        return false;
      }

      console.log("[PushService] Token refreshed:", {
        userId: `${userId.substring(0, 8)}...`,
        platform,
      });
      return true;
    }

    // Insert new token
    const { error: insertError } = await supabase.from("push_tokens").insert({
      user_id: userId,
      token,
      platform,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      // Handle duplicate key (race condition)
      if (insertError.code === "23505") {
        console.log("[PushService] Token already exists (race condition handled)");
        return true;
      }
      console.error("[PushService] Failed to insert token:", insertError);
      return false;
    }

    console.log("[PushService] Token registered:", {
      userId: `${userId.substring(0, 8)}...`,
      platform,
    });
    return true;
  } catch (error) {
    console.error("[PushService] Token registration error:", error);
    return false;
  }
}

/**
 * Unregisters a push notification token.
 *
 * Call this when a user logs out or disables notifications.
 * The token is permanently deleted from the database.
 *
 * @param token - The push token to unregister
 * @returns Promise resolving to true if unregistration succeeded
 *
 * @example
 * ```typescript
 * // On logout
 * await unregisterPushToken(storedToken);
 * ```
 */
export async function unregisterPushToken(token: string): Promise<boolean> {
  if (!token || typeof token !== "string") {
    console.error("[PushService] Invalid token for unregistration");
    return false;
  }

  try {
    const supabase = getSupabase();

    const { error } = await supabase
      .from("push_tokens")
      .delete()
      .eq("token", token);

    if (error) {
      console.error("[PushService] Failed to unregister token:", error);
      return false;
    }

    console.log("[PushService] Token unregistered successfully");
    return true;
  } catch (error) {
    console.error("[PushService] Token unregistration error:", error);
    return false;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Stores an in-app notification as fallback when push delivery fails.
 * In-app notifications are displayed in the app's notification center.
 *
 * Uses the dedicated notifications table if available, falling back to
 * activity_logs for backwards compatibility.
 */
async function storeInAppNotification(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  category: NotificationCategory,
  data: Record<string, string>
): Promise<void> {
  try {
    // Try to insert into the dedicated notifications table first
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: userId,
      title,
      body,
      category,
      data,
      is_read: false,
      workflow_id: data.workflowId || null,
      created_at: new Date().toISOString(),
    });

    if (notifError) {
      // If notifications table doesn't exist yet (migration not run),
      // fall back to activity_logs
      if (notifError.code === "42P01") {
        // relation does not exist
        console.warn(
          "[PushService] Notifications table not found, using activity_logs fallback"
        );
        await supabase.from("activity_logs").insert({
          user_id: userId,
          action_type: "in_app_notification",
          details: {
            title,
            body,
            category,
            data,
            is_read: false,
          },
          result: "success",
          created_at: new Date().toISOString(),
        });
      } else {
        throw notifError;
      }
    }

    console.log("[PushService] In-app notification stored:", {
      userId: `${userId.substring(0, 8)}...`,
      category,
    });
  } catch (error) {
    console.error("[PushService] Failed to store in-app notification:", error);
  }
}

/**
 * Marks push tokens as inactive in the database.
 * Called when push delivery fails with an invalid token error.
 */
async function markTokensInactive(
  supabase: SupabaseClient,
  tokenIds: string[]
): Promise<void> {
  if (tokenIds.length === 0) return;

  try {
    const { error } = await supabase
      .from("push_tokens")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", tokenIds);

    if (error) {
      console.error("[PushService] Failed to mark tokens inactive:", error);
    }
  } catch (error) {
    console.error("[PushService] Error marking tokens inactive:", error);
  }
}

/**
 * Determines if an error indicates the push token is invalid or expired.
 * Used to trigger token cleanup.
 */
function isTokenInvalidError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const invalidIndicators = [
    "unregistered",
    "expired",
    "invalid",
    "notregistered",
    "mismatchsenderid",
    "invalidregistration",
    "bad device token",
    "devicetokennotforapns",
    "410", // HTTP 410 Gone
    "404", // HTTP 404 Not Found
    "unsubscribed",
  ];

  return invalidIndicators.some((indicator) =>
    message.includes(indicator.toLowerCase())
  );
}

/**
 * Validates token format based on platform.
 * Prevents storage of malformed tokens.
 */
function isValidTokenFormat(token: string, platform: PushPlatform): boolean {
  if (!token || token.length < 20) {
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
      // FCM tokens are alphanumeric, 150-200+ chars
      return /^[A-Za-z0-9:_-]+$/.test(token) && token.length >= 100;

    case "ios":
      // APNS tokens are 64-character hex strings
      return /^[a-f0-9]{64}$/i.test(token);

    default:
      return false;
  }
}

/**
 * Returns a hex color code for notification category.
 * Used for Android notification icons.
 */
function getCategoryColor(category: NotificationCategory): string {
  switch (category) {
    case "alert":
      return "#EF4444"; // Red
    case "warning":
      return "#F59E0B"; // Amber
    case "success":
      return "#10B981"; // Green
    case "info":
    default:
      return "#3B82F6"; // Blue
  }
}

// =============================================================================
// Workflow Integration
// =============================================================================

/**
 * Creates a notification payload from workflow execution context.
 *
 * Helper function for the workflow executor to format notifications
 * with appropriate category and data based on the workflow action.
 *
 * @param workflowName - Name of the workflow that triggered
 * @param actionType - Type of workflow action
 * @param roomName - Optional room name for context
 * @param details - Additional details from the trigger
 * @returns Formatted notification payload (without userId)
 *
 * @example
 * ```typescript
 * const notification = createWorkflowNotification(
 *   "Temperature Monitor",
 *   "temperature_alert",
 *   "Flower Room",
 *   { currentTemp: "86", threshold: "85" }
 * );
 *
 * await sendPushNotification({
 *   userId,
 *   ...notification
 * });
 * ```
 */
export function createWorkflowNotification(
  workflowName: string,
  actionType: string,
  roomName?: string,
  details?: Record<string, string>
): Omit<PushNotificationPayload, "userId"> {
  const roomPrefix = roomName ? `${roomName}: ` : "";

  switch (actionType) {
    case "temperature_alert":
      return {
        title: "Temperature Alert",
        body: `${roomPrefix}${workflowName} - ${details?.message || "Temperature threshold triggered"}`,
        category: "alert",
        priority: "high",
        data: {
          type: "workflow",
          workflowName,
          actionType,
          ...details,
        },
      };

    case "humidity_alert":
      return {
        title: "Humidity Alert",
        body: `${roomPrefix}${workflowName} - ${details?.message || "Humidity threshold triggered"}`,
        category: "alert",
        priority: "high",
        data: {
          type: "workflow",
          workflowName,
          actionType,
          ...details,
        },
      };

    case "vpd_alert":
      return {
        title: "VPD Alert",
        body: `${roomPrefix}${workflowName} - ${details?.message || "VPD out of range"}`,
        category: "warning",
        priority: "high",
        data: {
          type: "workflow",
          workflowName,
          actionType,
          ...details,
        },
      };

    case "device_action":
      return {
        title: "Device Action",
        body: `${roomPrefix}${details?.device || "Device"} ${details?.action || "action executed"}`,
        category: "info",
        priority: "normal",
        data: {
          type: "workflow",
          workflowName,
          actionType,
          ...details,
        },
      };

    case "schedule_triggered":
      return {
        title: "Scheduled Action",
        body: `${roomPrefix}${workflowName} scheduled action completed`,
        category: "success",
        priority: "normal",
        data: {
          type: "workflow",
          workflowName,
          actionType,
          ...details,
        },
      };

    case "workflow_error":
      return {
        title: "Workflow Error",
        body: `${roomPrefix}${workflowName} - ${details?.error || "An error occurred"}`,
        category: "alert",
        priority: "high",
        data: {
          type: "workflow",
          workflowName,
          actionType,
          ...details,
        },
      };

    case "controller_offline":
      return {
        title: "Controller Offline",
        body: `${roomPrefix}${details?.controllerName || "Controller"} is no longer responding`,
        category: "warning",
        priority: "high",
        data: {
          type: "system",
          workflowName,
          actionType,
          ...details,
        },
      };

    case "controller_online":
      return {
        title: "Controller Online",
        body: `${roomPrefix}${details?.controllerName || "Controller"} is back online`,
        category: "success",
        priority: "normal",
        data: {
          type: "system",
          workflowName,
          actionType,
          ...details,
        },
      };

    default:
      return {
        title: "EnviroFlow Notification",
        body: `${roomPrefix}${details?.message || workflowName}`,
        category: "info",
        priority: "normal",
        data: {
          type: "workflow",
          workflowName,
          actionType,
          ...details,
        },
      };
  }
}

/**
 * Sends notifications to multiple users (batch operation).
 *
 * Useful for room-wide alerts or system announcements.
 * Executes sends in parallel for performance.
 *
 * @param userIds - Array of user UUIDs
 * @param notification - Notification payload (without userId)
 * @returns Aggregated results for all users
 *
 * @example
 * ```typescript
 * // Alert all users with access to a room
 * const roomUsers = await getRoomUsers(roomId);
 * const result = await sendPushNotificationToMany(
 *   roomUsers.map(u => u.id),
 *   {
 *     title: "Room Alert",
 *     body: "Flower Room requires attention",
 *     category: "alert",
 *     priority: "high"
 *   }
 * );
 * ```
 */
export async function sendPushNotificationToMany(
  userIds: string[],
  notification: Omit<PushNotificationPayload, "userId">
): Promise<{
  success: boolean;
  totalSent: number;
  totalFailed: number;
  results: Record<string, SendResult>;
}> {
  const results: Record<string, SendResult> = {};
  let totalSent = 0;
  let totalFailed = 0;

  // Send to each user in parallel
  const sendPromises = userIds.map(async (userId) => {
    const result = await sendPushNotification({
      userId,
      ...notification,
    });
    results[userId] = result;
    totalSent += result.sentCount;
    totalFailed += result.failedCount;
  });

  await Promise.allSettled(sendPromises);

  return {
    success: totalSent > 0,
    totalSent,
    totalFailed,
    results,
  };
}
