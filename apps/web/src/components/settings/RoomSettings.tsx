"use client";

import { useState, useCallback, useMemo } from "react";
import { RotateCcw, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { RoomPreferences } from "@/hooks/use-user-preferences";
import {
  DEFAULT_ROOM_PREFERENCES,
  calculateVPDStatus,
  calculateTempStatus,
  calculateHumidityStatus,
  getStatusColorClass,
  getStatusBgClass,
  type MetricStatus,
} from "@/hooks/use-user-preferences";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Room option for the selector dropdown.
 */
export interface RoomOption {
  id: string;
  name: string;
}

/**
 * Props for the RoomSettings component.
 */
export interface RoomSettingsProps {
  /** Available rooms for selection */
  rooms: RoomOption[];
  /** Currently selected room ID */
  selectedRoomId: string | null;
  /** Callback when room selection changes */
  onRoomChange: (roomId: string) => void;
  /** Current room preferences */
  preferences: RoomPreferences;
  /** Callback when preferences change */
  onPreferencesChange: (prefs: Partial<RoomPreferences>) => void;
  /** Callback to reset preferences to defaults */
  onResetToDefaults: () => void;
  /** Current metric values for live preview (optional) */
  currentValues?: {
    vpd?: number;
    temperature?: number;
    humidity?: number;
  };
  /** Additional CSS class names */
  className?: string;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Props for the RangeSlider component.
 */
interface RangeSliderProps {
  label: string;
  tooltip: string;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  unit: string;
  formatValue?: (value: number) => string;
  previewValue?: number;
  getStatus?: (value: number) => MetricStatus;
}

/**
 * Custom dual-thumb range slider for optimal range selection.
 * Provides visual feedback with a highlighted range zone.
 */
function RangeSlider({
  label,
  tooltip,
  min,
  max,
  step,
  value,
  onChange,
  unit,
  formatValue = (v) => v.toString(),
  previewValue,
  getStatus,
}: RangeSliderProps): JSX.Element {
  const [localMin, setLocalMin] = useState(value[0]);
  const [localMax, setLocalMax] = useState(value[1]);

  // Calculate positions for the visual range indicator
  const minPercent = ((localMin - min) / (max - min)) * 100;
  const maxPercent = ((localMax - min) / (max - min)) * 100;

  // Get preview status
  const previewStatus = previewValue !== undefined && getStatus ? getStatus(previewValue) : null;

  /**
   * Handles minimum value change.
   */
  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMin = parseFloat(e.target.value);
      setLocalMin(newMin);
      if (newMin <= localMax) {
        onChange([newMin, localMax]);
      }
    },
    [localMax, onChange]
  );

  /**
   * Handles maximum value change.
   */
  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMax = parseFloat(e.target.value);
      setLocalMax(newMax);
      if (newMax >= localMin) {
        onChange([localMin, newMax]);
      }
    },
    [localMin, onChange]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-sm text-muted-foreground">
          {formatValue(localMin)} - {formatValue(localMax)} {unit}
        </span>
      </div>

      {/* Custom Range Slider */}
      <div className="relative h-8 pt-2">
        {/* Track background */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-secondary rounded-full" />

        {/* Optimal range highlight */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-success/50 rounded-full transition-all"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />

        {/* Warning zones */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-warning/30 rounded-l-full"
          style={{
            left: 0,
            width: `${minPercent}%`,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-warning/30 rounded-r-full"
          style={{
            left: `${maxPercent}%`,
            width: `${100 - maxPercent}%`,
          }}
        />

        {/* Current value indicator (if preview enabled) */}
        {previewValue !== undefined && (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-background z-10 transition-all",
              previewStatus && getStatusBgClass(previewStatus),
              previewStatus === "optimal" && "bg-success",
              previewStatus === "warning" && "bg-warning",
              previewStatus === "alert" && "bg-destructive"
            )}
            style={{
              left: `${Math.max(0, Math.min(100, ((previewValue - min) / (max - min)) * 100))}%`,
            }}
          />
        )}

        {/* Minimum slider input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localMin}
          onChange={handleMinChange}
          className="absolute top-0 w-full h-full appearance-none bg-transparent cursor-pointer z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background"
          aria-label={`${label} minimum`}
        />

        {/* Maximum slider input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localMax}
          onChange={handleMaxChange}
          className="absolute top-0 w-full h-full appearance-none bg-transparent cursor-pointer z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background"
          aria-label={`${label} maximum`}
        />
      </div>

      {/* Preview status indicator */}
      {previewValue !== undefined && previewStatus && (
        <div className={cn("text-xs flex items-center gap-1", getStatusColorClass(previewStatus))}>
          <span className="inline-block w-2 h-2 rounded-full bg-current" />
          <span>
            Current: {formatValue(previewValue)} {unit} ({previewStatus})
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Props for the ToleranceInput component.
 */
interface ToleranceInputProps {
  label: string;
  tooltip: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
}

/**
 * Numeric input for tolerance/threshold values.
 */
function ToleranceInput({
  label,
  tooltip,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: ToleranceInputProps): JSX.Element {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      if (!isNaN(newValue) && newValue >= min && newValue <= max) {
        onChange(newValue);
      }
    },
    [min, max, onChange]
  );

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/70 cursor-help flex-shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          className="w-20 h-8 text-sm text-right"
        />
        <span className="text-sm text-muted-foreground w-8">{unit}</span>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * RoomSettings Component
 *
 * Allows users to configure per-room optimal ranges for environmental metrics.
 * Includes:
 * - Room selector dropdown
 * - Optimal range sliders for VPD, Temperature, and Humidity
 * - Warning tolerance inputs
 * - Alert threshold inputs
 * - Live preview of current values against configured ranges
 * - Reset to defaults functionality
 *
 * @example
 * ```tsx
 * <RoomSettings
 *   rooms={rooms}
 *   selectedRoomId={selectedRoomId}
 *   onRoomChange={setSelectedRoomId}
 *   preferences={roomPreferences}
 *   onPreferencesChange={handlePreferencesChange}
 *   onResetToDefaults={handleReset}
 *   currentValues={{ vpd: 1.1, temperature: 78, humidity: 55 }}
 * />
 * ```
 */
export function RoomSettings({
  rooms,
  selectedRoomId,
  onRoomChange,
  preferences,
  onPreferencesChange,
  onResetToDefaults,
  currentValues,
  className,
}: RoomSettingsProps): JSX.Element {
  /**
   * Memoized status calculator for VPD.
   */
  const getVPDStatus = useCallback(
    (value: number) => calculateVPDStatus(value, preferences),
    [preferences]
  );

  /**
   * Memoized status calculator for temperature.
   */
  const getTempStatus = useCallback(
    (value: number) => calculateTempStatus(value, preferences),
    [preferences]
  );

  /**
   * Memoized status calculator for humidity.
   */
  const getHumidityStatus = useCallback(
    (value: number) => calculateHumidityStatus(value, preferences),
    [preferences]
  );

  /**
   * Checks if current preferences differ from defaults.
   */
  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(preferences.optimalVPD) !== JSON.stringify(DEFAULT_ROOM_PREFERENCES.optimalVPD) ||
      JSON.stringify(preferences.optimalTemp) !== JSON.stringify(DEFAULT_ROOM_PREFERENCES.optimalTemp) ||
      JSON.stringify(preferences.optimalHumidity) !== JSON.stringify(DEFAULT_ROOM_PREFERENCES.optimalHumidity) ||
      JSON.stringify(preferences.warningTolerance) !== JSON.stringify(DEFAULT_ROOM_PREFERENCES.warningTolerance) ||
      JSON.stringify(preferences.alertThreshold) !== JSON.stringify(DEFAULT_ROOM_PREFERENCES.alertThreshold)
    );
  }, [preferences]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Room Selector */}
      <div className="space-y-2">
        <Label htmlFor="room-select">Select Room</Label>
        <Select value={selectedRoomId ?? ""} onValueChange={onRoomChange}>
          <SelectTrigger id="room-select" className="w-full">
            <SelectValue placeholder="Choose a room to configure" />
          </SelectTrigger>
          <SelectContent>
            {rooms.length === 0 ? (
              <SelectItem value="" disabled>
                No rooms available
              </SelectItem>
            ) : (
              rooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {selectedRoomId && (
        <>
          <Separator />

          {/* Optimal Ranges Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Optimal Ranges</h4>
              {hasChanges && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetToDefaults}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>

            {/* VPD Range */}
            <RangeSlider
              label="VPD Range"
              tooltip="Vapor Pressure Deficit - the optimal range for plant transpiration. Most plants thrive between 0.8-1.2 kPa during vegetative growth."
              min={0.4}
              max={2.0}
              step={0.05}
              value={preferences.optimalVPD}
              onChange={(value) => onPreferencesChange({ optimalVPD: value })}
              unit="kPa"
              formatValue={(v) => v.toFixed(2)}
              previewValue={currentValues?.vpd}
              getStatus={getVPDStatus}
            />

            {/* Temperature Range */}
            <RangeSlider
              label="Temperature Range"
              tooltip="Optimal air temperature range for your grow. Most plants prefer 70-85°F (21-29°C) during the day."
              min={50}
              max={90}
              step={1}
              value={preferences.optimalTemp}
              onChange={(value) => onPreferencesChange({ optimalTemp: value })}
              unit="°F"
              formatValue={(v) => v.toFixed(0)}
              previewValue={currentValues?.temperature}
              getStatus={getTempStatus}
            />

            {/* Humidity Range */}
            <RangeSlider
              label="Humidity Range"
              tooltip="Relative humidity percentage. Younger plants prefer higher humidity (60-70%), while flowering plants do better at 40-50%."
              min={30}
              max={90}
              step={1}
              value={preferences.optimalHumidity}
              onChange={(value) => onPreferencesChange({ optimalHumidity: value })}
              unit="%"
              formatValue={(v) => v.toFixed(0)}
              previewValue={currentValues?.humidity}
              getStatus={getHumidityStatus}
            />
          </div>

          <Separator />

          {/* Tolerances Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Warning Tolerances</h4>
            <p className="text-xs text-muted-foreground">
              Values outside optimal range by this amount will show a yellow warning indicator.
            </p>

            <div className="space-y-3 pl-1">
              <ToleranceInput
                label="VPD"
                tooltip="Distance from optimal VPD range before showing warning"
                value={preferences.warningTolerance.vpd}
                onChange={(value) =>
                  onPreferencesChange({
                    warningTolerance: { ...preferences.warningTolerance, vpd: value },
                  })
                }
                min={0.05}
                max={0.5}
                step={0.05}
                unit="kPa"
              />

              <ToleranceInput
                label="Temperature"
                tooltip="Degrees from optimal temperature range before showing warning"
                value={preferences.warningTolerance.temp}
                onChange={(value) =>
                  onPreferencesChange({
                    warningTolerance: { ...preferences.warningTolerance, temp: value },
                  })
                }
                min={1}
                max={10}
                step={0.5}
                unit="°F"
              />

              <ToleranceInput
                label="Humidity"
                tooltip="Percentage from optimal humidity range before showing warning"
                value={preferences.warningTolerance.humidity}
                onChange={(value) =>
                  onPreferencesChange({
                    warningTolerance: { ...preferences.warningTolerance, humidity: value },
                  })
                }
                min={1}
                max={15}
                step={1}
                unit="%"
              />
            </div>
          </div>

          <Separator />

          {/* Alert Thresholds Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Alert Thresholds</h4>
            <p className="text-xs text-muted-foreground">
              Values outside optimal range by this amount will show a red alert indicator.
            </p>

            <div className="space-y-3 pl-1">
              <ToleranceInput
                label="VPD"
                tooltip="Distance from optimal VPD range before showing alert"
                value={preferences.alertThreshold.vpd}
                onChange={(value) =>
                  onPreferencesChange({
                    alertThreshold: { ...preferences.alertThreshold, vpd: value },
                  })
                }
                min={0.1}
                max={1.0}
                step={0.05}
                unit="kPa"
              />

              <ToleranceInput
                label="Temperature"
                tooltip="Degrees from optimal temperature range before showing alert"
                value={preferences.alertThreshold.temp}
                onChange={(value) =>
                  onPreferencesChange({
                    alertThreshold: { ...preferences.alertThreshold, temp: value },
                  })
                }
                min={2}
                max={20}
                step={1}
                unit="°F"
              />

              <ToleranceInput
                label="Humidity"
                tooltip="Percentage from optimal humidity range before showing alert"
                value={preferences.alertThreshold.humidity}
                onChange={(value) =>
                  onPreferencesChange({
                    alertThreshold: { ...preferences.alertThreshold, humidity: value },
                  })
                }
                min={5}
                max={30}
                step={1}
                unit="%"
              />
            </div>
          </div>
        </>
      )}

      {!selectedRoomId && rooms.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Select a room to configure its environmental preferences.</p>
        </div>
      )}

      {rooms.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No rooms available. Create a room first to configure preferences.</p>
        </div>
      )}
    </div>
  );
}
