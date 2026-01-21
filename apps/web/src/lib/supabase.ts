/**
 * Supabase Client Configuration
 *
 * This module provides Supabase clients for the application:
 * 1. Browser client - for client-side operations (uses anon key with cookies)
 * 2. Server client - for server-side operations (uses service role key)
 *
 * Uses @supabase/ssr for proper cookie-based session management.
 */

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

// Environment variable validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
      "Please add it to your .env.local file."
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. " +
      "Please add it to your .env.local file."
  );
}

/**
 * Singleton browser client instance
 * Uses cookie-based storage via @supabase/ssr for proper SSR support
 */
let browserClient: SupabaseClient | null = null;

/**
 * Get the browser Supabase client (singleton)
 * Uses cookie-based session storage for SSR compatibility
 */
export function createClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
  return browserClient;
}

/**
 * Browser Supabase client for client-side operations.
 * Uses the anonymous key which respects Row Level Security (RLS) policies.
 *
 * @deprecated Use createClient() instead for new code
 */
export const supabase: SupabaseClient = createClient();

/**
 * Creates a Supabase client with service role privileges.
 * SECURITY WARNING: This client bypasses RLS - use ONLY in server-side code.
 *
 * @returns Supabase client with service role privileges, or null if key is missing
 */
export function createServerClient(): SupabaseClient | null {
  if (!supabaseServiceRoleKey) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Server-side operations requiring admin access will not work."
    );
    return null;
  }

  return createSupabaseClient(supabaseUrl!, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// =============================================================================
// Realtime Subscription Helpers
// =============================================================================

/**
 * Subscribe to changes on a specific table with optional filtering
 */
export function subscribeToTable<T extends Record<string, unknown>>(
  table: string,
  callback: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: T | null;
    old: Partial<T> | null;
  }) => void,
  filter?: string
): () => void {
  const client = createClient();

  const channelConfig: {
    event: "*";
    schema: "public";
    table: string;
    filter?: string;
  } = {
    event: "*",
    schema: "public",
    table,
  };

  if (filter) {
    channelConfig.filter = filter;
  }

  const channelName = `${table}_changes_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const channel = client
    .channel(channelName)
    .on(
      "postgres_changes",
      channelConfig,
      (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new: Record<string, unknown>;
        old: Record<string, unknown>;
      }) => {
        callback({
          eventType: payload.eventType,
          new: payload.new as T | null,
          old: payload.old as Partial<T> | null,
        });
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// =============================================================================
// Auth Helpers
// =============================================================================

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const client = createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    console.error("Error getting current user:", error.message);
    return null;
  }

  return user;
}

/**
 * Get the current session
 */
export async function getCurrentSession() {
  const client = createClient();
  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) {
    console.error("Error getting current session:", error.message);
    return null;
  }

  return session;
}

export type { SupabaseClient };
