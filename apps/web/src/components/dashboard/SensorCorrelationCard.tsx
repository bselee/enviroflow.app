"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CorrelationScatter } from "@/components/charts/CorrelationScatter";
import { Activity } from "lucide-react";
import type { TimeSeriesPoint, SensorType } from "@/types";

// =============================================================================
// Types
// =============================================================================

export interface SensorCorrelationCardProps {
  /** Temperature time series data */
  temperatureData?: TimeSeriesPoint[];
  /** Humidity time series data */
  humidityData?: TimeSeriesPoint[];
  /** VPD time series data */
  vpdData?: TimeSeriesPoint[];
  /** CO2 time series data */
  co2Data?: TimeSeriesPoint[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Correlation pair configuration
 */
interface CorrelationPair {
  id: string;
  xSensor: SensorType;
  ySensor: SensorType;
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  description: string;
}

// =============================================================================
// Constants
// =============================================================================

const CORRELATION_PAIRS: CorrelationPair[] = [
  {
    id: "temp-humidity",
    xSensor: "temperature",
    ySensor: "humidity",
    xLabel: "Temperature",
    yLabel: "Humidity",
    xUnit: "°F",
    yUnit: "%",
    description: "Analyze how temperature changes affect humidity levels",
  },
  {
    id: "vpd-co2",
    xSensor: "vpd",
    ySensor: "co2",
    xLabel: "VPD",
    yLabel: "CO2",
    xUnit: "kPa",
    yUnit: "ppm",
    description: "Examine the relationship between VPD and CO2 concentration",
  },
  {
    id: "temp-vpd",
    xSensor: "temperature",
    ySensor: "vpd",
    xLabel: "Temperature",
    yLabel: "VPD",
    xUnit: "°F",
    yUnit: "kPa",
    description: "Understand how temperature influences VPD",
  },
  {
    id: "humidity-vpd",
    xSensor: "humidity",
    ySensor: "vpd",
    xLabel: "Humidity",
    yLabel: "VPD",
    xUnit: "%",
    yUnit: "kPa",
    description: "See the inverse relationship between humidity and VPD",
  },
];

// =============================================================================
// Main Component
// =============================================================================

/**
 * SensorCorrelationCard - Dashboard card for sensor correlation analysis.
 *
 * Provides interactive correlation analysis between sensor pairs:
 * - Temperature vs Humidity
 * - VPD vs CO2
 * - Temperature vs VPD
 * - Humidity vs VPD
 *
 * Features:
 * - Tabbed interface for different correlation pairs
 * - Scatter plots with regression lines
 * - Statistical insights
 * - CSV export
 * - Minimum 50 readings required
 *
 * @example
 * ```tsx
 * <SensorCorrelationCard
 *   temperatureData={tempSeries}
 *   humidityData={humiditySeries}
 *   vpdData={vpdSeries}
 *   co2Data={co2Series}
 * />
 * ```
 */
export function SensorCorrelationCard({
  temperatureData,
  humidityData,
  vpdData,
  co2Data,
  isLoading = false,
  className,
}: SensorCorrelationCardProps) {
  const [selectedPair, setSelectedPair] = useState<string>("temp-humidity");

  // Map sensor data
  const sensorDataMap: Record<string, TimeSeriesPoint[]> = useMemo(
    () => ({
      temperature: temperatureData || [],
      humidity: humidityData || [],
      vpd: vpdData || [],
      co2: co2Data || [],
    }),
    [temperatureData, humidityData, vpdData, co2Data]
  );

  // Filter available pairs based on data availability
  const availablePairs = useMemo(() => {
    return CORRELATION_PAIRS.filter((pair) => {
      const xData = sensorDataMap[pair.xSensor];
      const yData = sensorDataMap[pair.ySensor];
      return xData && xData.length > 0 && yData && yData.length > 0;
    });
  }, [sensorDataMap]);

  // Get current pair data
  const currentPair = useMemo(() => {
    return availablePairs.find((p) => p.id === selectedPair) || availablePairs[0];
  }, [availablePairs, selectedPair]);

  // If no data available
  if (!isLoading && availablePairs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Sensor Correlations</CardTitle>
          </div>
          <CardDescription>
            Statistical analysis of sensor relationships (requires 50+ readings)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">No Sensor Data Available</p>
            <p className="text-xs text-muted-foreground max-w-md">
              Correlation analysis requires multiple sensor types with time series data.
              Connect controllers and start collecting readings to see correlations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle>Sensor Correlations</CardTitle>
            </div>
            <CardDescription>
              Statistical analysis of sensor relationships (requires 50+ readings)
            </CardDescription>
          </div>

          {/* Mobile: dropdown selector */}
          <div className="sm:hidden">
            <Select value={selectedPair} onValueChange={setSelectedPair}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availablePairs.map((pair) => (
                  <SelectItem key={pair.id} value={pair.id}>
                    {pair.xLabel} vs {pair.yLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Desktop: tabs */}
        <div className="hidden sm:block">
          <Tabs value={selectedPair} onValueChange={setSelectedPair}>
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-6">
              {availablePairs.map((pair) => (
                <TabsTrigger key={pair.id} value={pair.id} className="text-xs">
                  {pair.xLabel} vs {pair.yLabel}
                </TabsTrigger>
              ))}
            </TabsList>

            {availablePairs.map((pair) => (
              <TabsContent key={pair.id} value={pair.id} className="space-y-4">
                <p className="text-sm text-muted-foreground">{pair.description}</p>
                <CorrelationScatter
                  xTimeSeries={sensorDataMap[pair.xSensor]}
                  yTimeSeries={sensorDataMap[pair.ySensor]}
                  xLabel={pair.xLabel}
                  yLabel={pair.yLabel}
                  xUnit={pair.xUnit}
                  yUnit={pair.yUnit}
                  height={400}
                  isLoading={isLoading}
                  showInsights
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Mobile: single view with selector */}
        <div className="sm:hidden space-y-4">
          {currentPair && (
            <>
              <p className="text-sm text-muted-foreground">{currentPair.description}</p>
              <CorrelationScatter
                xTimeSeries={sensorDataMap[currentPair.xSensor]}
                yTimeSeries={sensorDataMap[currentPair.ySensor]}
                xLabel={currentPair.xLabel}
                yLabel={currentPair.yLabel}
                xUnit={currentPair.xUnit}
                yUnit={currentPair.yUnit}
                height={350}
                isLoading={isLoading}
                showInsights
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
