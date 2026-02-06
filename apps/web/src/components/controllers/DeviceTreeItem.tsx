"use client";

/**
 * DeviceTreeItem Component
 *
 * Individual device row within a controller's expanded section.
 * Shows device type icon, name, port, power level bar, and inline toggle/dimmer controls.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getPortIconConfig, iconSizes } from "@/config/deviceIcons";
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

/**
 * Get icon configuration for device type using centralized config.
 * Returns icon component, color, and background color.
 */
function getDeviceIconConfig(deviceType: string) {
  return getPortIconConfig(deviceType);
}

// ============================================
// Component
// ============================================

export function DeviceTreeItem({ device, onControl, disabled }: DeviceTreeItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localLevel, setLocalLevel] = useState(device.level);
  const [localIsOn, setLocalIsOn] = useState(device.isOn);

  const iconConfig = getDeviceIconConfig(device.deviceType);
  const Icon = iconConfig.icon;

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
        "flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-200",
        localIsOn
          ? "bg-[rgba(0,230,118,0.08)] dark:bg-[rgba(0,230,118,0.1)] border border-[rgba(0,230,118,0.2)] dark:border-[rgba(0,230,118,0.15)]"
          : "bg-muted/30 dark:bg-[#1e2a3a] border border-transparent dark:border-[rgba(255,255,255,0.04)]",
        "hover:shadow-sm dark:hover:border-[rgba(0,212,255,0.2)]"
      )}
    >
      {/* Device Icon - Color coded per device type */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
        style={{
          backgroundColor: localIsOn ? iconConfig.bg : 'rgba(255,255,255,0.05)',
        }}
      >
        <Icon
          size={iconSizes.portTile}
          style={{
            color: localIsOn ? iconConfig.color : '#4a5568',
          }}
          className="transition-colors"
        />
      </div>

      {/* Device Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium truncate",
            localIsOn ? "text-foreground dark:text-[#e8edf4]" : "text-muted-foreground dark:text-[#8896a8]"
          )}>
            {device.name}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 bg-muted/50 dark:bg-[rgba(255,255,255,0.06)] dark:text-[#4a5568]">
            Port {device.port}
          </Badge>
        </div>

        {/* Power Level Bar - Thicker and more visible */}
        {device.supportsDimming && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted dark:bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  localIsOn
                    ? "bg-gradient-to-r from-[#00e676] to-[#00d4ff]"
                    : "bg-muted-foreground/20 dark:bg-[rgba(255,255,255,0.1)]"
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
          "font-mono text-[16px] font-bold tabular-nums w-12 text-right",
          localIsOn ? "text-[#00d4ff]" : "text-muted-foreground dark:text-[#4a5568]"
        )}>
          {localIsOn ? Math.round(localLevel / 10) : 0}
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
              className="h-5 [&_[role=slider]]:bg-[#00d4ff] [&_[role=slider]]:border-[#00d4ff] [&_.range]:bg-[#00d4ff]"
            />
          </div>
        )}

        {/* Loading Indicator */}
        {isUpdating && (
          <Loader2 className="w-4 h-4 animate-spin text-[#00d4ff]" />
        )}

        {/* Toggle Switch */}
        <Switch
          checked={localIsOn}
          onCheckedChange={handleToggle}
          disabled={disabled || isUpdating}
          className="data-[state=checked]:bg-[#00e676]"
        />
      </div>
    </div>
  );
}
