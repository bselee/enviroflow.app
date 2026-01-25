"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Props for the MetricCard component.
 */
export interface MetricCardProps {
  /** Card title (e.g., "Avg Temperature") */
  title: string;
  /** Primary value to display */
  value: number | null;
  /** Unit of measurement (e.g., "°F", "%", "kPa") */
  unit: string;
  /** Trend percentage vs previous period (-100 to +100) */
  trend?: number;
  /** Optional subtitle showing range (e.g., "72-85°F") */
  subtitle?: string;
  /** Click handler for navigation to detail view */
  onClick?: () => void;
  /** Whether the card is loading */
  isLoading?: boolean;
  /** Number of decimal places to show */
  decimals?: number;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Trend indicator component showing up/down arrow with percentage.
 */
function TrendIndicator({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const absValue = Math.abs(value);

  const Icon = isNeutral ? Minus : isPositive ? ArrowUp : ArrowDown;
  const colorClass = isNeutral
    ? "text-muted-foreground"
    : isPositive
    ? "text-green-600 dark:text-green-500"
    : "text-red-600 dark:text-red-500";

  return (
    <div className={cn("flex items-center gap-1 text-xs font-medium", colorClass)}>
      <Icon className="h-3 w-3" />
      <span>{absValue.toFixed(1)}%</span>
    </div>
  );
}

/**
 * Loading skeleton for MetricCard.
 */
function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("transition-all", className)}>
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-16" />
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * MetricCard - Displays a single analytics metric with trend indicator.
 *
 * Features:
 * - Large primary value with unit
 * - Trend indicator (up/down arrow + percentage)
 * - Optional subtitle for additional context
 * - Clickable for navigation to detailed views
 * - Responsive hover states
 * - Loading skeleton support
 *
 * @example
 * ```tsx
 * <MetricCard
 *   title="Avg Temperature"
 *   value={78.5}
 *   unit="°F"
 *   trend={2.3}
 *   subtitle="72-85°F"
 *   onClick={() => router.push('/sensors/temperature')}
 * />
 * ```
 */
export function MetricCard({
  title,
  value,
  unit,
  trend,
  subtitle,
  onClick,
  isLoading = false,
  decimals = 1,
  className,
}: MetricCardProps) {
  // Format value for display
  const formattedValue = useMemo(() => {
    if (value === null || value === undefined) return "--";
    return value.toFixed(decimals);
  }, [value, decimals]);

  // Determine if card is clickable
  const isClickable = !!onClick;

  if (isLoading) {
    return <MetricCardSkeleton className={className} />;
  }

  return (
    <Card
      className={cn(
        "transition-all",
        isClickable && [
          "cursor-pointer",
          "hover:shadow-md hover:scale-[1.02]",
          "active:scale-[0.98]",
        ],
        className
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Primary Value */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums">
            {formattedValue}
          </span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>

        {/* Trend and Subtitle Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Trend Indicator */}
          {trend !== undefined && <TrendIndicator value={trend} />}

          {/* Subtitle (range, etc.) */}
          {subtitle && (
            <span className="text-xs text-muted-foreground ml-auto">
              {subtitle}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Export skeleton for external use.
 */
export { MetricCardSkeleton };
