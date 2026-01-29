"use client";

import { useState, useCallback } from "react";
import { Plus, Cpu, Wifi, WifiOff, MoreVertical, Trash2, Loader2, AlertTriangle, Home, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { useControllers } from "@/hooks/use-controllers";
import { createClient } from "@/lib/supabase";
import { useRooms } from "@/hooks/use-rooms";
import { AddControllerDialog } from "@/components/controllers/AddControllerDialog";
import { AssignRoomDialog } from "@/components/controllers/AssignRoomDialog";
import { ControllerSensorPreview } from "@/components/controllers/ControllerSensorPreview";
import { ErrorGuidance } from "@/components/ui/error-guidance";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { toast } from "@/hooks/use-toast";
import type { ControllerWithRoom } from "@/types";

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "Never";
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return then.toLocaleDateString();
}

/**
 * Get auth token for API requests
 */
async function getAuthToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Trigger immediate sensor polling for a newly added controller.
 * This ensures sensor data appears immediately without waiting for the cron job.
 */
async function triggerImmediateSensorPoll(controllerId: string): Promise<void> {
  try {
    const token = await getAuthToken();
    const response = await fetch(`/api/controllers/${controllerId}/sensors`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      // Non-critical error - sensor data will be fetched by cron job later
      console.warn(`Failed to fetch initial sensor data for controller ${controllerId}:`, response.status);
    }
  } catch (error) {
    // Non-critical error - log but don't show to user
    console.warn(`Error fetching initial sensor data for controller ${controllerId}:`, error);
  }
}

function ControllerCard({
  controller,
  onDelete,
  onAssignRoom,
  onRefresh,
}: {
  controller: ControllerWithRoom;
  onDelete: (id: string) => void;
  onAssignRoom: (controller: ControllerWithRoom) => void;
  onRefresh: () => void;
}) {
  const [isPolling, setIsPolling] = useState(false);
  const [pollResult, setPollResult] = useState<{ success: boolean; message: string } | null>(null);
  // Key to force ControllerSensorPreview to remount and refetch data after poll
  const [sensorRefreshKey, setSensorRefreshKey] = useState(0);

  // Manual poll handler with detailed feedback
  const handleManualPoll = async () => {
    if (isPolling) return;

    setIsPolling(true);
    setPollResult(null);

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/controllers/${controller.id}/sensors`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json();

      if (response.ok && data.success) {
        // Show detailed info about what was received
        const readings = data.readings || [];
        const readingTypes = readings.map((r: { type: string }) => r.type).join(', ');
        setPollResult({
          success: true,
          message: readings.length > 0
            ? `Got ${readings.length}: ${readingTypes}`
            : 'Poll OK but 0 readings returned'
        });
        // Force ControllerSensorPreview to remount and refetch the new data
        setSensorRefreshKey(prev => prev + 1);
        // Refresh the page data to show new readings
        onRefresh();
      } else {
        setPollResult({
          success: false,
          message: data.error || data.message || `Poll failed: ${JSON.stringify(data).slice(0, 100)}`
        });
      }
    } catch (err) {
      setPollResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network error'
      });
    } finally {
      setIsPolling(false);
      // Clear result after 5 seconds
      setTimeout(() => setPollResult(null), 5000);
    }
  };

  // Check if controller has been offline for a while
  const lastSeenDate = controller.last_seen ? new Date(controller.last_seen) : null;
  const offlineForLong = lastSeenDate
    ? (Date.now() - lastSeenDate.getTime()) > 24 * 60 * 60 * 1000 // > 24 hours
    : false;

  return (
    <div className={cn(
      "bg-card rounded-xl border p-5 hover:shadow-md transition-shadow",
      controller.status !== 'online' && controller.last_error
        ? "border-destructive/30"
        : "border-border"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center",
              controller.status === 'online' ? "bg-success/10" : "bg-muted"
            )}
          >
            {controller.status === 'online' ? (
              <Wifi className="w-6 h-6 text-success" />
            ) : (
              <WifiOff className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{controller.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">{controller.brand.replace("_", " ")}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  controller.status === 'online'
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {controller.status === 'online' ? "Online" : "Offline"}
              </Badge>
              {controller.room && (
                <Badge variant="outline" className="text-xs">
                  {controller.room.name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit</DropdownMenuItem>
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

      {/* Sensor and Device Data Preview */}
      <div className="mt-4">
        <ControllerSensorPreview
          key={sensorRefreshKey}
          controllerId={controller.id}
          compact={true}
          showDevices={true}
        />
      </div>

      {/* Offline warning with troubleshooting hint */}
      {controller.status !== 'online' && (controller.last_error || offlineForLong) && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-300">
              {controller.last_error ? (
                <p>{controller.last_error}</p>
              ) : offlineForLong ? (
                <p>This controller has been offline for over 24 hours.</p>
              ) : null}
              <p className="mt-1 text-amber-600 dark:text-amber-400">
                {controller.brand === "ac_infinity"
                  ? "Check that the controller is powered on and connected to 2.4GHz WiFi."
                  : controller.brand === "inkbird"
                    ? "Verify the device is powered on and connected to WiFi."
                    : "Check the device power and network connection."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
        <div className="flex justify-between items-center">
          <span>ID: {controller.controller_id}</span>
          <div className="flex items-center gap-2">
            <span>Last seen: {formatRelativeTime(controller.last_seen)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={handleManualPoll}
              disabled={isPolling}
              title="Poll sensors now"
            >
              {isPolling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        {/* Poll result feedback */}
        {pollResult && (
          <div className={cn(
            "mt-2 p-2 rounded text-xs",
            pollResult.success
              ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
              : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
          )}>
            {pollResult.success ? "✓" : "✗"} {pollResult.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ControllersPage() {
  const {
    controllers,
    loading,
    error,
    refresh,
    deleteController,
    addController,
    updateController,
    brands,
    rooms,
    fetchRooms,
  } = useControllers();
  const { createRoom } = useRooms();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [controllerToDelete, setControllerToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [controllerToAssign, setControllerToAssign] = useState<ControllerWithRoom | null>(null);

  const handleCreateRoom = async (name: string, description?: string) => {
    const result = await createRoom({ name, description: description || undefined });
    if (result.success && result.data) {
      // Refresh the rooms list in useControllers so the new room appears in dropdowns
      await fetchRooms();
      return { success: true, data: { id: result.data.id, name: result.data.name } };
    }
    return { success: false, error: result.error || "Failed to create room" };
  };

  const handleDelete = async () => {
    if (!controllerToDelete) return;

    setIsDeleting(true);
    const result = await deleteController(controllerToDelete);

    if (result.success) {
      toast({
        title: "Controller removed",
        description: "The controller has been removed successfully.",
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to remove controller",
        variant: "destructive",
      });
    }

    setIsDeleting(false);
    setControllerToDelete(null);
  };

  const handleAssignRoom = async (controllerId: string, roomId: string | null) => {
    const result = await updateController(controllerId, { room_id: roomId });

    if (result.success) {
      toast({
        title: roomId ? "Room assigned" : "Removed from room",
        description: roomId
          ? "The controller has been assigned to the room."
          : "The controller has been removed from its room.",
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to update room assignment",
        variant: "destructive",
      });
    }

    return result;
  };

  return (
    <AppLayout>
      <ErrorBoundary componentName="Controllers" showRetry>
        <div className="min-h-screen">
          <PageHeader
            title="Controllers"
            description="Manage your connected controllers"
            actions={
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Controller
              </Button>
            }
          />

          <div className="p-6 lg:p-8">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="max-w-md mx-auto py-16">
                <ErrorGuidance
                  error={error}
                  context="general"
                  onRetry={refresh}
                  defaultExpanded={true}
                />
              </div>
            ) : controllers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {controllers.map((controller) => (
                  <ControllerCard
                    key={controller.id}
                    controller={controller}
                    onDelete={setControllerToDelete}
                    onAssignRoom={setControllerToAssign}
                    onRefresh={refresh}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Cpu className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No controllers yet
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Get started by adding your first controller
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Controller
                </Button>
              </div>
            )}
          </div>

          {/* Add Controller Dialog */}
          <AddControllerDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            brands={brands}
            rooms={rooms.map(r => ({ id: r.id, name: r.name }))}
            onAdd={async (data) => {
              const result = await addController({
                brand: data.brand,
                name: data.name,
                credentials: data.credentials,
                room_id: data.room_id || undefined,
                // Forward discovered device info - allows API to skip connection test
                discoveredDevice: data.discoveredDevice,
              });
              if (result.success) {
                // Force immediate refresh to prevent flashing
                await refresh();

                // Trigger immediate sensor poll to populate data without waiting for cron job
                if (result.data?.id) {
                  // Fire and forget - don't block on this
                  triggerImmediateSensorPoll(result.data.id).catch(err => {
                    console.warn('Failed to trigger immediate sensor poll:', err);
                  });
                }

                toast({
                  title: "Controller added",
                  description: `${data.name} has been added successfully.`,
                });
              }
              return result;
            }}
            onCreateRoom={handleCreateRoom}
            onAssignControllerToRoom={handleAssignRoom}
          />

          {/* Delete Confirmation Dialog */}
          <AlertDialog
            open={!!controllerToDelete}
            onOpenChange={(open) => !open && setControllerToDelete(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Controller</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove this controller? This action cannot be undone.
                  Any automations using this controller will stop working.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    "Remove"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Assign Room Dialog */}
          <AssignRoomDialog
            open={!!controllerToAssign}
            onOpenChange={(open) => !open && setControllerToAssign(null)}
            controller={controllerToAssign}
            rooms={rooms}
            onAssign={handleAssignRoom}
            onCreateRoom={handleCreateRoom}
          />
        </div>
      </ErrorBoundary>
    </AppLayout>
  );
}
