"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Eye, EyeOff, Lock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Password strength levels with corresponding UI states
 */
type PasswordStrength = "weak" | "fair" | "good" | "strong";

interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-100
  feedback: string[];
}

/**
 * Props for the ChangePasswordDialog component
 */
interface ChangePasswordDialogProps {
  /** Optional trigger element. If not provided, uses default Button */
  trigger?: React.ReactNode;
  /** Callback when password is successfully changed */
  onSuccess?: () => void;
  /** Callback when dialog closes */
  onClose?: () => void;
}

/**
 * Evaluates password strength based on multiple criteria
 *
 * @param password - The password to evaluate
 * @returns Strength result with score and feedback
 */
function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;

  // Length checks
  if (password.length >= 8) {
    score += 20;
  } else {
    feedback.push("At least 8 characters required");
  }

  if (password.length >= 12) {
    score += 10;
  }

  if (password.length >= 16) {
    score += 10;
  }

  // Character variety checks
  if (/[a-z]/.test(password)) {
    score += 15;
  } else {
    feedback.push("Add lowercase letters");
  }

  if (/[A-Z]/.test(password)) {
    score += 15;
  } else {
    feedback.push("Add uppercase letters");
  }

  if (/[0-9]/.test(password)) {
    score += 15;
  } else {
    feedback.push("Add numbers");
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 15;
  } else {
    feedback.push("Add special characters (!@#$%^&*)");
  }

  // Determine strength level
  let strength: PasswordStrength;
  if (score >= 80) {
    strength = "strong";
  } else if (score >= 60) {
    strength = "good";
  } else if (score >= 40) {
    strength = "fair";
  } else {
    strength = "weak";
  }

  return { strength, score, feedback };
}

/**
 * Returns the appropriate color class for password strength indicator
 */
function getStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case "strong":
      return "bg-green-500";
    case "good":
      return "bg-blue-500";
    case "fair":
      return "bg-yellow-500";
    case "weak":
    default:
      return "bg-red-500";
  }
}

/**
 * Returns the display label for password strength
 */
function getStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case "strong":
      return "Strong";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "weak":
    default:
      return "Weak";
  }
}

/**
 * ChangePasswordDialog Component
 *
 * A secure dialog for changing user passwords with:
 * - Current password verification
 * - New password input with confirmation
 * - Real-time password strength indicator
 * - Validation feedback
 * - Supabase Auth integration
 *
 * @example
 * ```tsx
 * <ChangePasswordDialog onSuccess={() => console.log("Password changed!")} />
 * ```
 */
export function ChangePasswordDialog({
  trigger,
  onSuccess,
  onClose,
}: ChangePasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Calculate password strength
  const strengthResult = evaluatePasswordStrength(newPassword);

  // Validation checks
  const passwordsMatch = newPassword === confirmPassword;
  const isValidNewPassword = strengthResult.score >= 40; // At least "fair"
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    passwordsMatch &&
    isValidNewPassword &&
    !isLoading;

  /**
   * Resets the form to initial state
   */
  const resetForm = useCallback(() => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError(null);
    setSuccess(false);
  }, []);

  /**
   * Handles dialog open/close state changes
   */
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetForm();
        onClose?.();
      }
    },
    [resetForm, onClose]
  );

  /**
   * Handles the password change form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create Supabase client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase configuration is missing");
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Verify current password by attempting to sign in
      // This is a security measure to ensure the user knows their current password
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData?.session?.user?.email;

      if (!userEmail) {
        throw new Error("No active session. Please log in again.");
      }

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect");
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message || "Failed to update password");
      }

      // Success
      setSuccess(true);
      onSuccess?.();

      // Close dialog after short delay
      setTimeout(() => {
        handleOpenChange(false);
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Renders a password input field with visibility toggle
   */
  const renderPasswordInput = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    showPassword: boolean,
    onToggleShow: () => void,
    placeholder?: string,
    autoComplete?: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="pr-10"
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Change Password</Button>}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one. Make sure your new
            password is strong and unique.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="rounded-full bg-green-500/10 p-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-center font-medium">
              Password changed successfully!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            {renderPasswordInput(
              "current-password",
              "Current Password",
              currentPassword,
              setCurrentPassword,
              showCurrentPassword,
              () => setShowCurrentPassword(!showCurrentPassword),
              "Enter your current password",
              "current-password"
            )}

            {/* New Password */}
            {renderPasswordInput(
              "new-password",
              "New Password",
              newPassword,
              setNewPassword,
              showNewPassword,
              () => setShowNewPassword(!showNewPassword),
              "Enter a strong password",
              "new-password"
            )}

            {/* Password Strength Indicator */}
            {newPassword.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Password Strength
                  </span>
                  <span
                    className={`font-medium ${
                      strengthResult.strength === "strong"
                        ? "text-green-500"
                        : strengthResult.strength === "good"
                        ? "text-blue-500"
                        : strengthResult.strength === "fair"
                        ? "text-yellow-500"
                        : "text-red-500"
                    }`}
                  >
                    {getStrengthLabel(strengthResult.strength)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getStrengthColor(
                      strengthResult.strength
                    )}`}
                    style={{ width: `${strengthResult.score}%` }}
                  />
                </div>
                {strengthResult.feedback.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                    {strengthResult.feedback.map((tip, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Confirm Password */}
            {renderPasswordInput(
              "confirm-password",
              "Confirm New Password",
              confirmPassword,
              setConfirmPassword,
              showConfirmPassword,
              () => setShowConfirmPassword(!showConfirmPassword),
              "Confirm your new password",
              "new-password"
            )}

            {/* Password Match Indicator */}
            {confirmPassword.length > 0 && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  passwordsMatch ? "text-green-500" : "text-red-500"
                }`}
              >
                {passwordsMatch ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Passwords match
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Passwords do not match
                  </>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
