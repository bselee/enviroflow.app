"use client";

import { Plus, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RoomCard } from "@/components/dashboard/RoomCard";
import { AddRoomCard } from "@/components/dashboard/AddRoomCard";
import { ActivityLog } from "@/components/dashboard/ActivityLog";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRooms } from "@/hooks/use-rooms";
import { useActivityLogs } from "@/hooks/use-activity-logs";
import { AddRoomDialog } from "@/components/dashboard/AddRoomDialog";
import { useState } from "react";

export default function DashboardPage() {
  const { rooms, isLoading: roomsLoading, refetch } = useRooms();
  const { formattedLogs, isLoading: logsLoading } = useActivityLogs({ limit: 10 });
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);

  // Transform activity logs to the format expected by ActivityLog component
  const displayLogs = formattedLogs.map(log => ({
    id: log.id,
    timestamp: log.timestamp,
    type: log.type,
    message: log.message,
    roomName: log.roomName || "Unknown Room",
  }));

  return (
    <AppLayout>
      <div className="min-h-screen">
        <PageHeader
          title="Dashboard"
          description="Monitor and control your grow rooms"
          actions={
            <>
              <Button onClick={() => setIsAddRoomOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Room
              </Button>
              <AddRoomDialog
                open={isAddRoomOpen}
                onOpenChange={setIsAddRoomOpen}
                onRoomCreated={refetch}
              />
            </>
          }
        />

        <div className="p-6 lg:p-8 space-y-8">
          {/* Rooms Grid */}
          {roomsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-foreground mb-2">No rooms yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first grow room.
              </p>
              <AddRoomCard onRoomCreated={refetch} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
              <AddRoomCard onRoomCreated={refetch} />
            </div>
          )}

          {/* Activity Log */}
          {!roomsLoading && rooms.length > 0 && (
            <div className="max-w-2xl">
              <ActivityLog
                logs={displayLogs.length > 0 ? displayLogs : []}
                roomData={rooms.map(r => ({
                  name: r.name,
                  temperature: undefined,
                  humidity: undefined,
                  vpd: undefined,
                  fanSpeed: undefined,
                  lightLevel: undefined,
                }))}
                isLoading={logsLoading}
              />
            </div>
          )}
        </div>
      </div>

    </AppLayout>
  );
}
