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

// Environment variables - validated lazily to support build-time analysis
const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
        "Please add it to your .env.local file."
    );
  }
  return url;
};

/**
 * Custom fetch that proxies Supabase requests through Next.js server.
 * This avoids QUIC protocol errors when browser connects directly to Supabase on Vercel.
 *
 * Rewrites URLs like:
 *   https://xxx.supabase.co/rest/v1/... → /supabase-proxy/rest/v1/...
 *   https://xxx.supabase.co/auth/v1/... → /supabase-proxy/auth/v1/...
 */
const createProxiedFetch = () => {
  const supabaseUrl = getSupabaseUrl();

  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Only proxy in browser and only for Supabase URLs
    if (typeof window !== 'undefined' && url.startsWith(supabaseUrl)) {
      // Rewrite to use local proxy
      // e.g., https://xxx.supabase.co/rest/v1/table → /supabase-proxy/rest/v1/table
      const path = url.replace(supabaseUrl, '');
      url = `/supabase-proxy${path}`;

      // If input was a Request object, create a new one with updated URL
      if (input instanceof Request) {
        input = new Request(url, input);
      } else {
        input = url;
      }
    }

    return fetch(input, init);
  };
};

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. " +
        "Please add it to your .env.local file."
    );
  }
  return key;
};

const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Singleton browser client instance
 * Uses cookie-based storage via @supabase/ssr for proper SSR support
 */
let browserClient: SupabaseClient | null = null;

/**
 * Get the browser Supabase client (singleton)
 * Uses cookie-based session storage for SSR compatibility
 *
 * IMPORTANT: Configured with automatic token refresh and proper error handling
 * IMPORTANT: Uses proxied fetch to avoid QUIC protocol errors on Vercel
 */
export function createClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  // Create proxied fetch for browser to avoid QUIC issues
  const proxiedFetch = typeof window !== 'undefined' ? createProxiedFetch() : undefined;

  browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      // Automatically refresh tokens when they expire
      autoRefreshToken: true,
      // Persist session in cookies (handled by @supabase/ssr)
      persistSession: true,
      // Detect session from URL (for email confirmations, password resets)
      detectSessionInUrl: true,
      // Flow type for PKCE (more secure than implicit)
      flowType: 'pkce',
    },
    // Enable realtime for subscriptions
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    // Use proxied fetch in browser to route through Vercel server
    // This avoids ERR_QUIC_PROTOCOL_ERROR when browser connects directly to Supabase
    global: proxiedFetch ? {
      fetch: proxiedFetch,
    } : undefined,
  });

  return browserClient;
}

/**
 * Browser Supabase client for client-side operations.
 * Uses the anonymous key which respects Row Level Security (RLS) policies.
 *
 * @deprecated Use createClient() instead for new code
 */
export const supabase: SupabaseClient = (() => {
  // Lazy initialization to support build-time analysis
  if (typeof window === 'undefined' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Return a placeholder during build - will be properly initialized at runtime
    return null as unknown as SupabaseClient;
  }
  return createClient();
})();

/**
 * Creates a Supabase client with service role privileges.
 * SECURITY WARNING: This client bypasses RLS - use ONLY in server-side code.
 *
 * @returns Supabase client with service role privileges, or null if key is missing
 */
export function createServerClient(): SupabaseClient | null {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Server-side operations requiring admin access will not work."
    );
    return null;
  }

  return createSupabaseClient(getSupabaseUrl(), serviceRoleKey, {
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
