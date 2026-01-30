"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * Dashboard Route Error Boundary
 *
 * Catches errors that occur in the dashboard route and provides
 * a recovery UI specific to the dashboard context.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-env-bg p-6">
      <Card className="max-w-lg w-full border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Dashboard Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We encountered an error while loading your dashboard. This could be due to a
            connection issue or invalid data.
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
            <p className="text-sm font-medium">Try these steps:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Refresh the page to reload your data</li>
              <li>Check your internet connection</li>
              <li>Verify your controllers are online</li>
              <li>Try clearing your browser cache</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="default"
              onClick={reset}
              className="flex-1"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Dashboard
            </Button>
            <Button
              variant="outline"
              asChild
              className="flex-1"
            >
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
