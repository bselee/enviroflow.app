"use client";

/**
 * DeviceTreeItem Component
 *
 * Individual device row within a controller's expanded section.
 * Shows device type icon, name, port, power level bar, and inline toggle/dimmer controls.
 */

import { useState } from "react";
import { Fan, Lightbulb, Power, Zap, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DeviceState, DeviceControlResult } from "@/hooks/use-device-control";

// ============================================
// Types
// ============================================

interface DeviceTreeItemProps {
  device: DeviceState;
  onControl: (port: number, action: string, value?: number) => Promise<DeviceControlResult>;
  disabled?: boolean;
}

// ============================================
// Helper Functions
// ============================================

function getDeviceIcon(deviceType: string) {
  switch (deviceType.toLowerCase()) {
    case "fan":
      return Fan;
    case "light":
      return Lightbulb;
    case "outlet":
    case "heater":
    case "cooler":
    case "humidifier":
    case "dehumidifier":
      return Power;
    default:
      return Zap;
  }
}

function getDeviceIconEmoji(deviceType: string): string {
  switch (deviceType.toLowerCase()) {
    case "fan":
      return "🌀";
    case "light":
      return "💡";
    case "outlet":
      return "⚡";
    case "heater":
      return "🔥";
    case "cooler":
      return "❄️";
    case "humidifier":
      return "💨";
    case "dehumidifier":
      return "🌡️";
    default:
      return "⚡";
  }
}

// ============================================
// Component
// ============================================

export function DeviceTreeItem({ device, onControl, disabled }: DeviceTreeItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localLevel, setLocalLevel] = useState(device.level);
  const [localIsOn, setLocalIsOn] = useState(device.isOn);

  const Icon = getDeviceIcon(device.deviceType);
  const emoji = getDeviceIconEmoji(device.deviceType);

  const handleToggle = async (checked: boolean) => {
    if (disabled || isUpdating) return;

    setIsUpdating(true);
    setLocalIsOn(checked);

    const action = checked ? "turn_on" : "turn_off";
    const result = await onControl(device.port, action);

    if (!result.success) {
      // Revert on error
      setLocalIsOn(!checked);
    } else if (result.actualValue !== undefined) {
      setLocalLevel(result.actualValue);
    }

    setIsUpdating(false);
  };

  const handleLevelChange = async (value: number[]) => {
    if (disabled || isUpdating || !device.supportsDimming) return;

    const newLevel = value[0];
    setLocalLevel(newLevel);
  };

  const handleLevelCommit = async (value: number[]) => {
    if (disabled || isUpdating || !device.supportsDimming) return;

    const newLevel = value[0];
    setIsUpdating(true);

    const result = await onControl(device.port, "set_level", newLevel);

    if (!result.success) {
      // Revert on error
      setLocalLevel(device.level);
      setLocalIsOn(device.isOn);
    } else {
      if (result.actualValue !== undefined) {
        setLocalLevel(result.actualValue);
      }
      // Update on/off state based on level
      setLocalIsOn(newLevel > 0);
    }

    setIsUpdating(false);
  };

  // Calculate power bar width
  const powerBarWidth = device.supportsDimming ? localLevel : (localIsOn ? 100 : 0);

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3 px-4 rounded-lg transition-all",
        localIsOn 
          ? "bg-gradient-to-r from-success/10 to-success/5 border border-success/20" 
          : "bg-muted/30 border border-transparent",
        "hover:shadow-sm"
      )}
    >
      {/* Device Icon */}
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
          localIsOn ? "bg-success/20" : "bg-muted"
        )}
      >
        <Icon
          className={cn(
            "w-4 h-4 transition-colors",
            localIsOn ? "text-success" : "text-muted-foreground"
          )}
        />
      </div>

      {/* Device Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium truncate",
            localIsOn ? "text-foreground" : "text-muted-foreground"
          )}>
            {device.name}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 bg-muted/50">
            Port {device.port}
          </Badge>
        </div>

        {/* Power Level Bar - Thicker and more visible */}
        {device.supportsDimming && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  localIsOn ? "bg-gradient-to-r from-success to-green-400" : "bg-muted-foreground/20"
                )}
                style={{ width: `${powerBarWidth}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Speed Display */}
      {device.supportsDimming && (
        <div className={cn(
          "text-sm font-bold tabular-nums w-12 text-right",
          localIsOn ? "text-success" : "text-muted-foreground"
        )}>
          {localLevel}%
        </div>
      )}

      {/* Controls - Single slider when on, toggle always visible */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Dimmer Slider (when on and dimmable) */}
        {device.supportsDimming && localIsOn && (
          <div className="w-24 hidden sm:block">
            <Slider
              value={[localLevel]}
              onValueChange={handleLevelChange}
              onValueCommit={handleLevelCommit}
              min={device.minLevel}
              max={device.maxLevel}
              step={10}
              disabled={disabled || isUpdating}
              className="h-5"
            />
          </div>
        )}

        {/* Loading Indicator */}
        {isUpdating && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}

        {/* Toggle Switch */}
        <Switch
          checked={localIsOn}
          onCheckedChange={handleToggle}
          disabled={disabled || isUpdating}
          className="data-[state=checked]:bg-success"
        />
      </div>
    </div>
  );
}
