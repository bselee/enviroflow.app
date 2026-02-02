"use client";

import { useState } from "react";
import { Plus, Cpu, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
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
import { AppLayout } from "@/components/layout/AppLayout";
import { useControllers } from "@/hooks/use-controllers";
import { useLiveSensors } from "@/hooks/use-live-sensors";
import { createClient } from "@/lib/supabase";
import { useRooms } from "@/hooks/use-rooms";
import { AddControllerDialog } from "@/components/controllers/AddControllerDialog";
import { AssignRoomDialog } from "@/components/controllers/AssignRoomDialog";
import { UnifiedControllerTree } from "@/components/controllers/UnifiedControllerTree";
import { ErrorGuidance } from "@/components/ui/error-guidance";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { toast } from "@/hooks/use-toast";
import type { ControllerWithRoom } from "@/types";

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
  
  // Fetch live sensor data from Direct API for real-time readings and port status
  const { sensors: liveSensors, refresh: refreshLiveSensors } = useLiveSensors({
    refreshInterval: 15,
    autoRefresh: true,
  });
  
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
              <UnifiedControllerTree
                controllers={controllers}
                onRefresh={() => { refresh(); refreshLiveSensors(); }}
                onDelete={setControllerToDelete}
                onAssignRoom={setControllerToAssign}
                liveSensors={liveSensors}
              />
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
