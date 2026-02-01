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
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ControllerWithRoom } from "@/types";

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
}: ControllerTreeItemProps) {
  const [sensorData, setSensorData] = useState<LiveSensorData>({
    temperature: null,
    humidity: null,
    vpd: null,
  });
  const [isLoadingSensors, setIsLoadingSensors] = useState(false);
  const [sensorError, setSensorError] = useState<string | null>(null);

  // Track if user has explicitly expanded this controller (vs restored from localStorage)
  const [userExpanded, setUserExpanded] = useState(false);
  const hasLoadedDevices = useRef(false);

  // Only load devices after user explicitly expands, not from localStorage restore
  // This prevents all previously-expanded controllers from fetching at once on page load
  const shouldFetchDevices = isExpanded && (userExpanded || hasLoadedDevices.current);

  const {
    devices,
    isLoading: isLoadingDevices,
    error: devicesError,
    controlDevice,
    refreshDevices,
  } = useDeviceControl(shouldFetchDevices ? controller.id : "");

  // Track when devices have been loaded for this session
  useEffect(() => {
    if (isExpanded && devices.length > 0) {
      hasLoadedDevices.current = true;
    }
  }, [isExpanded, devices.length]);

  const isOnline = controller.status === "online";
  const lastSeenDate = controller.last_seen ? new Date(controller.last_seen) : null;
  const offlineForLong = lastSeenDate
    ? Date.now() - lastSeenDate.getTime() > 24 * 60 * 60 * 1000
    : false;

  // Fetch sensor data
  const fetchSensors = useCallback(async () => {
    setIsLoadingSensors(true);
    setSensorError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/controllers/${controller.id}/sensors?store=false`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();

      if (response.ok && data.success && data.readings) {
        const tempReading = data.readings.find((r: { type: string }) => r.type === "temperature");
        const humidityReading = data.readings.find((r: { type: string }) => r.type === "humidity");
        const vpdReading = data.readings.find((r: { type: string }) => r.type === "vpd");

        setSensorData({
          temperature: tempReading?.value ?? null,
          humidity: humidityReading?.value ?? null,
          vpd: vpdReading?.value ?? null,
        });
      } else {
        setSensorError(data.error || "Failed to fetch sensors");
      }
    } catch (err) {
      setSensorError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsLoadingSensors(false);
    }
  }, [controller.id]);

  // Fetch sensors on mount with staggered delay to avoid rate limits
  useEffect(() => {
    // Stagger initial fetch: 800ms delay per controller index
    const delay = index * 800;
    const timeoutId = setTimeout(() => {
      fetchSensors();
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [fetchSensors, index]);

  const handleRefresh = async () => {
    await fetchSensors();
    if (isExpanded) {
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
      className="border rounded-lg overflow-hidden transition-all"
    >
      {/* Controller Header */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 bg-card",
          isExpanded && "border-b"
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
            isOnline ? "bg-success/10" : "bg-muted"
          )}
        >
          {isOnline ? (
            <Wifi className="w-5 h-5 text-success" />
          ) : (
            <WifiOff className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Controller Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{controller.name}</h3>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                isOnline ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              )}
            >
              {isOnline ? "Online" : "Offline"}
            </Badge>
            {controller.room && (
              <Badge variant="outline" className="text-xs">
                {controller.room.name}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {controller.brand.replace("_", " ")}
            {controller.model && ` • ${controller.model}`}
          </p>
        </div>

        {/* Inline Sensor Readings (collapsed view) */}
        {!isExpanded && hasSensorData && (
          <div className="hidden md:flex items-center gap-4 text-sm flex-shrink-0">
            {sensorData.temperature !== null && (
              <div className="flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-red-500" />
                <span className="tabular-nums">{sensorData.temperature.toFixed(1)}°F</span>
              </div>
            )}
            {sensorData.humidity !== null && (
              <div className="flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-blue-500" />
                <span className="tabular-nums">{sensorData.humidity.toFixed(1)}%</span>
              </div>
            )}
            {sensorData.vpd !== null && (
              <div className="flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-green-500" />
                <span className="tabular-nums">{sensorData.vpd.toFixed(2)} kPa</span>
              </div>
            )}
          </div>
        )}

        {/* Last Seen */}
        <div className="hidden sm:block text-xs text-muted-foreground flex-shrink-0">
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
        <div className="bg-muted/20 px-4 py-3">
          {/* Sensor Readings (expanded view) */}
          {isLoadingSensors && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 pb-3 border-b border-border/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading sensor data...</span>
            </div>
          )}
          {sensorError && !hasSensorData && (
            <div className="mb-4 pb-3 border-b border-border/50">
              <p className="text-sm text-destructive">{sensorError}</p>
            </div>
          )}
          {hasSensorData && (
            <div className="flex items-center gap-6 text-sm mb-4 pb-3 border-b border-border/50">
              {sensorData.temperature !== null && (
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-red-500" />
                  <span className="font-medium tabular-nums">
                    {sensorData.temperature.toFixed(1)}°F
                  </span>
                </div>
              )}
              {sensorData.humidity !== null && (
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <span className="font-medium tabular-nums">
                    {sensorData.humidity.toFixed(1)}%
                  </span>
                </div>
              )}
              {sensorData.vpd !== null && (
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-green-500" />
                  <span className="font-medium tabular-nums">
                    {sensorData.vpd.toFixed(2)} kPa
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Offline Warning */}
          {!isOnline && (controller.last_error || offlineForLong) && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  {controller.last_error ? (
                    <p>{controller.last_error}</p>
                  ) : offlineForLong ? (
                    <p>This controller has been offline for over 24 hours.</p>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Devices Section */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Devices
            </div>

            {isLoadingDevices ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading devices from {controller.brand.replace("_", " ")}...</span>
              </div>
            ) : devicesError ? (
              <div className="text-center py-4">
                <p className="text-sm text-destructive mb-1">{devicesError}</p>
                <p className="text-xs text-muted-foreground">
                  Check Vercel logs for details. Common issues: rate limiting, expired credentials.
                </p>
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No devices found. The controller may be offline or have no connected devices.
              </div>
            ) : (
              <div className="space-y-1">
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

          {/* Footer Info */}
          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>ID: {controller.controller_id}</span>
              <span>Last seen: {formatRelativeTime(controller.last_seen)}</span>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
