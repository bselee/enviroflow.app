"use client";

/**
 * Demo Mode Components for EnviroFlow Dashboard
 *
 * These components provide visual indicators and CTAs when the dashboard is
 * displaying demo data instead of real controller data. They help users
 * understand they're viewing sample data and encourage them to connect
 * their hardware controllers.
 *
 * Components:
 * - DemoBanner: Top banner with demo/connected status
 * - DemoBadge: Watermark badge for room cards
 * - ConnectCTA: Pulsing button to connect first controller
 */

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import { Radio, Check, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the DemoBanner component.
 */
export interface DemoBannerProps {
  /** Whether the dashboard is in demo mode (no real controllers) */
  isDemoMode: boolean;
  /** Number of rooms being monitored (only shown when connected) */
  roomCount?: number;
  /** Whether the banner is currently transitioning states */
  isTransitioning?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the DemoBadge component.
 */
export interface DemoBadgeProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the ConnectCTA component.
 */
export interface ConnectCTAProps {
  /** Additional CSS classes */
  className?: string;
  /** Optional click handler (defaults to navigating to /controllers) */
  onClick?: () => void;
}

/**
 * Props for the DemoModeTransition wrapper component.
 */
export interface DemoModeTransitionProps {
  /** Whether demo mode is active */
  isDemoMode: boolean;
  /** Children to render with transition effects */
  children: React.ReactNode;
  /** Optional callback when transition completes */
  onTransitionComplete?: () => void;
}

// =============================================================================
// DemoBanner Component
// =============================================================================

/**
 * DemoBanner - Top banner indicating demo or connected status.
 *
 * When in demo mode:
 * - Shows blue indicator with "Viewing Demo Data" message
 * - Encourages user to connect controllers
 *
 * When controllers are connected:
 * - Shows green indicator with "Controllers Connected" message
 * - Displays the number of rooms being monitored
 *
 * Features smooth 500ms fade transition between states.
 *
 * @example
 * ```tsx
 * <DemoBanner isDemoMode={true} />
 *
 * // When connected:
 * <DemoBanner isDemoMode={false} roomCount={3} />
 * ```
 */
export function DemoBanner({
  isDemoMode,
  roomCount = 0,
  isTransitioning = false,
  className,
}: DemoBannerProps): React.ReactElement {
  // Memoize the banner content to prevent unnecessary re-renders
  const bannerContent = useMemo(() => {
    if (isDemoMode) {
      return {
        icon: Radio,
        iconClassName: "text-blue-500 animate-pulse",
        bgClassName: "bg-blue-500/10 border-blue-500/20",
        textClassName: "text-blue-600 dark:text-blue-400",
        primaryText: "Viewing Demo Data",
        secondaryText: "Connect your controllers to see real-time monitoring",
        indicator: (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
          </span>
        ),
      };
    }

    return {
      icon: Check,
      iconClassName: "text-green-500",
      bgClassName: "bg-green-500/10 border-green-500/20",
      textClassName: "text-green-600 dark:text-green-400",
      primaryText: "Controllers Connected",
      secondaryText: `Monitoring ${roomCount} room${roomCount !== 1 ? "s" : ""}`,
      indicator: (
        <span className="relative flex h-2.5 w-2.5">
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
      ),
    };
  }, [isDemoMode, roomCount]);

  const IconComponent = bannerContent.icon;

  return (
    <div
      className={cn(
        "w-full px-4 py-2.5 rounded-lg border transition-all duration-500",
        bannerContent.bgClassName,
        isTransitioning && "opacity-80",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-3">
        {/* Status Indicator */}
        {bannerContent.indicator}

        {/* Icon */}
        <IconComponent
          className={cn("h-4 w-4 flex-shrink-0", bannerContent.iconClassName)}
          aria-hidden="true"
        />

        {/* Text Content */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
          <span className={cn("font-medium", bannerContent.textClassName)}>
            {bannerContent.primaryText}
          </span>
          <span className="text-muted-foreground">-</span>
          <span className="text-muted-foreground">{bannerContent.secondaryText}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DemoBadge Component
// =============================================================================

/**
 * DemoBadge - Semi-transparent watermark badge for demo room cards.
 *
 * Displays "DEMO" text at 40% opacity in the top-right corner of room cards
 * to clearly indicate the data is synthetic. Designed to be informative
 * without being distracting.
 *
 * @example
 * ```tsx
 * // In a room card:
 * <div className="relative">
 *   <DemoBadge className="absolute top-2 right-2" />
 *   {// ... rest of card content }
 * </div>
 * ```
 */
export function DemoBadge({ className }: DemoBadgeProps): React.ReactElement {
  return (
    <div
      className={cn(
        // Positioning and layout
        "inline-flex items-center gap-1 px-2 py-0.5",
        // Visual styling - semi-transparent appearance
        "rounded-md bg-blue-500/10 border border-blue-500/20",
        // Typography
        "text-[10px] font-bold uppercase tracking-wider",
        // Opacity for watermark effect
        "text-blue-500/40 select-none",
        // Ensure it doesn't interfere with card interactions
        "pointer-events-none",
        className
      )}
      aria-label="Demo data indicator"
    >
      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
      <span>Demo</span>
    </div>
  );
}

// =============================================================================
// ConnectCTA Component
// =============================================================================

/**
 * ConnectCTA - Prominent call-to-action button for connecting controllers.
 *
 * Features a pulsing glow effect to draw user attention. When clicked,
 * navigates to the controllers page where users can add their hardware.
 *
 * The button uses a custom pulsing animation defined via Tailwind CSS
 * arbitrary values for the glow effect.
 *
 * @example
 * ```tsx
 * // In the dashboard when no controllers connected:
 * <ConnectCTA />
 *
 * // With custom click handler:
 * <ConnectCTA onClick={() => setShowSetupWizard(true)} />
 * ```
 */
export function ConnectCTA({ className, onClick }: ConnectCTAProps): React.ReactElement {
  // If onClick is provided, render as a button; otherwise, render as a link
  const buttonContent = (
    <>
      <Plus className="h-5 w-5" />
      <span>Connect Your First Controller</span>
    </>
  );

  const buttonClasses = cn(
    // Base button styles
    "relative inline-flex items-center gap-2 px-6 py-3",
    "rounded-lg font-semibold text-base",
    // Primary color scheme
    "bg-primary text-primary-foreground",
    // Hover state
    "hover:bg-primary/90 transition-colors",
    // Focus state for accessibility
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    // Pulsing glow effect using box-shadow animation
    "shadow-lg shadow-primary/25",
    "animate-cta-pulse",
    className
  );

  // Render with custom onClick or as a link
  if (onClick) {
    return (
      <Button
        size="lg"
        className={buttonClasses}
        onClick={onClick}
        aria-label="Connect your first controller to start monitoring"
      >
        {buttonContent}
      </Button>
    );
  }

  return (
    <Link href="/controllers" className={buttonClasses} aria-label="Connect your first controller to start monitoring">
      {buttonContent}
    </Link>
  );
}

// =============================================================================
// DemoModeTransition Component
// =============================================================================

/**
 * DemoModeTransition - Wrapper component that handles fade transitions.
 *
 * Provides a smooth 500ms fade-out/fade-in transition when switching
 * between demo mode and real data mode. This creates a polished UX
 * when a user's first controller comes online.
 *
 * @example
 * ```tsx
 * <DemoModeTransition
 *   isDemoMode={isDemoMode}
 *   onTransitionComplete={() => console.log('Transition done')}
 * >
 *   {isDemoMode ? <DemoContent /> : <RealContent />}
 * </DemoModeTransition>
 * ```
 */
export function DemoModeTransition({
  isDemoMode,
  children,
  onTransitionComplete,
}: DemoModeTransitionProps): React.ReactElement {
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [_shouldRender, setShouldRender] = React.useState(isDemoMode);
  const prevDemoModeRef = React.useRef(isDemoMode);

  React.useEffect(() => {
    // Detect transition from demo mode to connected mode
    if (prevDemoModeRef.current && !isDemoMode) {
      setIsTransitioning(true);

      // Wait for fade-out animation
      const fadeOutTimer = setTimeout(() => {
        setShouldRender(false);
        setIsTransitioning(false);
        onTransitionComplete?.();
      }, 500);

      return () => clearTimeout(fadeOutTimer);
    }

    // Update ref for next comparison
    prevDemoModeRef.current = isDemoMode;
    setShouldRender(isDemoMode);
  }, [isDemoMode, onTransitionComplete]);

  return (
    <div
      className={cn(
        "transition-opacity duration-500",
        isTransitioning ? "opacity-0" : "opacity-100"
      )}
    >
      {children}
    </div>
  );
}

// =============================================================================
// DemoRoomCardWrapper Component
// =============================================================================

/**
 * Props for DemoRoomCardWrapper.
 */
export interface DemoRoomCardWrapperProps {
  /** Whether this is a demo room card */
  isDemo: boolean;
  /** Children (the actual room card content) */
  children: React.ReactNode;
  /** Additional CSS classes for the wrapper */
  className?: string;
}

/**
 * DemoRoomCardWrapper - Wrapper that adds demo badge to room cards.
 *
 * Wraps a room card and overlays the demo badge when in demo mode.
 * Uses relative positioning to place the badge in the top-right corner.
 *
 * @example
 * ```tsx
 * <DemoRoomCardWrapper isDemo={isDemoMode}>
 *   <RoomCard room={room} />
 * </DemoRoomCardWrapper>
 * ```
 */
export function DemoRoomCardWrapper({
  isDemo,
  children,
  className,
}: DemoRoomCardWrapperProps): React.ReactElement {
  return (
    <div className={cn("relative", className)}>
      {isDemo && (
        <DemoBadge className="absolute top-3 right-3 z-10" />
      )}
      {children}
    </div>
  );
}

// =============================================================================
// CSS Keyframes Note
// =============================================================================

/**
 * The following CSS keyframes should be added to your global styles or
 * Tailwind configuration for the pulsing glow animation:
 *
 * ```css
 * @keyframes cta-pulse {
 *   0%, 100% {
 *     box-shadow: 0 10px 15px -3px rgba(var(--primary-rgb), 0.25),
 *                 0 4px 6px -4px rgba(var(--primary-rgb), 0.25);
 *   }
 *   50% {
 *     box-shadow: 0 20px 25px -5px rgba(var(--primary-rgb), 0.4),
 *                 0 8px 10px -6px rgba(var(--primary-rgb), 0.4);
 *   }
 * }
 *
 * .animate-cta-pulse {
 *   animation: cta-pulse 2s ease-in-out infinite;
 * }
 * ```
 *
 * Alternatively, you can add to tailwind.config.js:
 *
 * ```js
 * module.exports = {
 *   theme: {
 *     extend: {
 *       animation: {
 *         'cta-pulse': 'cta-pulse 2s ease-in-out infinite',
 *       },
 *       keyframes: {
 *         'cta-pulse': {
 *           '0%, 100%': {
 *             boxShadow: '0 10px 15px -3px hsl(var(--primary) / 0.25), 0 4px 6px -4px hsl(var(--primary) / 0.25)',
 *           },
 *           '50%': {
 *             boxShadow: '0 20px 25px -5px hsl(var(--primary) / 0.4), 0 8px 10px -6px hsl(var(--primary) / 0.4)',
 *           },
 *         },
 *       },
 *     },
 *   },
 * };
 * ```
 */
