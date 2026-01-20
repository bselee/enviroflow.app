"use client";
import { Thermometer, Droplet, Activity, Settings, MoreVertical, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface Room {
  id: string;
  name: string;
  isOnline: boolean;
  workflowActive: boolean;
  temperature: number;
  humidity: number;
  vpd: number;
  fanSpeed: number;
  lightLevel: number;
  lastUpdate: string;
}

interface RoomCardProps {
  room: Room;
}

export function RoomCard({ room }: RoomCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-6 transition-shadow hover:shadow-md",
        room.isOnline ? "border-border" : "border-destructive/30"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{room.name}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                room.isOnline
                  ? "bg-success/10 text-success hover:bg-success/20"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full mr-1.5",
                  room.isOnline ? "bg-success" : "bg-muted-foreground"
                )}
              />
              {room.isOnline ? "Online" : "Offline"}
            </Badge>
            {room.workflowActive && (
              <Badge
                variant="secondary"
                className="bg-info/10 text-info hover:bg-info/20 text-xs"
              >
                <Bot className="w-3 h-3 mr-1" />
                VPD Auto
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Sensor Readings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Thermometer className="w-4 h-4" />
            Temperature
          </span>
          <span
            className={cn(
              "text-lg font-semibold",
              room.isOnline ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {room.temperature}°F
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Droplet className="w-4 h-4" />
            Humidity
          </span>
          <span
            className={cn(
              "text-lg font-semibold",
              room.isOnline ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {room.humidity}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Activity className="w-4 h-4" />
            VPD
          </span>
          <span
            className={cn(
              "text-lg font-semibold",
              room.isOnline ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {room.vpd} kPa
          </span>
        </div>
      </div>

      {/* Device Controls */}
      <div className="mt-4 pt-4 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Fan</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${room.fanSpeed}%` }}
              />
            </div>
            <span className="text-xs font-medium text-foreground w-8 text-right">
              {room.fanSpeed}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Light</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-warning transition-all"
                style={{ width: `${room.lightLevel}%` }}
              />
            </div>
            <span className="text-xs font-medium text-foreground w-8 text-right">
              {room.lightLevel}%
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
        Last update: {room.lastUpdate}
      </div>
    </div>
  );
}
