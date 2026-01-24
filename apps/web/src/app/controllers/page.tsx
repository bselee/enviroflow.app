"use client";

import { useState } from "react";
import { Plus, Cpu, Wifi, WifiOff, MoreVertical, Trash2, Loader2, AlertTriangle, Home } from "lucide-react";
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
import { useRooms } from "@/hooks/use-rooms";
import { AddControllerDialog } from "@/components/controllers/AddControllerDialog";
import { AssignRoomDialog } from "@/components/controllers/AssignRoomDialog";
import { ErrorGuidance } from "@/components/ui/error-guidance";
import { toast } from "@/hooks/use-toast";
import type { ControllerWithRoom, ControllerBrand } from "@/types";

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
}: {
  controller: ControllerWithRoom;
  onDelete: (id: string) => void;
  onAssignRoom: (controller: ControllerWithRoom) => void;
}) {
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
        <div className="flex justify-between">
          <span>ID: {controller.controller_id}</span>
          <span>Last seen: {formatRelativeTime(controller.last_seen)}</span>
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
    brands,
    rooms,
  } = useControllers();

  // Use the rooms hook for room creation
  const { createRoom: createRoomFromHook } = useRooms();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [controllerToDelete, setControllerToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [controllerToAssign, setControllerToAssign] = useState<ControllerWithRoom | null>(null);

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

        {/* Assign Room Dialog */}
        <AssignRoomDialog
          open={!!controllerToAssign}
          onOpenChange={(open) => !open && setControllerToAssign(null)}
          controller={controllerToAssign}
          rooms={rooms}
          onAssign={handleAssignRoom}
        />
      </div>
    </AppLayout>
  );
}
