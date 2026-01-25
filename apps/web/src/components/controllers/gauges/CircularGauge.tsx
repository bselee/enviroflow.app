'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * CircularGauge component props
 */
export interface CircularGaugeProps {
  /** Current value to display */
  value: number;
  /** Minimum value of the gauge range */
  min: number;
  /** Maximum value of the gauge range */
  max: number;
  /** Unit label (e.g., "°F", "%", "kPa") */
  unit: string;
  /** Label to display below the gauge */
  label: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Threshold configuration for color changes */
  thresholds?: {
    /** Value at which gauge turns yellow */
    warning: number;
    /** Value at which gauge turns red */
    danger: number;
  };
  /** Number of decimal places to display */
  precision?: number;
  /** Enable smooth value transitions */
  animated?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Custom color function */
  getColor?: (value: number, min: number, max: number) => string;
}

/**
 * Sizes configuration for different gauge variants
 */
const SIZES = {
  sm: {
    width: 120,
    height: 120,
    strokeWidth: 8,
    fontSize: 'text-xl',
    labelSize: 'text-xs',
    unitSize: 'text-xs',
  },
  md: {
    width: 160,
    height: 160,
    strokeWidth: 10,
    fontSize: 'text-3xl',
    labelSize: 'text-sm',
    unitSize: 'text-sm',
  },
  lg: {
    width: 200,
    height: 200,
    strokeWidth: 12,
    fontSize: 'text-4xl',
    labelSize: 'text-base',
    unitSize: 'text-base',
  },
};

/**
 * Default color calculation based on thresholds
 */
function defaultGetColor(
  value: number,
  min: number,
  max: number,
  thresholds?: CircularGaugeProps['thresholds']
): string {
  if (!thresholds) {
    // Default: green → yellow → red gradient
    const percent = ((value - min) / (max - min)) * 100;
    if (percent < 33) return 'rgb(34, 197, 94)'; // green-500
    if (percent < 66) return 'rgb(234, 179, 8)'; // yellow-500
    return 'rgb(239, 68, 68)'; // red-500
  }

  if (value >= thresholds.danger) return 'rgb(239, 68, 68)'; // red-500
  if (value >= thresholds.warning) return 'rgb(234, 179, 8)'; // yellow-500
  return 'rgb(34, 197, 94)'; // green-500
}

/**
 * CircularGauge - Beautiful circular gauge component for displaying sensor readings
 *
 * Features:
 * - SVG-based arc rendering with gradient effects
 * - Smooth animated transitions
 * - Configurable size variants
 * - Color-coded value ranges
 * - Accessible with ARIA attributes
 * - Dark mode support
 */
export function CircularGauge({
  value,
  min,
  max,
  unit,
  label,
  size = 'md',
  thresholds,
  precision = 1,
  animated = true,
  className,
  getColor,
}: CircularGaugeProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const sizeConfig = SIZES[size];

  // Animate value changes
  useEffect(() => {
    if (!animated) {
      setDisplayValue(value);
      return;
    }

    const duration = 500; // ms
    const steps = 30;
    const stepDuration = duration / steps;
    const stepValue = (value - displayValue) / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(interval);
      } else {
        setDisplayValue((prev) => prev + stepValue);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value, animated]);

  // Calculate arc properties
  const { percentage, arcPath, color } = useMemo(() => {
    // Clamp value between min and max
    const clampedValue = Math.max(min, Math.min(max, displayValue));
    const percentage = ((clampedValue - min) / (max - min)) * 100;

    // Arc properties
    const centerX = sizeConfig.width / 2;
    const centerY = sizeConfig.height / 2;
    const radius = (sizeConfig.width - sizeConfig.strokeWidth) / 2 - 4;
    const startAngle = -135; // Start at bottom-left
    const endAngle = 135; // End at bottom-right
    const totalAngle = endAngle - startAngle;
    const currentAngle = startAngle + (percentage / 100) * totalAngle;

    // Convert angles to radians
    const startRad = (startAngle * Math.PI) / 180;
    const currentRad = (currentAngle * Math.PI) / 180;

    // Calculate arc path
    const startX = centerX + radius * Math.cos(startRad);
    const startY = centerY + radius * Math.sin(startRad);
    const endX = centerX + radius * Math.cos(currentRad);
    const endY = centerY + radius * Math.sin(currentRad);

    const largeArcFlag = currentAngle - startAngle > 180 ? 1 : 0;

    const arcPath = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;

    // Determine color
    const colorFunc = getColor || defaultGetColor;
    const color = colorFunc(clampedValue, min, max, thresholds);

    return { percentage, arcPath, color };
  }, [displayValue, min, max, sizeConfig, thresholds, getColor]);

  return (
    <div
      className={cn('flex flex-col items-center gap-2', className)}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={`${label}: ${value.toFixed(precision)} ${unit}`}
    >
      {/* SVG Gauge */}
      <div className="relative">
        <svg
          width={sizeConfig.width}
          height={sizeConfig.height}
          className="transform rotate-0"
        >
          {/* Background arc */}
          <path
            d={`M ${sizeConfig.width / 2 - ((sizeConfig.width - sizeConfig.strokeWidth) / 2 - 4) * Math.cos((-135 * Math.PI) / 180)} ${sizeConfig.height / 2 - ((sizeConfig.width - sizeConfig.strokeWidth) / 2 - 4) * Math.sin((-135 * Math.PI) / 180)} A ${(sizeConfig.width - sizeConfig.strokeWidth) / 2 - 4} ${(sizeConfig.width - sizeConfig.strokeWidth) / 2 - 4} 0 1 1 ${sizeConfig.width / 2 - ((sizeConfig.width - sizeConfig.strokeWidth) / 2 - 4) * Math.cos((135 * Math.PI) / 180)} ${sizeConfig.height / 2 - ((sizeConfig.width - sizeConfig.strokeWidth) / 2 - 4) * Math.sin((135 * Math.PI) / 180)}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={sizeConfig.strokeWidth}
            strokeLinecap="round"
            className="text-gray-200 dark:text-gray-700 opacity-30"
          />

          {/* Value arc with gradient */}
          <defs>
            <filter id={`glow-${label.replace(/\s+/g, '-')}`}>
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient
              id={`gradient-${label.replace(/\s+/g, '-')}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>

          <path
            d={arcPath}
            fill="none"
            stroke={`url(#gradient-${label.replace(/\s+/g, '-')})`}
            strokeWidth={sizeConfig.strokeWidth}
            strokeLinecap="round"
            filter={`url(#glow-${label.replace(/\s+/g, '-')})`}
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Center value display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={cn('font-bold tabular-nums', sizeConfig.fontSize)}>
            {displayValue.toFixed(precision)}
          </div>
          <div className={cn('text-muted-foreground', sizeConfig.unitSize)}>
            {unit}
          </div>
        </div>
      </div>

      {/* Label */}
      <div className={cn('text-muted-foreground font-medium text-center', sizeConfig.labelSize)}>
        {label}
      </div>
    </div>
  );
}
