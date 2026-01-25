/**
 * Room Suggestion Logic
 *
 * Provides intelligent room name suggestions based on controller capabilities.
 * Helps reduce friction during controller setup by pre-filling sensible defaults.
 */

import type { ControllerCapabilities, ControllerBrand } from "@/types";

/**
 * Room suggestion result
 */
export interface RoomSuggestion {
  /** Suggested room name */
  name: string;
  /** Reason for the suggestion (for internal use/debugging) */
  reason: string;
  /** Confidence level (high/medium/low) */
  confidence: "high" | "medium" | "low";
}

/**
 * Suggests a room name based on controller capabilities and brand.
 *
 * Logic:
 * - Grow-focused controllers (temp + humidity + VPD) → "Grow Room"
 * - Climate controllers (temp + humidity, no VPD) → "Climate Zone"
 * - Temperature-only controllers → "Environment"
 * - Controllers with light sensors → "Grow Room"
 * - Ecowitt/outdoor sensors → "Outdoor Station"
 * - CSV upload → "Data Room"
 * - Default fallback → "Environment"
 *
 * @param capabilities - Controller capabilities (sensors, devices, etc.)
 * @param brand - Controller brand
 * @returns Room suggestion with name, reason, and confidence
 */
export function suggestRoomName(
  capabilities: ControllerCapabilities,
  brand?: ControllerBrand
): RoomSuggestion {
  const { sensors = [], devices = [] } = capabilities;

  // Special case: CSV upload
  if (brand === "csv_upload") {
    return {
      name: "Data Room",
      reason: "CSV upload controller - manual data source",
      confidence: "medium",
    };
  }

  // Special case: Ecowitt (outdoor weather stations)
  if (brand === "ecowitt") {
    return {
      name: "Outdoor Station",
      reason: "Ecowitt weather station - typically outdoor",
      confidence: "high",
    };
  }

  // High confidence: Grow room (temp + humidity + VPD or light sensors)
  const hasTemp = sensors.includes("temperature");
  const hasHumidity = sensors.includes("humidity");
  const hasVpd = sensors.includes("vpd");
  const hasLight = sensors.includes("light");

  if ((hasTemp && hasHumidity && hasVpd) || hasLight) {
    return {
      name: "Grow Room",
      reason: "VPD monitoring or light sensors detected - indicates grow environment",
      confidence: "high",
    };
  }

  // Medium confidence: Climate zone (temp + humidity, no VPD)
  if (hasTemp && hasHumidity) {
    return {
      name: "Climate Zone",
      reason: "Temperature and humidity monitoring - general climate control",
      confidence: "medium",
    };
  }

  // Low confidence: Environment (temperature only or other sensors)
  if (hasTemp) {
    return {
      name: "Environment",
      reason: "Temperature monitoring - basic environmental control",
      confidence: "low",
    };
  }

  // Check for device types if no sensors
  const hasGrowDevices = devices.some((d) =>
    ["light", "fan", "humidifier", "dehumidifier"].includes(d)
  );

  if (hasGrowDevices) {
    return {
      name: "Grow Room",
      reason: "Grow-related devices detected (lights, fans, humidity control)",
      confidence: "medium",
    };
  }

  // Default fallback
  return {
    name: "Environment",
    reason: "No specific sensors detected - generic environment",
    confidence: "low",
  };
}

/**
 * Generates a default controller name based on brand and model.
 *
 * Examples:
 * - AC Infinity + Controller 69 → "AC Infinity Controller 69"
 * - Inkbird + ITC-308 → "Inkbird ITC-308"
 * - CSV Upload → "CSV Data Source"
 * - No model → "AC Infinity Controller"
 *
 * @param brandName - Human-readable brand name (e.g., "AC Infinity")
 * @param model - Device model (optional, e.g., "Controller 69")
 * @returns Default controller name
 */
export function generateDefaultControllerName(
  brandName: string,
  model?: string | null
): string {
  if (!model || model.trim() === "") {
    return `${brandName} Controller`;
  }

  // If model already contains the brand name, don't duplicate
  const modelLower = model.toLowerCase();
  const brandLower = brandName.toLowerCase();

  if (modelLower.includes(brandLower)) {
    return model;
  }

  return `${brandName} ${model}`;
}
