/**
 * Supabase Client Configuration
 *
 * This module provides two Supabase clients:
 * 1. Browser client - for client-side operations (uses anon key)
 * 2. Server client - for server-side operations (uses service role key)
 *
 * Security: The service role key bypasses RLS and should ONLY be used
 * in server-side code (API routes, server components, middleware).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Environment variable validation
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawSupabaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
      "Please add it to your .env.local file."
  );
}

if (!rawSupabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. " +
      "Please add it to your .env.local file."
  );
}

// TypeScript-safe assignments after validation
const supabaseUrl: string = rawSupabaseUrl;
const supabaseAnonKey: string = rawSupabaseAnonKey;

/**
 * Browser Supabase client for client-side operations.
 * Uses the anonymous key which respects Row Level Security (RLS) policies.
 *
 * Usage:
 * - Authentication (signIn, signUp, signOut)
 * - Client-side data fetching with RLS
 * - Real-time subscriptions
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Persist session in localStorage for browser client
      persistSession: true,
      // Automatically refresh token before expiry
      autoRefreshToken: true,
      // Detect session from URL (for OAuth callbacks)
      detectSessionInUrl: true,
    },
  }
);

/**
 * Creates a Supabase client with service role privileges.
 * SECURITY WARNING: This client bypasses RLS - use ONLY in server-side code.
 *
 * Usage:
 * - API routes that need admin access
 * - Server-side data operations
 * - Cron jobs and background tasks
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

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      // Don't persist session for server client
      persistSession: false,
      // Don't auto-refresh for server client
      autoRefreshToken: false,
    },
  });
}

// =============================================================================
// Realtime Subscription Helpers
// =============================================================================

/**
 * Subscribe to changes on a specific table with optional filtering
 *
 * @param table - The table name to subscribe to
 * @param callback - Callback function to handle changes
 * @param filter - Optional filter string (e.g., 'user_id=eq.xxx')
 * @returns Cleanup function to unsubscribe
 *
 * @example
 * const unsubscribe = subscribeToTable('rooms', (payload) => {
 *   if (payload.eventType === 'INSERT') {
 *     // Handle new room
 *   }
 * }, `user_id=eq.${userId}`);
 *
 * // Later, to cleanup:
 * unsubscribe();
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
  // Build channel config
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

  // Generate unique channel name to avoid conflicts
  const channelName = `${table}_changes_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const channel = supabase
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

  // Return cleanup function
  return () => {
    supabase.removeChannel(channel);
  };
}

// =============================================================================
// Auth Helpers
// =============================================================================

/**
 * Get the current authenticated user
 *
 * @returns The current user or null if not authenticated
 */
export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Error getting current user:", error.message);
    return null;
  }

  return user;
}

/**
 * Get the current session
 *
 * @returns The current session or null if not authenticated
 */
export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Error getting current session:", error.message);
    return null;
  }

  return session;
}

// =============================================================================
// Type Exports
// =============================================================================

export type { SupabaseClient };
