"use client";

import { useState } from "react";
import { Plus, Home, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RoomCard, RoomCardSkeleton } from "@/components/dashboard/RoomCard";
import { AddRoomCard } from "@/components/dashboard/AddRoomCard";
import { ActivityLog } from "@/components/dashboard/ActivityLog";
import { AddRoomDialog } from "@/components/dashboard/AddRoomDialog";
import { KPICards } from "@/components/dashboard/KPICards";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRooms } from "@/hooks/use-rooms";
import { cn } from "@/lib/utils";

/**
 * Empty state component shown when user has no rooms.
 * Provides a clear call-to-action to create the first room.
 */
function EmptyState({ onAddRoom }: { onAddRoom: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Home className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Welcome to EnviroFlow
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Get started by adding your first room. Rooms help you organize your
        controllers and monitor your grow spaces.
      </p>
      <Button onClick={onAddRoom} size="lg">
        <Plus className="h-5 w-5 mr-2" />
        Add Your First Room
      </Button>
    </div>
  );
}

/**
 * Loading skeleton for the room grid.
 * Shows placeholder cards while data is being fetched.
 */
function RoomGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <RoomCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Dashboard page component.
 *
 * Main landing page after authentication. Displays:
 * - Grid of room cards with live sensor data
 * - Activity log showing recent automation actions
 * - Quick actions for adding new rooms
 *
 * Uses Supabase real-time subscriptions for live updates.
 */
export default function DashboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { rooms, isLoading, error, refetch } = useRooms();

  /**
   * Handles opening the add room dialog.
   */
  const handleAddRoom = () => {
    setDialogOpen(true);
  };

  /**
   * Prepares room data for ActivityLog AI analysis context.
   * Extracts relevant sensor data from each room.
   */
  const roomDataForAnalysis = rooms.map((room) => {
    // Get aggregated data from room controllers if available
    // This is a simplified version - actual data comes from useSensorReadings in RoomCard
    return {
      name: room.name,
      temperature: 0, // Will be populated by actual sensor data
      humidity: 0,
      vpd: 0,
      fanSpeed: 0,
      lightLevel: 0,
    };
  });

  return (
    <AppLayout>
      <div className="min-h-screen">
        <PageHeader
          title="Dashboard"
          description="Monitor and control your grow rooms"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading}
                aria-label="Refresh dashboard"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isLoading && "animate-spin")}
                />
              </Button>
              <Button onClick={handleAddRoom}>
                <Plus className="h-4 w-4 mr-2" />
                Add Room
              </Button>
            </div>
          }
        />

        <div className="p-6 lg:p-8 space-y-8">
          {/* KPI Summary Cards */}
          <KPICards />

          {/* Error State */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive">
                Failed to load rooms: {error}
              </p>
              <Button
                onClick={() => refetch()}
                size="sm"
                variant="outline"
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !error && <RoomGridSkeleton />}

          {/* Empty State */}
          {!isLoading && !error && rooms.length === 0 && (
            <EmptyState onAddRoom={handleAddRoom} />
          )}

          {/* Room Grid */}
          {!isLoading && !error && rooms.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
              <AddRoomCard onRoomCreated={refetch} />
            </div>
          )}

          {/* Activity Log */}
          <div className="max-w-2xl">
            <ActivityLog roomData={roomDataForAnalysis} />
          </div>
        </div>

        {/* Add Room Dialog */}
        <AddRoomDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onRoomCreated={refetch}
        />
      </div>
    </AppLayout>
  );
}
