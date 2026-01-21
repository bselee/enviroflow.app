/**
 * Next.js Middleware for Authentication
 *
 * Protects routes by checking for valid Supabase session.
 * Redirects unauthenticated users to login page.
 * Redirects authenticated users away from auth pages.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Routes that require authentication
 * Users without a valid session will be redirected to /login
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/controllers",
  "/automations",
  "/settings",
  "/analytics",
  "/rooms",
];

/**
 * Routes that are only for unauthenticated users
 * Authenticated users will be redirected to /dashboard
 */
const AUTH_ROUTES = ["/login", "/signup", "/reset-password"];

/**
 * Routes that are always public
 * No authentication checks are performed
 */
const PUBLIC_ROUTES = ["/", "/api", "/auth/callback"];

/**
 * Check if a pathname matches any route in the list
 * Handles both exact matches and prefix matches
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => {
    // Exact match
    if (pathname === route) return true;
    // Prefix match (e.g., /dashboard/settings matches /dashboard)
    if (pathname.startsWith(`${route}/`)) return true;
    return false;
  });
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // Static files like images, fonts, etc.
  ) {
    return NextResponse.next();
  }

  // Skip for public routes (includes auth callback for email confirmation)
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  // Get Supabase URL and anon key from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, allow all requests (development mode)
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "Supabase environment variables not set. Skipping auth middleware."
    );
    return NextResponse.next();
  }

  // Create Supabase client for middleware
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Get access token from cookies
  // Supabase stores session in cookies with these names
  const accessToken = request.cookies.get("sb-access-token")?.value;
  const refreshToken = request.cookies.get("sb-refresh-token")?.value;

  // Also check for the combined auth token cookie (Supabase v2 format)
  const authTokenCookie = request.cookies.get(
    `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`
  )?.value;

  let isAuthenticated = false;

  // Try to verify the session
  if (authTokenCookie) {
    try {
      // Parse the auth token cookie (it's a JSON array: [access_token, refresh_token])
      const tokens = JSON.parse(authTokenCookie);
      if (Array.isArray(tokens) && tokens[0]) {
        const { data, error } = await supabase.auth.getUser(tokens[0]);
        isAuthenticated = !error && !!data.user;
      }
    } catch {
      // Token parsing failed, user is not authenticated
      isAuthenticated = false;
    }
  } else if (accessToken) {
    // Fallback to separate token cookies
    try {
      const { data, error } = await supabase.auth.getUser(accessToken);
      isAuthenticated = !error && !!data.user;
    } catch {
      isAuthenticated = false;
    }
  }

  // Handle protected routes - redirect to login if not authenticated
  if (matchesRoute(pathname, PROTECTED_ROUTES)) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      // Store the original URL to redirect back after login
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Handle auth routes - redirect to dashboard if already authenticated
  if (matchesRoute(pathname, AUTH_ROUTES)) {
    if (isAuthenticated) {
      // Check for redirect parameter
      const redirect = request.nextUrl.searchParams.get("redirect");
      const redirectUrl = new URL(redirect || "/dashboard", request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

/**
 * Middleware configuration
 * Defines which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
