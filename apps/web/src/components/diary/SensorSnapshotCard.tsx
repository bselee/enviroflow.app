"use client";

import { Thermometer, Droplets, Wind, Leaf } from "lucide-react";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { formatTemperature } from "@/lib/temperature-utils";
import type { SensorSnapshot } from "@/types";
import { cn } from "@/lib/utils";

interface SensorSnapshotCardProps {
  snapshot: SensorSnapshot;
  className?: string;
}

/**
 * Compact display of sensor readings captured at diary entry time.
 */
export function SensorSnapshotCard({ snapshot, className }: SensorSnapshotCardProps) {
  const { preferences } = useUserPreferences();

  const hasData =
    snapshot.temperature != null ||
    snapshot.humidity != null ||
    snapshot.vpd != null ||
    snapshot.co2 != null;

  if (!hasData) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-4 text-xs text-muted-foreground flex-wrap",
        className
      )}
    >
      {snapshot.temperature != null && (
        <div className="flex items-center gap-1" title="Temperature">
          <Thermometer className="h-3 w-3" />
          <span>{formatTemperature(snapshot.temperature, preferences.temperatureUnit)}</span>
        </div>
      )}
      {snapshot.humidity != null && (
        <div className="flex items-center gap-1" title="Humidity">
          <Droplets className="h-3 w-3" />
          <span>{snapshot.humidity}%</span>
        </div>
      )}
      {snapshot.vpd != null && (
        <div className="flex items-center gap-1" title="VPD">
          <Wind className="h-3 w-3" />
          <span>{snapshot.vpd} kPa</span>
        </div>
      )}
      {snapshot.co2 != null && (
        <div className="flex items-center gap-1" title="CO₂">
          <Leaf className="h-3 w-3" />
          <span>{snapshot.co2} ppm</span>
        </div>
      )}
    </div>
  );
}
