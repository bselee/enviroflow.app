/**
 * Circular gauge component for displaying sensor readings
 *
 * Features:
 * - Animated needle with smooth transitions
 * - Color-coded ranges (good/warning/danger)
 * - Large readable value display
 * - Responsive sizing
 */

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

export interface SensorGaugeProps {
  label: string
  value: number
  unit: string
  min: number
  max: number
  /** Optional target range for color coding */
  targetMin?: number
  targetMax?: number
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SensorGauge({
  label,
  value,
  unit,
  min,
  max,
  targetMin,
  targetMax,
  size = 'md',
  className,
}: SensorGaugeProps) {
  const dimensions = {
    sm: { size: 80, stroke: 6, fontSize: 16 },
    md: { size: 120, stroke: 8, fontSize: 20 },
    lg: { size: 160, stroke: 10, fontSize: 24 },
  }

  const { size: gaugeSize, stroke, fontSize } = dimensions[size]
  const radius = (gaugeSize - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const center = gaugeSize / 2

  // Calculate angle for needle (180 degree arc, starting at 180deg)
  const normalizedValue = Math.max(min, Math.min(max, value))
  const percentage = (normalizedValue - min) / (max - min)
  const angle = 180 + percentage * 180 // 180 to 360 degrees

  // Determine status color
  const statusColor = useMemo(() => {
    if (targetMin !== undefined && targetMax !== undefined) {
      if (value < targetMin || value > targetMax) {
        return 'text-red-500'
      }
      if (
        value < targetMin + (targetMax - targetMin) * 0.1 ||
        value > targetMax - (targetMax - targetMin) * 0.1
      ) {
        return 'text-yellow-500'
      }
    }
    return 'text-green-500'
  }, [value, targetMin, targetMax])

  // Calculate dash offset for arc (bottom half circle)
  const dashOffset = circumference * (1 - percentage / 2)

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: gaugeSize, height: gaugeSize / 2 + 10 }}>
        <svg
          width={gaugeSize}
          height={gaugeSize / 2 + 10}
          className="overflow-visible"
        >
          {/* Background arc */}
          <path
            d={`M ${stroke / 2} ${center} A ${radius} ${radius} 0 0 1 ${gaugeSize - stroke / 2} ${center}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted-foreground/20"
          />

          {/* Filled arc based on value */}
          <path
            d={`M ${stroke / 2} ${center} A ${radius} ${radius} 0 0 1 ${gaugeSize - stroke / 2} ${center}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeDasharray={circumference / 2}
            strokeDashoffset={dashOffset}
            className={cn('transition-all duration-500', statusColor)}
            strokeLinecap="round"
          />

          {/* Needle */}
          <line
            x1={center}
            y1={center}
            x2={center + Math.cos((angle * Math.PI) / 180) * (radius - stroke / 2)}
            y2={center + Math.sin((angle * Math.PI) / 180) * (radius - stroke / 2)}
            stroke="currentColor"
            strokeWidth={2}
            className="text-foreground transition-all duration-500"
            style={{
              transformOrigin: `${center}px ${center}px`,
            }}
          />

          {/* Center dot */}
          <circle cx={center} cy={center} r={4} fill="currentColor" className="text-foreground" />
        </svg>

        {/* Value display */}
        <div className="absolute bottom-0 left-0 right-0 text-center">
          <div className={cn('font-bold tabular-nums', statusColor)} style={{ fontSize }}>
            {value.toFixed(1)}
          </div>
          <div className="text-xs text-muted-foreground">{unit}</div>
        </div>
      </div>

      {/* Label */}
      <div className="text-sm font-medium text-center">{label}</div>
    </div>
  )
}
