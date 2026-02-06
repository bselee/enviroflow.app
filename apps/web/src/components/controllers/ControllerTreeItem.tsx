"use client";

/**
 * ControllerTreeItem Component
 *
 * A collapsible controller row in the unified tree view.
 * Shows controller header with name, brand, status, inline sensor readings.
 * Expands to show connected devices with inline controls.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Wifi,
  WifiOff,
  MoreVertical,
  Trash2,
  Home,
  Edit,
  Thermometer,
  Droplets,
  Gauge,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DeviceTreeItem } from "./DeviceTreeItem";
import { useDeviceControl } from "@/hooks/use-device-control";
import { useSensorReadings } from "@/hooks/use-sensor-readings";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { formatTemperature } from "@/lib/temperature-utils";
import { cn } from "@/lib/utils";
import type { ControllerWithRoom, LiveSensor } from "@/types";

// ============================================
// Types
// ============================================

interface ControllerTreeItemProps {
  controller: ControllerWithRoom;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
  onDelete: (id: string) => void;
  onAssignRoom: (controller: ControllerWithRoom) => void;
  onRefresh: () => void;
  /** Index for staggering initial data fetch to avoid rate limits */
  index?: number;
  /** Live sensor data from Direct API (includes ports) */
  liveSensor?: LiveSensor;
}

interface LiveSensorData {
  temperature: number | null;
  humidity: number | null;
  vpd: number | null;
}

// ============================================
// Helper Functions
// ============================================

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "Never";
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

// ============================================
// Component
// ============================================

export function ControllerTreeItem({
  controller,
  isExpanded,
  onToggleExpanded,
  onDelete,
  onAssignRoom,
  onRefresh,
  index = 0,
  liveSensor,
}: ControllerTreeItemProps) {
  // Get user preferences for temperature unit
  const { preferences } = useUserPreferences();
  const tempUnit = preferences.temperatureUnit;
  
  // Use the sensor readings hook - reads from database, gets realtime updates
  // No API calls to AC Infinity - data is populated by cron job
  const {
    isLoading: isLoadingSensors,
    error: sensorError,
    getLatestForController,
    refetch: refetchSensors,
  } = useSensorReadings({
    controllerIds: [controller.id],
    timeRangeHours: 1, // Only need recent data
    limit: 10,
    enableRealtime: true, // Get live updates when cron stores new readings
  });

  // Get the latest sensor values from the database
  const latestSensors = getLatestForController(controller.id);
  const sensorData: LiveSensorData = {
    temperature: latestSensors.temperature?.value ?? null,
    humidity: latestSensors.humidity?.value ?? null,
    vpd: latestSensors.vpd?.value ?? null,
  };

  // Get live ports from Direct API (much faster than adapter fetch)
  const livePorts = liveSensor?.ports || [];
  const hasLivePorts = livePorts.length > 0;

  // Track if user has explicitly expanded this controller (vs restored from localStorage)
  const [userExpanded, setUserExpanded] = useState(false);
  const hasLoadedDevices = useRef(false);

  // Fetch from adapter API when expanded AND we don't have live ports
  // Simplified logic: always fetch if expanded and no live ports available
  const shouldFetchDevices = isExpanded && !hasLivePorts;

  const {
    devices: adapterDevices,
    isLoading: isLoadingDevices,
    error: devicesError,
    controlDevice,
    refreshDevices,
  } = useDeviceControl(shouldFetchDevices ? controller.id : "");

  // Use live ports if available, otherwise fall back to adapter devices
  const devices = hasLivePorts 
    ? livePorts.map(port => ({
        port: port.portId,
        deviceType: 'device',
        name: port.name,
        isOn: port.isOn,
        level: port.speed, // Already 0-100
        supportsDimming: true,
        minLevel: 0,
        maxLevel: 100,
      }))
    : adapterDevices;

  // Track when devices have been loaded for this session
  useEffect(() => {
    if (isExpanded && devices.length > 0) {
      hasLoadedDevices.current = true;
    }
  }, [isExpanded, devices.length]);

  const isOnline = liveSensor?.online ?? (controller.status === "online");
  const lastSeenDate = controller.last_seen ? new Date(controller.last_seen) : null;
  const offlineForLong = lastSeenDate
    ? Date.now() - lastSeenDate.getTime() > 24 * 60 * 60 * 1000
    : false;

  // No need for manual fetch - useSensorReadings handles it
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _index = index; // Keep prop for interface compatibility but no longer used for staggering

  const handleRefresh = async () => {
    // Refetch sensor data from database
    await refetchSensors();
    if (isExpanded && !hasLivePorts) {
      await refreshDevices();
    }
    onRefresh();
  };

  const hasSensorData =
    sensorData.temperature !== null ||
    sensorData.humidity !== null ||
    sensorData.vpd !== null;

  // Handle user-initiated expansion (not from localStorage restore)
  const handleToggle = useCallback(() => {
    if (!isExpanded) {
      // User is expanding - mark as user-initiated
      setUserExpanded(true);
    }
    onToggleExpanded(controller.id);
  }, [isExpanded, onToggleExpanded, controller.id]);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={handleToggle}
      className="bg-card dark:bg-[#151c26] rounded-2xl border border-border dark:border-[rgba(255,255,255,0.06)] overflow-hidden transition-all duration-200 hover:border-border/80 dark:hover:border-[rgba(0,212,255,0.3)] hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(0,212,255,0.1)]"
    >
      {/* Controller Header */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 bg-card dark:bg-[#151c26]",
          isExpanded && "border-b border-border dark:border-[rgba(255,255,255,0.06)]"
        )}
      >
        {/* Expand/Collapse Button */}
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        {/* Status Icon */}
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            isOnline
              ? "bg-[rgba(0,230,118,0.1)] dark:bg-[rgba(0,230,118,0.1)]"
              : "bg-muted dark:bg-[#1e2a3a]"
          )}
        >
          {isOnline ? (
            <Wifi className="w-5 h-5 text-[#00e676]" />
          ) : (
            <WifiOff className="w-5 h-5 text-muted-foreground dark:text-[#4a5568]" />
          )}
        </div>

        {/* Controller Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground dark:text-[#e8edf4] truncate">{controller.name}</h3>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                isOnline
                  ? "bg-[rgba(0,230,118,0.1)] text-[#00e676] border-none"
                  : "bg-muted dark:bg-[#1e2a3a] text-muted-foreground dark:text-[#4a5568]"
              )}
            >
              {isOnline ? "Online" : "Offline"}
            </Badge>
            {controller.room && (
              <Badge variant="outline" className="text-xs dark:border-[rgba(255,255,255,0.1)] dark:text-[#8896a8]">
                {controller.room.name}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground dark:text-[#4a5568] capitalize mt-0.5">
            {controller.brand.replace("_", " ")}
            {controller.model && ` • ${controller.model}`}
          </p>
        </div>

        {/* Inline Sensor Readings - Show live data from Direct API, fallback to database */}
        {!isExpanded && (liveSensor || hasSensorData) && (
          <div className="hidden md:flex items-center gap-3 text-sm flex-shrink-0">
            {(liveSensor?.temperature ?? sensorData.temperature) !== null && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 dark:bg-[rgba(255,82,82,0.1)]">
                <Thermometer className="w-3.5 h-3.5 text-red-500 dark:text-[#ff5252]" />
                <span className="tabular-nums font-medium text-red-600 dark:text-red-400">
                  {formatTemperature(liveSensor?.temperature ?? sensorData.temperature, tempUnit)}
                </span>
              </div>
            )}
            {(liveSensor?.humidity ?? sensorData.humidity) !== null && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 dark:bg-[rgba(0,212,255,0.1)]">
                <Droplets className="w-3.5 h-3.5 text-blue-500 dark:text-[#00d4ff]" />
                <span className="tabular-nums font-medium text-blue-600 dark:text-[#00d4ff]">
                  {(liveSensor?.humidity ?? sensorData.humidity)?.toFixed(1)}%
                </span>
              </div>
            )}
            {(liveSensor?.vpd ?? sensorData.vpd) !== null && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[rgba(179,136,255,0.1)]">
                <Gauge className="w-3.5 h-3.5 text-[#b388ff]" />
                <span className="tabular-nums font-medium text-[#b388ff]">
                  {(liveSensor?.vpd ?? sensorData.vpd)?.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Last Seen */}
        <div className="hidden sm:block text-xs text-muted-foreground dark:text-[#4a5568] flex-shrink-0">
          {formatRelativeTime(controller.last_seen)}
        </div>

        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            handleRefresh();
          }}
          disabled={isLoadingSensors}
        >
          <RefreshCw
            className={cn("h-4 w-4", isLoadingSensors && "animate-spin")}
          />
        </Button>

        {/* Action Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAssignRoom(controller)}>
              <Home className="h-4 w-4 mr-2" />
              Assign to Room
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(controller.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Expanded Content */}
      <CollapsibleContent>
        <div className="bg-muted/10 dark:bg-[#1e2a3a] px-4 py-4">
          {/* Live Sensor Data Section */}
          {(liveSensor || hasSensorData) && (
            <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b border-border/50 dark:border-[rgba(255,255,255,0.06)]">
              {(liveSensor?.temperature ?? sensorData.temperature) !== null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 dark:bg-[rgba(255,82,82,0.1)]">
                  <Thermometer className="w-5 h-5 text-red-500 dark:text-[#ff5252]" />
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                      {formatTemperature(liveSensor?.temperature ?? sensorData.temperature, tempUnit)}
                    </span>
                    <p className="text-[10px] text-muted-foreground dark:text-[#4a5568] uppercase tracking-[1px]">Temperature</p>
                  </div>
                </div>
              )}
              {(liveSensor?.humidity ?? sensorData.humidity) !== null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 dark:bg-[rgba(0,212,255,0.1)]">
                  <Droplets className="w-5 h-5 text-blue-500 dark:text-[#00d4ff]" />
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums text-blue-600 dark:text-[#00d4ff]">
                      {(liveSensor?.humidity ?? sensorData.humidity)?.toFixed(1)}%
                    </span>
                    <p className="text-[10px] text-muted-foreground dark:text-[#4a5568] uppercase tracking-[1px]">Humidity</p>
                  </div>
                </div>
              )}
              {(liveSensor?.vpd ?? sensorData.vpd) !== null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(179,136,255,0.1)]">
                  <Gauge className="w-5 h-5 text-[#b388ff]" />
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums text-[#b388ff]">
                      {(liveSensor?.vpd ?? sensorData.vpd)?.toFixed(2)}
                    </span>
                    <p className="text-[10px] text-muted-foreground dark:text-[#4a5568] uppercase tracking-[1px]">VPD (kPa)</p>
                  </div>
                </div>
              )}
              {liveSensor && (
                <Badge variant="outline" className="text-[10px] text-[#00e676] border-[#00e676]/30 dark:bg-[rgba(0,230,118,0.1)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] mr-1.5 shadow-[0_0_4px_rgba(0,230,118,0.5)]"></span>
                  Live
                </Badge>
              )}
            </div>
          )}

          {/* Offline Warning */}
          {!isOnline && (controller.last_error || offlineForLong) && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-[rgba(255,145,0,0.1)] rounded-lg border border-amber-200 dark:border-[rgba(255,145,0,0.3)]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-[#ff9100] mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700 dark:text-[#ff9100]">
                  {controller.last_error ? (
                    <p>{controller.last_error}</p>
                  ) : offlineForLong ? (
                    <p>This controller has been offline for over 24 hours.</p>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Devices/Ports Section */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-foreground dark:text-[#8896a8] uppercase tracking-[1.5px] mb-3">
              Ports {hasLivePorts && <Badge variant="outline" className="text-[10px] text-[#00e676] border-[#00e676]/30 dark:bg-[rgba(0,230,118,0.1)] ml-1 normal-case tracking-normal">Live</Badge>}
            </div>

            {isLoadingDevices && !hasLivePorts ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground dark:text-[#00d4ff]" />
                <span className="ml-2 text-sm text-muted-foreground dark:text-[#8896a8]">Loading devices from {controller.brand.replace("_", " ")}...</span>
              </div>
            ) : devicesError && !hasLivePorts ? (
              <div className="text-center py-4">
                <p className="text-sm text-destructive dark:text-[#ff5252] mb-1">{devicesError}</p>
                <p className="text-xs text-muted-foreground dark:text-[#4a5568]">
                  Check Vercel logs for details. Common issues: rate limiting, expired credentials.
                </p>
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground dark:text-[#4a5568]">
                No devices found. The controller may be offline or have no connected devices.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {devices.map((device) => (
                  <DeviceTreeItem
                    key={device.port}
                    device={device}
                    onControl={controlDevice}
                    disabled={!isOnline}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer Info - Cleaner display */}
          <div className="mt-4 pt-3 border-t border-border/50 dark:border-[rgba(255,255,255,0.06)] text-[10px] text-muted-foreground/70 dark:text-[#4a5568]">
            <div className="flex justify-between items-center">
              <span className="font-mono">ID: {controller.controller_id.slice(0, 8)}...</span>
              {liveSensor ? (
                <span className="text-[#00e676]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00e676] mr-1 shadow-[0_0_4px_rgba(0,230,118,0.5)]"></span>
                  Live • Updated {formatRelativeTime(liveSensor.lastUpdate)}
                </span>
              ) : (
                <span>Last seen: {formatRelativeTime(controller.last_seen)}</span>
              )}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
