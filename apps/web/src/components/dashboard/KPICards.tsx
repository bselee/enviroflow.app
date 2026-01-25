"use client";

import React, { useMemo } from "react";
import {
  Activity,
  Target,
  Workflow,
  Server,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAnalytics, type AnalyticsData } from "@/hooks/use-analytics";

/**
 * KPI Card configuration type
 *
 * Defines the structure for each KPI metric card displayed at the top of the dashboard.
 */
interface KPICardConfig {
  /** Unique identifier for the KPI */
  id: string;
  /** Display label for the KPI */
  label: string;
  /** Function to extract the primary value from analytics data */
  getValue: (data: AnalyticsData) => number | string;
  /** Function to get the secondary value (e.g., "today" vs "this week") */
  getSecondaryValue?: (data: AnalyticsData) => string;
  /** Unit suffix (e.g., "%", "hrs") */
  unit?: string;
  /** Icon component to display */
  icon: React.ElementType;
  /** Color theme for the card */
  color: "primary" | "success" | "warning" | "info";
  /** Function to determine trend direction (positive = up, negative = down) */
  getTrend?: (data: AnalyticsData) => number;
}

/**
 * Props for the KPICards component
 */
interface KPICardsProps {
  /** Optional class name for the container */
  className?: string;
  /** Custom analytics options (date range, filters) */
  analyticsOptions?: Parameters<typeof useAnalytics>[0];
  /** Whether to show loading skeletons */
  showSkeleton?: boolean;
}

/**
 * Individual KPI Card component
 */
interface KPICardItemProps {
  config: KPICardConfig;
  data: AnalyticsData | null;
  isLoading: boolean;
}

/**
 * Color mappings for card themes
 */
const colorClasses = {
  primary: {
    bg: "bg-primary/10",
    icon: "text-primary",
    trend: "text-primary",
  },
  success: {
    bg: "bg-success/10",
    icon: "text-success",
    trend: "text-success",
  },
  warning: {
    bg: "bg-warning/10",
    icon: "text-warning",
    trend: "text-warning",
  },
  info: {
    bg: "bg-info/10",
    icon: "text-info",
    trend: "text-info",
  },
};

/**
 * KPI card configurations
 *
 * Each card displays a key performance indicator with:
 * - Icon and label
 * - Primary value with optional unit
 * - Secondary value for context
 * - Trend indicator (up/down/neutral)
 */
const KPI_CONFIGS: KPICardConfig[] = [
  {
    id: "executions",
    label: "Automation Executions",
    getValue: (data) => data.todayExecutions,
    getSecondaryValue: (data) => `${data.totalExecutions} this week`,
    icon: Activity,
    color: "primary",
    getTrend: (data) => {
      // Positive trend if today's executions are above average
      const avgDaily = data.executionRate;
      return data.todayExecutions > avgDaily ? 1 : data.todayExecutions < avgDaily ? -1 : 0;
    },
  },
  {
    id: "compliance",
    label: "Target Compliance",
    getValue: (data) => data.targetCompliance,
    getSecondaryValue: () => "in optimal range",
    unit: "%",
    icon: Target,
    color: "success",
    getTrend: (data) => {
      // Green is good for compliance, > 90% is positive
      return data.targetCompliance >= 90 ? 1 : data.targetCompliance < 70 ? -1 : 0;
    },
  },
  {
    id: "active",
    label: "Active Automations",
    getValue: (data) => data.activeWorkflows,
    getSecondaryValue: (data) => `${data.workflowStats.length} total`,
    icon: Workflow,
    color: "info",
  },
  {
    id: "uptime",
    label: "System Uptime",
    getValue: (data) => data.uptime,
    getSecondaryValue: () => "controllers online",
    unit: "%",
    icon: Server,
    color: "warning",
    getTrend: (data) => {
      // High uptime is positive
      return data.uptime >= 95 ? 1 : data.uptime < 80 ? -1 : 0;
    },
  },
];

/**
 * Renders an individual KPI card with icon, value, and trend indicator.
 */
function KPICardItem({ config, data, isLoading }: KPICardItemProps): JSX.Element {
  const colors = colorClasses[config.color];

  // Calculate values when data is available
  const { primaryValue, secondaryValue, trend } = useMemo(() => {
    if (!data) {
      return { primaryValue: "--", secondaryValue: "", trend: 0 };
    }

    const value = config.getValue(data);
    const secondary = config.getSecondaryValue?.(data) ?? "";
    const trendValue = config.getTrend?.(data) ?? 0;

    return {
      primaryValue: typeof value === "number" ? value.toLocaleString() : value,
      secondaryValue: secondary,
      trend: trendValue,
    };
  }, [data, config]);

  // Determine trend icon
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor =
    trend > 0 ? "text-success" : trend < 0 ? "text-destructive" : "text-muted-foreground";

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {/* Label */}
            <p className="text-sm font-medium text-muted-foreground">
              {config.label}
            </p>

            {/* Primary Value */}
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">
                {primaryValue}
              </span>
              {config.unit && (
                <span className="text-lg font-medium text-muted-foreground">
                  {config.unit}
                </span>
              )}
            </div>

            {/* Secondary Value with Trend */}
            <div className="flex items-center gap-1.5">
              {trend !== 0 && (
                <TrendIcon className={cn("h-3 w-3", trendColor)} />
              )}
              <span className="text-xs text-muted-foreground">
                {secondaryValue}
              </span>
            </div>
          </div>

          {/* Icon */}
          <div className={cn("rounded-lg p-2.5", colors.bg)}>
            <config.icon className={cn("h-5 w-5", colors.icon)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * KPICards Component
 *
 * Displays a grid of 4 KPI cards at the top of the dashboard:
 * 1. Automation Executions (today/week)
 * 2. Target Compliance (% in optimal range)
 * 3. Active Automations (count)
 * 4. System Uptime (%)
 *
 * Each card includes:
 * - Icon representing the metric
 * - Primary value with optional unit
 * - Secondary context value
 * - Trend indicator (up/down/neutral)
 *
 * @example
 * ```tsx
 * <KPICards />
 * ```
 *
 * @example With custom date range
 * ```tsx
 * <KPICards
 *   analyticsOptions={{
 *     dateRange: { start: new Date('2024-01-01'), end: new Date() }
 *   }}
 * />
 * ```
 */
export function KPICards({
  className,
  analyticsOptions,
  showSkeleton = true,
}: KPICardsProps): JSX.Element {
  const { data, isLoading, error } = useAnalytics({
    ...analyticsOptions,
    // Auto-refresh every 60 seconds for live updates
    refreshInterval: 60000,
  });

  // Show error state if fetch failed
  if (error && !isLoading) {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4", className)}>
        {KPI_CONFIGS.map((config) => (
          <Card key={config.id} className="relative overflow-hidden border-destructive/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {config.label}
                  </p>
                  <p className="text-sm text-destructive">Unable to load</p>
                </div>
                <div className={cn("rounded-lg p-2.5", colorClasses[config.color].bg)}>
                  <config.icon
                    className={cn("h-5 w-5", colorClasses[config.color].icon)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4", className)}>
      {KPI_CONFIGS.map((config) => (
        <KPICardItem
          key={config.id}
          config={config}
          data={data}
          isLoading={isLoading && showSkeleton}
        />
      ))}
    </div>
  );
}

/**
 * Loading skeleton for KPICards
 *
 * Use this when you want to show a loading state without the analytics hook.
 */
export function KPICardsSkeleton({ className }: { className?: string }): JSX.Element {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4", className)}>
      {KPI_CONFIGS.map((config) => (
        <Card key={config.id} className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
