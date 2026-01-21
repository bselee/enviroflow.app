"use client";

import { useState } from "react";
import { Plus, Cpu, Wifi, WifiOff, MoreVertical, Trash2, Loader2 } from "lucide-react";
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
import { AddControllerDialog } from "@/components/controllers/AddControllerDialog";
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
}: {
  controller: ControllerWithRoom;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center",
              controller.is_online ? "bg-success/10" : "bg-muted"
            )}
          >
            {controller.is_online ? (
              <Wifi className="w-6 h-6 text-success" />
            ) : (
              <WifiOff className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{controller.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">{controller.brand.replace("_", " ")}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  controller.is_online
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {controller.is_online ? "Online" : "Offline"}
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
            <DropdownMenuItem>Assign to Room</DropdownMenuItem>
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
    brands,
    rooms,
  } = useControllers();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [controllerToDelete, setControllerToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
            <div className="text-center py-16">
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={refresh}>
                Try Again
              </Button>
            </div>
          ) : controllers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {controllers.map((controller) => (
                <ControllerCard
                  key={controller.id}
                  controller={controller}
                  onDelete={setControllerToDelete}
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
            });
            if (result.success) {
              toast({
                title: "Controller added",
                description: `${data.name} has been added successfully.`,
              });
            }
            return result;
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
      </div>
    </AppLayout>
  );
}
