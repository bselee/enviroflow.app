/**
 * Interactive Onboarding Tour Component
 *
 * A progressive 5-step onboarding experience that guides new users through
 * the core features of EnviroFlow. The tour:
 *
 * - Appears automatically on first login
 * - Persists completion state to localStorage
 * - Tracks analytics for user engagement
 * - Is fully responsive (mobile, tablet, desktop)
 * - Can be dismissed and restarted from Help menu
 *
 * Architecture:
 * - Uses shadcn Dialog for modal overlay
 * - Manages state via useOnboarding hook
 * - Supports keyboard navigation (Esc to close, arrow keys to navigate)
 * - Smooth animations with Tailwind transitions
 *
 * Usage:
 * ```tsx
 * <OnboardingTour />
 * ```
 */

"use client";

import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/hooks/use-onboarding";
import { ONBOARDING_STEPS, isFirstStep, isLastStep } from "@/lib/onboarding-content";

/**
 * Props for OnboardingTour component.
 */
interface OnboardingTourProps {
  /** Optional className for custom styling */
  className?: string;
  /** Callback fired when tour completes */
  onComplete?: () => void;
  /** Callback fired when tour is dismissed */
  onDismiss?: () => void;
}

/**
 * Main OnboardingTour component.
 */
export function OnboardingTour({
  className,
  onComplete,
  onDismiss,
}: OnboardingTourProps): JSX.Element {
  const {
    isActive,
    currentStep,
    totalSteps,
    nextStep,
    previousStep,
    skipStep,
    completeTour,
    dismissTour,
  } = useOnboarding();

  // Get current step data
  const step = ONBOARDING_STEPS[currentStep];
  const isFirst = isFirstStep(currentStep);
  const isLast = isLastStep(currentStep);
  const progress = ((currentStep + 1) / totalSteps) * 100;

  /**
   * Handle next button click.
   */
  const handleNext = useCallback(() => {
    if (isLast) {
      completeTour();
      onComplete?.();
    } else {
      nextStep();
    }
  }, [isLast, completeTour, nextStep, onComplete]);

  /**
   * Handle previous button click.
   */
  const handlePrevious = useCallback(() => {
    if (!isFirst) {
      previousStep();
    }
  }, [isFirst, previousStep]);

  /**
   * Handle skip button click.
   */
  const handleSkip = useCallback(() => {
    skipStep();
  }, [skipStep]);

  /**
   * Handle dismiss/close.
   */
  const handleDismiss = useCallback(() => {
    dismissTour();
    onDismiss?.();
  }, [dismissTour, onDismiss]);

  /**
   * Handle keyboard navigation.
   */
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          if (!isFirst) {
            event.preventDefault();
            previousStep();
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          handleNext();
          break;
        case "Escape":
          event.preventDefault();
          handleDismiss();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, isFirst, previousStep, handleNext, handleDismiss]);

  // Don't render if not active or no step data
  if (!isActive || !step) {
    return <></>;
  }

  return (
    <Dialog open={isActive} onOpenChange={handleDismiss}>
      <DialogContent
        className={cn(
          "max-w-2xl p-0 gap-0 overflow-hidden",
          "sm:max-w-[600px]",
          className
        )}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close onboarding tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </span>
            <span className="text-xs font-medium text-primary">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <DialogHeader className="text-left mb-6">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {step.title}
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground leading-relaxed mt-3">
              {step.content}
            </DialogDescription>
          </DialogHeader>

          {/* Optional image placeholder for future enhancement */}
          {step.imageUrl && (
            <div className="mb-6 rounded-lg overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={step.imageUrl}
                alt={step.title}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Step indicators (dots) */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {ONBOARDING_STEPS.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  index === currentStep
                    ? "w-8 bg-primary"
                    : index < currentStep
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted-foreground/20"
                )}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        {/* Footer with navigation */}
        <DialogFooter className="px-6 py-4 bg-muted/30 border-t flex-col sm:flex-row gap-2 sm:gap-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Previous button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={isFirst}
              className="flex-1 sm:flex-initial"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            {/* Skip button (hidden on last step) */}
            {!isLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="flex-1 sm:flex-initial text-muted-foreground hover:text-foreground"
              >
                Skip
              </Button>
            )}
          </div>

          {/* Next/Complete button */}
          <Button
            onClick={handleNext}
            size="sm"
            className="w-full sm:w-auto sm:ml-auto"
          >
            {isLast ? step.ctaText || "Complete" : step.ctaText || "Next"}
            {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mobile-optimized variant with swipe gestures (future enhancement).
 * Currently renders the same as desktop but prepared for touch gestures.
 */
export function OnboardingTourMobile(props: OnboardingTourProps): JSX.Element {
  // For now, render the same component
  // Future: Add swipe gesture support using react-use-gesture or similar
  return <OnboardingTour {...props} />;
}
