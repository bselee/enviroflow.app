'use client';

import { memo } from 'react';

interface ConnectionWireProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isActive: boolean;
  deviceType: string;
  animated?: boolean;
}

const DEVICE_COLORS: Record<string, string> = {
  fan: '#3b82f6',      // blue
  light: '#eab308',    // yellow
  outlet: '#22c55e',   // green
  heater: '#f97316',   // orange
  humidifier: '#06b6d4', // cyan
  default: '#6b7280',  // gray
};

const INACTIVE_COLOR = '#6b7280'; // gray

export const ConnectionWire = memo(({
  startX,
  startY,
  endX,
  endY,
  isActive,
  deviceType,
  animated = true,
}: ConnectionWireProps) => {
  // Determine wire color based on device type and active state
  const wireColor = isActive
    ? (DEVICE_COLORS[deviceType.toLowerCase()] || DEVICE_COLORS.default)
    : INACTIVE_COLOR;

  // Calculate control points for smooth bezier curve
  // Use vertical offset for natural wire droop
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Control point offset based on distance for natural curve
  const controlOffset = Math.min(distance * 0.3, 100);

  // Create smooth S-curve using cubic bezier
  const controlPoint1X = startX + dx * 0.25;
  const controlPoint1Y = startY + controlOffset;
  const controlPoint2X = startX + dx * 0.75;
  const controlPoint2Y = endY - controlOffset;

  const pathD = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;

  // Generate unique ID for the path (needed for animateMotion)
  const pathId = `wire-path-${startX}-${startY}-${endX}-${endY}`;

  return (
    <g className="connection-wire">
      {/* Glow effect (larger, semi-transparent) */}
      <path
        d={pathD}
        fill="none"
        stroke={wireColor}
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.2"
        filter="url(#wire-glow)"
      />

      {/* Main wire */}
      <path
        id={pathId}
        d={pathD}
        fill="none"
        stroke={wireColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-300"
        style={{
          filter: isActive ? 'drop-shadow(0 0 4px currentColor)' : 'none',
        }}
      />

      {/* Animated pulse dot when active */}
      {isActive && animated && (
        <>
          {/* Pulse dot */}
          <circle r="4" fill={wireColor} opacity="0.9">
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              path={pathD}
            />
            <animate
              attributeName="r"
              values="3;5;3"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Trailing glow */}
          <circle r="6" fill={wireColor} opacity="0.3">
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              path={pathD}
            />
          </circle>
        </>
      )}
    </g>
  );
});

ConnectionWire.displayName = 'ConnectionWire';

// SVG filter definitions for glow effects
export const ConnectionWireFilters = () => (
  <defs>
    <filter id="wire-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
    </filter>
  </defs>
);
