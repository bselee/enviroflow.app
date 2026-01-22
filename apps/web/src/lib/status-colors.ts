/**
 * Status Color System
 *
 * Provides dynamic color calculation based on sensor values and user-defined optimal ranges.
 * Uses HSL color space for smooth gradient interpolation between status levels.
 *
 * Status Levels:
 * - OPTIMAL (green): Value is within the user's defined optimal range
 * - WARNING (amber): Value is approaching the alert threshold
 * - ALERT (red): Value has exceeded acceptable tolerance
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Status levels for environmental readings.
 */
export type StatusLevel = "optimal" | "warning" | "alert";

/**
 * Options for calculating status color from a sensor value.
 */
export interface StatusColorOptions {
  /** Current sensor value */
  value: number;
  /** Minimum value of the optimal range */
  optimalMin: number;
  /** Maximum value of the optimal range */
  optimalMax: number;
  /**
   * Tolerance as a percentage (0-1) of the optimal range before entering warning.
   * For example, 0.15 means 15% tolerance.
   * Default: 0.15 (15%)
   */
  warningTolerance?: number;
  /**
   * Threshold as a percentage (0-1) of the optimal range before entering alert.
   * This is the distance from optimal at which the value becomes an alert.
   * Default: 0.30 (30%)
   */
  alertThreshold?: number;
}

/**
 * Result of status color calculation.
 */
export interface StatusColorResult {
  /** The status level (optimal, warning, or alert) */
  status: StatusLevel;
  /** HSL color string for the current status */
  color: string;
  /** Hex color string for the current status */
  hexColor: string;
  /** RGB color string for the current status */
  rgbColor: string;
  /** Absolute deviation from the optimal range center */
  deviation: number;
  /** Deviation as a percentage of the optimal range (0 = center, 1 = edge of optimal) */
  deviationPercent: number;
  /** Glow color with transparency for effects */
  glowColor: string;
  /** Tailwind CSS class for text color */
  textClass: string;
  /** Tailwind CSS class for background color */
  bgClass: string;
  /** Direction of deviation: 'low', 'high', or 'none' (within optimal) */
  deviationDirection: "low" | "high" | "none";
}

/**
 * HSL color representation for interpolation.
 */
interface HSLColor {
  h: number; // Hue: 0-360
  s: number; // Saturation: 0-100
  l: number; // Lightness: 0-100
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Predefined status colors in HSL format.
 * These match the EnviroFlow design system.
 */
export const STATUS_COLORS = {
  optimal: {
    hsl: { h: 142, s: 71, l: 45 }, // #10b981 - Emerald
    hex: "#10b981",
    rgb: "rgb(16, 185, 129)",
    textClass: "text-emerald-500",
    bgClass: "bg-emerald-500",
    glowRgba: "rgba(16, 185, 129, 0.4)",
  },
  warning: {
    hsl: { h: 38, s: 92, l: 50 }, // #f59e0b - Amber
    hex: "#f59e0b",
    rgb: "rgb(245, 158, 11)",
    textClass: "text-amber-500",
    bgClass: "bg-amber-500",
    glowRgba: "rgba(245, 158, 11, 0.4)",
  },
  alert: {
    hsl: { h: 0, s: 72, l: 51 }, // #ef4444 - Red
    hex: "#ef4444",
    rgb: "rgb(239, 68, 68)",
    textClass: "text-red-500",
    bgClass: "bg-red-500",
    glowRgba: "rgba(239, 68, 68, 0.4)",
  },
} as const;

/** Default warning tolerance (15% of optimal range) */
const DEFAULT_WARNING_TOLERANCE = 0.15;

/** Default alert threshold (30% of optimal range) */
const DEFAULT_ALERT_THRESHOLD = 0.30;

// =============================================================================
// HSL Conversion Utilities
// =============================================================================

/**
 * Converts HSL color to CSS hsl() string.
 *
 * @param hsl - HSL color object
 * @returns CSS hsl() string
 */
function hslToString(hsl: HSLColor): string {
  return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
}

/**
 * Converts HSL color to hex string.
 *
 * @param hsl - HSL color object
 * @returns Hex color string (e.g., "#10b981")
 */
function hslToHex(hsl: HSLColor): string {
  const { h, s, l } = hsl;
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number): string => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts HSL color to RGB string.
 *
 * @param hsl - HSL color object
 * @returns CSS rgb() string
 */
function hslToRgb(hsl: HSLColor): string {
  const { h, s, l } = hsl;
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const rVal = Math.round((r + m) * 255);
  const gVal = Math.round((g + m) * 255);
  const bVal = Math.round((b + m) * 255);

  return `rgb(${rVal}, ${gVal}, ${bVal})`;
}

/**
 * Converts HSL color to RGBA string with specified alpha.
 *
 * @param hsl - HSL color object
 * @param alpha - Alpha value (0-1)
 * @returns CSS rgba() string
 */
function hslToRgba(hsl: HSLColor, alpha: number): string {
  const rgb = hslToRgb(hsl);
  return rgb.replace("rgb", "rgba").replace(")", `, ${alpha})`);
}

// =============================================================================
// Interpolation Functions
// =============================================================================

/**
 * Linearly interpolates between two numbers.
 *
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0 = a, 1 = b)
 * @returns Interpolated value
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Parses an HSL string into an HSLColor object.
 *
 * @param hslString - CSS hsl() string (e.g., "hsl(142, 71%, 45%)")
 * @returns Parsed HSLColor object or null if parsing fails
 */
function parseHSL(hslString: string): HSLColor | null {
  // Match hsl(h, s%, l%) or hsl(h s% l%) formats
  const match = hslString.match(
    /hsl\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)%?\s*[,\s]\s*(\d+(?:\.\d+)?)%?\s*\)/i
  );

  if (!match) {
    return null;
  }

  return {
    h: parseFloat(match[1]),
    s: parseFloat(match[2]),
    l: parseFloat(match[3]),
  };
}

/**
 * Parses a hex color string into an HSLColor object.
 *
 * @param hex - Hex color string (e.g., "#10b981" or "10b981")
 * @returns Parsed HSLColor object or null if parsing fails
 */
function parseHex(hex: string): HSLColor | null {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, "");

  if (!/^[0-9a-f]{6}$/i.test(cleanHex)) {
    return null;
  }

  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    // Achromatic
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

/**
 * Parses a color string (hex or HSL) into an HSLColor object.
 *
 * @param color - Color string in hex (#10b981) or hsl (hsl(142, 71%, 45%)) format
 * @returns Parsed HSLColor object
 * @throws Error if the color format is not recognized
 */
function parseColor(color: string): HSLColor {
  const trimmed = color.trim();

  // Try HSL format first
  if (trimmed.toLowerCase().startsWith("hsl")) {
    const parsed = parseHSL(trimmed);
    if (parsed) {
      return parsed;
    }
  }

  // Try hex format
  const parsed = parseHex(trimmed);
  if (parsed) {
    return parsed;
  }

  throw new Error(`Unable to parse color: ${color}. Expected hex (#10b981) or hsl (hsl(142, 71%, 45%)) format.`);
}

/**
 * Interpolates between two HSL colors.
 * Uses shortest path for hue interpolation (handles wrap-around at 360).
 *
 * @param from - Starting HSL color
 * @param to - Ending HSL color
 * @param t - Interpolation factor (0 = from, 1 = to)
 * @returns Interpolated HSL color
 */
function interpolateHSL(from: HSLColor, to: HSLColor, t: number): HSLColor {
  // Clamp t to [0, 1]
  const tClamped = Math.max(0, Math.min(1, t));

  // Interpolate hue using shortest path around the color wheel
  let hDiff = to.h - from.h;
  if (hDiff > 180) {
    hDiff -= 360;
  } else if (hDiff < -180) {
    hDiff += 360;
  }
  let h = from.h + hDiff * tClamped;
  if (h < 0) {
    h += 360;
  } else if (h >= 360) {
    h -= 360;
  }

  return {
    h,
    s: lerp(from.s, to.s, tClamped),
    l: lerp(from.l, to.l, tClamped),
  };
}

/**
 * Interpolates between two status colors.
 *
 * @param fromStatus - Starting status level
 * @param toStatus - Ending status level
 * @param percent - Interpolation percentage (0-1)
 * @returns Interpolated HSL color string
 *
 * @example
 * ```ts
 * // Get color halfway between optimal and warning
 * const color = interpolateStatusColor('optimal', 'warning', 0.5);
 * // Returns: "hsl(90, 81%, 48%)" (yellowish-green)
 * ```
 */
export function interpolateStatusColor(
  fromStatus: StatusLevel,
  toStatus: StatusLevel,
  percent: number
): string {
  const fromColor = STATUS_COLORS[fromStatus].hsl;
  const toColor = STATUS_COLORS[toStatus].hsl;
  const interpolated = interpolateHSL(fromColor, toColor, percent);
  return hslToString(interpolated);
}

/**
 * Interpolates between two status colors and returns all color formats.
 *
 * @param fromStatus - Starting status level
 * @param toStatus - Ending status level
 * @param percent - Interpolation percentage (0-1)
 * @returns Object with all color format strings
 */
export function interpolateStatusColorFull(
  fromStatus: StatusLevel,
  toStatus: StatusLevel,
  percent: number
): { hsl: string; hex: string; rgb: string; rgba: string } {
  const fromColor = STATUS_COLORS[fromStatus].hsl;
  const toColor = STATUS_COLORS[toStatus].hsl;
  const interpolated = interpolateHSL(fromColor, toColor, percent);

  return {
    hsl: hslToString(interpolated),
    hex: hslToHex(interpolated),
    rgb: hslToRgb(interpolated),
    rgba: hslToRgba(interpolated, 0.4),
  };
}

// =============================================================================
// Main Status Color Function
// =============================================================================

/**
 * Calculates the status color for a sensor value based on user-defined optimal range.
 *
 * The color smoothly transitions between status levels:
 * - Within optimal range: Full green, intensity based on how centered the value is
 * - Between optimal and warning: Gradient from green to amber
 * - Between warning and alert: Gradient from amber to red
 * - Beyond alert: Full red
 *
 * @param options - Configuration options including value and ranges
 * @returns Comprehensive status color result with all formats and metadata
 *
 * @example
 * ```ts
 * // Temperature sensor with optimal range of 70-78F
 * const result = getStatusColor({
 *   value: 82,
 *   optimalMin: 70,
 *   optimalMax: 78,
 *   warningTolerance: 0.15,
 *   alertThreshold: 0.30,
 * });
 *
 * console.log(result.status); // 'warning' or 'alert' depending on thresholds
 * console.log(result.color);  // HSL color string
 * console.log(result.deviationPercent); // How far from optimal
 * ```
 */
export function getStatusColor(options: StatusColorOptions): StatusColorResult {
  const {
    value,
    optimalMin,
    optimalMax,
    warningTolerance = DEFAULT_WARNING_TOLERANCE,
    alertThreshold = DEFAULT_ALERT_THRESHOLD,
  } = options;

  // Validate inputs
  if (optimalMax < optimalMin) {
    throw new Error("optimalMax must be greater than or equal to optimalMin");
  }

  // Calculate optimal range characteristics
  const optimalCenter = (optimalMin + optimalMax) / 2;
  const optimalRange = optimalMax - optimalMin;
  const halfRange = optimalRange / 2;

  // Calculate deviation from optimal range
  let deviation: number;
  let deviationDirection: "low" | "high" | "none";

  if (value >= optimalMin && value <= optimalMax) {
    // Within optimal range - calculate distance from center
    deviation = Math.abs(value - optimalCenter);
    deviationDirection = "none";
  } else if (value < optimalMin) {
    // Below optimal range
    deviation = optimalMin - value;
    deviationDirection = "low";
  } else {
    // Above optimal range
    deviation = value - optimalMax;
    deviationDirection = "high";
  }

  // Calculate deviation as percentage (0 = center of optimal, 1 = edge of optimal range)
  // Beyond optimal range, this exceeds 1
  const deviationPercent = halfRange > 0 ? deviation / halfRange : 0;

  // Calculate thresholds in absolute terms
  const warningThresholdAbs = halfRange * warningTolerance;
  const alertThresholdAbs = halfRange * alertThreshold;

  // Determine status and calculate interpolated color
  let status: StatusLevel;
  let interpolatedHSL: HSLColor;
  let textClass: string;
  let bgClass: string;

  if (value >= optimalMin && value <= optimalMax) {
    // Within optimal range
    status = "optimal";
    interpolatedHSL = STATUS_COLORS.optimal.hsl;
    textClass = STATUS_COLORS.optimal.textClass;
    bgClass = STATUS_COLORS.optimal.bgClass;
  } else if (deviation <= warningThresholdAbs) {
    // In warning zone (between optimal and warning threshold)
    status = "warning";
    // Interpolate from optimal to warning based on position in warning zone
    const warningProgress = deviation / warningThresholdAbs;
    interpolatedHSL = interpolateHSL(
      STATUS_COLORS.optimal.hsl,
      STATUS_COLORS.warning.hsl,
      warningProgress
    );
    textClass = warningProgress > 0.5 ? STATUS_COLORS.warning.textClass : STATUS_COLORS.optimal.textClass;
    bgClass = warningProgress > 0.5 ? STATUS_COLORS.warning.bgClass : STATUS_COLORS.optimal.bgClass;
  } else if (deviation <= alertThresholdAbs) {
    // Between warning and alert
    status = "warning";
    // Interpolate from warning to alert
    const alertProgress = (deviation - warningThresholdAbs) / (alertThresholdAbs - warningThresholdAbs);
    interpolatedHSL = interpolateHSL(
      STATUS_COLORS.warning.hsl,
      STATUS_COLORS.alert.hsl,
      alertProgress
    );
    textClass = alertProgress > 0.5 ? STATUS_COLORS.alert.textClass : STATUS_COLORS.warning.textClass;
    bgClass = alertProgress > 0.5 ? STATUS_COLORS.alert.bgClass : STATUS_COLORS.warning.bgClass;
  } else {
    // Beyond alert threshold
    status = "alert";
    interpolatedHSL = STATUS_COLORS.alert.hsl;
    textClass = STATUS_COLORS.alert.textClass;
    bgClass = STATUS_COLORS.alert.bgClass;
  }

  return {
    status,
    color: hslToString(interpolatedHSL),
    hexColor: hslToHex(interpolatedHSL),
    rgbColor: hslToRgb(interpolatedHSL),
    deviation,
    deviationPercent,
    glowColor: hslToRgba(interpolatedHSL, 0.4),
    textClass,
    bgClass,
    deviationDirection,
  };
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Gets the static status color for a given status level.
 * Use this when you already know the status and don't need interpolation.
 *
 * @param status - The status level
 * @returns Status color object with all formats
 */
export function getStaticStatusColor(status: StatusLevel): {
  hsl: string;
  hex: string;
  rgb: string;
  glow: string;
  textClass: string;
  bgClass: string;
} {
  const config = STATUS_COLORS[status];
  return {
    hsl: hslToString(config.hsl),
    hex: config.hex,
    rgb: config.rgb,
    glow: config.glowRgba,
    textClass: config.textClass,
    bgClass: config.bgClass,
  };
}

/**
 * Determines status level based on value and optimal range.
 * Simpler version that doesn't calculate colors, just the status.
 *
 * @param value - Current value
 * @param optimalMin - Minimum optimal value
 * @param optimalMax - Maximum optimal value
 * @param tolerance - Warning tolerance as percentage (default 0.15)
 * @returns Status level
 */
export function getStatusLevel(
  value: number,
  optimalMin: number,
  optimalMax: number,
  tolerance: number = DEFAULT_WARNING_TOLERANCE
): StatusLevel {
  if (value >= optimalMin && value <= optimalMax) {
    return "optimal";
  }

  const rangeSize = optimalMax - optimalMin;
  const warningBuffer = rangeSize * tolerance;

  if (value >= optimalMin - warningBuffer && value <= optimalMax + warningBuffer) {
    return "warning";
  }

  return "alert";
}

/**
 * Calculates VPD-specific status with predefined ranges.
 * VPD has specific optimal ranges for different growth stages.
 *
 * @param vpd - VPD value in kPa
 * @param optimalRange - Optional custom optimal range [min, max]
 * @returns Status color result
 */
export function getVPDStatusColor(
  vpd: number,
  optimalRange: [number, number] = [0.8, 1.2]
): StatusColorResult {
  return getStatusColor({
    value: vpd,
    optimalMin: optimalRange[0],
    optimalMax: optimalRange[1],
    warningTolerance: 0.15,
    alertThreshold: 0.30,
  });
}

/**
 * Calculates temperature-specific status.
 *
 * @param temp - Temperature value
 * @param unit - Temperature unit (default: 'F')
 * @param optimalRange - Optional custom optimal range [min, max]
 * @returns Status color result
 */
export function getTemperatureStatusColor(
  temp: number,
  unit: "F" | "C" = "F",
  optimalRange?: [number, number]
): StatusColorResult {
  // Default optimal ranges based on unit
  const defaultRange: [number, number] = unit === "F" ? [70, 82] : [21, 28];
  const [min, max] = optimalRange ?? defaultRange;

  return getStatusColor({
    value: temp,
    optimalMin: min,
    optimalMax: max,
    warningTolerance: 0.10,
    alertThreshold: 0.25,
  });
}

/**
 * Calculates humidity-specific status.
 *
 * @param humidity - Relative humidity percentage (0-100)
 * @param optimalRange - Optional custom optimal range [min, max]
 * @returns Status color result
 */
export function getHumidityStatusColor(
  humidity: number,
  optimalRange: [number, number] = [50, 70]
): StatusColorResult {
  return getStatusColor({
    value: humidity,
    optimalMin: optimalRange[0],
    optimalMax: optimalRange[1],
    warningTolerance: 0.15,
    alertThreshold: 0.30,
  });
}

/**
 * Calculates CO2-specific status.
 *
 * @param co2 - CO2 level in PPM
 * @param optimalRange - Optional custom optimal range [min, max]
 * @returns Status color result
 */
export function getCO2StatusColor(
  co2: number,
  optimalRange: [number, number] = [800, 1200]
): StatusColorResult {
  return getStatusColor({
    value: co2,
    optimalMin: optimalRange[0],
    optimalMax: optimalRange[1],
    warningTolerance: 0.20,
    alertThreshold: 0.40,
  });
}

// =============================================================================
// Generic Color Interpolation
// =============================================================================

/**
 * Interpolates between two colors in HSL space for smooth gradients.
 *
 * Accepts colors in hex (#10b981) or HSL (hsl(142, 71%, 45%)) format.
 * Returns an HSL string suitable for CSS.
 *
 * @param from - Starting color (hex or HSL string)
 * @param to - Ending color (hex or HSL string)
 * @param percent - Interpolation percentage (0 = from, 1 = to)
 * @returns Interpolated color as HSL string
 *
 * @example
 * ```ts
 * // Interpolate halfway between green and amber
 * const midColor = interpolateColor('#10b981', '#f59e0b', 0.5);
 * // Returns: "hsl(90, 82%, 47%)" (yellowish-green)
 *
 * // Using HSL format
 * const color = interpolateColor('hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 0.3);
 * ```
 */
export function interpolateColor(from: string, to: string, percent: number): string {
  const fromHSL = parseColor(from);
  const toHSL = parseColor(to);
  const interpolated = interpolateHSL(fromHSL, toHSL, percent);
  return hslToString(interpolated);
}

/**
 * Interpolates between two colors and returns multiple format options.
 *
 * @param from - Starting color (hex or HSL string)
 * @param to - Ending color (hex or HSL string)
 * @param percent - Interpolation percentage (0 = from, 1 = to)
 * @returns Object with hsl, hex, rgb, and rgba color strings
 *
 * @example
 * ```ts
 * const result = interpolateColorFull('#10b981', '#f59e0b', 0.5);
 * console.log(result.hsl);  // "hsl(90, 82%, 47%)"
 * console.log(result.hex);  // "#7bc836"
 * console.log(result.rgba); // "rgba(123, 200, 54, 0.4)"
 * ```
 */
export function interpolateColorFull(
  from: string,
  to: string,
  percent: number
): { hsl: string; hex: string; rgb: string; rgba: string } {
  const fromHSL = parseColor(from);
  const toHSL = parseColor(to);
  const interpolated = interpolateHSL(fromHSL, toHSL, percent);

  return {
    hsl: hslToString(interpolated),
    hex: hslToHex(interpolated),
    rgb: hslToRgb(interpolated),
    rgba: hslToRgba(interpolated, 0.4),
  };
}
