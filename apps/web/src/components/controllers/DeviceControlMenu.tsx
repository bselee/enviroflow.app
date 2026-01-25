"use client";

import React, { useState } from "react";
import { MoreVertical, Power, PowerOff, Sliders, BarChart3 } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useDeviceControl, type DeviceState } from "@/hooks/use-device-control";
import { cn } from "@/lib/utils";

/**
 * Props interface for DeviceControlMenu component
 */
export interface DeviceControlMenuProps {
  /** Controller ID that owns this device */
  controllerId: string;
  /** Device state information */
  device: DeviceState;
  /** Optional callback when a command succeeds */
  onCommandSuccess?: () => void;
  /** Optional custom className for the trigger button */
  className?: string;
}

/**
 * Device Control Dropdown Menu Component
 *
 * Provides a three-dot menu with device control options:
 * - Turn On/Off commands
 * - Set Level (for dimmable devices)
 * - View History analytics link
 *
 * Integrates with useDeviceControl hook for command execution
 * and shows loading states and toast notifications.
 */
export function DeviceControlMenu({
  controllerId,
  device,
  onCommandSuccess,
  className,
}: DeviceControlMenuProps) {
  const { controlDevice } = useDeviceControl(controllerId);
  const { toast } = useToast();

  // State for dimmer dialog
  const [isDimmerDialogOpen, setIsDimmerDialogOpen] = useState(false);
  const [targetLevel, setTargetLevel] = useState<number>(device.level);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Update target level when device level changes
  React.useEffect(() => {
    setTargetLevel(device.level);
  }, [device.level]);

  /**
   * Execute a device control command with error handling
   */
  const executeCommand = async (action: string, value?: number) => {
    setIsExecutingCommand(true);

    try {
      const result = await controlDevice(device.port, action, value);

      if (result.success) {
        toast({
          title: "Command successful",
          description: `${device.name} ${action === "turn_on" ? "turned on" : action === "turn_off" ? "turned off" : `set to ${value}%`}`,
        });
        onCommandSuccess?.();
      } else {
        toast({
          variant: "destructive",
          title: "Command failed",
          description: result.error || "Failed to control device",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Command failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsExecutingCommand(false);
    }
  };

  /**
   * Handle turn on command
   */
  const handleTurnOn = async () => {
    await executeCommand("turn_on");
  };

  /**
   * Handle turn off command
   */
  const handleTurnOff = async () => {
    await executeCommand("turn_off");
  };

  /**
   * Handle set level command from dialog
   */
  const handleSetLevel = async () => {
    await executeCommand("set_level", targetLevel);
    setIsDimmerDialogOpen(false);
  };

  /**
   * Open dimmer dialog and initialize with current level
   */
  const handleOpenDimmerDialog = () => {
    setTargetLevel(device.level);
    setIsDimmerDialogOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", className)}
            disabled={isExecutingCommand}
            aria-label={`Control ${device.name}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={handleTurnOn}
            disabled={isExecutingCommand || device.isOn}
          >
            <Power className="mr-2 h-4 w-4" />
            <span>Turn On</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleTurnOff}
            disabled={isExecutingCommand || !device.isOn}
          >
            <PowerOff className="mr-2 h-4 w-4" />
            <span>Turn Off</span>
          </DropdownMenuItem>

          {device.supportsDimming && (
            <DropdownMenuItem
              onClick={handleOpenDimmerDialog}
              disabled={isExecutingCommand}
            >
              <Sliders className="mr-2 h-4 w-4" />
              <span>Set Level...</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href={`/dashboard/analytics?controller=${controllerId}&device=${device.port}`}>
              <BarChart3 className="mr-2 h-4 w-4" />
              <span>View History</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dimmer Level Dialog */}
      <Dialog open={isDimmerDialogOpen} onOpenChange={setIsDimmerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Device Level</DialogTitle>
            <DialogDescription>
              Adjust the intensity level for {device.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current value display */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Level</span>
              <span className="text-2xl font-bold">{targetLevel}%</span>
            </div>

            {/* Slider control */}
            <Slider
              value={[targetLevel]}
              onValueChange={(value) => setTargetLevel(value[0])}
              min={device.minLevel}
              max={device.maxLevel}
              step={1}
              className="w-full"
              disabled={isExecutingCommand}
            />

            {/* Min/Max labels */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Min: {device.minLevel}%</span>
              <span>Max: {device.maxLevel}%</span>
            </div>

            {/* Current device state */}
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current level:</span>
                <span className="font-medium">{device.level}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium">{device.isOn ? "On" : "Off"}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDimmerDialogOpen(false)}
              disabled={isExecutingCommand}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetLevel}
              disabled={isExecutingCommand || targetLevel === device.level}
            >
              {isExecutingCommand ? "Setting..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
