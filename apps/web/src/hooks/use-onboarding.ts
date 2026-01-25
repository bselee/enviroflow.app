/**
 * Onboarding State Management Hook
 *
 * Manages the onboarding tour state including:
 * - Current step tracking
 * - Completion persistence via localStorage
 * - Analytics event tracking
 * - Tour restart capability
 *
 * Usage:
 * ```tsx
 * const { isActive, currentStep, nextStep, skipStep, completeTour, restartTour } = useOnboarding();
 * ```
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { OnboardingState, OnboardingAnalytics } from "@/types";
import {
  ONBOARDING_VERSION,
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_ANALYTICS_KEY,
  ONBOARDING_STEPS,
  getTotalSteps,
  isLastStep,
} from "@/lib/onboarding-content";

/**
 * Hook return type.
 */
interface UseOnboardingReturn {
  /** Whether the onboarding tour is currently active */
  isActive: boolean;
  /** Current step index (0-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether tour has been completed */
  isCompleted: boolean;
  /** Advance to next step */
  nextStep: () => void;
  /** Go back to previous step */
  previousStep: () => void;
  /** Skip current step and advance */
  skipStep: () => void;
  /** Complete the entire tour */
  completeTour: () => void;
  /** Dismiss/exit the tour without completing */
  dismissTour: () => void;
  /** Restart the tour from beginning */
  restartTour: () => void;
  /** Start the tour (used for manual trigger) */
  startTour: () => void;
  /** Get analytics events */
  getAnalytics: () => OnboardingAnalytics[];
}

/**
 * Custom hook for managing onboarding tour state.
 */
export function useOnboarding(): UseOnboardingReturn {
  // State
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [skippedSteps, setSkippedSteps] = useState<string[]>([]);

  // Track step view time for analytics
  const stepStartTimeRef = useRef<number>(Date.now());
  const isMountedRef = useRef(true);

  /**
   * Load state from localStorage on mount.
   */
  useEffect(() => {
    isMountedRef.current = true;

    const loadState = () => {
      try {
        const storedState = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (!storedState) {
          // First-time user - show onboarding
          setIsActive(true);
          return;
        }

        const state: OnboardingState = JSON.parse(storedState);

        // Check if version matches
        if (state.version !== ONBOARDING_VERSION) {
          // New version - reset onboarding
          localStorage.removeItem(ONBOARDING_STORAGE_KEY);
          setIsActive(true);
          return;
        }

        // Load existing state
        setIsCompleted(state.completed);
        setCurrentStep(state.currentStep);
        setSkippedSteps(state.skippedSteps);

        // Don't auto-show if already completed
        setIsActive(!state.completed);
      } catch (error) {
        console.error("Failed to load onboarding state:", error);
        // Fallback to showing onboarding
        setIsActive(true);
      }
    };

    loadState();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Save state to localStorage whenever it changes.
   */
  const saveState = useCallback(
    (updates: Partial<OnboardingState>) => {
      if (!isMountedRef.current) return;

      const state: OnboardingState = {
        completed: isCompleted,
        currentStep,
        skippedSteps,
        version: ONBOARDING_VERSION,
        ...updates,
      };

      try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error("Failed to save onboarding state:", error);
      }
    },
    [isCompleted, currentStep, skippedSteps]
  );

  /**
   * Track analytics event.
   */
  const trackEvent = useCallback(
    (
      action: OnboardingAnalytics["action"],
      stepId?: string
    ) => {
      if (!isMountedRef.current) return;

      const timeSpent = Math.floor((Date.now() - stepStartTimeRef.current) / 1000);
      const event: OnboardingAnalytics = {
        stepId: stepId || ONBOARDING_STEPS[currentStep]?.id || "unknown",
        action,
        timestamp: new Date().toISOString(),
        timeSpentSeconds: action === "view" ? undefined : timeSpent,
      };

      try {
        const existingEvents = localStorage.getItem(ONBOARDING_ANALYTICS_KEY);
        const events: OnboardingAnalytics[] = existingEvents
          ? JSON.parse(existingEvents)
          : [];
        events.push(event);
        localStorage.setItem(ONBOARDING_ANALYTICS_KEY, JSON.stringify(events));
      } catch (error) {
        console.error("Failed to track onboarding event:", error);
      }

      // Reset timer for next step
      if (action === "view") {
        stepStartTimeRef.current = Date.now();
      }
    },
    [currentStep]
  );

  /**
   * Complete the tour.
   */
  const completeTour = useCallback(() => {
    if (!isMountedRef.current) return;

    trackEvent("complete");
    setIsCompleted(true);
    setIsActive(false);
    saveState({
      completed: true,
      completedAt: new Date().toISOString(),
    });
  }, [trackEvent, saveState]);

  /**
   * Advance to the next step.
   */
  const nextStep = useCallback(() => {
    if (!isMountedRef.current) return;

    if (isLastStep(currentStep)) {
      completeTour();
      return;
    }

    const nextStepIndex = currentStep + 1;
    setCurrentStep(nextStepIndex);
    trackEvent("view", ONBOARDING_STEPS[nextStepIndex]?.id);
    saveState({ currentStep: nextStepIndex });
  }, [currentStep, completeTour, trackEvent, saveState]);

  /**
   * Go back to the previous step.
   */
  const previousStep = useCallback(() => {
    if (!isMountedRef.current || currentStep === 0) return;

    const prevStepIndex = currentStep - 1;
    setCurrentStep(prevStepIndex);
    trackEvent("view", ONBOARDING_STEPS[prevStepIndex]?.id);
    saveState({ currentStep: prevStepIndex });
  }, [currentStep, trackEvent, saveState]);

  /**
   * Skip the current step.
   */
  const skipStep = useCallback(() => {
    if (!isMountedRef.current) return;

    const stepId = ONBOARDING_STEPS[currentStep]?.id;
    if (stepId) {
      const newSkippedSteps = [...skippedSteps, stepId];
      setSkippedSteps(newSkippedSteps);
      trackEvent("skip", stepId);
      saveState({ skippedSteps: newSkippedSteps });
    }

    nextStep();
  }, [currentStep, skippedSteps, nextStep, trackEvent, saveState]);

  /**
   * Dismiss the tour without completing.
   */
  const dismissTour = useCallback(() => {
    if (!isMountedRef.current) return;

    setIsActive(false);
    saveState({ currentStep });
  }, [currentStep, saveState]);

  /**
   * Restart the tour from the beginning.
   */
  const restartTour = useCallback(() => {
    if (!isMountedRef.current) return;

    setCurrentStep(0);
    setIsCompleted(false);
    setSkippedSteps([]);
    setIsActive(true);
    trackEvent("view", ONBOARDING_STEPS[0]?.id);
    saveState({
      completed: false,
      currentStep: 0,
      skippedSteps: [],
      completedAt: undefined,
    });
  }, [trackEvent, saveState]);

  /**
   * Start the tour (for manual trigger).
   */
  const startTour = useCallback(() => {
    if (!isMountedRef.current) return;

    setIsActive(true);
    trackEvent("view", ONBOARDING_STEPS[currentStep]?.id);
  }, [currentStep, trackEvent]);

  /**
   * Get analytics events.
   */
  const getAnalytics = useCallback((): OnboardingAnalytics[] => {
    try {
      const storedEvents = localStorage.getItem(ONBOARDING_ANALYTICS_KEY);
      return storedEvents ? JSON.parse(storedEvents) : [];
    } catch (error) {
      console.error("Failed to load onboarding analytics:", error);
      return [];
    }
  }, []);

  return {
    isActive,
    currentStep,
    totalSteps: getTotalSteps(),
    isCompleted,
    nextStep,
    previousStep,
    skipStep,
    completeTour,
    dismissTour,
    restartTour,
    startTour,
    getAnalytics,
  };
}
