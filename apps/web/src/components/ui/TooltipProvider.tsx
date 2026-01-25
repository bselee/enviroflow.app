/**
 * TooltipProvider Component
 *
 * Provides Radix UI TooltipProvider context to the entire application.
 * This ensures all Tooltip components work correctly without needing to
 * wrap each one individually.
 *
 * Usage: Wrap your app layout with this provider
 * ```tsx
 * <TooltipProviderWrapper>
 *   {children}
 * </TooltipProviderWrapper>
 * ```
 */

"use client";

import { TooltipProvider as RadixTooltipProvider } from "@/components/ui/tooltip";

export interface TooltipProviderWrapperProps {
  children: React.ReactNode;
  /**
   * Delay in ms before tooltip appears (default: 200)
   */
  delayDuration?: number;
  /**
   * Whether tooltip should skip delay when moving between tooltips (default: true)
   */
  skipDelayDuration?: number;
}

/**
 * TooltipProviderWrapper - Global tooltip context provider
 */
export function TooltipProviderWrapper({
  children,
  delayDuration = 200,
  skipDelayDuration = 300,
}: TooltipProviderWrapperProps) {
  return (
    <RadixTooltipProvider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
    >
      {children}
    </RadixTooltipProvider>
  );
}
