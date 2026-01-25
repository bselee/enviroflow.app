/**
 * ScheduleBuilder Component
 *
 * Main component for building and managing device schedules.
 * Combines the calendar grid, modal, and schedule list.
 */
"use client";

import { useState } from "react";
import { useSchedules } from "@/hooks/use-schedules";
import { WeeklyCalendarGrid } from "./WeeklyCalendarGrid";
import { ScheduleModal } from "./ScheduleModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreVertical, Edit, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { CreateDeviceScheduleInput, DeviceSchedule } from "@/types";

interface ScheduleBuilderProps {
  /** Optional controller ID to filter schedules */
  controllerId?: string;
}

export function ScheduleBuilder({ controllerId }: ScheduleBuilderProps) {
  const {
    schedules,
    loading,
    error,
    controllers,
    controllersLoading,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    fetchControllers,
  } = useSchedules(controllerId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DeviceSchedule | undefined>();
  const [defaultTimeRange, setDefaultTimeRange] = useState<{
    days: number[];
    start_time: string;
    end_time: string;
  } | undefined>();

  // Load controllers when modal opens
  const handleOpenModal = () => {
    if (controllers.length === 0) {
      fetchControllers();
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSchedule(undefined);
    setDefaultTimeRange(undefined);
  };

  const handleSaveSchedule = async (schedule: CreateDeviceScheduleInput) => {
    if (editingSchedule) {
      const result = await updateSchedule(editingSchedule.id, schedule);
      if (!result.success) {
        throw new Error(result.error || "Failed to update schedule");
      }
    } else {
      const result = await addSchedule(schedule);
      if (!result.success) {
        throw new Error(result.error || "Failed to create schedule");
      }
    }
  };

  const handleEditSchedule = (schedule: DeviceSchedule) => {
    setEditingSchedule(schedule);
    handleOpenModal();
  };

  const handleDeleteSchedule = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the schedule "${name}"?`)) {
      return;
    }

    const result = await deleteSchedule(id);
    if (result.success) {
      toast.success("Schedule deleted successfully");
    } else {
      toast.error(result.error || "Failed to delete schedule");
    }
  };

  const handleToggleSchedule = async (id: string, currentState: boolean) => {
    const result = await toggleSchedule(id, !currentState);
    if (result.success) {
      toast.success(`Schedule ${!currentState ? "enabled" : "disabled"}`);
    } else {
      toast.error(result.error || "Failed to toggle schedule");
    }
  };

  const handleBlockSelect = (selection: {
    days: number[];
    start_time: string;
    end_time: string;
  }) => {
    setDefaultTimeRange(selection);
    handleOpenModal();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[600px] w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Device Schedules</h2>
          <p className="text-muted-foreground">
            Automate device control with time-based schedules
          </p>
        </div>
        <Button onClick={handleOpenModal}>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule View</CardTitle>
          <CardDescription>
            Drag to select time blocks and create new schedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklyCalendarGrid
            schedules={schedules}
            onBlockSelect={handleBlockSelect}
            enableSelection={true}
            height={600}
          />
        </CardContent>
      </Card>

      {/* Schedule List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {schedules.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Schedules Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first schedule by clicking the button above or dragging on the calendar grid
              </p>
              <Button onClick={handleOpenModal}>
                <Plus className="mr-2 h-4 w-4" />
                Create Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{schedule.name}</CardTitle>
                  <CardDescription>
                    {schedule.controller?.name} - Port {schedule.device_port}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditSchedule(schedule)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeleteSchedule(schedule.id, schedule.name)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-4">
                {schedule.description && (
                  <p className="text-sm text-muted-foreground">{schedule.description}</p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Trigger</span>
                    <Badge variant="outline" className="capitalize">
                      {schedule.trigger_type}
                    </Badge>
                  </div>

                  {schedule.trigger_type === "time" && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Time</span>
                        <span>{schedule.schedule.start_time}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Days</span>
                        <span className="text-xs">
                          {schedule.schedule.days?.length === 7
                            ? "Every day"
                            : `${schedule.schedule.days?.length || 0} days/week`}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Action</span>
                    <Badge
                      variant={
                        schedule.schedule.action === "on"
                          ? "default"
                          : schedule.schedule.action === "off"
                            ? "destructive"
                            : "secondary"
                      }
                      className="capitalize"
                    >
                      {schedule.schedule.action}
                      {schedule.schedule.level !== undefined &&
                        ` (${schedule.schedule.level}%)`}
                    </Badge>
                  </div>

                  {schedule.next_execution && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Next Run</span>
                      <span className="text-xs">
                        {new Date(schedule.next_execution).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Active</span>
                    <Switch
                      checked={schedule.is_active}
                      onCheckedChange={() =>
                        handleToggleSchedule(schedule.id, schedule.is_active)
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Schedule Modal */}
      <ScheduleModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveSchedule}
        controllers={controllers}
        schedule={editingSchedule}
        defaultControllerId={controllerId}
        defaultTimeRange={defaultTimeRange}
      />
    </div>
  );
}
