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
        "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
        localIsOn ? "bg-success/5" : "bg-muted/30",
        "hover:bg-muted/50"
      )}
    >
      {/* Device Icon */}
      <div
        className={cn(
          "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
          localIsOn ? "bg-success/10" : "bg-muted"
        )}
      >
        <Icon
          className={cn(
            "w-4 h-4",
            localIsOn ? "text-success" : "text-muted-foreground"
          )}
        />
      </div>

      {/* Device Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{device.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
            Port {device.port}
          </Badge>
        </div>

        {/* Power Level Bar */}
        {device.supportsDimming && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  localIsOn ? "bg-success" : "bg-muted-foreground/30"
                )}
                style={{ width: `${powerBarWidth}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">
              {localLevel}%
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Dimmer Slider (only when expanded/dimmable) */}
        {device.supportsDimming && localIsOn && (
          <div className="w-20 hidden sm:block">
            <Slider
              value={[localLevel]}
              onValueChange={handleLevelChange}
              onValueCommit={handleLevelCommit}
              min={device.minLevel}
              max={device.maxLevel}
              step={10}
              disabled={disabled || isUpdating}
              className="h-4"
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
