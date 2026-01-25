'use client';

import React, { useState } from 'react';
import { CircularGauge, CircularGaugeProps } from './CircularGauge';
import { cn } from '@/lib/utils';

/**
 * Plant growth stage type
 */
export type GrowthStage = 'seedling' | 'vegetative' | 'flowering' | 'late_flowering';

/**
 * VPD ideal ranges by growth stage
 */
const VPD_RANGES: Record<
  GrowthStage,
  { min: number; max: number; label: string }
> = {
  seedling: { min: 0.4, max: 0.8, label: 'Seedling' },
  vegetative: { min: 0.8, max: 1.2, label: 'Vegetative' },
  flowering: { min: 1.0, max: 1.5, label: 'Flowering' },
  late_flowering: { min: 1.2, max: 1.6, label: 'Late Flowering' },
};

/**
 * VpdGauge component props
 */
export interface VpdGaugeProps {
  /** VPD value in kPa */
  value: number;
  /** Current growth stage */
  growthStage?: GrowthStage;
  /** Allow user to select growth stage */
  allowStageSelection?: boolean;
  /** Size variant */
  size?: CircularGaugeProps['size'];
  /** Enable smooth value transitions */
  animated?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Optional label override */
  label?: string;
  /** Callback when growth stage changes */
  onStageChange?: (stage: GrowthStage) => void;
}

/**
 * Get VPD color based on value and growth stage
 */
function getVpdColor(vpd: number, stage: GrowthStage): string {
  const range = VPD_RANGES[stage];
  const mid = (range.min + range.max) / 2;
  const tolerance = (range.max - range.min) / 2;

  if (vpd < range.min) {
    // Below ideal - blue (too humid)
    const deviation = Math.min(1, (range.min - vpd) / range.min);
    const r = Math.round(59 - 20 * deviation);
    const g = Math.round(130 + 67 * (1 - deviation));
    const b = Math.round(246 - 40 * deviation);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (vpd > range.max) {
    // Above ideal - red/orange (too dry)
    const deviation = Math.min(1, (vpd - range.max) / (2.0 - range.max));
    const r = Math.round(34 + (239 - 34) * deviation);
    const g = Math.round(197 + (68 - 197) * deviation);
    const b = Math.round(94 + (68 - 94) * deviation);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // In ideal range - green gradient
    const centerDist = Math.abs(vpd - mid) / tolerance;
    const r = Math.round(34 + (100 - 34) * centerDist);
    const g = Math.round(197 - (30 * centerDist));
    const b = Math.round(94 - (20 * centerDist));
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * VpdGauge - Pre-configured circular gauge for VPD (Vapor Pressure Deficit) readings
 *
 * Features:
 * - Optimized for VPD display (0-2.0 kPa)
 * - Color-coded based on plant growth stage
 * - Ideal range bands for different growth stages
 * - Growth stage selector
 * - Visual feedback for optimal conditions
 */
export function VpdGauge({
  value,
  growthStage = 'vegetative',
  allowStageSelection = false,
  size = 'md',
  animated = true,
  className,
  label = 'VPD',
  onStageChange,
}: VpdGaugeProps) {
  const [selectedStage, setSelectedStage] = useState<GrowthStage>(growthStage);

  // Clamp value between 0 and 2.0 kPa
  const clampedValue = Math.max(0, Math.min(2.0, value));
  const range = VPD_RANGES[selectedStage];

  // Check if value is in ideal range
  const isIdeal = clampedValue >= range.min && clampedValue <= range.max;

  // Handle stage change
  const handleStageChange = (stage: GrowthStage) => {
    setSelectedStage(stage);
    onStageChange?.(stage);
  };

  return (
    <div className={cn('relative', className)}>
      <CircularGauge
        value={clampedValue}
        min={0}
        max={2.0}
        unit="kPa"
        label={label}
        size={size}
        precision={2}
        animated={animated}
        getColor={(val) => getVpdColor(val, selectedStage)}
      />

      {/* Ideal range indicator */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap">
        Ideal: {range.min.toFixed(1)}-{range.max.toFixed(1)} kPa
      </div>

      {/* Status indicator */}
      {isIdeal ? (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs text-green-500 dark:text-green-400 whitespace-nowrap font-medium">
          ✓ Optimal
        </div>
      ) : clampedValue < range.min ? (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs text-blue-500 dark:text-blue-400 whitespace-nowrap font-medium">
          ⚠️ Too Humid
        </div>
      ) : (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs text-orange-500 dark:text-orange-400 whitespace-nowrap font-medium">
          ⚠️ Too Dry
        </div>
      )}

      {/* Growth stage selector */}
      {allowStageSelection && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-48">
          <select
            value={selectedStage}
            onChange={(e) => handleStageChange(e.target.value as GrowthStage)}
            className="w-full text-xs px-2 py-1 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Select growth stage"
          >
            {Object.entries(VPD_RANGES).map(([stage, config]) => (
              <option key={stage} value={stage}>
                {config.label} ({config.min}-{config.max} kPa)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Static growth stage label */}
      {!allowStageSelection && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap">
          {range.label}
        </div>
      )}
    </div>
  );
}
