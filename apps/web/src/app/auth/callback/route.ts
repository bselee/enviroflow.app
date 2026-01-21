/**
 * Auth Callback Route Handler
 *
 * This route handles the OAuth/email confirmation callback from Supabase.
 * When a user clicks the confirmation link in their email, Supabase redirects
 * them to this endpoint with an auth code. This handler exchanges that code
 * for a session, sets the appropriate cookies, and redirects to the dashboard.
 *
 * Flow:
 * 1. User clicks confirmation link in email
 * 2. Supabase redirects to /auth/callback?code=xxx
 * 3. This handler exchanges the code for a session
 * 4. User is redirected to /dashboard with an active session
 */

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /auth/callback
 *
 * Handles the auth callback from Supabase email confirmation links.
 * Exchanges the auth code for a session and sets cookies for authentication.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Handle OAuth errors (e.g., user denied consent)
  if (error) {
    console.error("Auth callback error:", error, errorDescription);
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set(
      "error",
      errorDescription || "Authentication failed"
    );
    return NextResponse.redirect(loginUrl);
  }

  // If no code is present, redirect to login
  if (!code) {
    console.error("Auth callback: No code parameter received");
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "Invalid confirmation link");
    return NextResponse.redirect(loginUrl);
  }

  // Get Supabase credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Auth callback: Missing Supabase environment variables");
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "Server configuration error");
    return NextResponse.redirect(loginUrl);
  }

  // Create a Supabase client for this request
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    // Exchange the code for a session
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Auth callback: Code exchange failed:", exchangeError);
      const loginUrl = new URL("/login", requestUrl.origin);
      loginUrl.searchParams.set(
        "error",
        exchangeError.message || "Session creation failed"
      );
      return NextResponse.redirect(loginUrl);
    }

    if (!data.session) {
      console.error("Auth callback: No session returned from code exchange");
      const loginUrl = new URL("/login", requestUrl.origin);
      loginUrl.searchParams.set("error", "Session creation failed");
      return NextResponse.redirect(loginUrl);
    }

    // Create the response with redirect to dashboard
    const dashboardUrl = new URL("/dashboard", requestUrl.origin);
    const response = NextResponse.redirect(dashboardUrl);

    // Set the auth cookies
    // Supabase v2 uses a combined auth token cookie format
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const authCookieName = `sb-${projectRef}-auth-token`;

    // The auth token cookie stores both access and refresh tokens as a JSON array
    const authTokenValue = JSON.stringify([
      data.session.access_token,
      data.session.refresh_token,
    ]);

    // Get the cookie store to set cookies properly
    const cookieStore = await cookies();

    // Set the main auth cookie
    // Using httpOnly: false because the client-side Supabase SDK needs to read it
    cookieStore.set(authCookieName, authTokenValue, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // Max age matches Supabase session expiry (default: 1 week)
      maxAge: 60 * 60 * 24 * 7,
    });

    // Also set individual token cookies for compatibility
    cookieStore.set("sb-access-token", data.session.access_token, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });

    cookieStore.set("sb-refresh-token", data.session.refresh_token, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });

    console.log(
      "Auth callback: Session created successfully for user:",
      data.session.user.email
    );

    return response;
  } catch (error) {
    console.error("Auth callback: Unexpected error:", error);
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "An unexpected error occurred");
    return NextResponse.redirect(loginUrl);
  }
}
