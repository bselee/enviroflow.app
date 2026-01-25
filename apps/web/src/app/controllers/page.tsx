"use client";

import { useState } from "react";
import { Plus, Cpu, Wifi, WifiOff, MoreVertical, Trash2, Loader2, AlertTriangle, Home, Settings, Activity, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { useControllers } from "@/hooks/use-controllers";
import { useRooms } from "@/hooks/use-rooms";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { AddControllerDialog } from "@/components/controllers/AddControllerDialog";
import { AssignRoomDialog } from "@/components/controllers/AssignRoomDialog";
import { ControllerDevicesPanel } from "@/components/controllers/ControllerDevicesPanel";
import { ControllerStatusIndicator, getConnectionHealth } from "@/components/controllers/ControllerStatusIndicator";
import { ControllerDiagnosticsPanel } from "@/components/controllers/ControllerDiagnosticsPanel";
import { BulkActionBar } from "@/components/controllers/BulkActionBar";
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

function ControllerCard({
  controller,
  onDelete,
  onAssignRoom,
  onViewDevices,
  onViewDiagnostics,
  isSelected = false,
  onToggleSelect,
  showCheckbox = false,
}: {
  controller: ControllerWithRoom;
  onDelete: (id: string) => void;
  onAssignRoom: (controller: ControllerWithRoom) => void;
  onViewDevices: (controller: ControllerWithRoom) => void;
  onViewDiagnostics: (controller: ControllerWithRoom) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string, event?: React.MouseEvent) => void;
  showCheckbox?: boolean;
}) {
  // Get connection health for UI decisions
  const health = getConnectionHealth(controller.status, controller.last_seen);
  const hasIssue = health !== "online" && (controller.last_error || health === "offline");

  const handleCardClick = (e: React.MouseEvent) => {
    // Only handle clicks on the card itself, not on buttons/dropdowns
    if (
      showCheckbox &&
      onToggleSelect &&
      e.target === e.currentTarget
    ) {
      onToggleSelect(controller.id, e);
    }
  };

  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-5 transition-all relative",
        hasIssue ? "border-destructive/30" : "border-border",
        showCheckbox && "cursor-pointer hover:shadow-md",
        isSelected && "ring-2 ring-primary border-primary bg-primary/5"
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Checkbox for bulk selection */}
          {showCheckbox && onToggleSelect && (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(controller.id)}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                aria-label={`Select ${controller.name}`}
              />
            </div>
          )}
          <div
            className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center",
              health === "online" ? "bg-success/10" : "bg-muted"
            )}
          >
            {health === "online" ? (
              <Wifi className="w-6 h-6 text-success" />
            ) : (
              <WifiOff className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{controller.name}</h3>
              <ControllerStatusIndicator
                controller={controller}
                size="sm"
                onClick={() => onViewDiagnostics(controller)}
              />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground capitalize">
                {controller.brand.replace("_", " ")}
              </p>
              {controller.model && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <p className="text-sm font-medium text-foreground">
                    {controller.model}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {controller.room && (
                <Badge variant="outline" className="text-xs">
                  {controller.room.name}
                </Badge>
              )}
              {controller.firmware_version && (
                <Badge variant="secondary" className="text-xs">
                  FW: {controller.firmware_version}
                </Badge>
              )}
              {controller.capabilities?.devices && controller.capabilities.devices.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {controller.capabilities.devices.length} device{controller.capabilities.devices.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {/* Device Information Section */}
            <DropdownMenuLabel className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Device Information
            </DropdownMenuLabel>
            <div className="px-2 py-1.5 text-xs text-muted-foreground space-y-1">
              {controller.model && (
                <div className="flex justify-between">
                  <span>Model:</span>
                  <span className="font-medium text-foreground">{controller.model}</span>
                </div>
              )}
              {controller.firmware_version && (
                <div className="flex justify-between">
                  <span>Firmware:</span>
                  <span className="font-medium text-foreground">{controller.firmware_version}</span>
                </div>
              )}
              {controller.capabilities?.devices && (
                <div className="flex justify-between">
                  <span>Device Types:</span>
                  <span className="font-medium text-foreground">{controller.capabilities.devices.length}</span>
                </div>
              )}
              {controller.capabilities?.sensors && (
                <div className="flex justify-between">
                  <span>Sensor Types:</span>
                  <span className="font-medium text-foreground">{controller.capabilities.sensors.length}</span>
                </div>
              )}
            </div>

            <DropdownMenuSeparator />

            {/* Connection Details Section */}
            <DropdownMenuLabel className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Connection Status
            </DropdownMenuLabel>
            <div className="px-2 py-1.5 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between items-center">
                <span>Status:</span>
                <Badge
                  variant={health === "online" ? "default" : "destructive"}
                  className="text-xs h-5"
                >
                  {controller.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Last Seen:</span>
                <span className="font-medium text-foreground">{formatRelativeTime(controller.last_seen)}</span>
              </div>
              {controller.last_error && (
                <div className="pt-1 mt-1 border-t">
                  <div className="text-destructive text-xs line-clamp-2">
                    {controller.last_error}
                  </div>
                </div>
              )}
            </div>

            <DropdownMenuSeparator />

            {/* Actions Section */}
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onViewDiagnostics(controller)}>
              <Activity className="h-4 w-4 mr-2" />
              View Diagnostics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewDevices(controller)}>
              <Settings className="h-4 w-4 mr-2" />
              Control Devices
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAssignRoom(controller)}>
              <Home className="h-4 w-4 mr-2" />
              Assign to Room
            </DropdownMenuItem>

            <DropdownMenuSeparator />

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

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onViewDiagnostics(controller);
            }}
            className="w-full"
          >
            <Activity className="w-4 h-4 mr-2" />
            Diagnostics
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onViewDevices(controller);
            }}
            className="w-full"
            disabled={controller.brand === 'csv_upload'}
          >
            <Settings className="w-4 h-4 mr-2" />
            Control
          </Button>
        </div>
      </div>

      {/* Status warning - click to view diagnostics */}
      {hasIssue && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDiagnostics(controller);
          }}
          className="mt-3 w-full p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors text-left"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-300 flex-1">
              {controller.last_error ? (
                <p>{controller.last_error}</p>
              ) : health === "offline" ? (
                <p>Controller is offline or unreachable.</p>
              ) : (
                <p>Controller has not reported in over 1 hour.</p>
              )}
              <p className="mt-1 text-amber-600 dark:text-amber-400 font-medium">
                Click to view diagnostics and troubleshooting steps
              </p>
            </div>
          </div>
        </button>
      )}

      <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
        <div className="flex justify-between items-center">
          <span className="truncate">ID: {controller.controller_id}</span>
          <span className="ml-2 flex-shrink-0">
            {formatRelativeTime(controller.last_seen)}
          </span>
        </div>
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
    testConnection,
    brands,
    rooms,
  } = useControllers();

  // Use the rooms hook for room creation
  const { createRoom: createRoomFromHook } = useRooms();

  // Bulk selection state
  const {
    selectedCount,
    isSelected,
    isAllSelected,
    isIndeterminate,
    toggleItem,
    selectAll,
    clearSelection,
    getSelectedItems,
  } = useBulkSelection({
    items: controllers,
    getKey: (controller) => controller.id,
  });

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [controllerToDelete, setControllerToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [controllerToAssign, setControllerToAssign] = useState<ControllerWithRoom | null>(null);
  const [controllerToViewDevices, setControllerToViewDevices] = useState<ControllerWithRoom | null>(null);
  const [controllerToViewDiagnostics, setControllerToViewDiagnostics] = useState<ControllerWithRoom | null>(null);
  const [bulkAssignControllers, setBulkAssignControllers] = useState<ControllerWithRoom[]>([]);
  const [bulkModeEnabled, setBulkModeEnabled] = useState(false);

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

  // Bulk operations are now handled by BulkActionBar modals
  // (BulkAssignModal, BulkTestModal, BulkDeleteModal)

  // Toggle bulk mode on mobile
  const toggleBulkMode = () => {
    if (bulkModeEnabled) {
      clearSelection();
    }
    setBulkModeEnabled(!bulkModeEnabled);
  };

  // Desktop: always show checkboxes when there are controllers
  // Mobile: only show when bulk mode is enabled
  const showCheckboxes = controllers.length > 0 && (bulkModeEnabled || selectedCount > 0);

  return (
    <AppLayout>
      <ErrorBoundary componentName="Controllers" showRetry>
      <div className="min-h-screen">
        <PageHeader
          title="Controllers"
          description="Manage your connected controllers"
          actions={
            <div className="flex items-center gap-2">
              {/* Mobile: Bulk mode toggle */}
              {controllers.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleBulkMode}
                  className="sm:hidden"
                >
                  {bulkModeEnabled ? "Cancel" : "Select"}
                </Button>
              )}
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Controller
              </Button>
            </div>
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
            <>
              {/* Select All checkbox - Desktop only */}
              {showCheckboxes && (
                <div className="hidden sm:flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg border">
                  <Checkbox
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) {
                        // Set indeterminate state
                        el.setAttribute(
                          "data-state",
                          isIndeterminate ? "indeterminate" : isAllSelected ? "checked" : "unchecked"
                        );
                      }
                    }}
                    onCheckedChange={() => {
                      if (isAllSelected || isIndeterminate) {
                        clearSelection();
                      } else {
                        selectAll();
                      }
                    }}
                    aria-label="Select all controllers"
                  />
                  <span className="text-sm font-medium">
                    {isAllSelected
                      ? `All ${controllers.length} controllers selected`
                      : isIndeterminate
                        ? `${selectedCount} of ${controllers.length} selected`
                        : "Select all controllers"}
                  </span>
                  {selectedCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="ml-auto text-xs"
                    >
                      Clear selection
                    </Button>
                  )}
                </div>
              )}

              {/* Controllers grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {controllers.map((controller) => (
                  <ControllerCard
                    key={controller.id}
                    controller={controller}
                    onDelete={setControllerToDelete}
                    onAssignRoom={setControllerToAssign}
                    onViewDevices={setControllerToViewDevices}
                    onViewDiagnostics={setControllerToViewDiagnostics}
                    isSelected={isSelected(controller.id)}
                    onToggleSelect={toggleItem}
                    showCheckbox={showCheckboxes}
                  />
                ))}
              </div>

              {/* Bulk action bar */}
              <BulkActionBar
                selectedCount={selectedCount}
                totalCount={controllers.length}
                selectedControllers={getSelectedItems()}
                rooms={rooms}
                onClearSelection={clearSelection}
                onSuccess={refresh}
                onCreateRoom={async (name: string) => {
                  const result = await createRoomFromHook({ name });
                  if (result.success && result.data) {
                    return {
                      success: true,
                      data: { id: result.data.id, name: result.data.name },
                    };
                  }
                  return { success: false, error: result.error || "Failed to create room" };
                }}
              />
            </>
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
              toast({
                title: "Controller added",
                description: `${data.name} has been added successfully.`,
              });
            }
            return result;
          }}
          onCreateRoom={async (name: string) => {
            const result = await createRoomFromHook({ name });
            if (result.success && result.data) {
              toast({
                title: "Room created",
                description: `${name} has been created successfully.`,
              });
              return {
                success: true,
                data: { id: result.data.id, name: result.data.name },
              };
            }
            return { success: false, error: result.error || "Failed to create room" };
          }}
          onAssignControllerToRoom={async (controllerId: string, roomId: string) => {
            return await handleAssignRoom(controllerId, roomId);
          }}
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

        {/* Assign Room Dialog - Single controller */}
        <AssignRoomDialog
          open={!!controllerToAssign}
          onOpenChange={(open) => !open && setControllerToAssign(null)}
          controller={controllerToAssign}
          rooms={rooms}
          onAssign={handleAssignRoom}
          onCreateRoom={async (name: string) => {
            const result = await createRoomFromHook({ name });
            if (result.success && result.data) {
              return {
                success: true,
                data: { id: result.data.id, name: result.data.name },
              };
            }
            return { success: false, error: result.error || "Failed to create room" };
          }}
        />

        {/* Assign Room Dialog - Bulk mode */}
        <AssignRoomDialog
          open={bulkAssignControllers.length > 0}
          onOpenChange={(open) => !open && setBulkAssignControllers([])}
          controllers={bulkAssignControllers}
          rooms={rooms}
          onAssign={handleAssignRoom}
          onCreateRoom={async (name: string) => {
            const result = await createRoomFromHook({ name });
            if (result.success && result.data) {
              return {
                success: true,
                data: { id: result.data.id, name: result.data.name },
              };
            }
            return { success: false, error: result.error || "Failed to create room" };
          }}
          isBulkMode={true}
        />

        {/* View Devices Dialog */}
        <Dialog
          open={!!controllerToViewDevices}
          onOpenChange={(open) => !open && setControllerToViewDevices(null)}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Control Devices</DialogTitle>
              <DialogDescription>
                View and control devices connected to this controller
              </DialogDescription>
            </DialogHeader>
            {controllerToViewDevices && (
              <ControllerDevicesPanel
                controllerId={controllerToViewDevices.id}
                controllerName={controllerToViewDevices.name}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Diagnostics Dialog */}
        {controllerToViewDiagnostics && (
          <ControllerDiagnosticsPanel
            controller={controllerToViewDiagnostics}
            open={!!controllerToViewDiagnostics}
            onOpenChange={(open) => !open && setControllerToViewDiagnostics(null)}
            onRefresh={refresh}
            onTestConnection={async (controllerId: string) => {
              await testConnection(controllerId);
            }}
          />
        )}
      </div>
      </ErrorBoundary>
    </AppLayout>
  );
}
