/**
 * Auth Callback Route Handler
 *
 * Handles both:
 * 1. Email confirmation (token_hash + type)
 * 2. OAuth callbacks (code)
 *
 * Uses @supabase/ssr for proper cookie-based session management
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);

  console.log("[Auth Callback] Full URL:", request.url);
  console.log("[Auth Callback] Search params:", Object.fromEntries(requestUrl.searchParams));

  // Get all possible auth parameters
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  const origin = requestUrl.origin;

  // Handle errors from OAuth provider
  if (error) {
    console.error("[Auth Callback] Error param:", error, errorDescription);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // Get Supabase credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[Auth Callback] Missing Supabase env vars");
    return NextResponse.redirect(`${origin}/login?error=Server+configuration+error`);
  }

  // Create response - we'll set cookies on this
  const response = NextResponse.redirect(`${origin}/dashboard`);

  // Track cookies being set for debugging
  const cookiesSet: string[] = [];

  // Create Supabase client with cookie handling
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies = request.cookies.getAll();
        console.log("[Auth Callback] getAll cookies:", cookies.map(c => c.name));
        return cookies;
      },
      setAll(cookiesToSet) {
        console.log("[Auth Callback] setAll called with:", cookiesToSet.length, "cookies");
        cookiesToSet.forEach(({ name, value, options }) => {
          console.log("[Auth Callback] Setting cookie:", name, "options:", options);
          cookiesSet.push(name);
          // Ensure secure cookies on production
          response.cookies.set(name, value, {
            ...options,
            secure: true,
            sameSite: "lax",
            path: "/",
          });
        });
      },
    },
  });

  try {
    // Handle email confirmation (token_hash flow)
    if (token_hash && type) {
      console.log("[Auth Callback] Processing email verification");
      console.log("[Auth Callback] token_hash length:", token_hash.length);
      console.log("[Auth Callback] type:", type);

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as "signup" | "recovery" | "invite" | "email",
      });

      if (verifyError) {
        console.error("[Auth Callback] OTP verification failed:", verifyError.message);
        console.error("[Auth Callback] OTP error code:", verifyError.status);
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(verifyError.message)}`
        );
      }

      console.log("[Auth Callback] verifyOtp result - has session:", !!data.session);
      console.log("[Auth Callback] verifyOtp result - has user:", !!data.user);

      if (data.session) {
        console.log("[Auth Callback] Session created for:", data.session.user.email);
        console.log("[Auth Callback] Session expires at:", data.session.expires_at);
        console.log("[Auth Callback] Cookies that were set:", cookiesSet);

        // Double-check by getting session (this should trigger cookie setting)
        const { data: sessionCheck } = await supabase.auth.getSession();
        console.log("[Auth Callback] Session check after verify:", !!sessionCheck.session);

        return response;
      }

      // No session but verified - redirect to login with success message
      console.log("[Auth Callback] Email verified but no session, redirecting to login");
      return NextResponse.redirect(`${origin}/login?message=Email+confirmed!+Please+sign+in.`);
    }

    // Handle OAuth callback (code flow)
    if (code) {
      console.log("[Auth Callback] Processing OAuth code exchange");
      console.log("[Auth Callback] code length:", code.length);

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error("[Auth Callback] Code exchange failed:", exchangeError.message);
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
        );
      }

      if (data.session) {
        console.log("[Auth Callback] OAuth session created for:", data.session.user.email);
        console.log("[Auth Callback] Cookies that were set:", cookiesSet);
        return response;
      }
    }

    // No valid auth parameters
    console.error("[Auth Callback] No valid auth parameters found");
    console.error("[Auth Callback] code:", !!code, "token_hash:", !!token_hash, "type:", type);
    return NextResponse.redirect(`${origin}/login?error=Invalid+confirmation+link`);

  } catch (err) {
    console.error("[Auth Callback] Unexpected error:", err);
    return NextResponse.redirect(`${origin}/login?error=An+unexpected+error+occurred`);
  }
}
