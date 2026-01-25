"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import {
  Shield,
  CheckCircle,
  Copy,
  Loader2,
  AlertTriangle,
  Smartphone,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Steps in the 2FA setup flow
 */
type SetupStep = "start" | "scan" | "verify" | "recovery" | "complete";

/**
 * Props for the TwoFactorDialog component
 */
interface TwoFactorDialogProps {
  /** Whether 2FA is currently enabled for this user */
  isEnabled?: boolean;
  /** Optional trigger element. If not provided, uses default Button */
  trigger?: React.ReactNode;
  /** Callback when 2FA status changes */
  onStatusChange?: (enabled: boolean) => void;
  /** Callback when dialog closes */
  onClose?: () => void;
}

/**
 * Supabase MFA factor type
 */
interface _MFAFactor {
  id: string;
  type: string;
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

/**
 * TwoFactorDialog Component
 *
 * A dialog for setting up or disabling Two-Factor Authentication.
 * Supports TOTP-based 2FA with authenticator apps.
 *
 * Features:
 * - QR code display for authenticator app scanning
 * - Manual secret key entry option
 * - Verification code input
 * - Recovery codes display and copy
 * - Disable 2FA with confirmation
 *
 * @example
 * ```tsx
 * <TwoFactorDialog
 *   isEnabled={user.hasMFA}
 *   onStatusChange={(enabled) => console.log("2FA:", enabled)}
 * />
 * ```
 */
export function TwoFactorDialog({
  isEnabled = false,
  trigger,
  onStatusChange,
  onClose,
}: TwoFactorDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<SetupStep>("start");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA setup data
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // Disable confirmation
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  // Copy feedback
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  /**
   * Get Supabase client instance
   */
  const getSupabase = useCallback(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("Supabase configuration is missing");
    }

    return createClient(url, key);
  }, []);

  /**
   * Resets the dialog to initial state
   */
  const resetState = useCallback(() => {
    setStep("start");
    setError(null);
    setQrCode(null);
    setSecretKey(null);
    setFactorId(null);
    setVerificationCode("");
    setRecoveryCodes([]);
    setCopiedSecret(false);
    setCopiedRecovery(false);
  }, []);

  /**
   * Handles dialog open/close state changes
   */
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetState();
        onClose?.();
      }
    },
    [resetState, onClose]
  );

  /**
   * Starts the 2FA enrollment process
   */
  const startEnrollment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();

      // Enroll a new TOTP factor
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });

      if (enrollError) {
        throw new Error(enrollError.message || "Failed to start 2FA setup");
      }

      if (!data) {
        throw new Error("No enrollment data received");
      }

      // Store enrollment data
      setQrCode(data.totp.qr_code);
      setSecretKey(data.totp.secret);
      setFactorId(data.id);
      setStep("scan");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start 2FA setup";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verifies the TOTP code and completes enrollment
   */
  const verifyAndEnroll = async () => {
    if (!factorId || verificationCode.length !== 6) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();

      // Create a challenge for the factor
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId,
        });

      if (challengeError) {
        throw new Error(challengeError.message || "Failed to create challenge");
      }

      if (!challengeData) {
        throw new Error("No challenge data received");
      }

      // Verify the challenge with the user's code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) {
        throw new Error("Invalid verification code. Please try again.");
      }

      // Generate recovery codes securely from server
      const recoveryCodes = await fetchRecoveryCodes();
      if (recoveryCodes.length === 0) {
        throw new Error("Failed to generate recovery codes");
      }
      setRecoveryCodes(recoveryCodes);
      setStep("recovery");
      onStatusChange?.(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Verification failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetches cryptographically secure recovery codes from the server.
   * Uses the /api/auth/recovery-codes endpoint which generates codes
   * using crypto.randomBytes for proper security.
   *
   * @returns Array of recovery codes or empty array on failure
   */
  const fetchRecoveryCodes = async (): Promise<string[]> => {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error("No session available for recovery code generation");
        return [];
      }

      const response = await fetch("/api/auth/recovery-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          count: 8,
          length: 4,
          segments: 2,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch recovery codes:", errorData.error || response.statusText);
        return [];
      }

      const data = await response.json();
      return data.codes || [];
    } catch (err) {
      console.error("Error fetching recovery codes:", err instanceof Error ? err.message : "Unknown error");
      return [];
    }
  };

  /**
   * Disables 2FA for the user
   */
  const disable2FA = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();

      // Get current factors
      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) {
        throw new Error(factorsError.message || "Failed to list MFA factors");
      }

      // Unenroll all TOTP factors
      if (factorsData?.totp && factorsData.totp.length > 0) {
        for (const factor of factorsData.totp) {
          const { error: unenrollError } = await supabase.auth.mfa.unenroll({
            factorId: factor.id,
          });

          if (unenrollError) {
            throw new Error(
              unenrollError.message || "Failed to disable 2FA"
            );
          }
        }
      }

      onStatusChange?.(false);
      handleOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to disable 2FA";
      setError(message);
    } finally {
      setIsLoading(false);
      setShowDisableConfirm(false);
    }
  };

  /**
   * Copies text to clipboard with feedback
   */
  const copyToClipboard = async (
    text: string,
    type: "secret" | "recovery"
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "secret") {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else {
        setCopiedRecovery(true);
        setTimeout(() => setCopiedRecovery(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  /**
   * Formats the secret key for display (groups of 4)
   */
  const formatSecretKey = (secret: string): string => {
    return secret.match(/.{1,4}/g)?.join(" ") || secret;
  };

  /**
   * Renders the start step (initial screen)
   */
  const renderStartStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Shield className="h-12 w-12 text-primary" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="font-semibold text-lg">
          Secure Your Account with 2FA
        </h3>
        <p className="text-sm text-muted-foreground">
          Two-factor authentication adds an extra layer of security by
          requiring a verification code from your authenticator app when you
          sign in.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium">You will need:</p>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            An authenticator app (Google Authenticator, Authy, etc.)
          </li>
        </ul>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        onClick={startEnrollment}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Setting up...
          </>
        ) : (
          "Get Started"
        )}
      </Button>
    </div>
  );

  /**
   * Renders the scan QR code step
   */
  const renderScanStep = () => (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="font-semibold text-lg">Scan QR Code</h3>
        <p className="text-sm text-muted-foreground">
          Open your authenticator app and scan this QR code to add EnviroFlow.
        </p>
      </div>

      {/* QR Code Display */}
      <div className="flex justify-center">
        {qrCode ? (
          <div className="bg-white p-4 rounded-lg">
            <img
              src={qrCode}
              alt="2FA QR Code"
              className="w-48 h-48"
            />
          </div>
        ) : (
          <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Manual Entry Option */}
      {secretKey && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center">
            Or enter this code manually:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono text-center">
              {formatSecretKey(secretKey)}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(secretKey, "secret")}
            >
              {copiedSecret ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      <Button onClick={() => setStep("verify")} className="w-full">
        I&apos;ve Scanned the Code
      </Button>
    </div>
  );

  /**
   * Renders the verify code step
   */
  const renderVerifyStep = () => (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="font-semibold text-lg">Enter Verification Code</h3>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app to verify setup.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="verification-code">Verification Code</Label>
        <Input
          id="verification-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={verificationCode}
          onChange={(e) =>
            setVerificationCode(e.target.value.replace(/\D/g, ""))
          }
          placeholder="000000"
          className="text-center text-2xl tracking-widest font-mono"
          autoComplete="one-time-code"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setStep("scan")}
          disabled={isLoading}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onClick={verifyAndEnroll}
          disabled={verificationCode.length !== 6 || isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
      </div>
    </div>
  );

  /**
   * Renders the recovery codes step
   */
  const renderRecoveryStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <div className="rounded-full bg-yellow-500/10 p-3">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="font-semibold text-lg">Save Your Recovery Codes</h3>
        <p className="text-sm text-muted-foreground">
          If you lose access to your authenticator app, you can use these codes
          to sign in. Each code can only be used once.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-2">
          {recoveryCodes.map((code, index) => (
            <code
              key={index}
              className="bg-background px-3 py-2 rounded text-sm font-mono text-center"
            >
              {code}
            </code>
          ))}
        </div>
      </div>

      <Button
        variant="outline"
        onClick={() =>
          copyToClipboard(recoveryCodes.join("\n"), "recovery")
        }
        className="w-full"
      >
        {copiedRecovery ? (
          <>
            <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="mr-2 h-4 w-4" />
            Copy All Codes
          </>
        )}
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        <strong>Important:</strong> Store these codes in a safe place. You
        won&apos;t be able to see them again.
      </div>

      <Button onClick={() => setStep("complete")} className="w-full">
        I&apos;ve Saved My Codes
      </Button>
    </div>
  );

  /**
   * Renders the completion step
   */
  const renderCompleteStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <div className="rounded-full bg-green-500/10 p-4">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="font-semibold text-lg">2FA Enabled Successfully!</h3>
        <p className="text-sm text-muted-foreground">
          Your account is now protected with two-factor authentication. You&apos;ll
          need to enter a verification code from your authenticator app each
          time you sign in.
        </p>
      </div>

      <Button onClick={() => handleOpenChange(false)} className="w-full">
        Done
      </Button>
    </div>
  );

  /**
   * Renders the disable 2FA view
   */
  const renderDisableView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <div className="rounded-full bg-green-500/10 p-4">
          <Shield className="h-12 w-12 text-green-500" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="font-semibold text-lg">2FA is Currently Enabled</h3>
        <p className="text-sm text-muted-foreground">
          Your account is protected with two-factor authentication. You can
          disable it below, but this will make your account less secure.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => handleOpenChange(false)}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={() => setShowDisableConfirm(true)}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Disabling...
            </>
          ) : (
            "Disable 2FA"
          )}
        </Button>
      </div>
    </div>
  );

  /**
   * Renders the appropriate step content
   */
  const renderContent = () => {
    if (isEnabled && step === "start") {
      return renderDisableView();
    }

    switch (step) {
      case "start":
        return renderStartStep();
      case "scan":
        return renderScanStep();
      case "verify":
        return renderVerifyStep();
      case "recovery":
        return renderRecoveryStep();
      case "complete":
        return renderCompleteStep();
      default:
        return renderStartStep();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline">
              {isEnabled ? "Manage 2FA" : "Enable 2FA"}
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Two-Factor Authentication
            </DialogTitle>
            <DialogDescription className="sr-only">
              Set up or manage two-factor authentication for your account
            </DialogDescription>
          </DialogHeader>

          {renderContent()}
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={showDisableConfirm} onOpenChange={setShowDisableConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the extra layer of security from your account.
              Anyone with your password will be able to access your account.
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={disable2FA}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Disable 2FA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
