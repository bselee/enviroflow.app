"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Props for the AnimatedNumber component.
 *
 * @example
 * // Basic usage
 * <AnimatedNumber value={72.5} suffix="°F" />
 *
 * @example
 * // With custom formatting
 * <AnimatedNumber
 *   value={1234.567}
 *   decimals={2}
 *   formatFn={(v) => v.toLocaleString()}
 * />
 */
export interface AnimatedNumberProps {
  /** The target number to animate to */
  value: number;
  /** Number of decimal places to display (default: 0) */
  decimals?: number;
  /** Animation duration in milliseconds (default: 400) */
  duration?: number;
  /** Suffix to display after the number (e.g., "°F", "%", "kPa") */
  suffix?: string;
  /** Prefix to display before the number (e.g., "$", "-") */
  prefix?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Custom formatting function for the displayed number */
  formatFn?: (value: number) => string;
}

/**
 * EaseOutExpo easing function.
 * Provides a smooth deceleration effect where the animation
 * starts fast and gradually slows down.
 *
 * @param t - Progress value between 0 and 1
 * @returns Eased progress value between 0 and 1
 */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * AnimatedNumber - A component that smoothly animates between number values.
 *
 * Features:
 * - Smooth counting animation using requestAnimationFrame
 * - EaseOutExpo easing for natural deceleration
 * - Pauses animation when element is not in viewport (performance optimization)
 * - Subtle scale animation on value change for visual feedback
 * - Supports decimal places, negative numbers, and custom formatting
 * - Accessible with aria-live for screen readers
 * - Handles rapid value changes gracefully by interrupting ongoing animations
 *
 * @example
 * // Temperature display
 * <AnimatedNumber value={72.5} decimals={1} suffix="°F" />
 *
 * @example
 * // Humidity percentage
 * <AnimatedNumber value={65} suffix="%" duration={600} />
 *
 * @example
 * // Currency with prefix
 * <AnimatedNumber value={1234.56} decimals={2} prefix="$" />
 */
const AnimatedNumber = React.forwardRef<HTMLSpanElement, AnimatedNumberProps>(
  (
    {
      value,
      decimals = 0,
      duration = 400,
      suffix = "",
      prefix = "",
      className,
      formatFn,
    },
    ref
  ) => {
    // Internal ref for intersection observer when external ref not provided
    const internalRef = React.useRef<HTMLSpanElement>(null);
    const spanRef = (ref as React.RefObject<HTMLSpanElement>) || internalRef;

    // Current displayed value (animated)
    const [displayValue, setDisplayValue] = React.useState<number>(value);

    // Scale state for the "pop" animation effect on value change
    const [scale, setScale] = React.useState<number>(1);

    // Track if element is visible in viewport
    const [isInViewport, setIsInViewport] = React.useState<boolean>(true);

    // Store animation state in refs to avoid stale closures
    const animationRef = React.useRef<number | null>(null);
    const startValueRef = React.useRef<number>(value);
    const targetValueRef = React.useRef<number>(value);
    const startTimeRef = React.useRef<number | null>(null);

    /**
     * Set up IntersectionObserver to pause animations when element
     * is not visible, improving performance.
     */
    React.useEffect(() => {
      const element = spanRef.current;
      if (!element) return;

      // Check if IntersectionObserver is available (SSR safety)
      if (typeof IntersectionObserver === "undefined") {
        setIsInViewport(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          setIsInViewport(entry.isIntersecting);
        },
        {
          // Trigger when element is at least 10% visible
          threshold: 0.1,
          // Start observing slightly before element enters viewport
          rootMargin: "50px",
        }
      );

      observer.observe(element);

      return () => {
        observer.disconnect();
      };
    }, [spanRef]);

    /**
     * Cancel any ongoing animation.
     * Called when component unmounts or when a new animation starts.
     */
    const cancelAnimation = React.useCallback(() => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      startTimeRef.current = null;
    }, []);

    /**
     * Animate the number from current display value to target value.
     * Uses requestAnimationFrame for smooth 60fps animation.
     */
    const animate = React.useCallback(() => {
      const animationLoop = (timestamp: number) => {
        // Initialize start time on first frame
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp;
        }

        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutExpo(progress);

        // Calculate interpolated value
        const start = startValueRef.current;
        const end = targetValueRef.current;
        const currentValue = start + (end - start) * easedProgress;

        setDisplayValue(currentValue);

        // Continue animation if not complete
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animationLoop);
        } else {
          // Ensure we land exactly on the target value
          setDisplayValue(end);
          animationRef.current = null;
          startTimeRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(animationLoop);
    }, [duration]);

    /**
     * Handle value changes - trigger animation and scale effect.
     */
    React.useEffect(() => {
      // Skip if value hasn't changed
      if (targetValueRef.current === value) {
        return;
      }

      // Cancel any ongoing animation to handle rapid value changes
      cancelAnimation();

      // Store animation parameters
      startValueRef.current = displayValue;
      targetValueRef.current = value;

      // If not in viewport, jump directly to target value (no animation)
      if (!isInViewport) {
        setDisplayValue(value);
        return;
      }

      // Trigger scale animation for visual feedback
      setScale(1.05);

      // Reset scale after a short delay
      const scaleTimeout = setTimeout(() => {
        setScale(1);
      }, 150);

      // Start the counting animation
      animate();

      return () => {
        clearTimeout(scaleTimeout);
      };
    }, [value, isInViewport, animate, cancelAnimation, displayValue]);

    /**
     * Resume animation when element enters viewport.
     * If we were in the middle of animating when element left viewport,
     * continue from current position.
     */
    React.useEffect(() => {
      if (isInViewport && displayValue !== targetValueRef.current) {
        // Resume animation from current position
        startValueRef.current = displayValue;
        animate();
      } else if (!isInViewport) {
        // Pause animation when leaving viewport
        cancelAnimation();
      }
    }, [isInViewport, animate, cancelAnimation, displayValue]);

    /**
     * Cleanup on unmount.
     */
    React.useEffect(() => {
      return () => {
        cancelAnimation();
      };
    }, [cancelAnimation]);

    /**
     * Format the display value with proper decimal places.
     * Uses custom formatFn if provided, otherwise toFixed.
     */
    const formattedValue = React.useMemo(() => {
      // Round to specified decimal places to avoid floating point artifacts
      const roundedValue = Number(displayValue.toFixed(decimals));

      if (formatFn) {
        return formatFn(roundedValue);
      }

      return roundedValue.toFixed(decimals);
    }, [displayValue, decimals, formatFn]);

    return (
      <span
        ref={spanRef}
        className={cn(
          "inline-block tabular-nums transition-transform duration-150 ease-out",
          className
        )}
        style={{
          transform: `scale(${scale})`,
        }}
        // Accessibility: announce value changes to screen readers
        // "polite" ensures it doesn't interrupt current speech
        aria-live="polite"
        aria-atomic="true"
        // Provide the actual numeric value for assistive technology
        aria-label={`${prefix}${Number(value.toFixed(decimals))}${suffix}`}
      >
        {prefix}
        {formattedValue}
        {suffix}
      </span>
    );
  }
);

AnimatedNumber.displayName = "AnimatedNumber";

export { AnimatedNumber };
