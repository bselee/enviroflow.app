"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

/**
 * Global Error Boundary for Next.js App Router
 *
 * This component automatically catches errors in any page or layout component.
 * It provides a user-friendly error UI with recovery options.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    console.error("Global error caught:", error);

    // In production, you might want to send this to an error tracking service
    // Example: Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Application Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred in the application. We apologize for the inconvenience.
              </p>

              {/* Show error details in development */}
              {process.env.NODE_ENV === "development" && error.message && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs font-mono text-destructive break-words">
                    {error.message}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Error ID: {error.digest}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={reset}
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  variant="default"
                  asChild
                  className="flex-1"
                >
                  <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Link>
                </Button>
              </div>

              {error.digest && process.env.NODE_ENV === "production" && (
                <p className="text-xs text-muted-foreground text-center">
                  Error reference: {error.digest}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
