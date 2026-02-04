"use client";

import * as React from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RateLimitStatus {
  used: number;
  limit: number;
  resetAt: number;
}

function formatResetTime(resetAt: number): string {
  const remaining = resetAt - Date.now();
  if (remaining <= 0) return "now";
  const seconds = Math.ceil(remaining / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

interface RateLimitIndicatorProps {
  className?: string;
}

export function RateLimitIndicator({ className }: RateLimitIndicatorProps) {
  const [status, setStatus] = React.useState<RateLimitStatus | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/workflows/rate-limit");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Non-critical - silently fail
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!status) return null;

  const pct = (status.used / status.limit) * 100;
  const remaining = status.limit - status.used;
  const isCritical = pct >= 85;
  const isWarning = pct >= 60;

  const color = isCritical
    ? "text-red-600 dark:text-red-400"
    : isWarning
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";

  const barColor = isCritical
    ? "bg-red-500"
    : isWarning
      ? "bg-amber-500"
      : "bg-green-500";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1.5 text-xs cursor-default", color, className)}>
            {isCritical ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Activity className="h-3 w-3" />
            )}
            <span className="font-medium">{remaining}/{status.limit}</span>
            <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", barColor)}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Workflow Commands</p>
          <p className="text-xs text-muted-foreground">
            {status.used} of {status.limit} used &middot; Resets in {formatResetTime(status.resetAt)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default RateLimitIndicator;
