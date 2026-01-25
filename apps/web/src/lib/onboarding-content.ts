/**
 * Onboarding Tour Content Definitions
 *
 * Defines the 5-step progressive onboarding flow for new users.
 * Each step guides users through core features of EnviroFlow.
 */

import type { OnboardingStep } from "@/types";

/**
 * Current version of the onboarding tour.
 * Increment this when making breaking changes to force re-display.
 */
export const ONBOARDING_VERSION = "1.0.0";

/**
 * LocalStorage key for onboarding state persistence.
 */
export const ONBOARDING_STORAGE_KEY = "enviroflow_onboarding_state";

/**
 * LocalStorage key for onboarding analytics.
 */
export const ONBOARDING_ANALYTICS_KEY = "enviroflow_onboarding_analytics";

/**
 * Onboarding tour step definitions.
 * Order matters - these are displayed sequentially.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to EnviroFlow",
    content:
      "Your universal environmental automation platform. Monitor sensors, control devices, and automate workflows across all your hardware controllers in one place.",
    position: "center",
    ctaText: "Get Started",
  },
  {
    id: "dashboard",
    title: "Dashboard Overview",
    content:
      "Your command center shows real-time environment conditions with VPD (Vapor Pressure Deficit) at the center. Track temperature, humidity, and trends across all your rooms at a glance.",
    position: "center",
    ctaText: "Next",
  },
  {
    id: "sensors",
    title: "Sensor Monitoring",
    content:
      "The Intelligent Timeline displays 24-hour sensor trends with customizable time ranges. Spot patterns, detect anomalies, and stay within optimal ranges for your grow stages.",
    position: "center",
    ctaText: "Next",
  },
  {
    id: "devices",
    title: "Device Control",
    content:
      "Control your connected devices directly from room cards. Toggle fans, lights, and outlets with a single tap. Create rooms to organize controllers by location or grow stage.",
    position: "center",
    ctaText: "Next",
  },
  {
    id: "automation",
    title: "Automation Basics",
    content:
      "Build powerful workflows with visual automation. Set conditions based on sensor readings and trigger device actions automatically. Your environment stays optimal 24/7, even while you sleep.",
    position: "center",
    ctaText: "Next",
  },
  {
    id: "next-steps",
    title: "You're All Set!",
    content:
      "Ready to connect your first controller? Click 'Add Room' to create a space, then add controllers from supported brands like AC Infinity, Inkbird, and more. You can restart this tour anytime from the Help menu.",
    position: "center",
    ctaText: "Start Exploring",
    ctaLink: "/dashboard",
  },
];

/**
 * Get step by ID.
 */
export function getStepById(stepId: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((step) => step.id === stepId);
}

/**
 * Get total number of steps.
 */
export function getTotalSteps(): number {
  return ONBOARDING_STEPS.length;
}

/**
 * Check if step is the first step.
 */
export function isFirstStep(stepIndex: number): boolean {
  return stepIndex === 0;
}

/**
 * Check if step is the last step.
 */
export function isLastStep(stepIndex: number): boolean {
  return stepIndex === ONBOARDING_STEPS.length - 1;
}
