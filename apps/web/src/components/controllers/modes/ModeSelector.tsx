"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Power,
  PowerOff,
  Thermometer,
  Droplets,
  Timer,
  Repeat,
  Calendar,
} from "lucide-react";
import type { DeviceMode } from "@/types";

// =============================================================================
// Types
// =============================================================================

/**
 * Mode configuration with display properties
 */
interface ModeConfig {
  id: DeviceMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  hoverColor: string;
  glowColor: string;
  description: string;
}

/**
 * Props for the ModeSelector component
 */
export interface ModeSelectorProps {
  /** Current active mode */
  currentMode: DeviceMode;
  /** Callback when mode is changed */
  onModeChange: (mode: DeviceMode) => void;
  /** Current temperature reading in °F or °C */
  temperature?: number;
  /** Current humidity reading in % */
  humidity?: number;
  /** Current VPD (Vapor Pressure Deficit) in kPa */
  vpd?: number;
  /** Disable all mode selections */
  disabled?: boolean;
  /** Component size variant */
  size?: "sm" | "md" | "lg";
  /** Temperature unit for display */
  temperatureUnit?: "°F" | "°C";
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Mode Configurations
// =============================================================================

const MODE_CONFIGS: Record<DeviceMode, ModeConfig> = {
  off: {
    id: "off",
    label: "OFF",
    icon: PowerOff,
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    hoverColor: "hover:bg-gray-500/20",
    glowColor: "rgba(156, 163, 175, 0.5)",
    description: "Device disabled",
  },
  on: {
    id: "on",
    label: "ON",
    icon: Power,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    hoverColor: "hover:bg-green-500/20",
    glowColor: "rgba(34, 197, 94, 0.5)",
    description: "Continuous operation",
  },
  auto: {
    id: "auto",
    label: "AUTO",
    icon: Thermometer,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    hoverColor: "hover:bg-blue-500/20",
    glowColor: "rgba(59, 130, 246, 0.5)",
    description: "Temperature/humidity triggers",
  },
  vpd: {
    id: "vpd",
    label: "VPD",
    icon: Droplets,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    hoverColor: "hover:bg-purple-500/20",
    glowColor: "rgba(168, 85, 247, 0.5)",
    description: "Vapor pressure deficit control",
  },
  timer: {
    id: "timer",
    label: "TIMER",
    icon: Timer,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    hoverColor: "hover:bg-orange-500/20",
    glowColor: "rgba(249, 115, 22, 0.5)",
    description: "Countdown timer",
  },
  cycle: {
    id: "cycle",
    label: "CYCLE",
    icon: Repeat,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    hoverColor: "hover:bg-cyan-500/20",
    glowColor: "rgba(6, 182, 212, 0.5)",
    description: "Repeating on/off cycles",
  },
  schedule: {
    id: "schedule",
    label: "SCHEDULE",
    icon: Calendar,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    hoverColor: "hover:bg-yellow-500/20",
    glowColor: "rgba(234, 179, 8, 0.5)",
    description: "Daily time-based schedule",
  },
};

// =============================================================================
// Size Variants
// =============================================================================

const SIZE_CONFIG = {
  sm: {
    container: "w-48 h-48",
    center: { cx: 96, cy: 96, r: 55 },
    segment: { outerRadius: 96, innerRadius: 65 },
    iconSize: "w-4 h-4",
    fontSize: "text-xs",
    centerText: "text-base",
    centerSubtext: "text-xs",
  },
  md: {
    container: "w-72 h-72",
    center: { cx: 144, cy: 144, r: 80 },
    segment: { outerRadius: 144, innerRadius: 95 },
    iconSize: "w-5 h-5",
    fontSize: "text-sm",
    centerText: "text-2xl",
    centerSubtext: "text-sm",
  },
  lg: {
    container: "w-96 h-96",
    center: { cx: 192, cy: 192, r: 105 },
    segment: { outerRadius: 192, innerRadius: 125 },
    iconSize: "w-6 h-6",
    fontSize: "text-base",
    centerText: "text-3xl",
    centerSubtext: "text-base",
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculates the path data for a pie slice segment
 */
function calculateSegmentPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;

  const x1 = cx + outerRadius * Math.cos(startRad);
  const y1 = cy + outerRadius * Math.sin(startRad);
  const x2 = cx + outerRadius * Math.cos(endRad);
  const y2 = cy + outerRadius * Math.sin(endRad);
  const x3 = cx + innerRadius * Math.cos(endRad);
  const y3 = cy + innerRadius * Math.sin(endRad);
  const x4 = cx + innerRadius * Math.cos(startRad);
  const y4 = cy + innerRadius * Math.sin(startRad);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

/**
 * Calculates the center position for a mode icon/label
 */
function calculateLabelPosition(
  cx: number,
  cy: number,
  radius: number,
  angle: number
): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

/**
 * Formats sensor value with appropriate precision
 */
function formatSensorValue(value: number | undefined, decimals = 1): string {
  if (value === undefined || value === null) return "--";
  return value.toFixed(decimals);
}

// =============================================================================
// Main Component
// =============================================================================

export function ModeSelector({
  currentMode,
  onModeChange,
  temperature,
  humidity,
  vpd,
  disabled = false,
  size = "md",
  temperatureUnit = "°F",
  className,
}: ModeSelectorProps) {
  const [hoveredMode, setHoveredMode] = React.useState<DeviceMode | null>(null);
  const [focusedMode, setFocusedMode] = React.useState<DeviceMode | null>(null);

  const sizeConfig = SIZE_CONFIG[size];
  const modes = Object.values(MODE_CONFIGS);
  const segmentAngle = 360 / modes.length;

  const handleModeClick = (mode: DeviceMode) => {
    if (!disabled && mode !== currentMode) {
      onModeChange(mode);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, mode: DeviceMode) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleModeClick(mode);
    }

    // Arrow key navigation
    const currentIndex = modes.findIndex((m) => m.id === mode);
    let nextIndex = currentIndex;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % modes.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + modes.length) % modes.length;
    }

    if (nextIndex !== currentIndex) {
      const nextMode = modes[nextIndex].id;
      setFocusedMode(nextMode);
      // Focus the next segment
      const nextElement = document.getElementById(`mode-segment-${nextMode}`);
      nextElement?.focus();
    }
  };

  return (
    <div
      className={cn(
        "relative inline-flex flex-col items-center justify-center gap-4",
        className
      )}
    >
      {/* Main circular selector */}
      <div className={cn("relative", sizeConfig.container)}>
        <svg
          viewBox={`0 0 ${sizeConfig.center.cx * 2} ${sizeConfig.center.cy * 2}`}
          className="w-full h-full"
          role="radiogroup"
          aria-label="Device mode selector"
        >
          {/* Gradient definitions for glow effects */}
          <defs>
            {modes.map((mode) => (
              <radialGradient key={`glow-${mode.id}`} id={`glow-${mode.id}`}>
                <stop offset="0%" stopColor={mode.glowColor} stopOpacity="0.8" />
                <stop offset="100%" stopColor={mode.glowColor} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          {/* Mode segments */}
          {modes.map((mode, index) => {
            const startAngle = index * segmentAngle;
            const endAngle = (index + 1) * segmentAngle;
            const midAngle = (startAngle + endAngle) / 2;
            const isActive = currentMode === mode.id;
            const isHovered = hoveredMode === mode.id;
            const isFocused = focusedMode === mode.id;

            const labelPos = calculateLabelPosition(
              sizeConfig.center.cx,
              sizeConfig.center.cy,
              (sizeConfig.segment.outerRadius + sizeConfig.segment.innerRadius) / 2,
              midAngle
            );

            return (
              <g key={mode.id}>
                {/* Glow effect for active mode */}
                {isActive && (
                  <circle
                    cx={sizeConfig.center.cx}
                    cy={sizeConfig.center.cy}
                    r={sizeConfig.segment.outerRadius + 8}
                    fill={`url(#glow-${mode.id})`}
                    className="animate-pulse-subtle"
                  />
                )}

                {/* Segment path */}
                <path
                  id={`mode-segment-${mode.id}`}
                  d={calculateSegmentPath(
                    sizeConfig.center.cx,
                    sizeConfig.center.cy,
                    sizeConfig.segment.innerRadius,
                    sizeConfig.segment.outerRadius,
                    startAngle,
                    endAngle
                  )}
                  className={cn(
                    "transition-all duration-300 cursor-pointer",
                    isActive
                      ? mode.bgColor
                      : "fill-muted/30 hover:fill-muted/50",
                    isActive && "stroke-2",
                    (isHovered || isFocused) && !disabled && "opacity-80",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                  stroke={isActive ? mode.color.replace("text-", "#") : "transparent"}
                  strokeWidth={isActive ? "3" : "0"}
                  style={{
                    transform: isActive ? "scale(1.05)" : "scale(1)",
                    transformOrigin: `${sizeConfig.center.cx}px ${sizeConfig.center.cy}px`,
                  }}
                  onClick={() => handleModeClick(mode.id)}
                  onMouseEnter={() => setHoveredMode(mode.id)}
                  onMouseLeave={() => setHoveredMode(null)}
                  onFocus={() => setFocusedMode(mode.id)}
                  onBlur={() => setFocusedMode(null)}
                  onKeyDown={(e) => handleKeyDown(e, mode.id)}
                  tabIndex={disabled ? -1 : 0}
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`${mode.label} mode: ${mode.description}`}
                />

                {/* Mode label */}
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={cn(
                    "font-semibold pointer-events-none select-none transition-all duration-300",
                    sizeConfig.fontSize,
                    isActive ? mode.color : "fill-muted-foreground"
                  )}
                  style={{
                    transform: isActive ? "scale(1.1)" : "scale(1)",
                    transformOrigin: `${labelPos.x}px ${labelPos.y}px`,
                  }}
                >
                  {mode.label}
                </text>
              </g>
            );
          })}

          {/* Center circle with sensor readings */}
          <circle
            cx={sizeConfig.center.cx}
            cy={sizeConfig.center.cy}
            r={sizeConfig.center.r}
            className="fill-card stroke-border"
            strokeWidth="2"
          />
        </svg>

        {/* Center content overlay (positioned absolutely for better text rendering) */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            width: sizeConfig.center.r * 2,
            height: sizeConfig.center.r * 2,
            left: `calc(50% - ${sizeConfig.center.r}px)`,
            top: `calc(50% - ${sizeConfig.center.r}px)`,
          }}
        >
          <div className="flex flex-col items-center justify-center text-center">
            {/* Temperature */}
            {temperature !== undefined && (
              <div className={cn("font-bold text-foreground", sizeConfig.centerText)}>
                {formatSensorValue(temperature, 1)}
                <span className="text-sm font-normal">{temperatureUnit}</span>
              </div>
            )}

            {/* Humidity */}
            {humidity !== undefined && (
              <div className={cn("text-muted-foreground", sizeConfig.centerSubtext)}>
                {formatSensorValue(humidity, 0)}% RH
              </div>
            )}

            {/* VPD */}
            {vpd !== undefined && (
              <div
                className={cn(
                  "text-muted-foreground mt-1",
                  size === "sm" ? "text-[10px]" : "text-xs"
                )}
              >
                VPD: {formatSensorValue(vpd, 2)} kPa
              </div>
            )}

            {/* No sensor data message */}
            {temperature === undefined &&
              humidity === undefined &&
              vpd === undefined && (
                <div className="text-muted-foreground text-xs">No sensor data</div>
              )}
          </div>
        </div>
      </div>

      {/* Mode description tooltip */}
      {(hoveredMode || focusedMode) && (
        <div className="text-center animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-sm font-medium text-foreground">
            {MODE_CONFIGS[hoveredMode || focusedMode!].label}
          </p>
          <p className="text-xs text-muted-foreground">
            {MODE_CONFIGS[hoveredMode || focusedMode!].description}
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Display Name
// =============================================================================

ModeSelector.displayName = "ModeSelector";
