/**
 * Browser-side Supabase Client for Next.js
 *
 * Uses @supabase/ssr for proper cookie-based authentication
 * that syncs with server-side session management.
 */

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create a Supabase client for browser/client components
 * Uses cookie storage for session to sync with server-side auth
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
