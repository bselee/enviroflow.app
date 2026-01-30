/**
 * Auth Token Refresh Utilities
 *
 * Provides utilities to handle JWT token expiration and automatic refresh
 * for fetch requests that interact with Supabase-authenticated APIs.
 */

import { createClient } from "@/lib/supabase";

/**
 * Error class for authentication/token errors
 */
export class AuthTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthTokenError";
  }
}

/**
 * Check if an error response indicates an expired/invalid token
 */
export function isTokenError(response: Response): boolean {
  return (
    response.status === 401 ||
    response.status === 403 ||
    response.statusText === "Unauthorized"
  );
}

/**
 * Refresh the current session token
 * Returns the new access token or null if refresh fails
 */
export async function refreshAccessToken(): Promise<string | null> {
  const supabase = createClient();

  try {
    // Force a session refresh
    const {
      data: { session },
      error,
    } = await supabase.auth.refreshSession();

    if (error) {
      console.error("[AuthRefresh] Failed to refresh token:", error.message);
      return null;
    }

    if (!session?.access_token) {
      console.error("[AuthRefresh] No access token in refreshed session");
      return null;
    }

    console.log("[AuthRefresh] Token refreshed successfully");
    return session.access_token;
  } catch (error) {
    console.error("[AuthRefresh] Exception during token refresh:", error);
    return null;
  }
}

/**
 * Get the current valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string | null> {
  const supabase = createClient();

  try {
    // First try to get the current session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("[AuthRefresh] Error getting session:", error.message);
      return null;
    }

    if (!session?.access_token) {
      console.log("[AuthRefresh] No active session");
      return null;
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expiryTime = expiresAt * 1000; // Convert to milliseconds
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiryTime - now < fiveMinutes) {
        console.log("[AuthRefresh] Token expiring soon, refreshing...");
        return await refreshAccessToken();
      }
    }

    return session.access_token;
  } catch (error) {
    console.error("[AuthRefresh] Exception getting valid token:", error);
    return null;
  }
}

/**
 * Enhanced fetch wrapper that automatically handles token refresh
 * Use this instead of fetch() for authenticated API requests
 *
 * @example
 * ```ts
 * const response = await authenticatedFetch('/api/controllers', {
 *   method: 'GET',
 * });
 * ```
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get a valid access token (will refresh if needed)
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new AuthTokenError("No valid access token available");
  }

  // Add Authorization header
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If we get a 401, try to refresh the token and retry once
  if (isTokenError(response) && !options.signal?.aborted) {
    console.log("[AuthRefresh] Got 401, attempting token refresh and retry...");

    const newToken = await refreshAccessToken();

    if (!newToken) {
      // Refresh failed - user needs to re-authenticate
      console.error("[AuthRefresh] Token refresh failed, redirect to login");
      throw new AuthTokenError("Session expired. Please sign in again.");
    }

    // Retry the request with the new token
    headers.set("Authorization", `Bearer ${newToken}`);

    const retryResponse = await fetch(url, {
      ...options,
      headers,
    });

    return retryResponse;
  }

  return response;
}
