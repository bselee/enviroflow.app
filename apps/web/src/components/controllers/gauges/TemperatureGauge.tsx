'use client';

import React, { useState } from 'react';
import { CircularGauge, CircularGaugeProps } from './CircularGauge';
import { cn } from '@/lib/utils';

/**
 * Temperature unit type
 */
export type TemperatureUnit = 'F' | 'C';

/**
 * TemperatureGauge component props
 */
export interface TemperatureGaugeProps {
  /** Temperature value in Fahrenheit */
  value: number;
  /** Temperature unit to display */
  unit?: TemperatureUnit;
  /** Allow user to toggle between F/C */
  allowUnitToggle?: boolean;
  /** Size variant */
  size?: CircularGaugeProps['size'];
  /** Enable smooth value transitions */
  animated?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Optional label override */
  label?: string;
}

/**
 * Convert Fahrenheit to Celsius
 */
function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * (5 / 9);
}

/**
 * Convert Celsius to Fahrenheit
 */
function celsiusToFahrenheit(celsius: number): number {
  return celsius * (9 / 5) + 32;
}

/**
 * Get temperature color based on value (Fahrenheit)
 * Cold: < 60°F (blue)
 * Ideal: 65-85°F (green)
 * Warm: 85-95°F (yellow)
 * Hot: > 95°F (red)
 */
function getTemperatureColor(tempF: number): string {
  if (tempF < 60) {
    // Cold - blue gradient
    const intensity = Math.max(0, Math.min(1, (60 - tempF) / 28)); // 32-60°F range
    const r = Math.round(59 + (96 - 59) * (1 - intensity));
    const g = Math.round(130 + (165 - 130) * (1 - intensity));
    const b = Math.round(246 + (10 - 246) * (1 - intensity));
    return `rgb(${r}, ${g}, ${b})`;
  } else if (tempF < 65) {
    // Cool to ideal - blue to green
    const t = (tempF - 60) / 5;
    const r = Math.round(96 + (34 - 96) * t);
    const g = Math.round(165 + (197 - 165) * t);
    const b = Math.round(10 + (94 - 10) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (tempF < 85) {
    // Ideal - green
    return 'rgb(34, 197, 94)'; // green-500
  } else if (tempF < 95) {
    // Warm - yellow
    const t = (tempF - 85) / 10;
    const r = Math.round(34 + (234 - 34) * t);
    const g = Math.round(197 + (179 - 197) * t);
    const b = Math.round(94 + (8 - 94) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Hot - red
    const t = Math.min(1, (tempF - 95) / 25); // 95-120°F range
    const r = Math.round(234 + (239 - 234) * t);
    const g = Math.round(179 + (68 - 179) * t);
    const b = Math.round(8 + (68 - 8) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * TemperatureGauge - Pre-configured circular gauge for temperature readings
 *
 * Features:
 * - Optimized for temperature display (32°F - 120°F / 0°C - 49°C)
 * - Color gradient: blue (cold) → green (ideal) → yellow (warm) → red (hot)
 * - Optional unit toggle between °F and °C
 * - Ideal range indicator (65-85°F / 18-29°C)
 */
export function TemperatureGauge({
  value,
  unit = 'F',
  allowUnitToggle = false,
  size = 'md',
  animated = true,
  className,
  label = 'Temperature',
}: TemperatureGaugeProps) {
  const [displayUnit, setDisplayUnit] = useState<TemperatureUnit>(unit);

  // Convert value if needed
  const displayValue =
    displayUnit === 'C' ? fahrenheitToCelsius(value) : value;

  // Set range based on unit
  const min = displayUnit === 'C' ? 0 : 32;
  const max = displayUnit === 'C' ? 49 : 120;

  // Handle unit toggle
  const handleToggleUnit = () => {
    if (allowUnitToggle) {
      setDisplayUnit((prev) => (prev === 'F' ? 'C' : 'F'));
    }
  };

  return (
    <div className={cn('relative', className)}>
      <CircularGauge
        value={displayValue}
        min={min}
        max={max}
        unit={`°${displayUnit}`}
        label={label}
        size={size}
        precision={1}
        animated={animated}
        getColor={(val) =>
          getTemperatureColor(
            displayUnit === 'C' ? celsiusToFahrenheit(val) : val
          )
        }
      />

      {/* Ideal range indicator */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap">
        Ideal: {displayUnit === 'C' ? '18-29°C' : '65-85°F'}
      </div>

      {/* Unit toggle button */}
      {allowUnitToggle && (
        <button
          onClick={handleToggleUnit}
          className="absolute top-0 right-0 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent"
          aria-label={`Switch to ${displayUnit === 'F' ? 'Celsius' : 'Fahrenheit'}`}
        >
          °{displayUnit === 'F' ? 'C' : 'F'}
        </button>
      )}
    </div>
  );
}
