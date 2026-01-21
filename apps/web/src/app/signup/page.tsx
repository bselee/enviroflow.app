"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Leaf, Loader2, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Signup form validation schema
 * - Name: minimum 2 characters
 * - Email: valid email format
 * - Password: minimum 8 characters for security
 * - Confirm Password: must match password field
 */
const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

/**
 * Signup Page Component
 *
 * Handles user registration with Supabase Auth.
 * Features:
 * - Form validation with Zod schema
 * - Real Supabase authentication
 * - Email confirmation flow handling
 * - Loading states and error handling
 * - Toast notifications for user feedback
 */
export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  // Track whether signup was successful and email confirmation is needed
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  /**
   * Handle form submission
   * Calls Supabase signUp and handles the response appropriately
   */
  async function onSubmit(data: SignupFormData) {
    setIsLoading(true);

    try {
      const result = await signUp(data.email, data.password, {
        name: data.name,
      });

      if (!result.success) {
        // Show error toast with the specific error message
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: result.error || "An unexpected error occurred.",
        });
        return;
      }

      // Signup successful - show email confirmation state
      // Supabase requires email confirmation by default
      setSubmittedEmail(data.email);
      setEmailSent(true);

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
    } catch (error) {
      // Handle unexpected errors (network issues, etc.)
      console.error("Signup error:", error);
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Show email confirmation success state
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background px-4 py-12">
        <div className="max-w-md w-full space-y-8 p-8 bg-card rounded-xl shadow-lg border border-border">
          {/* Success Icon */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Check your email
            </h1>
            <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
              <Mail className="h-5 w-5" />
              <span className="text-sm">{submittedEmail}</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              We&apos;ve sent you a verification link. Please check your inbox
              and click the link to activate your account.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Didn&apos;t receive the email? Check your spam folder or try
              signing up again.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/login")}
            >
              Go to Sign In
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setEmailSent(false);
                form.reset();
              }}
            >
              Use a different email
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background px-4 py-12">
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
            Create your account
          </p>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary hover:text-primary/80 font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
