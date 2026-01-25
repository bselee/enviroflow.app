"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// =============================================================================
// Types
// =============================================================================

/**
 * Animation performance tiers based on device capability.
 *
 * - **full**: All animations enabled (>55fps) - smooth transitions, pulse glows, complex easing
 * - **simplified**: Reduced animations (40-55fps) - disable pulse glows, use simpler easing
 * - **minimal**: Essential updates only (<40fps) - only data changes, no decorative animations
 */
export type AnimationTier = "full" | "simplified" | "minimal";

/**
 * Return type for the useAnimationTier hook.
 */
export interface UseAnimationTierReturn {
  /** Current animation tier based on device capability */
  tier: AnimationTier;
  /** Current measured frames per second (0 if not yet measured) */
  fps: number;
  /** Whether user prefers reduced motion (via OS setting) */
  isReducedMotion: boolean;
  /** Whether user has manually overridden the auto-detected tier */
  manualOverride: boolean;
  /** Set a manual override for the animation tier, or null to use auto-detection */
  setManualOverride: (tier: AnimationTier | null) => void;
  /** Whether tier has been degraded from initial measurement */
  hasDegraded: boolean;
  /** Force a re-measurement of FPS */
  remeasure: () => void;
}

/**
 * Configuration for FPS measurement.
 */
interface FPSMeasurementConfig {
  /** Number of frames to sample for FPS calculation */
  sampleSize: number;
  /** Interval (in ms) between re-measurements */
  remeasureInterval: number;
  /** Threshold FPS for full tier (above this = full) */
  fullThreshold: number;
  /** Threshold FPS for simplified tier (above this = simplified, below = minimal) */
  simplifiedThreshold: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Default configuration for FPS measurement */
const DEFAULT_CONFIG: FPSMeasurementConfig = {
  sampleSize: 60, // 60 frames (~1 second at 60fps)
  remeasureInterval: 30000, // Re-measure every 30 seconds
  fullThreshold: 55, // >55fps = full tier
  simplifiedThreshold: 40, // 40-55fps = simplified, <40fps = minimal
};

/** LocalStorage key for manual tier override */
const STORAGE_KEY = "enviroflow-animation-tier-override";

/** CSS custom property name for global tier access */
const CSS_PROPERTY = "--animation-tier";

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Determines animation tier based on FPS measurement.
 *
 * @param fps - Measured frames per second
 * @param config - FPS measurement configuration
 * @returns The appropriate animation tier
 */
function determineTier(fps: number, config: FPSMeasurementConfig): AnimationTier {
  if (fps > config.fullThreshold) {
    return "full";
  }
  if (fps >= config.simplifiedThreshold) {
    return "simplified";
  }
  return "minimal";
}

/**
 * Checks if the browser/OS prefers reduced motion.
 * This is a user accessibility setting that should always be respected.
 *
 * @returns true if reduced motion is preferred
 */
function checkReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Sets the animation tier as a CSS custom property and class on the document.
 * This allows CSS to react to the current tier via:
 * - CSS custom property: var(--animation-tier)
 * - Data attribute: [data-animation-tier="full|simplified|minimal"]
 * - Body class: .animation-tier-full|simplified|minimal
 *
 * @param tier - The animation tier to set
 */
function setTierCSSProperty(tier: AnimationTier): void {
  if (typeof document === "undefined") {
    return;
  }

  // Set CSS custom property on document root
  document.documentElement.style.setProperty(CSS_PROPERTY, tier);
  document.documentElement.setAttribute("data-animation-tier", tier);

  // Apply tier class to body for CSS rule matching
  // Remove any existing tier classes first
  const tierClasses = ["animation-tier-full", "animation-tier-simplified", "animation-tier-minimal"];
  document.body.classList.remove(...tierClasses);
  document.body.classList.add(`animation-tier-${tier}`);
}

/**
 * Retrieves stored manual override from localStorage.
 *
 * @returns The stored tier or null if not set/invalid
 */
function getStoredOverride(): AnimationTier | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ["full", "simplified", "minimal"].includes(stored)) {
      return stored as AnimationTier;
    }
  } catch {
    // localStorage might be unavailable in some contexts
  }
  return null;
}

/**
 * Stores manual override to localStorage.
 *
 * @param tier - The tier to store, or null to clear
 */
function setStoredOverride(tier: AnimationTier | null): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (tier === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, tier);
    }
  } catch {
    // localStorage might be unavailable in some contexts
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useAnimationTier - Auto-detects device animation capability and manages animation tiers.
 *
 * This hook measures the device's rendering performance using requestAnimationFrame
 * and automatically selects an appropriate animation tier. It respects the user's
 * prefers-reduced-motion setting and allows manual overrides.
 *
 * Features:
 * - FPS measurement using 60-frame sample
 * - Three performance tiers: full (>55fps), simplified (40-55fps), minimal (<40fps)
 * - Respects prefers-reduced-motion media query (forces minimal)
 * - Stores tier in CSS custom property for global access
 * - Re-measures every 30 seconds to adapt to changing conditions
 * - Manual override option with localStorage persistence
 * - Degradation detection for user notification
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { tier, fps, isReducedMotion, hasDegraded } = useAnimationTier();
 *
 *   return (
 *     <div className={`animation-tier-${tier}`}>
 *       {tier === 'full' && <PulseGlow />}
 *       {hasDegraded && <p>Animations reduced for better performance</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnimationTier(
  config: Partial<FPSMeasurementConfig> = {}
): UseAnimationTierReturn {
  const mergedConfig: FPSMeasurementConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );

  // State
  const [fps, setFps] = useState<number>(0);
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);
  const [manualOverrideTier, setManualOverrideTier] = useState<AnimationTier | null>(null);
  const [initialTier, setInitialTier] = useState<AnimationTier | null>(null);

  // Refs for animation frame tracking
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const measurementCompleteRef = useRef<boolean>(false);
  const remeasureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Measures FPS using requestAnimationFrame.
   * Samples the specified number of frames and calculates average FPS.
   */
  const measureFPS = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Reset measurement state
    frameCountRef.current = 0;
    lastTimeRef.current = 0;
    measurementCompleteRef.current = false;

    const measureFrame = (timestamp: number): void => {
      // Initialize on first frame
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        frameCountRef.current = 0;
        animationFrameRef.current = requestAnimationFrame(measureFrame);
        return;
      }

      frameCountRef.current++;

      // Check if we've collected enough samples
      if (frameCountRef.current >= mergedConfig.sampleSize) {
        const elapsed = timestamp - lastTimeRef.current;
        const measuredFPS = (frameCountRef.current / elapsed) * 1000;

        // Round to 1 decimal place for display
        const roundedFPS = Math.round(measuredFPS * 10) / 10;
        setFps(roundedFPS);
        measurementCompleteRef.current = true;

        // Set initial tier on first measurement
        if (initialTier === null) {
          setInitialTier(determineTier(roundedFPS, mergedConfig));
        }

        return;
      }

      // Continue measuring
      animationFrameRef.current = requestAnimationFrame(measureFrame);
    };

    // Cancel any existing measurement
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Start measurement
    animationFrameRef.current = requestAnimationFrame(measureFrame);
  }, [mergedConfig, initialTier]);

  /**
   * Handle manual override setting.
   */
  const setManualOverride = useCallback((tier: AnimationTier | null): void => {
    setManualOverrideTier(tier);
    setStoredOverride(tier);
  }, []);

  /**
   * Force a re-measurement of FPS.
   */
  const remeasure = useCallback((): void => {
    measureFPS();
  }, [measureFPS]);

  // Initialize on mount
  useEffect(() => {
    // Check for stored override
    const storedOverride = getStoredOverride();
    if (storedOverride) {
      setManualOverrideTier(storedOverride);
    }

    // Check reduced motion preference
    const reducedMotion = checkReducedMotion();
    setIsReducedMotion(reducedMotion);

    // Start FPS measurement (unless reduced motion is set)
    if (!reducedMotion) {
      measureFPS();
    }

    // Set up media query listener for reduced motion changes
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

      const handleChange = (event: MediaQueryListEvent): void => {
        setIsReducedMotion(event.matches);
        // Re-measure when reduced motion is turned off
        if (!event.matches) {
          measureFPS();
        }
      };

      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
      } else {
        // Legacy support
        mediaQuery.addListener(handleChange);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handleChange);
        } else {
          mediaQuery.removeListener(handleChange);
        }
      };
    }
  }, [measureFPS]);

  // Set up periodic re-measurement
  useEffect(() => {
    if (isReducedMotion || manualOverrideTier !== null) {
      // Don't re-measure if reduced motion is on or manual override is set
      return;
    }

    remeasureIntervalRef.current = setInterval(() => {
      measureFPS();
    }, mergedConfig.remeasureInterval);

    return () => {
      if (remeasureIntervalRef.current !== null) {
        clearInterval(remeasureIntervalRef.current);
      }
    };
  }, [measureFPS, mergedConfig.remeasureInterval, isReducedMotion, manualOverrideTier]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (remeasureIntervalRef.current !== null) {
        clearInterval(remeasureIntervalRef.current);
      }
    };
  }, []);

  // Calculate the effective tier
  const effectiveTier = (() => {
    // Reduced motion always forces minimal
    if (isReducedMotion) {
      return "minimal";
    }

    // Manual override takes precedence
    if (manualOverrideTier !== null) {
      return manualOverrideTier;
    }

    // Auto-detect based on FPS (default to simplified before first measurement)
    if (fps === 0) {
      return "simplified";
    }

    return determineTier(fps, mergedConfig);
  })();

  // Check if tier has degraded from initial measurement
  const hasDegraded = (() => {
    if (initialTier === null || isReducedMotion || manualOverrideTier !== null) {
      return false;
    }

    const tierOrder: Record<AnimationTier, number> = {
      full: 2,
      simplified: 1,
      minimal: 0,
    };

    return tierOrder[effectiveTier] < tierOrder[initialTier];
  })();

  // Update CSS property when tier changes
  useEffect(() => {
    setTierCSSProperty(effectiveTier);
  }, [effectiveTier]);

  return {
    tier: effectiveTier,
    fps,
    isReducedMotion,
    manualOverride: manualOverrideTier !== null,
    setManualOverride,
    hasDegraded,
    remeasure,
  };
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * useAnimationEnabled - Simple boolean check for whether animations should be enabled.
 *
 * Use this hook when you just need to know if animations should run at all,
 * without needing the full tier information.
 *
 * @returns true if animations should be enabled (tier is not minimal)
 */
export function useAnimationEnabled(): boolean {
  const { tier } = useAnimationTier();
  return tier !== "minimal";
}

/**
 * usePulseEnabled - Check if pulse/glow animations should be enabled.
 *
 * Pulse animations are only enabled in the "full" tier as they are
 * decorative and can be performance-intensive.
 *
 * @returns true if pulse animations should be enabled
 */
export function usePulseEnabled(): boolean {
  const { tier } = useAnimationTier();
  return tier === "full";
}

/**
 * useComplexEasingEnabled - Check if complex easing functions should be used.
 *
 * Complex easing (cubic-bezier, spring physics) is only enabled in
 * full and simplified tiers.
 *
 * @returns true if complex easing should be used
 */
export function useComplexEasingEnabled(): boolean {
  const { tier } = useAnimationTier();
  return tier !== "minimal";
}

// =============================================================================
// Context (Optional - for components that need tier without measuring)
// =============================================================================

/**
 * Context for sharing animation tier across component tree.
 */
const AnimationTierContext = createContext<UseAnimationTierReturn | null>(null);

/**
 * Props for AnimationTierProvider.
 */
export interface AnimationTierProviderProps {
  children: ReactNode;
  config?: Partial<FPSMeasurementConfig>;
}

/**
 * AnimationTierProvider - Provides animation tier context to child components.
 *
 * Use this at the root of your app to avoid multiple FPS measurements.
 * Child components can then use useAnimationTierContext() instead of useAnimationTier().
 *
 * @example
 * ```tsx
 * // In your app root
 * <AnimationTierProvider>
 *   <App />
 * </AnimationTierProvider>
 *
 * // In any child component
 * const { tier } = useAnimationTierContext();
 * ```
 */
export function AnimationTierProvider({
  children,
  config,
}: AnimationTierProviderProps): ReactNode {
  const value = useAnimationTier(config);

  return (
    <AnimationTierContext.Provider value={value}>
      {children}
    </AnimationTierContext.Provider>
  );
}

/**
 * useAnimationTierContext - Access animation tier from context.
 *
 * Use this in child components when AnimationTierProvider is used at the root.
 * Falls back to creating a new measurement if context is not available.
 *
 * @returns Animation tier state and controls
 */
export function useAnimationTierContext(): UseAnimationTierReturn {
  const context = useContext(AnimationTierContext);

  // Fall back to direct hook if context not available
  // This is a trade-off: allows use without provider but may cause multiple measurements
  const fallback = useAnimationTier();

  return context ?? fallback;
}
