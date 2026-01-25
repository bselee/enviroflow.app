/**
 * ScheduleModal Component
 *
 * Modal dialog for creating and editing device schedules.
 * Supports time-based, sunrise/sunset, and cron-based triggers.
 */
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Clock, Sunrise, Sunset, Calendar } from "lucide-react";
import type {
  CreateDeviceScheduleInput,
  DeviceSchedule,
  ScheduleTriggerType,
  ScheduleAction,
  Controller,
} from "@/types";

interface ScheduleModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when schedule is saved */
  onSave: (schedule: CreateDeviceScheduleInput) => Promise<void>;
  /** Available controllers */
  controllers: Controller[];
  /** Existing schedule to edit */
  schedule?: DeviceSchedule;
  /** Pre-selected controller ID */
  defaultControllerId?: string;
  /** Pre-selected time range */
  defaultTimeRange?: {
    days: number[];
    start_time: string;
    end_time: string;
  };
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function ScheduleModal({
  open,
  onClose,
  onSave,
  controllers,
  schedule,
  defaultControllerId,
  defaultTimeRange,
}: ScheduleModalProps) {
  const [loading, setLoading] = useState(false);
  const [triggerType, setTriggerType] = useState<ScheduleTriggerType>("time");
  const [action, setAction] = useState<ScheduleAction>("on");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [dimLevel, setDimLevel] = useState(100);

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      name: "",
      description: "",
      controller_id: defaultControllerId || "",
      device_port: 1,
      start_time: "08:00",
      end_time: "",
      cron_expression: "",
      offset_minutes: 0,
    },
  });

  const controllerId = watch("controller_id");
  const selectedController = controllers.find((c) => c.id === controllerId);

  // Initialize form with existing schedule or defaults
  useEffect(() => {
    if (schedule) {
      setValue("name", schedule.name);
      setValue("description", schedule.description || "");
      setValue("controller_id", schedule.controller_id);
      setValue("device_port", schedule.device_port);
      setValue("start_time", schedule.schedule.start_time);
      setValue("end_time", schedule.schedule.end_time || "");
      setValue("cron_expression", schedule.schedule.cron || "");
      setValue("offset_minutes", schedule.schedule.offset_minutes || 0);

      setTriggerType(schedule.trigger_type);
      setAction(schedule.schedule.action);
      setSelectedDays(schedule.schedule.days || []);
      if (schedule.schedule.level !== undefined) {
        setDimLevel(schedule.schedule.level);
      }
    } else if (defaultTimeRange) {
      setValue("start_time", defaultTimeRange.start_time);
      setValue("end_time", defaultTimeRange.end_time);
      setSelectedDays(defaultTimeRange.days);
    }
  }, [schedule, defaultTimeRange, setValue]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);

      // Validate required fields
      if (!data.controller_id) {
        toast.error("Please select a controller");
        return;
      }

      if (!data.name.trim()) {
        toast.error("Please enter a schedule name");
        return;
      }

      if (triggerType === "time" && selectedDays.length === 0) {
        toast.error("Please select at least one day");
        return;
      }

      if (triggerType === "cron" && !data.cron_expression.trim()) {
        toast.error("Please enter a cron expression");
        return;
      }

      // Build schedule configuration
      const scheduleConfig: CreateDeviceScheduleInput = {
        controller_id: data.controller_id,
        name: data.name,
        description: data.description || undefined,
        device_port: Number(data.device_port),
        trigger_type: triggerType,
        schedule: {
          days: selectedDays,
          start_time: data.start_time,
          end_time: data.end_time || undefined,
          action,
          level: action === "set_level" ? dimLevel : undefined,
          cron: triggerType === "cron" ? data.cron_expression : undefined,
          offset_minutes:
            triggerType === "sunrise" || triggerType === "sunset"
              ? Number(data.offset_minutes)
              : undefined,
        },
        is_active: true,
      };

      await onSave(scheduleConfig);

      toast.success(
        schedule ? "Schedule updated successfully" : "Schedule created successfully"
      );

      // Reset form
      reset();
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
      setAction("on");
      setDimLevel(100);
      onClose();
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Failed to save schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {schedule ? "Edit Schedule" : "Create New Schedule"}
          </DialogTitle>
          <DialogDescription>
            Configure an automated schedule for device control
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Schedule Name</Label>
              <Input
                id="name"
                placeholder="e.g., Daily Lights On"
                {...register("name", { required: true })}
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this schedule..."
                rows={2}
                {...register("description")}
              />
            </div>
          </div>

          {/* Controller and Device Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="controller_id">Controller</Label>
              <Select
                value={controllerId}
                onValueChange={(value) => setValue("controller_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select controller" />
                </SelectTrigger>
                <SelectContent>
                  {controllers.map((controller) => (
                    <SelectItem key={controller.id} value={controller.id}>
                      {controller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="device_port">Device Port</Label>
              <Input
                id="device_port"
                type="number"
                min={1}
                {...register("device_port", { required: true, min: 1 })}
              />
            </div>
          </div>

          {/* Trigger Type */}
          <div>
            <Label>Trigger Type</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <Button
                type="button"
                variant={triggerType === "time" ? "default" : "outline"}
                className="justify-start"
                onClick={() => setTriggerType("time")}
              >
                <Clock className="mr-2 h-4 w-4" />
                Time
              </Button>
              <Button
                type="button"
                variant={triggerType === "sunrise" ? "default" : "outline"}
                className="justify-start"
                onClick={() => setTriggerType("sunrise")}
              >
                <Sunrise className="mr-2 h-4 w-4" />
                Sunrise
              </Button>
              <Button
                type="button"
                variant={triggerType === "sunset" ? "default" : "outline"}
                className="justify-start"
                onClick={() => setTriggerType("sunset")}
              >
                <Sunset className="mr-2 h-4 w-4" />
                Sunset
              </Button>
              <Button
                type="button"
                variant={triggerType === "cron" ? "default" : "outline"}
                className="justify-start"
                onClick={() => setTriggerType("cron")}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Cron
              </Button>
            </div>
          </div>

          {/* Time Configuration */}
          {triggerType === "time" && (
            <>
              <div>
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={selectedDays.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    {...register("start_time", { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time (Optional)</Label>
                  <Input id="end_time" type="time" {...register("end_time")} />
                </div>
              </div>
            </>
          )}

          {(triggerType === "sunrise" || triggerType === "sunset") && (
            <div>
              <Label htmlFor="offset_minutes">
                Offset (minutes {triggerType === "sunrise" ? "after sunrise" : "before sunset"})
              </Label>
              <Input
                id="offset_minutes"
                type="number"
                placeholder="0"
                {...register("offset_minutes")}
              />
            </div>
          )}

          {triggerType === "cron" && (
            <div>
              <Label htmlFor="cron_expression">Cron Expression</Label>
              <Input
                id="cron_expression"
                placeholder="0 8 * * *"
                {...register("cron_expression")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: minute hour day month weekday
              </p>
            </div>
          )}

          {/* Action Configuration */}
          <div>
            <Label>Action</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Button
                type="button"
                variant={action === "on" ? "default" : "outline"}
                onClick={() => setAction("on")}
              >
                Turn On
              </Button>
              <Button
                type="button"
                variant={action === "off" ? "default" : "outline"}
                onClick={() => setAction("off")}
              >
                Turn Off
              </Button>
              <Button
                type="button"
                variant={action === "set_level" ? "default" : "outline"}
                onClick={() => setAction("set_level")}
                disabled={!selectedController?.capabilities?.supportsDimming}
              >
                Set Level
              </Button>
            </div>
          </div>

          {action === "set_level" && (
            <div>
              <Label>Dim Level: {dimLevel}%</Label>
              <Slider
                value={[dimLevel]}
                onValueChange={([value]) => setDimLevel(value)}
                min={0}
                max={100}
                step={1}
                className="mt-2"
              />
            </div>
          )}

          {/* Preview */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="text-sm font-medium mb-2">Preview</h4>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Trigger:</span>{" "}
                {triggerType === "time" && watch("start_time")
                  ? `Every ${selectedDays.length === 7 ? "day" : DAYS_OF_WEEK.filter((d) => selectedDays.includes(d.value)).map((d) => d.label).join(", ")} at ${watch("start_time")}`
                  : triggerType === "sunrise"
                    ? "At sunrise"
                    : triggerType === "sunset"
                      ? "At sunset"
                      : "Custom cron schedule"}
              </p>
              <p>
                <span className="font-medium">Action:</span>{" "}
                {action === "on"
                  ? "Turn device on"
                  : action === "off"
                    ? "Turn device off"
                    : `Set device to ${dimLevel}%`}
              </p>
              <p>
                <span className="font-medium">Device:</span> Port {watch("device_port")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : schedule ? "Update Schedule" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
