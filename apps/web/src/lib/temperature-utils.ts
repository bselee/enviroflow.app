/**
 * Temperature conversion and formatting utilities.
 * 
 * All sensor data is stored in Fahrenheit. These utilities convert
 * to Celsius when the user preference requires it.
 */

import type { TemperatureUnit } from "@/hooks/use-user-preferences";

/**
 * Convert Fahrenheit to Celsius.
 */
export function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * (5 / 9);
}

/**
 * Convert Celsius to Fahrenheit.
 */
export function celsiusToFahrenheit(celsius: number): number {
  return celsius * (9 / 5) + 32;
}

/**
 * Convert a temperature value based on the target unit.
 * Assumes input is always in Fahrenheit (our storage format).
 * 
 * @param value - Temperature value in Fahrenheit
 * @param unit - Target unit to convert to
 * @returns Converted temperature value
 */
export function convertTemperature(value: number, unit: TemperatureUnit): number {
  if (unit === "C") {
    return fahrenheitToCelsius(value);
  }
  return value;
}

/**
 * Format a temperature value for display with unit symbol.
 * 
 * @param value - Temperature value in Fahrenheit (null-safe)
 * @param unit - Target unit for display
 * @param precision - Decimal places (default: 1)
 * @returns Formatted string like "72.5°F" or "22.5°C", or "--" if null
 */
export function formatTemperature(
  value: number | null | undefined,
  unit: TemperatureUnit,
  precision: number = 1
): string {
  if (value == null) {
    return "--";
  }
  
  const converted = convertTemperature(value, unit);
  return `${converted.toFixed(precision)}°${unit}`;
}

/**
 * Format a temperature value without the unit symbol.
 * Useful when the unit is displayed separately.
 * 
 * @param value - Temperature value in Fahrenheit (null-safe)
 * @param unit - Target unit for display
 * @param precision - Decimal places (default: 1)
 * @returns Formatted number string or "--" if null
 */
export function formatTemperatureValue(
  value: number | null | undefined,
  unit: TemperatureUnit,
  precision: number = 1
): string {
  if (value == null) {
    return "--";
  }
  
  const converted = convertTemperature(value, unit);
  return converted.toFixed(precision);
}

/**
 * Get the temperature unit symbol.
 * 
 * @param unit - Temperature unit
 * @returns Unit symbol like "°F" or "°C"
 */
export function getTemperatureUnitSymbol(unit: TemperatureUnit): string {
  return `°${unit}`;
}

/**
 * Convert a temperature range [min, max] to the target unit.
 * Useful for converting optimal ranges stored in Fahrenheit.
 * 
 * @param range - Temperature range [min, max] in Fahrenheit
 * @param unit - Target unit
 * @returns Converted range
 */
export function convertTemperatureRange(
  range: [number, number],
  unit: TemperatureUnit
): [number, number] {
  if (unit === "C") {
    return [fahrenheitToCelsius(range[0]), fahrenheitToCelsius(range[1])];
  }
  return range;
}
