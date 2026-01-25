'use client';

import React from 'react';
import { TemperatureGauge, TemperatureUnit } from './TemperatureGauge';
import { HumidityGauge } from './HumidityGauge';
import { VpdGauge, GrowthStage } from './VpdGauge';
import { CircularGaugeProps } from './CircularGauge';
import { cn } from '@/lib/utils';

/**
 * Layout variants for gauge cluster
 */
export type ClusterLayout = 'horizontal' | 'vertical' | 'compact' | 'grid';

/**
 * SensorGaugeCluster component props
 */
export interface SensorGaugeClusterProps {
  /** Temperature value in Fahrenheit */
  temperature?: number;
  /** Humidity value (0-100%) */
  humidity?: number;
  /** VPD value in kPa */
  vpd?: number;
  /** Temperature unit to display */
  temperatureUnit?: TemperatureUnit;
  /** Layout arrangement */
  layout?: ClusterLayout;
  /** Show VPD gauge */
  showVpd?: boolean;
  /** Growth stage for VPD calculations */
  growthStage?: GrowthStage;
  /** Allow temperature unit toggle */
  allowTemperatureToggle?: boolean;
  /** Allow VPD growth stage selection */
  allowVpdStageSelection?: boolean;
  /** Size variant for all gauges */
  size?: CircularGaugeProps['size'];
  /** Enable smooth value transitions */
  animated?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Callback when VPD growth stage changes */
  onVpdStageChange?: (stage: GrowthStage) => void;
}

/**
 * SensorGaugeCluster - Combined display of temperature, humidity, and VPD gauges
 *
 * Features:
 * - Flexible layout options (horizontal, vertical, compact, grid)
 * - Responsive sizing
 * - Optional VPD gauge
 * - Synchronized sizing across all gauges
 * - Handles missing sensor values gracefully
 */
export function SensorGaugeCluster({
  temperature,
  humidity,
  vpd,
  temperatureUnit = 'F',
  layout = 'horizontal',
  showVpd = false,
  growthStage = 'vegetative',
  allowTemperatureToggle = false,
  allowVpdStageSelection = false,
  size = 'md',
  animated = true,
  className,
  onVpdStageChange,
}: SensorGaugeClusterProps) {
  // Determine which gauges to show
  const hasTemperature = temperature !== undefined && !isNaN(temperature);
  const hasHumidity = humidity !== undefined && !isNaN(humidity);
  const hasVpd = vpd !== undefined && !isNaN(vpd);
  const showVpdGauge = showVpd && hasVpd;

  // Count active gauges
  const gaugeCount =
    (hasTemperature ? 1 : 0) + (hasHumidity ? 1 : 0) + (showVpdGauge ? 1 : 0);

  // If no gauges to show, return empty state
  if (gaugeCount === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-8 text-muted-foreground',
          className
        )}
      >
        <div className="text-center">
          <p className="text-sm">No sensor data available</p>
        </div>
      </div>
    );
  }

  // Layout-specific container classes
  const containerClasses = {
    horizontal: 'flex flex-row items-start justify-center gap-8 flex-wrap',
    vertical: 'flex flex-col items-center justify-start gap-8',
    compact: 'flex flex-row items-start justify-center gap-4 flex-wrap',
    grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 place-items-center',
  };

  // Adjust size for compact layout
  const effectiveSize = layout === 'compact' ? 'sm' : size;

  return (
    <div className={cn(containerClasses[layout], className)}>
      {/* Temperature Gauge */}
      {hasTemperature && (
        <div className="flex-shrink-0">
          <TemperatureGauge
            value={temperature}
            unit={temperatureUnit}
            allowUnitToggle={allowTemperatureToggle}
            size={effectiveSize}
            animated={animated}
          />
        </div>
      )}

      {/* Humidity Gauge */}
      {hasHumidity && (
        <div className="flex-shrink-0">
          <HumidityGauge
            value={humidity}
            size={effectiveSize}
            animated={animated}
          />
        </div>
      )}

      {/* VPD Gauge */}
      {showVpdGauge && (
        <div className="flex-shrink-0">
          <VpdGauge
            value={vpd}
            growthStage={growthStage}
            allowStageSelection={allowVpdStageSelection}
            size={effectiveSize}
            animated={animated}
            onStageChange={onVpdStageChange}
          />
        </div>
      )}
    </div>
  );
}

/**
 * CompactSensorGaugeCluster - Compact variant with smaller gauges
 */
export function CompactSensorGaugeCluster(
  props: Omit<SensorGaugeClusterProps, 'layout' | 'size'>
) {
  return <SensorGaugeCluster {...props} layout="compact" size="sm" />;
}

/**
 * VerticalSensorGaugeCluster - Vertical stacked variant
 */
export function VerticalSensorGaugeCluster(
  props: Omit<SensorGaugeClusterProps, 'layout'>
) {
  return <SensorGaugeCluster {...props} layout="vertical" />;
}

/**
 * GridSensorGaugeCluster - Responsive grid variant
 */
export function GridSensorGaugeCluster(
  props: Omit<SensorGaugeClusterProps, 'layout'>
) {
  return <SensorGaugeCluster {...props} layout="grid" />;
}
