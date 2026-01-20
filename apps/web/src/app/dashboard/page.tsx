"use client";

import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RoomCard } from "@/components/dashboard/RoomCard";
import { AddRoomCard } from "@/components/dashboard/AddRoomCard";
import { ActivityLog } from "@/components/dashboard/ActivityLog";
import { Button } from "@/components/ui/button";
import { mockRooms } from "@/data/mockData";
import { AppLayout } from "@/components/layout/AppLayout";

const mockLogs = [
  { id: "1", timestamp: "2 min ago", type: "success" as const, message: "VPD adjusted to optimal range (1.0-1.2 kPa)", roomName: "Veg Room A" },
  { id: "2", timestamp: "5 min ago", type: "info" as const, message: "Fan speed increased to 65%", roomName: "Flower Room 1" },
  { id: "3", timestamp: "12 min ago", type: "warning" as const, message: "Humidity approaching upper threshold (68%)", roomName: "Clone Tent" },
  { id: "4", timestamp: "25 min ago", type: "info" as const, message: "Lights dimmed to 90% for evening transition", roomName: "Flower Room 1" },
  { id: "5", timestamp: "1 hour ago", type: "error" as const, message: "Sensor connection lost temporarily", roomName: "Drying Room" },
  { id: "6", timestamp: "2 hours ago", type: "success" as const, message: "Temperature stabilized at target range", roomName: "Veg Room A" },
];

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="min-h-screen">
        <PageHeader
          title="Dashboard"
          description="Monitor and control your grow rooms"
          actions={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Room
            </Button>
          }
        />

        <div className="p-6 lg:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {mockRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
            <AddRoomCard />
          </div>

          <div className="max-w-2xl">
            <ActivityLog 
              logs={mockLogs} 
              roomData={mockRooms.map(r => ({
                name: r.name,
                temperature: r.temperature,
                humidity: r.humidity,
                vpd: r.vpd,
                fanSpeed: r.fanSpeed,
                lightLevel: r.lightLevel,
              }))} 
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
