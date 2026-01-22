"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  useAnimationTierContext,
  type AnimationTier,
} from "@/hooks/use-animation-tier";
import { toast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for PerformanceIndicator component.
 */
export interface PerformanceIndicatorProps {
  /** Whether to show detailed information (FPS, etc.) */
  showDetails?: boolean;
  /** Whether to show the manual override selector */
  showOverrideSelector?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show only when degraded */
  showOnlyWhenDegraded?: boolean;
  /** Callback when degradation is detected */
  onDegradation?: (fromTier: AnimationTier, toTier: AnimationTier) => void;
}

/**
 * Props for the degradation toast notification.
 */
interface DegradationToastProps {
  currentTier: AnimationTier;
  fps: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Tier labels for display */
const TIER_LABELS: Record<AnimationTier, string> = {
  full: "Full",
  simplified: "Simplified",
  minimal: "Minimal",
};

/** Tier descriptions for tooltips */
const TIER_DESCRIPTIONS: Record<AnimationTier, string> = {
  full: "All animations enabled for the best visual experience",
  simplified: "Some animations disabled to improve performance",
  minimal: "Most animations disabled for maximum performance",
};

/** Tier icon colors */
const TIER_COLORS: Record<AnimationTier, string> = {
  full: "text-emerald-500",
  simplified: "text-amber-500",
  minimal: "text-red-500",
};

/** Tier background colors */
const TIER_BG_COLORS: Record<AnimationTier, string> = {
  full: "bg-emerald-500/10",
  simplified: "bg-amber-500/10",
  minimal: "bg-red-500/10",
};

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Performance status icon that visually indicates the current tier.
 */
function PerformanceIcon({
  tier,
  size = "md",
  className,
}: {
  tier: AnimationTier;
  size?: "sm" | "md" | "lg";
  className?: string;
}): React.ReactElement {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  // Different icons based on tier
  const iconPath = {
    full: (
      // Speedometer icon (full speed)
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    ),
    simplified: (
      // Gauge icon (moderate)
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    ),
    minimal: (
      // Slow/pause icon
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={cn(sizeClasses[size], TIER_COLORS[tier], className)}
    >
      {iconPath[tier]}
    </svg>
  );
}

/**
 * FPS display component.
 */
function FPSDisplay({
  fps,
  className,
}: {
  fps: number;
  className?: string;
}): React.ReactElement {
  const fpsColor =
    fps > 55 ? "text-emerald-500" : fps >= 40 ? "text-amber-500" : "text-red-500";

  return (
    <span className={cn("font-mono text-xs tabular-nums", fpsColor, className)}>
      {fps > 0 ? `${fps.toFixed(0)} FPS` : "Measuring..."}
    </span>
  );
}

// =============================================================================
// Toast Notification
// =============================================================================

/**
 * Shows a toast notification when animation tier is degraded.
 * This is called automatically when degradation is detected.
 */
function showDegradationToast({ currentTier, fps }: DegradationToastProps): void {
  const message =
    currentTier === "minimal"
      ? "Animations reduced to minimum for better performance"
      : "Some animations simplified for better performance";

  toast({
    title: "Performance Adjusted",
    description: (
      <div className="flex flex-col gap-1">
        <span>{message}</span>
        <span className="text-xs text-muted-foreground">
          Current: {TIER_LABELS[currentTier]} ({fps.toFixed(0)} FPS)
        </span>
      </div>
    ),
    duration: 4000,
  });
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * PerformanceIndicator - Shows current animation performance tier and controls.
 *
 * This component displays the current animation tier, measured FPS, and optionally
 * provides controls for manually overriding the tier. It can also show a toast
 * notification when the tier is automatically degraded.
 *
 * Features:
 * - Visual indicator of current tier (icon + color)
 * - FPS display (when showDetails is true)
 * - Manual tier override selector (when showOverrideSelector is true)
 * - Can be hidden unless degradation occurs
 * - Automatic toast notification on degradation
 *
 * @example
 * ```tsx
 * // Basic usage in settings page
 * <PerformanceIndicator showDetails showOverrideSelector />
 *
 * // Minimal indicator that only shows when degraded
 * <PerformanceIndicator size="sm" showOnlyWhenDegraded />
 *
 * // With degradation callback
 * <PerformanceIndicator
 *   onDegradation={(from, to) => {
 *     analytics.track('animation_tier_degraded', { from, to });
 *   }}
 * />
 * ```
 */
export function PerformanceIndicator({
  showDetails = false,
  showOverrideSelector = false,
  className,
  size = "md",
  showOnlyWhenDegraded = false,
  onDegradation,
}: PerformanceIndicatorProps): React.ReactElement | null {
  const {
    tier,
    fps,
    isReducedMotion,
    manualOverride,
    setManualOverride,
    hasDegraded,
    remeasure,
  } = useAnimationTierContext();

  // Track previous tier for degradation detection
  const prevTierRef = React.useRef<AnimationTier | null>(null);
  const hasShownToastRef = React.useRef<boolean>(false);

  // Detect degradation and show toast/callback
  React.useEffect(() => {
    if (prevTierRef.current !== null && prevTierRef.current !== tier) {
      const tierOrder: Record<AnimationTier, number> = {
        full: 2,
        simplified: 1,
        minimal: 0,
      };

      const wasDegraded = tierOrder[tier] < tierOrder[prevTierRef.current];

      if (wasDegraded && !hasShownToastRef.current) {
        // Show toast notification
        showDegradationToast({ currentTier: tier, fps });
        hasShownToastRef.current = true;

        // Call callback if provided
        onDegradation?.(prevTierRef.current, tier);
      }
    }

    prevTierRef.current = tier;
  }, [tier, fps, onDegradation]);

  // Reset toast flag when tier improves
  React.useEffect(() => {
    if (!hasDegraded) {
      hasShownToastRef.current = false;
    }
  }, [hasDegraded]);

  // If showOnlyWhenDegraded is true and not degraded, hide component
  if (showOnlyWhenDegraded && !hasDegraded) {
    return null;
  }

  // Handle manual override change
  const handleOverrideChange = (value: string): void => {
    if (value === "auto") {
      setManualOverride(null);
    } else {
      setManualOverride(value as AnimationTier);
    }
  };

  const sizeClasses = {
    sm: "text-xs gap-1.5",
    md: "text-sm gap-2",
    lg: "text-base gap-2.5",
  };

  const content = (
    <div
      className={cn(
        "inline-flex items-center",
        sizeClasses[size],
        TIER_BG_COLORS[tier],
        "rounded-full px-3 py-1.5",
        className
      )}
    >
      <PerformanceIcon tier={tier} size={size} />

      <span className={cn("font-medium", TIER_COLORS[tier])}>
        {TIER_LABELS[tier]}
      </span>

      {showDetails && (
        <>
          <span className="text-muted-foreground">|</span>
          <FPSDisplay fps={fps} />
        </>
      )}

      {isReducedMotion && (
        <span className="text-xs text-muted-foreground">(Reduced Motion)</span>
      )}

      {manualOverride && (
        <span className="text-xs text-muted-foreground">(Manual)</span>
      )}
    </div>
  );

  // Wrap with tooltip for description
  const indicator = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p>{TIER_DESCRIPTIONS[tier]}</p>
          {isReducedMotion && (
            <p className="mt-1 text-xs text-muted-foreground">
              Your system prefers reduced motion
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // If not showing override selector, just return the indicator
  if (!showOverrideSelector) {
    return indicator;
  }

  // Full settings view with override selector
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Current Status */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Animation Performance</span>
          <span className="text-xs text-muted-foreground">
            Automatically adjusts based on device capability
          </span>
        </div>
        {indicator}
      </div>

      {/* Override Selector */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label
            htmlFor="animation-tier-select"
            className="text-sm font-medium mb-1.5 block"
          >
            Animation Level
          </label>
          <Select
            value={manualOverride ? tier : "auto"}
            onValueChange={handleOverrideChange}
          >
            <SelectTrigger id="animation-tier-select" className="w-full">
              <SelectValue placeholder="Select animation level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                <div className="flex items-center gap-2">
                  <span>Auto-detect</span>
                  <span className="text-xs text-muted-foreground">
                    ({fps > 0 ? `${fps.toFixed(0)} FPS` : "measuring"})
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="full">
                <div className="flex items-center gap-2">
                  <PerformanceIcon tier="full" size="sm" />
                  <span>Full</span>
                  <span className="text-xs text-muted-foreground">
                    All animations
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="simplified">
                <div className="flex items-center gap-2">
                  <PerformanceIcon tier="simplified" size="sm" />
                  <span>Simplified</span>
                  <span className="text-xs text-muted-foreground">
                    Reduced effects
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="minimal">
                <div className="flex items-center gap-2">
                  <PerformanceIcon tier="minimal" size="sm" />
                  <span>Minimal</span>
                  <span className="text-xs text-muted-foreground">
                    Essential only
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Re-measure button */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium invisible">Action</span>
          <Button
            variant="outline"
            size="sm"
            onClick={remeasure}
            disabled={manualOverride}
          >
            Re-measure
          </Button>
        </div>
      </div>

      {/* Reduced motion notice */}
      {isReducedMotion && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
          <strong>Note:</strong> Your system has reduced motion enabled.
          Animations are set to minimal regardless of the setting above.
          To enable animations, change your system&apos;s accessibility settings.
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Compact Variants
// =============================================================================

/**
 * CompactPerformanceIndicator - A minimal version for headers/footers.
 *
 * Shows just the icon and optionally FPS, useful for persistent display
 * in app headers or status bars.
 */
export function CompactPerformanceIndicator({
  showFps = false,
  className,
}: {
  showFps?: boolean;
  className?: string;
}): React.ReactElement {
  const { tier, fps } = useAnimationTierContext();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1 cursor-help",
              className
            )}
          >
            <PerformanceIcon tier={tier} size="sm" />
            {showFps && fps > 0 && (
              <span className="text-xs text-muted-foreground">
                {fps.toFixed(0)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {TIER_LABELS[tier]} animations ({fps > 0 ? `${fps.toFixed(0)} FPS` : "measuring"})
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * DegradationBanner - A banner shown when performance is degraded.
 *
 * Use this at the top of a page or section to inform users that
 * animations have been reduced for better performance.
 */
export function DegradationBanner({
  className,
  onDismiss,
}: {
  className?: string;
  onDismiss?: () => void;
}): React.ReactElement | null {
  const { tier, hasDegraded, fps } = useAnimationTierContext();
  const [dismissed, setDismissed] = React.useState(false);

  // Don't show if not degraded or already dismissed
  if (!hasDegraded || dismissed) {
    return null;
  }

  const handleDismiss = (): void => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2",
        "bg-amber-500/10 border border-amber-500/20 rounded-md",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <PerformanceIcon tier={tier} size="sm" />
        <span className="text-sm">
          Animations reduced for better performance ({fps.toFixed(0)} FPS)
        </span>
      </div>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
