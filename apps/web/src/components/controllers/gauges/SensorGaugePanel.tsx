/**
 * Panel displaying multiple sensor gauges for a controller
 *
 * Automatically selects relevant sensors and displays them in a grid
 */

import { useMemo } from 'react'
import { SensorGauge } from './SensorGauge'
import type { SensorReading } from '@/types'
import { Card } from '@/components/ui/card'

export interface SensorGaugePanelProps {
  readings: SensorReading[]
  className?: string
}

interface GaugeConfig {
  type: string
  label: string
  min: number
  max: number
  targetMin?: number
  targetMax?: number
}

const GAUGE_CONFIGS: Record<string, GaugeConfig> = {
  temperature: {
    type: 'temperature',
    label: 'Temperature',
    min: 32,
    max: 110,
    targetMin: 68,
    targetMax: 82,
  },
  humidity: {
    type: 'humidity',
    label: 'Humidity',
    min: 0,
    max: 100,
    targetMin: 40,
    targetMax: 60,
  },
  vpd: {
    type: 'vpd',
    label: 'VPD',
    min: 0,
    max: 3,
    targetMin: 0.8,
    targetMax: 1.2,
  },
  co2: {
    type: 'co2',
    label: 'CO₂',
    min: 0,
    max: 2000,
    targetMin: 400,
    targetMax: 1200,
  },
}

export function SensorGaugePanel({ readings, className }: SensorGaugePanelProps) {
  // Get latest reading for each sensor type
  const latestReadings = useMemo(() => {
    const readingMap = new Map<string, SensorReading>()

    readings.forEach((reading) => {
      const existing = readingMap.get(reading.sensor_type)
      if (
        !existing ||
        new Date(reading.recorded_at) > new Date(existing.recorded_at)
      ) {
        readingMap.set(reading.sensor_type, reading)
      }
    })

    return Array.from(readingMap.values())
  }, [readings])

  // Filter to only supported gauges
  const displayedGauges = useMemo(() => {
    return latestReadings
      .filter((reading) => reading.sensor_type in GAUGE_CONFIGS)
      .map((reading) => ({
        reading,
        config: GAUGE_CONFIGS[reading.sensor_type],
      }))
      .sort((a, b) => {
        // Sort by priority: temp, humidity, vpd, co2, others
        const priority = ['temperature', 'humidity', 'vpd', 'co2']
        const aIndex = priority.indexOf(a.config.type)
        const bIndex = priority.indexOf(b.config.type)
        if (aIndex === -1 && bIndex === -1) return 0
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
  }, [latestReadings])

  if (displayedGauges.length === 0) {
    return (
      <Card className={className}>
        <div className="p-6 text-center text-muted-foreground">
          <p>No sensor readings available</p>
          <p className="text-sm mt-1">Waiting for data...</p>
        </div>
      </Card>
    )
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {displayedGauges.map(({ reading, config }) => (
          <SensorGauge
            key={reading.sensor_type}
            label={config.label}
            value={reading.value}
            unit={reading.unit}
            min={config.min}
            max={config.max}
            targetMin={config.targetMin}
            targetMax={config.targetMax}
            size="md"
          />
        ))}
      </div>
    </div>
  )
}
