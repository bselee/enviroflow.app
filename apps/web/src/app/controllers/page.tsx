/**
 * Controllers Page
 *
 * Main page for managing connected controllers.
 * Features:
 * - Grid/list view of all controllers
 * - Real-time status updates
 * - Add, edit, delete controllers
 * - Loading skeleton while fetching
 * - Empty state with onboarding CTA
 */
"use client";

import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Plus,
  Cpu,
  Wifi,
  WifiOff,
  MoreVertical,
  Trash2,
  Pencil,
  RefreshCw,
  Upload,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useControllers } from "@/hooks/use-controllers";
import {
  AddControllerDialog,
  EditControllerDialog,
  DeleteControllerDialog,
} from "@/components/controllers";
import type { ControllerWithRoom, ControllerBrand } from "@/types";

/**
 * Brand display names and configuration
 */
const BRAND_CONFIG: Record<
  ControllerBrand,
  { name: string; icon: typeof Cpu; color: string }
> = {
  ac_infinity: { name: "AC Infinity", icon: Cpu, color: "text-blue-600" },
  inkbird: { name: "Inkbird", icon: Cpu, color: "text-green-600" },
  csv_upload: { name: "CSV Upload", icon: Upload, color: "text-amber-600" },
  govee: { name: "Govee", icon: Cpu, color: "text-purple-600" },
  mqtt: { name: "MQTT", icon: Cpu, color: "text-cyan-600" },
  custom: { name: "Custom", icon: Cpu, color: "text-gray-600" },
};

/**
 * Format last seen timestamp
 */
function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "Never";

  try {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // If less than 2 minutes ago, show "Just now"
    if (diffMs < 120000) {
      return "Just now";
    }

    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

/**
 * Controller Card Skeleton for loading state
 */
function ControllerCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Skeleton className="w-12 h-12 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

/**
 * Controller Card Component
 */
interface ControllerCardProps {
  controller: ControllerWithRoom;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

function ControllerCard({ controller, onEdit, onDelete, onRefresh }: ControllerCardProps) {
  const brandConfig = BRAND_CONFIG[controller.brand] || BRAND_CONFIG.custom;
  const BrandIcon = brandConfig.icon;

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
            <p className={cn("text-sm", brandConfig.color)}>{brandConfig.name}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
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
              {controller.room?.name && (
                <Badge variant="outline" className="text-xs">
                  {controller.room.name}
                </Badge>
              )}
              {controller.model && (
                <Badge variant="outline" className="text-xs">
                  {controller.model}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Test Connection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Last error warning */}
      {controller.last_error && (
        <div className="mt-3 flex items-start gap-2 p-2 bg-destructive/10 rounded-lg text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-xs line-clamp-2">{controller.last_error}</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span className="truncate max-w-[50%]" title={controller.controller_id}>
            ID: {controller.controller_id}
          </span>
          <span>Last seen: {formatLastSeen(controller.last_seen)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty State Component
 */
interface EmptyStateProps {
  onAddController: () => void;
}

function EmptyState({ onAddController }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-4">
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <Cpu className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          No controllers yet
        </h3>
        <p className="text-muted-foreground mb-6">
          Connect your first controller to start monitoring and automating your
          environment. We support AC Infinity, Inkbird, and CSV imports.
        </p>
        <Button onClick={onAddController} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Controller
        </Button>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4">
            <div className="text-2xl font-bold text-primary mb-1">40%</div>
            <div className="text-xs text-muted-foreground">Market share</div>
            <div className="text-sm font-medium mt-1">AC Infinity</div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-bold text-primary mb-1">25%</div>
            <div className="text-xs text-muted-foreground">Market share</div>
            <div className="text-sm font-medium mt-1">Inkbird</div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-bold text-primary mb-1">Any</div>
            <div className="text-xs text-muted-foreground">Brand via</div>
            <div className="text-sm font-medium mt-1">CSV Upload</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Error State Component
 */
interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="text-center py-16 px-4">
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-destructive" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Failed to load controllers
        </h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    </div>
  );
}

/**
 * Controllers Page - Main Component
 */
export default function ControllersPage() {
  // Controllers hook
  const {
    controllers,
    loading,
    error,
    brands,
    rooms,
    refresh,
    addController,
    updateController,
    deleteController,
    testConnection,
    getAssociatedWorkflows,
  } = useControllers();

  // Toast notifications
  const { toast } = useToast();

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedController, setSelectedController] = useState<ControllerWithRoom | null>(null);

  /**
   * Handle add controller
   */
  const handleAddController = useCallback(
    async (data: {
      brand: ControllerBrand;
      name: string;
      credentials?: { email?: string; password?: string };
      room_id?: string | null;
    }) => {
      const result = await addController(data);

      if (result.success) {
        toast({
          title: "Controller added",
          description: `${data.name} has been added successfully.`,
        });
      } else {
        toast({
          title: "Failed to add controller",
          description: result.error,
          variant: "destructive",
        });
      }

      return result;
    },
    [addController, toast]
  );

  /**
   * Handle edit controller
   */
  const handleEditController = useCallback((controller: ControllerWithRoom) => {
    setSelectedController(controller);
    setIsEditDialogOpen(true);
  }, []);

  /**
   * Handle update controller
   */
  const handleUpdateController = useCallback(
    async (id: string, data: Parameters<typeof updateController>[1]) => {
      const result = await updateController(id, data);

      if (result.success) {
        toast({
          title: "Controller updated",
          description: "Your changes have been saved.",
        });
      } else {
        toast({
          title: "Failed to update controller",
          description: result.error,
          variant: "destructive",
        });
      }

      return result;
    },
    [updateController, toast]
  );

  /**
   * Handle delete controller click
   */
  const handleDeleteClick = useCallback((controller: ControllerWithRoom) => {
    setSelectedController(controller);
    setIsDeleteDialogOpen(true);
  }, []);

  /**
   * Handle delete controller
   */
  const handleDeleteSuccess = useCallback(() => {
    toast({
      title: "Controller deleted",
      description: "The controller has been removed.",
    });
  }, [toast]);

  /**
   * Handle test connection
   */
  const handleTestConnection = useCallback(
    async (controller: ControllerWithRoom) => {
      toast({
        title: "Testing connection...",
        description: `Checking ${controller.name}`,
      });

      const result = await testConnection(controller.id);

      if (result.success) {
        toast({
          title: result.data?.isOnline ? "Connection successful" : "Connection failed",
          description: result.data?.isOnline
            ? `${controller.name} is online and responding.`
            : `${controller.name} could not be reached.`,
          variant: result.data?.isOnline ? "default" : "destructive",
        });
      } else {
        toast({
          title: "Connection test failed",
          description: result.error,
          variant: "destructive",
        });
      }
    },
    [testConnection, toast]
  );

  return (
    <AppLayout>
      <div className="min-h-screen">
        <PageHeader
          title="Controllers"
          description="Manage your connected environmental controllers"
          actions={
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Controller
            </Button>
          }
        />

        <div className="p-6 lg:p-8">
          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <ControllerCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error State */}
          {!loading && error && <ErrorState error={error} onRetry={refresh} />}

          {/* Empty State */}
          {!loading && !error && controllers.length === 0 && (
            <EmptyState onAddController={() => setIsAddDialogOpen(true)} />
          )}

          {/* Controllers Grid */}
          {!loading && !error && controllers.length > 0 && (
            <>
              {/* Stats Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{controllers.length}</span>{" "}
                    controller{controllers.length !== 1 ? "s" : ""}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-success">
                      {controllers.filter((c) => c.is_online).length}
                    </span>{" "}
                    online
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={refresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {controllers.map((controller) => (
                  <ControllerCard
                    key={controller.id}
                    controller={controller}
                    onEdit={() => handleEditController(controller)}
                    onDelete={() => handleDeleteClick(controller)}
                    onRefresh={() => handleTestConnection(controller)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Add Controller Dialog */}
        <AddControllerDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          brands={brands}
          rooms={rooms}
          onAdd={handleAddController}
        />

        {/* Edit Controller Dialog */}
        <EditControllerDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          controller={selectedController}
          rooms={rooms}
          onUpdate={handleUpdateController}
          onTestConnection={testConnection}
        />

        {/* Delete Controller Dialog */}
        <DeleteControllerDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          controller={selectedController}
          onDelete={deleteController}
          onGetAssociatedWorkflows={getAssociatedWorkflows}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </AppLayout>
  );
}
