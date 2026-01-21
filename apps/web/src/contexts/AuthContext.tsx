"use client";

/**
 * Authentication Context Provider
 *
 * Provides authentication state and methods throughout the application.
 * Handles Supabase auth state changes and provides a clean interface
 * for components to access user information and auth methods.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { User, Session, AuthError, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";

/**
 * Result type for auth operations
 * Follows the project pattern: { success, data?, error? }
 */
interface AuthResult {
  success: boolean;
  error?: string;
}

/**
 * Auth context value interface
 */
interface AuthContextValue {
  /** Current authenticated user, null if not authenticated */
  user: User | null;
  /** Current session, null if not authenticated */
  session: Session | null;
  /** Whether auth state is being loaded */
  loading: boolean;
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** Sign up with email and password */
  signUp: (
    email: string,
    password: string,
    metadata?: { name?: string }
  ) => Promise<AuthResult>;
  /** Sign out the current user */
  signOut: () => Promise<AuthResult>;
  /** Reset password for email */
  resetPassword: (email: string) => Promise<AuthResult>;
}

// Create context with undefined default to ensure provider is used
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Props for AuthProvider component
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 *
 * Wraps the application and provides authentication state and methods.
 * Automatically subscribes to auth state changes and handles session refresh.
 *
 * @example
 * ```tsx
 * // In layout.tsx
 * <AuthProvider>
 *   {children}
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState<SupabaseClient>(() => createClient());

  // Initialize auth state and subscribe to changes
  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      console.log("[AuthContext] Initializing auth...");
      try {
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        console.log("[AuthContext] getSession result:", {
          hasSession: !!initialSession,
          hasUser: !!initialSession?.user,
          userEmail: initialSession?.user?.email,
          error: error?.message,
        });

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error("[AuthContext] Error fetching initial session:", error);
      } finally {
        console.log("[AuthContext] Setting loading to false");
        setLoading(false);
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("[AuthContext] Auth state changed:", {
        event,
        hasSession: !!newSession,
        userEmail: newSession?.user?.email,
      });
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return {
            success: false,
            error: formatAuthError(error),
          };
        }

        return { success: true };
      } catch (error) {
        console.error("Sign in error:", error);
        return {
          success: false,
          error: "An unexpected error occurred. Please try again.",
        };
      }
    },
    [supabase]
  );

  /**
   * Sign up with email and password
   * Optionally includes user metadata like name
   */
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { name?: string }
    ): Promise<AuthResult> => {
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata,
            // Redirect to auth callback to exchange code for session
            // This ensures the user is automatically logged in after confirmation
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          return {
            success: false,
            error: formatAuthError(error),
          };
        }

        return { success: true };
      } catch (error) {
        console.error("Sign up error:", error);
        return {
          success: false,
          error: "An unexpected error occurred. Please try again.",
        };
      }
    },
    [supabase]
  );

  /**
   * Sign out the current user
   */
  const signOut = useCallback(async (): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: formatAuthError(error),
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Sign out error:", error);
      return {
        success: false,
        error: "An unexpected error occurred. Please try again.",
      };
    }
  }, [supabase]);

  /**
   * Send password reset email
   */
  const resetPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
          return {
            success: false,
            error: formatAuthError(error),
          };
        }

        return { success: true };
      } catch (error) {
        console.error("Reset password error:", error);
        return {
          success: false,
          error: "An unexpected error occurred. Please try again.",
        };
      }
    },
    [supabase]
  );

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
    }),
    [user, session, loading, signIn, signUp, signOut, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 *
 * @throws Error if used outside of AuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, signOut } = useAuth();
 *
 *   if (!user) return <LoginPrompt />;
 *
 *   return <button onClick={signOut}>Sign Out</button>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

/**
 * Format Supabase auth errors into user-friendly messages
 */
function formatAuthError(error: AuthError): string {
  // Map common Supabase error messages to user-friendly versions
  const errorMessages: Record<string, string> = {
    "Invalid login credentials": "Invalid email or password. Please try again.",
    "Email not confirmed":
      "Please verify your email address before signing in.",
    "User already registered":
      "An account with this email already exists. Please sign in instead.",
    "Password should be at least 6 characters":
      "Password must be at least 6 characters long.",
    "Email rate limit exceeded":
      "Too many attempts. Please wait a few minutes and try again.",
    "User not found": "No account found with this email address.",
    "Invalid email": "Please enter a valid email address.",
  };

  // Check if we have a friendly message for this error
  const friendlyMessage = Object.entries(errorMessages).find(([key]) =>
    error.message.toLowerCase().includes(key.toLowerCase())
  );

  if (friendlyMessage) {
    return friendlyMessage[1];
  }

  // Return the original message if no mapping exists
  return error.message;
}
