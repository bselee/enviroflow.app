/**
 * Next.js Middleware for Authentication
 *
 * Protects routes by checking for valid Supabase session.
 * Redirects unauthenticated users to login page.
 * Redirects authenticated users away from auth pages.
 *
 * Uses @supabase/ssr for proper cookie-based session management.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  "/schedules",
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

  // Create response to potentially modify
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client with cookie handling for middleware
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Set cookie on the request (for subsequent middleware)
          request.cookies.set(name, value);
          // Set cookie on the response (critical for persistence)
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Get user from session (this also refreshes the session if needed)
  // IMPORTANT: getUser() will automatically refresh expired tokens
  // and the refreshed tokens will be set in cookies via setAll()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // If getUser fails, try to refresh the session explicitly
  if (userError && !user) {
    console.log("[Middleware] getUser failed, attempting session refresh:", userError.message);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.log("[Middleware] Session refresh failed:", sessionError?.message);
      // Session is invalid - user needs to re-authenticate
    }
  }

  const isAuthenticated = !!user;

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

  return response;
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
