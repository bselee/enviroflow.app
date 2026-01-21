"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Leaf, Loader2, ArrowLeft, Mail, Lock, CheckCircle2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";

/**
 * Schema for the forgot password (email request) form
 */
const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

/**
 * Schema for the reset password (new password) form
 */
const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// Initialize Supabase client lazily
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("Supabase configuration missing");
    }

    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

/**
 * Reset Password Page Component (wrapped in Suspense)
 *
 * This component handles two flows:
 * 1. Forgot Password: User enters email to receive a reset link
 * 2. Set New Password: User arrives via reset link to set a new password
 *
 * The flow is determined by the presence of URL parameters from Supabase Auth.
 */
function ResetPasswordContent(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine if this is a reset confirmation (has token in URL)
  // Supabase sends tokens via hash fragment, but also supports query params
  const [isResetMode, setIsResetMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for reset token on mount
  useEffect(() => {
    // Supabase sends the token in the URL hash as #access_token=xxx&type=recovery
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.substring(1));
      const type = hashParams.get("type");

      if (type === "recovery") {
        setIsResetMode(true);
      }
    }

    // Also check for code parameter (Supabase PKCE flow)
    const code = searchParams.get("code");
    if (code) {
      setIsResetMode(true);
      // Exchange the code for a session
      exchangeCodeForSession(code);
    }
  }, [searchParams]);

  async function exchangeCodeForSession(code: string): Promise<void> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setError(error.message);
        setIsResetMode(false);
      }
    } catch (err) {
      console.error("Code exchange error:", err);
      setError("Failed to verify reset link. Please request a new one.");
      setIsResetMode(false);
    }
  }

  // Forgot password form
  const forgotForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // Reset password form
  const resetForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  /**
   * Handle forgot password form submission
   * Sends a password reset email via Supabase Auth
   */
  async function onForgotSubmit(data: ForgotPasswordFormData): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();

      // Construct the redirect URL for the reset link
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        data.email,
        {
          redirectTo,
        }
      );

      if (resetError) {
        throw resetError;
      }

      setIsSuccess(true);
      toast({
        title: "Reset email sent",
        description: "Check your inbox for the password reset link.",
      });
    } catch (err) {
      console.error("Password reset error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to send reset email";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Handle reset password form submission
   * Updates the user's password via Supabase Auth
   */
  async function onResetSubmit(data: ResetPasswordFormData): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();

      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Password updated",
        description: "Your password has been successfully reset.",
      });

      // Redirect to login after successful reset
      router.push("/login");
    } catch (err) {
      console.error("Password update error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to update password";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  // Success state for forgot password flow
  if (isSuccess && !isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="max-w-md w-full space-y-8 p-8 bg-card rounded-xl shadow-lg border border-border">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ve sent a password reset link to your email address.
              Please check your inbox and click the link to reset your password.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-center text-muted-foreground">
              Didn&apos;t receive the email? Check your spam folder or{" "}
              <button
                type="button"
                onClick={() => setIsSuccess(false)}
                className="text-primary hover:text-primary/80 font-medium"
              >
                try again
              </button>
            </p>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full space-y-8 p-8 bg-card rounded-xl shadow-lg border border-border">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Leaf className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">EnviroFlow</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isResetMode ? "Set your new password" : "Reset your password"}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Forgot Password Form (Request Email) */}
        {!isResetMode && (
          <Form {...forgotForm}>
            <form
              onSubmit={forgotForm.handleSubmit(onForgotSubmit)}
              className="mt-8 space-y-6"
            >
              <FormField
                control={forgotForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-xs text-muted-foreground">
                Enter your email address and we&apos;ll send you a link to reset
                your password.
              </p>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          </Form>
        )}

        {/* Reset Password Form (Set New Password) */}
        {isResetMode && (
          <Form {...resetForm}>
            <form
              onSubmit={resetForm.handleSubmit(onResetSubmit)}
              className="mt-8 space-y-6"
            >
              <FormField
                control={resetForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Enter new password"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resetForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Confirm new password"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ul className="text-xs text-muted-foreground space-y-1">
                <li>Password must be at least 8 characters</li>
                <li>Include at least one uppercase and one lowercase letter</li>
                <li>Include at least one number</li>
              </ul>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          </Form>
        )}

        {/* Back to Login Link */}
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

/**
 * Reset Password Page Export with Suspense boundary
 *
 * useSearchParams() requires a Suspense boundary in Next.js 14+
 */
export default function ResetPasswordPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
