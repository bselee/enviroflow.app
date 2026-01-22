"use client";

import { useState, useCallback, useMemo } from "react";
import { Loader2, Settings, Palette, Thermometer, Sparkles, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useUserPreferences,
  DEFAULT_USER_PREFERENCES,
  type ViewMode,
  type AnimationQuality,
  type PrimaryMetric,
  type TimelineMetric,
  type TemperatureUnit,
} from "@/hooks/use-user-preferences";
import { RoomSettings, type RoomOption } from "./RoomSettings";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Props for the DashboardPreferences component.
 */
export interface DashboardPreferencesProps {
  /** Available rooms for room-specific settings */
  rooms: RoomOption[];
  /** Current metric values for live preview (optional) */
  currentValues?: {
    vpd?: number;
    temperature?: number;
    humidity?: number;
  };
  /** Callback when preferences are saved */
  onSave?: () => void;
  /** Additional CSS class names */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Available timeline metrics for selection.
 */
const TIMELINE_METRICS: { value: TimelineMetric; label: string }[] = [
  { value: "vpd", label: "VPD" },
  { value: "temperature", label: "Temperature" },
  { value: "humidity", label: "Humidity" },
  { value: "co2", label: "CO2" },
  { value: "light", label: "Light" },
];

/**
 * Available view modes with descriptions.
 */
const VIEW_MODES: { value: ViewMode; label: string; description: string }[] = [
  {
    value: "primary-mini",
    label: "Primary + Mini",
    description: "Large primary metric with smaller supporting values",
  },
  {
    value: "grid",
    label: "Grid",
    description: "Equal-sized cards for all metrics",
  },
  {
    value: "carousel",
    label: "Carousel",
    description: "Swipeable cards on mobile",
  },
  {
    value: "split",
    label: "Split View",
    description: "Two-column layout for comparison",
  },
];

/**
 * Animation quality options with descriptions.
 */
const ANIMATION_QUALITIES: { value: AnimationQuality; label: string; description: string }[] = [
  {
    value: "auto",
    label: "Auto",
    description: "Automatically adjust based on device performance",
  },
  {
    value: "full",
    label: "Full",
    description: "All animations and transitions enabled",
  },
  {
    value: "reduced",
    label: "Reduced",
    description: "Simplified animations for better performance",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Essential transitions only",
  },
];

/**
 * Primary metric options for dashboard focus.
 */
const PRIMARY_METRICS: { value: PrimaryMetric; label: string }[] = [
  { value: "vpd", label: "VPD" },
  { value: "temperature", label: "Temperature" },
  { value: "humidity", label: "Humidity" },
  { value: "co2", label: "CO2" },
];

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Status preview indicator showing how current values map to status colors.
 */
interface StatusPreviewProps {
  label: string;
  value: number | undefined;
  unit: string;
  status: "optimal" | "warning" | "alert" | null;
}

function StatusPreview({ label, value, unit, status }: StatusPreviewProps): JSX.Element {
  if (value === undefined) {
    return (
      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">No data</span>
      </div>
    );
  }

  const statusColors = {
    optimal: "bg-success/20 text-success border-success/30",
    warning: "bg-warning/20 text-warning border-warning/30",
    alert: "bg-destructive/20 text-destructive border-destructive/30",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between py-2 px-3 rounded-md border",
        status ? statusColors[status] : "bg-muted/50 border-border"
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm font-mono">
        {value.toFixed(label === "VPD" ? 2 : 0)} {unit}
      </span>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * DashboardPreferences Component
 *
 * Multi-tab panel for managing all user dashboard preferences:
 * - General: Temperature unit, primary metric, view mode
 * - Rooms: Per-room optimal ranges and tolerances
 * - Appearance: Animation quality, timeline metrics
 * - Advanced: Reset options, data export
 *
 * Features:
 * - Auto-save with debounce
 * - Live preview of status colors
 * - Accessible form controls
 * - Loading and saving states
 *
 * @example
 * ```tsx
 * <DashboardPreferences
 *   rooms={rooms}
 *   currentValues={{ vpd: 1.1, temperature: 78, humidity: 55 }}
 *   onSave={() => console.log("Saved")}
 * />
 * ```
 */
export function DashboardPreferences({
  rooms,
  currentValues,
  onSave,
  className,
}: DashboardPreferencesProps): JSX.Element {
  const {
    preferences,
    isLoading,
    isSaving,
    updatePreference,
    updateRoomPreferences,
    getRoomPreferences,
    resetRoomPreferences,
    resetAllPreferences,
    savePreferences,
  } = useUserPreferences();

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(
    rooms.length > 0 ? rooms[0].id : null
  );

  const [activeTab, setActiveTab] = useState("general");

  /**
   * Gets the selected room's preferences.
   */
  const selectedRoomPreferences = useMemo(() => {
    if (!selectedRoomId) return null;
    return getRoomPreferences(selectedRoomId);
  }, [selectedRoomId, getRoomPreferences]);

  /**
   * Handles timeline metric toggle.
   */
  const handleTimelineMetricToggle = useCallback(
    (metric: TimelineMetric, checked: boolean) => {
      const currentMetrics = preferences.timelineMetrics;

      // Ensure at least one metric is always selected
      if (!checked && currentMetrics.length === 1) {
        toast({
          title: "Cannot remove metric",
          description: "At least one metric must be visible on the timeline.",
          variant: "destructive",
        });
        return;
      }

      const newMetrics = checked
        ? [...currentMetrics, metric]
        : currentMetrics.filter((m) => m !== metric);

      updatePreference("timelineMetrics", newMetrics);
    },
    [preferences.timelineMetrics, updatePreference]
  );

  /**
   * Handles manual save button click.
   */
  const handleSave = useCallback(async () => {
    const result = await savePreferences();

    if (result.success) {
      toast({
        title: "Preferences saved",
        description: "Your dashboard preferences have been updated.",
      });
      onSave?.();
    } else {
      toast({
        title: "Save failed",
        description: result.error || "An error occurred while saving preferences.",
        variant: "destructive",
      });
    }
  }, [savePreferences, onSave]);

  /**
   * Handles reset all preferences.
   */
  const handleResetAll = useCallback(() => {
    resetAllPreferences();
    toast({
      title: "Preferences reset",
      description: "All preferences have been restored to defaults.",
    });
  }, [resetAllPreferences]);

  /**
   * Handles room selection change.
   */
  const handleRoomChange = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
  }, []);

  /**
   * Handles room preferences change.
   */
  const handleRoomPreferencesChange = useCallback(
    (prefs: Parameters<typeof updateRoomPreferences>[1]) => {
      if (selectedRoomId) {
        updateRoomPreferences(selectedRoomId, prefs);
      }
    },
    [selectedRoomId, updateRoomPreferences]
  );

  /**
   * Handles room preferences reset.
   */
  const handleRoomReset = useCallback(() => {
    if (selectedRoomId) {
      resetRoomPreferences(selectedRoomId);
      toast({
        title: "Room preferences reset",
        description: "Room preferences have been restored to defaults.",
      });
    }
  }, [selectedRoomId, resetRoomPreferences]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading preferences...</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="text-xs sm:text-sm">
            <Settings className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            General
          </TabsTrigger>
          <TabsTrigger value="rooms" className="text-xs sm:text-sm">
            <Thermometer className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Rooms
          </TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs sm:text-sm">
            <Palette className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs sm:text-sm">
            <Sparkles className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Advanced
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="mt-6 space-y-6">
          {/* Temperature Unit */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Temperature Unit</Label>
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  preferences.temperatureUnit === "F" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Fahrenheit (°F)
              </span>
              <Switch
                checked={preferences.temperatureUnit === "C"}
                onCheckedChange={(checked: boolean) =>
                  updatePreference("temperatureUnit", checked ? "C" : "F")
                }
                aria-label="Toggle temperature unit"
              />
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  preferences.temperatureUnit === "C" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Celsius (°C)
              </span>
            </div>
          </div>

          <Separator />

          {/* Primary Metric */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Primary Metric</Label>
            <p className="text-xs text-muted-foreground">
              The main metric to focus on in the dashboard hero section.
            </p>
            <Select
              value={preferences.primaryMetric}
              onValueChange={(value: PrimaryMetric) => updatePreference("primaryMetric", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select primary metric" />
              </SelectTrigger>
              <SelectContent>
                {PRIMARY_METRICS.map((metric) => (
                  <SelectItem key={metric.value} value={metric.value}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* View Mode */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">View Mode</Label>
            <p className="text-xs text-muted-foreground">
              How metrics are displayed on the dashboard.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => updatePreference("viewMode", mode.value)}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                    preferences.viewMode === mode.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <span className="text-sm font-medium">{mode.label}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{mode.description}</span>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="mt-6">
          {selectedRoomPreferences && selectedRoomId ? (
            <RoomSettings
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              onRoomChange={handleRoomChange}
              preferences={selectedRoomPreferences}
              onPreferencesChange={handleRoomPreferencesChange}
              onResetToDefaults={handleRoomReset}
              currentValues={currentValues}
            />
          ) : (
            <RoomSettings
              rooms={rooms}
              selectedRoomId={null}
              onRoomChange={handleRoomChange}
              preferences={{
                optimalVPD: [0.8, 1.2],
                optimalTemp: [70, 85],
                optimalHumidity: [50, 70],
                warningTolerance: { vpd: 0.2, temp: 2, humidity: 5 },
                alertThreshold: { vpd: 0.3, temp: 5, humidity: 10 },
              }}
              onPreferencesChange={() => {}}
              onResetToDefaults={() => {}}
            />
          )}
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="mt-6 space-y-6">
          {/* Animation Quality */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Animation Quality</Label>
            <p className="text-xs text-muted-foreground">
              Controls the amount of visual animations and transitions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ANIMATION_QUALITIES.map((quality) => (
                <button
                  key={quality.value}
                  type="button"
                  onClick={() => updatePreference("animationQuality", quality.value)}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                    preferences.animationQuality === quality.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <span className="text-sm font-medium">{quality.label}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{quality.description}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Timeline Metrics */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Timeline Metrics</Label>
            <p className="text-xs text-muted-foreground">
              Select which metrics to display on the timeline chart.
            </p>
            <div className="space-y-2">
              {TIMELINE_METRICS.map((metric) => (
                <div
                  key={metric.value}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <Label
                    htmlFor={`metric-${metric.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {metric.label}
                  </Label>
                  <Checkbox
                    id={`metric-${metric.value}`}
                    checked={preferences.timelineMetrics.includes(metric.value)}
                    onCheckedChange={(checked: boolean) =>
                      handleTimelineMetricToggle(metric.value, checked)
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          {currentValues && (
            <>
              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Live Preview</Label>
                <p className="text-xs text-muted-foreground">
                  Current sensor values with status colors based on your room settings.
                </p>
                <div className="space-y-2">
                  <StatusPreview
                    label="VPD"
                    value={currentValues.vpd}
                    unit="kPa"
                    status={
                      currentValues.vpd !== undefined && selectedRoomPreferences
                        ? (() => {
                            const [min, max] = selectedRoomPreferences.optimalVPD;
                            const val = currentValues.vpd;
                            if (val >= min && val <= max) return "optimal";
                            const dist = val < min ? min - val : val - max;
                            if (dist >= selectedRoomPreferences.alertThreshold.vpd) return "alert";
                            if (dist >= selectedRoomPreferences.warningTolerance.vpd) return "warning";
                            return "optimal";
                          })()
                        : null
                    }
                  />
                  <StatusPreview
                    label="Temperature"
                    value={currentValues.temperature}
                    unit="°F"
                    status={
                      currentValues.temperature !== undefined && selectedRoomPreferences
                        ? (() => {
                            const [min, max] = selectedRoomPreferences.optimalTemp;
                            const val = currentValues.temperature;
                            if (val >= min && val <= max) return "optimal";
                            const dist = val < min ? min - val : val - max;
                            if (dist >= selectedRoomPreferences.alertThreshold.temp) return "alert";
                            if (dist >= selectedRoomPreferences.warningTolerance.temp) return "warning";
                            return "optimal";
                          })()
                        : null
                    }
                  />
                  <StatusPreview
                    label="Humidity"
                    value={currentValues.humidity}
                    unit="%"
                    status={
                      currentValues.humidity !== undefined && selectedRoomPreferences
                        ? (() => {
                            const [min, max] = selectedRoomPreferences.optimalHumidity;
                            const val = currentValues.humidity;
                            if (val >= min && val <= max) return "optimal";
                            const dist = val < min ? min - val : val - max;
                            if (dist >= selectedRoomPreferences.alertThreshold.humidity) return "alert";
                            if (dist >= selectedRoomPreferences.warningTolerance.humidity) return "warning";
                            return "optimal";
                          })()
                        : null
                    }
                  />
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="mt-6 space-y-6">
          {/* Reset Options */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Reset Options</Label>

            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Reset All Preferences</p>
                  <p className="text-xs text-muted-foreground">
                    Restore all settings to their default values.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAll}
                  className="text-destructive hover:text-destructive"
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Reset All
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Current Settings Summary */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Current Settings Summary</Label>
            <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Temperature Unit:</span>
                <span className="font-mono">{preferences.temperatureUnit === "F" ? "Fahrenheit" : "Celsius"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primary Metric:</span>
                <span className="font-mono capitalize">{preferences.primaryMetric}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">View Mode:</span>
                <span className="font-mono">{VIEW_MODES.find(m => m.value === preferences.viewMode)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Animation Quality:</span>
                <span className="font-mono capitalize">{preferences.animationQuality}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timeline Metrics:</span>
                <span className="font-mono">{preferences.timelineMetrics.length} selected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custom Room Settings:</span>
                <span className="font-mono">{Object.keys(preferences.roomSettings).length} rooms</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
      </div>
    </div>
  );
}
