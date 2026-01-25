/**
 * Push Notification Service
 *
 * This module provides functions for sending push notifications to users.
 * Supports Web Push API for browser notifications.
 *
 * SECURITY NOTES:
 * - Uses Supabase service role for database access
 * - VAPID keys should be stored securely in environment variables
 * - Failed delivery attempts are logged and tokens are marked invalid
 * - Never log notification content that may contain sensitive data
 *
 * @module lib/notifications
 */

import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

/**
 * Notification payload structure
 */
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
}

/**
 * Action button for notifications
 */
interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

/**
 * Result of sending a notification
 */
export interface SendNotificationResult {
  success: boolean;
  sent: number;
  failed: number;
  invalidTokens: string[];
  errors: string[];
}

/**
 * Push token record from database
 */
interface PushToken {
  id: string;
  token: string;
  token_type: "web_push" | "fcm" | "apns";
  is_valid: boolean;
}

// VAPID configuration for Web Push
let vapidConfigured = false;

/**
 * Configures VAPID keys for Web Push
 * Should be called once on server startup
 */
function configureVapid(): void {
  if (vapidConfigured) return;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:notifications@enviroflow.app";

  if (vapidPublicKey && vapidPrivateKey) {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    vapidConfigured = true;
    console.log("[Notifications] VAPID configured successfully");
  } else {
    console.warn(
      "[Notifications] VAPID keys not configured. Web Push will not work."
    );
  }
}

/**
 * Gets or creates the Supabase service role client
 */
function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase credentials not configured");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Sends a push notification to a specific user
 *
 * This function retrieves all valid push tokens for the user
 * and attempts to send the notification to each one.
 *
 * @param userId - The user's Supabase UUID
 * @param title - Notification title
 * @param body - Notification body text
 * @param data - Optional additional data to include with notification
 * @returns Result with success status and delivery statistics
 *
 * @example
 * ```ts
 * const result = await sendPushNotification(
 *   "user-uuid",
 *   "Temperature Alert",
 *   "Room A temperature exceeded 85F",
 *   { roomId: "room-1", type: "alert" }
 * );
 * ```
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<SendNotificationResult> {
  const result: SendNotificationResult = {
    success: false,
    sent: 0,
    failed: 0,
    invalidTokens: [],
    errors: [],
  };

  try {
    // Configure VAPID if not already done
    configureVapid();

    const supabase = getSupabase();

    // Fetch user's valid push tokens
    const { data: tokens, error: fetchError } = await supabase
      .from("push_tokens")
      .select("id, token, token_type, is_valid")
      .eq("user_id", userId)
      .eq("is_valid", true);

    if (fetchError) {
      console.error("[Notifications] Failed to fetch tokens:", {
        code: fetchError.code,
        message: fetchError.message,
      });
      result.errors.push("Failed to fetch push tokens");
      return result;
    }

    if (!tokens || tokens.length === 0) {
      // No tokens is not an error, just no notifications to send
      result.success = true;
      return result;
    }

    // Build notification payload
    const payload: NotificationPayload = {
      title,
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      tag: `enviroflow-${Date.now()}`,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        url: data?.url || "/dashboard",
      },
    };

    // Send to each token
    const sendPromises = (tokens as PushToken[]).map(async (tokenRecord) => {
      try {
        await sendToToken(tokenRecord, payload);
        result.sent++;
      } catch (error) {
        result.failed++;

        // Check if the error indicates an invalid token
        if (isTokenInvalidError(error)) {
          result.invalidTokens.push(tokenRecord.id);
        } else {
          result.errors.push(
            error instanceof Error ? error.message : "Send failed"
          );
        }
      }
    });

    await Promise.all(sendPromises);

    // Mark invalid tokens as invalid in database
    if (result.invalidTokens.length > 0) {
      await markTokensInvalid(supabase, result.invalidTokens);
    }

    result.success = result.sent > 0 || tokens.length === 0;

    // Log summary (never log content)
    console.log("[Notifications] Send complete:", {
      userId: `${userId.substring(0, 8)}...`,
      sent: result.sent,
      failed: result.failed,
      invalidTokens: result.invalidTokens.length,
    });

    return result;
  } catch (error) {
    console.error("[Notifications] Error:", error);
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error"
    );
    return result;
  }
}

/**
 * Sends notification to a specific token based on its type
 */
async function sendToToken(
  tokenRecord: PushToken,
  payload: NotificationPayload
): Promise<void> {
  const { token, token_type } = tokenRecord;

  switch (token_type) {
    case "web_push":
      await sendWebPush(token, payload);
      break;

    case "fcm":
      await sendFCM(token, payload);
      break;

    case "apns":
      await sendAPNS(token, payload);
      break;

    default:
      throw new Error(`Unsupported token type: ${token_type}`);
  }
}

/**
 * Sends a Web Push notification
 */
async function sendWebPush(
  subscription: string,
  payload: NotificationPayload
): Promise<void> {
  if (!vapidConfigured) {
    throw new Error("VAPID not configured");
  }

  // Parse subscription if it's a JSON string (Web Push subscription object)
  let pushSubscription: webPush.PushSubscription;

  try {
    if (subscription.startsWith("{")) {
      pushSubscription = JSON.parse(subscription);
    } else if (subscription.startsWith("https://")) {
      // Simple endpoint format
      pushSubscription = {
        endpoint: subscription,
        keys: {
          p256dh: "",
          auth: "",
        },
      };
    } else {
      throw new Error("Invalid subscription format");
    }
  } catch {
    throw new Error("Failed to parse push subscription");
  }

  await webPush.sendNotification(
    pushSubscription,
    JSON.stringify(payload),
    {
      TTL: 3600, // 1 hour
      urgency: "normal",
    }
  );
}

/**
 * Sends a Firebase Cloud Messaging notification
 * Note: Requires FCM server configuration
 */
async function sendFCM(
  token: string,
  payload: NotificationPayload
): Promise<void> {
  const fcmServerKey = process.env.FCM_SERVER_KEY;

  if (!fcmServerKey) {
    throw new Error("FCM server key not configured");
  }

  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${fcmServerKey}`,
    },
    body: JSON.stringify({
      to: token,
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
      },
      data: payload.data,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FCM error: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  if (result.failure > 0) {
    throw new Error("FCM delivery failed");
  }
}

/**
 * Sends an Apple Push Notification Service notification
 * Note: Requires APNS configuration
 */
async function sendAPNS(
  _token: string,
  _payload: NotificationPayload
): Promise<void> {
  // APNS requires more complex setup with certificates or tokens
  // For now, throw an error indicating it's not yet implemented
  throw new Error(
    "APNS support coming soon. Please use Web Push or FCM."
  );
}

/**
 * Checks if an error indicates the push token is invalid
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
    "410", // HTTP 410 Gone
    "404", // HTTP 404 Not Found
  ];

  return invalidIndicators.some((indicator) =>
    message.includes(indicator)
  );
}

/**
 * Marks tokens as invalid in the database
 */
async function markTokensInvalid(
  supabase: SupabaseClient,
  tokenIds: string[]
): Promise<void> {
  if (tokenIds.length === 0) return;

  const { error } = await supabase
    .from("push_tokens")
    .update({
      is_valid: false,
      invalidated_at: new Date().toISOString(),
    })
    .in("id", tokenIds);

  if (error) {
    console.error("[Notifications] Failed to mark tokens invalid:", error);
  } else {
    console.log("[Notifications] Marked tokens as invalid:", tokenIds.length);
  }
}

/**
 * Sends a notification to multiple users
 *
 * Useful for broadcast notifications or room-based alerts.
 *
 * @param userIds - Array of user UUIDs
 * @param title - Notification title
 * @param body - Notification body text
 * @param data - Optional additional data
 * @returns Aggregated results for all users
 */
export async function sendPushNotificationToMany(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{
  success: boolean;
  totalSent: number;
  totalFailed: number;
  userResults: Record<string, SendNotificationResult>;
}> {
  const userResults: Record<string, SendNotificationResult> = {};
  let totalSent = 0;
  let totalFailed = 0;

  // Send to each user in parallel
  await Promise.all(
    userIds.map(async (userId) => {
      const result = await sendPushNotification(userId, title, body, data);
      userResults[userId] = result;
      totalSent += result.sent;
      totalFailed += result.failed;
    })
  );

  return {
    success: totalSent > 0,
    totalSent,
    totalFailed,
    userResults,
  };
}

/**
 * Creates a workflow notification payload
 *
 * Helper function to format notifications from workflow executions.
 *
 * @param workflowName - Name of the workflow that triggered the notification
 * @param actionType - Type of action that occurred
 * @param details - Additional details about the action
 * @returns Formatted notification payload
 */
export function createWorkflowNotificationPayload(
  workflowName: string,
  actionType: string,
  details?: Record<string, unknown>
): { title: string; body: string; data: Record<string, unknown> } {
  let title: string;
  let body: string;

  switch (actionType) {
    case "temperature_alert":
      title = "Temperature Alert";
      body = `${workflowName}: ${details?.message || "Temperature threshold triggered"}`;
      break;

    case "humidity_alert":
      title = "Humidity Alert";
      body = `${workflowName}: ${details?.message || "Humidity threshold triggered"}`;
      break;

    case "device_action":
      title = "Device Action";
      body = `${workflowName}: ${details?.device || "Device"} ${details?.action || "action executed"}`;
      break;

    case "schedule_triggered":
      title = "Scheduled Action";
      body = `${workflowName} scheduled action completed`;
      break;

    case "workflow_error":
      title = "Workflow Error";
      body = `${workflowName}: ${details?.error || "An error occurred"}`;
      break;

    default:
      title = "EnviroFlow Notification";
      body = `${workflowName}: ${details?.message || actionType}`;
  }

  return {
    title,
    body,
    data: {
      type: "workflow",
      workflowName,
      actionType,
      ...details,
    },
  };
}

/**
 * Registers a browser for push notifications (client-side helper)
 *
 * This is a client-side function that should be called from the browser
 * to register for push notifications.
 *
 * @returns Push subscription or null if not supported/denied
 */
export async function registerBrowserForPush(): Promise<PushSubscription | null> {
  // Check if push notifications are supported
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[Notifications] Push notifications not supported");
    return null;
  }

  try {
    // Get the service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Check notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[Notifications] Permission denied");
      return null;
    }

    // Get VAPID public key
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error("[Notifications] VAPID public key not configured");
      return null;
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    return subscription;
  } catch (error) {
    console.error("[Notifications] Registration error:", error);
    return null;
  }
}

/**
 * Converts a URL-safe base64 string to Uint8Array
 * Used for VAPID application server key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
