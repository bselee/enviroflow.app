"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  useAnimationTierContext,
  type AnimationTier,
} from "@/hooks/use-animation-tier";

// =============================================================================
// Types
// =============================================================================

/**
 * Animation types that can be conditionally rendered based on performance tier.
 *
 * - **pulse**: Pulsing/breathing animations (e.g., status indicators)
 * - **count**: Number counting animations (e.g., AnimatedNumber)
 * - **transition**: State transition animations (e.g., enter/exit, color changes)
 * - **glow**: Glow effects and shadows (e.g., status glows)
 * - **parallax**: Parallax scroll effects
 * - **complex**: Any complex animation requiring high performance
 */
export type AnimationType =
  | "pulse"
  | "count"
  | "transition"
  | "glow"
  | "parallax"
  | "complex";

/**
 * Mapping of animation types to the minimum tier required to enable them.
 */
const ANIMATION_TIER_REQUIREMENTS: Record<AnimationType, AnimationTier> = {
  pulse: "full", // Only in full tier
  glow: "full", // Only in full tier
  parallax: "full", // Only in full tier
  complex: "full", // Only in full tier
  count: "simplified", // Full and simplified
  transition: "simplified", // Full and simplified
};

/**
 * Props for AnimationWrapper component.
 */
export interface AnimationWrapperProps {
  /** Child elements to render */
  children: React.ReactNode;
  /** Type of animation being wrapped */
  animationType: AnimationType;
  /** Alternative content to show when animation is disabled */
  fallback?: React.ReactNode;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Custom styles for the wrapper */
  style?: React.CSSProperties;
  /** Whether to render a wrapper div (true) or just conditionally render children (false) */
  asWrapper?: boolean;
  /** HTML element tag to use for wrapper (default: 'div') */
  as?: keyof JSX.IntrinsicElements;
  /** Force enable/disable regardless of tier (for testing or special cases) */
  forceEnabled?: boolean;
  /** Callback when animation is enabled/disabled */
  onEnabledChange?: (enabled: boolean) => void;
}

/**
 * Return type for useAnimationEnabled hook variant.
 */
export interface AnimationEnabledResult {
  /** Whether the specific animation type should be enabled */
  enabled: boolean;
  /** Current animation tier */
  tier: AnimationTier;
  /** Whether user prefers reduced motion */
  isReducedMotion: boolean;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Checks if a specific animation type should be enabled for the given tier.
 *
 * @param animationType - The type of animation
 * @param tier - Current animation tier
 * @returns true if the animation should be enabled
 */
export function isAnimationEnabled(
  animationType: AnimationType,
  tier: AnimationTier
): boolean {
  const requiredTier = ANIMATION_TIER_REQUIREMENTS[animationType];
  const tierOrder: Record<AnimationTier, number> = {
    minimal: 0,
    simplified: 1,
    full: 2,
  };

  return tierOrder[tier] >= tierOrder[requiredTier];
}

/**
 * Gets CSS classes for animation tier.
 *
 * @param tier - Current animation tier
 * @returns CSS class string
 */
export function getAnimationTierClass(tier: AnimationTier): string {
  return `animation-tier-${tier}`;
}

/**
 * Gets CSS variables for animation timing based on tier.
 *
 * @param tier - Current animation tier
 * @returns Object with CSS custom properties
 */
export function getAnimationTimingVars(tier: AnimationTier): Record<string, string> {
  switch (tier) {
    case "full":
      return {
        "--animation-duration-fast": "150ms",
        "--animation-duration-normal": "300ms",
        "--animation-duration-slow": "500ms",
        "--animation-easing": "cubic-bezier(0.4, 0, 0.2, 1)",
        "--animation-easing-bounce": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      };
    case "simplified":
      return {
        "--animation-duration-fast": "100ms",
        "--animation-duration-normal": "200ms",
        "--animation-duration-slow": "300ms",
        "--animation-easing": "ease-out",
        "--animation-easing-bounce": "ease-out",
      };
    case "minimal":
    default:
      return {
        "--animation-duration-fast": "0ms",
        "--animation-duration-normal": "0ms",
        "--animation-duration-slow": "0ms",
        "--animation-easing": "linear",
        "--animation-easing-bounce": "linear",
      };
  }
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * useAnimationTypeEnabled - Check if a specific animation type should be enabled.
 *
 * @param animationType - The type of animation to check
 * @returns Object with enabled state and tier info
 *
 * @example
 * ```tsx
 * function PulseIndicator() {
 *   const { enabled } = useAnimationTypeEnabled('pulse');
 *
 *   return (
 *     <div className={enabled ? 'animate-pulse' : ''}>
 *       Status
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnimationTypeEnabled(
  animationType: AnimationType
): AnimationEnabledResult {
  const { tier, isReducedMotion } = useAnimationTierContext();

  const enabled = React.useMemo(() => {
    if (isReducedMotion) {
      return false;
    }
    return isAnimationEnabled(animationType, tier);
  }, [animationType, tier, isReducedMotion]);

  return {
    enabled,
    tier,
    isReducedMotion,
  };
}

/**
 * useConditionalAnimation - Returns animation classes/styles only if enabled.
 *
 * @param animationType - Type of animation
 * @param enabledClassName - Class to apply when enabled
 * @param disabledClassName - Class to apply when disabled (optional)
 * @returns The appropriate class name
 *
 * @example
 * ```tsx
 * function GlowButton() {
 *   const glowClass = useConditionalAnimation(
 *     'glow',
 *     'shadow-lg shadow-blue-500/50',
 *     'shadow-sm'
 *   );
 *
 *   return <button className={glowClass}>Click me</button>;
 * }
 * ```
 */
export function useConditionalAnimation(
  animationType: AnimationType,
  enabledClassName: string,
  disabledClassName: string = ""
): string {
  const { enabled } = useAnimationTypeEnabled(animationType);
  return enabled ? enabledClassName : disabledClassName;
}

// =============================================================================
// Component
// =============================================================================

/**
 * AnimationWrapper - Conditionally renders animations based on performance tier.
 *
 * This component wraps animated content and conditionally renders it based on
 * the current animation tier. Use it to gracefully degrade complex animations
 * on lower-performance devices.
 *
 * Features:
 * - Automatically checks animation tier
 * - Supports fallback content for when animations are disabled
 * - Applies tier-specific CSS classes
 * - Can render as wrapper div or just conditionally render children
 * - Supports force-enable for testing
 *
 * @example
 * ```tsx
 * // Basic usage - wrap a pulsing animation
 * <AnimationWrapper animationType="pulse">
 *   <div className="animate-pulse">Loading...</div>
 * </AnimationWrapper>
 *
 * // With fallback content
 * <AnimationWrapper
 *   animationType="glow"
 *   fallback={<div className="border border-gray-300">Status</div>}
 * >
 *   <div className="shadow-lg shadow-green-500/50">Status</div>
 * </AnimationWrapper>
 *
 * // Without wrapper div (just conditional rendering)
 * <AnimationWrapper animationType="transition" asWrapper={false}>
 *   <motion.div animate={{ opacity: 1 }}>Content</motion.div>
 * </AnimationWrapper>
 * ```
 */
export function AnimationWrapper({
  children,
  animationType,
  fallback,
  className,
  style,
  asWrapper = true,
  as: Component = "div",
  forceEnabled,
  onEnabledChange,
}: AnimationWrapperProps): React.ReactElement | null {
  const { tier, isReducedMotion } = useAnimationTierContext();

  // Determine if animation should be enabled
  const shouldEnable = React.useMemo(() => {
    if (forceEnabled !== undefined) {
      return forceEnabled;
    }
    if (isReducedMotion) {
      return false;
    }
    return isAnimationEnabled(animationType, tier);
  }, [animationType, tier, isReducedMotion, forceEnabled]);

  // Notify on enabled change
  React.useEffect(() => {
    onEnabledChange?.(shouldEnable);
  }, [shouldEnable, onEnabledChange]);

  // Get timing variables for the current tier
  const timingVars = React.useMemo(() => getAnimationTimingVars(tier), [tier]);

  // Content to render
  const content = shouldEnable ? children : (fallback ?? children);

  // If not using wrapper, just return the content
  if (!asWrapper) {
    return <>{content}</>;
  }

  // Render with wrapper
  return (
    <Component
      className={cn(
        getAnimationTierClass(tier),
        `animation-type-${animationType}`,
        shouldEnable && "animation-enabled",
        !shouldEnable && "animation-disabled",
        className
      )}
      style={{
        ...timingVars,
        ...style,
      }}
      data-animation-tier={tier}
      data-animation-type={animationType}
      data-animation-enabled={shouldEnable}
    >
      {content}
    </Component>
  );
}

// =============================================================================
// Specialized Wrapper Components
// =============================================================================

/**
 * PulseWrapper - Wrapper specifically for pulse animations.
 * Pulse animations are only enabled in the "full" tier.
 */
export function PulseWrapper({
  children,
  fallback,
  className,
  ...props
}: Omit<AnimationWrapperProps, "animationType">): React.ReactElement {
  return (
    <AnimationWrapper
      animationType="pulse"
      fallback={fallback}
      className={className}
      {...props}
    >
      {children}
    </AnimationWrapper>
  );
}

/**
 * GlowWrapper - Wrapper specifically for glow effects.
 * Glow effects are only enabled in the "full" tier.
 */
export function GlowWrapper({
  children,
  fallback,
  className,
  ...props
}: Omit<AnimationWrapperProps, "animationType">): React.ReactElement {
  return (
    <AnimationWrapper
      animationType="glow"
      fallback={fallback}
      className={className}
      {...props}
    >
      {children}
    </AnimationWrapper>
  );
}

/**
 * TransitionWrapper - Wrapper specifically for transition animations.
 * Transitions are enabled in "full" and "simplified" tiers.
 */
export function TransitionWrapper({
  children,
  fallback,
  className,
  ...props
}: Omit<AnimationWrapperProps, "animationType">): React.ReactElement {
  return (
    <AnimationWrapper
      animationType="transition"
      fallback={fallback}
      className={className}
      {...props}
    >
      {children}
    </AnimationWrapper>
  );
}

/**
 * CountWrapper - Wrapper specifically for counting animations.
 * Count animations are enabled in "full" and "simplified" tiers.
 */
export function CountWrapper({
  children,
  fallback,
  className,
  ...props
}: Omit<AnimationWrapperProps, "animationType">): React.ReactElement {
  return (
    <AnimationWrapper
      animationType="count"
      fallback={fallback}
      className={className}
      {...props}
    >
      {children}
    </AnimationWrapper>
  );
}

// =============================================================================
// HOC Pattern
// =============================================================================

/**
 * Higher-order component that wraps a component with animation tier awareness.
 *
 * @param WrappedComponent - Component to wrap
 * @param animationType - Type of animation the component uses
 * @returns Wrapped component with animation tier support
 *
 * @example
 * ```tsx
 * const AnimatedGlow = withAnimationTier(GlowEffect, 'glow');
 *
 * // Then use it:
 * <AnimatedGlow color="green" />
 * ```
 */
export function withAnimationTier<P extends object>(
  WrappedComponent: React.ComponentType<P & { animationEnabled: boolean }>,
  animationType: AnimationType
): React.FC<P> {
  const WithAnimationTier: React.FC<P> = (props) => {
    const { enabled, tier } = useAnimationTypeEnabled(animationType);

    return (
      <WrappedComponent
        {...props}
        animationEnabled={enabled}
        data-animation-tier={tier}
      />
    );
  };

  WithAnimationTier.displayName = `withAnimationTier(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return WithAnimationTier;
}

// =============================================================================
// Render Props Pattern
// =============================================================================

/**
 * Props for AnimationTierRender component.
 */
export interface AnimationTierRenderProps {
  animationType: AnimationType;
  children: (props: AnimationEnabledResult) => React.ReactNode;
}

/**
 * AnimationTierRender - Render props pattern for animation tier.
 *
 * Use this when you need more control over how the animation tier
 * affects your component rendering.
 *
 * @example
 * ```tsx
 * <AnimationTierRender animationType="pulse">
 *   {({ enabled, tier }) => (
 *     <div style={{ animationDuration: enabled ? '2s' : '0s' }}>
 *       Current tier: {tier}
 *     </div>
 *   )}
 * </AnimationTierRender>
 * ```
 */
export function AnimationTierRender({
  animationType,
  children,
}: AnimationTierRenderProps): React.ReactElement {
  const result = useAnimationTypeEnabled(animationType);
  return <>{children(result)}</>;
}
