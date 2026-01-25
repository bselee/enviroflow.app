'use client';

import React from 'react';
import { CircularGauge, CircularGaugeProps } from './CircularGauge';
import { cn } from '@/lib/utils';

/**
 * HumidityGauge component props
 */
export interface HumidityGaugeProps {
  /** Humidity value (0-100%) */
  value: number;
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
 * Get humidity color based on value
 * Dry: < 40% (yellow/orange)
 * Ideal: 40-60% (green)
 * Humid: > 60% (blue)
 */
function getHumidityColor(humidity: number): string {
  if (humidity < 30) {
    // Very dry - orange to yellow
    const t = humidity / 30;
    const r = Math.round(249 + (234 - 249) * t);
    const g = Math.round(115 + (179 - 115) * t);
    const b = Math.round(22 + (8 - 22) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (humidity < 40) {
    // Dry - yellow to green
    const t = (humidity - 30) / 10;
    const r = Math.round(234 + (34 - 234) * t);
    const g = Math.round(179 + (197 - 179) * t);
    const b = Math.round(8 + (94 - 8) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (humidity < 60) {
    // Ideal - green
    return 'rgb(34, 197, 94)'; // green-500
  } else if (humidity < 70) {
    // Humid - green to cyan
    const t = (humidity - 60) / 10;
    const r = Math.round(34 + (6 - 34) * t);
    const g = Math.round(197 + (182 - 197) * t);
    const b = Math.round(94 + (212 - 94) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (humidity < 80) {
    // Very humid - cyan to blue
    const t = (humidity - 70) / 10;
    const r = Math.round(6 + (59 - 6) * t);
    const g = Math.round(182 + (130 - 182) * t);
    const b = Math.round(212 + (246 - 212) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Extreme humidity - blue
    const t = Math.min(1, (humidity - 80) / 20);
    const r = Math.round(59 - 20 * t);
    const g = Math.round(130 - 20 * t);
    const b = Math.round(246 - 40 * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * HumidityGauge - Pre-configured circular gauge for humidity readings
 *
 * Features:
 * - Optimized for humidity display (0-100%)
 * - Color gradient: yellow (dry) → green (ideal) → blue (humid)
 * - Ideal range indicator (40-60%)
 * - Visual feedback for extreme conditions
 */
export function HumidityGauge({
  value,
  size = 'md',
  animated = true,
  className,
  label = 'Humidity',
}: HumidityGaugeProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('relative', className)}>
      <CircularGauge
        value={clampedValue}
        min={0}
        max={100}
        unit="%"
        label={label}
        size={size}
        precision={0}
        animated={animated}
        getColor={(val) => getHumidityColor(val)}
      />

      {/* Ideal range indicator */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap">
        Ideal: 40-60%
      </div>

      {/* Warning indicators for extreme values */}
      {clampedValue < 30 && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs text-orange-500 dark:text-orange-400 whitespace-nowrap font-medium">
          ⚠️ Very Dry
        </div>
      )}
      {clampedValue > 70 && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs text-blue-500 dark:text-blue-400 whitespace-nowrap font-medium">
          ⚠️ Very Humid
        </div>
      )}
    </div>
  );
}
