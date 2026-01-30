"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * Controllers Route Error Boundary
 *
 * Catches errors in the controllers section, including connection
 * errors, credential issues, and controller management failures.
 */
export default function ControllersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Controllers error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-lg w-full border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Controller Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            An error occurred while managing your controllers. This might be related to
            connection issues or invalid credentials.
          </p>

          {/* Show error details in development */}
          {process.env.NODE_ENV === "development" && error.message && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-mono text-destructive break-words">
                {error.message}
              </p>
              {error.stack && (
                <pre className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Troubleshooting steps:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Refresh to reload controller data</li>
              <li>Check controller credentials are correct</li>
              <li>Verify controllers are powered on</li>
              <li>Ensure network connectivity</li>
              <li>Check controller cloud service status</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="default"
              onClick={reset}
              className="flex-1"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Controllers
            </Button>
            <Button
              variant="outline"
              asChild
              className="flex-1"
            >
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
