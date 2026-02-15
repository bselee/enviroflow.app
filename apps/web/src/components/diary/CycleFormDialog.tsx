"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useRooms } from "@/hooks/use-rooms";
import { useControllers } from "@/hooks/use-controllers";
import type { CreateDiaryCycleInput, DiaryCycleWithCounts } from "@/types";
import { cn } from "@/lib/utils";

const STAGES = [
  { value: "germination", label: "Germination" },
  { value: "seedling", label: "Seedling" },
  { value: "vegetative", label: "Vegetative" },
  { value: "flowering", label: "Flowering" },
  { value: "harvest", label: "Harvest" },
  { value: "cure", label: "Cure" },
] as const;

/**
 * Zod validation schema for cycle creation/edit form.
 */
const cycleFormSchema = z.object({
  name: z
    .string()
    .min(1, "Cycle name is required")
    .max(100, "Cycle name must be 100 characters or less")
    .trim(),
  description: z
    .string()
    .max(1000, "Description must be 1000 characters or less")
    .optional()
    .transform((val) => val?.trim() || undefined),
  started_at: z.date({
    required_error: "Start date is required",
  }),
  room_id: z.string().optional(),
  controller_ids: z.array(z.string()).optional().default([]),
  current_stage: z.enum([
    "germination",
    "seedling",
    "vegetative",
    "flowering",
    "harvest",
    "cure",
  ]).default("seedling"),
  enable_device_logging: z.boolean().default(true),
  enable_sensor_logging: z.boolean().default(true),
});

type CycleFormValues = z.infer<typeof cycleFormSchema>;

interface CycleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle?: DiaryCycleWithCounts | null;
  onSubmit: (input: CreateDiaryCycleInput) => Promise<{ success: boolean; error?: string }>;
  onSuccess?: () => void;
}

/**
 * Dialog component for creating or editing a diary cycle.
 *
 * Uses react-hook-form with Zod validation for form handling.
 */
export function CycleFormDialog({
  open,
  onOpenChange,
  cycle,
  onSubmit,
  onSuccess,
}: CycleFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { rooms } = useRooms();
  const { controllers } = useControllers();

  const isEdit = !!cycle;

  const form = useForm<CycleFormValues>({
    resolver: zodResolver(cycleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      started_at: new Date(),
      room_id: undefined,
      controller_ids: [],
      current_stage: "seedling",
      enable_device_logging: true,
      enable_sensor_logging: true,
    },
  });

  // Update form when cycle changes (edit mode)
  useEffect(() => {
    if (cycle && open) {
      form.reset({
        name: cycle.name,
        description: cycle.description || "",
        started_at: new Date(cycle.started_at),
        room_id: cycle.room_id || undefined,
        controller_ids: cycle.controller_ids || [],
        current_stage: cycle.current_stage,
        enable_device_logging: cycle.enable_device_logging,
        enable_sensor_logging: cycle.enable_sensor_logging,
      });
    } else if (!cycle && open) {
      form.reset({
        name: "",
        description: "",
        started_at: new Date(),
        room_id: undefined,
        controller_ids: [],
        current_stage: "seedling",
        enable_device_logging: true,
        enable_sensor_logging: true,
      });
    }
  }, [cycle, open, form]);

  async function handleSubmit(values: CycleFormValues) {
    setIsSubmitting(true);

    try {
      const input: CreateDiaryCycleInput = {
        name: values.name,
        description: values.description,
        started_at: values.started_at.toISOString(),
        room_id: values.room_id === "none" || !values.room_id ? null : values.room_id,
        controller_ids: values.controller_ids || [],
        current_stage: values.current_stage,
        enable_device_logging: values.enable_device_logging,
        enable_sensor_logging: values.enable_sensor_logging,
      };

      const result = await onSubmit(input);

      if (result.success) {
        toast.success(isEdit ? "Cycle updated" : "Cycle created", {
          description: `"${values.name}" has been ${isEdit ? "updated" : "created"} successfully.`,
        });

        form.reset();
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(isEdit ? "Failed to update cycle" : "Failed to create cycle", {
          description: result.error || "Please try again.",
        });
      }
    } catch (error) {
      console.error("CycleFormDialog submit error:", error);
      toast.error("An unexpected error occurred", {
        description: "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen && !isSubmitting) {
      form.reset();
    }
    onOpenChange(newOpen);
  }

  // Get controllers filtered by selected room
  const roomId = form.watch("room_id");
  const availableControllers = roomId
    ? controllers.filter((c) => c.room_id === roomId)
    : controllers;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Diary Cycle" : "New Diary Cycle"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of your diary cycle."
              : "Create a new diary cycle to track your growing journey."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Spring 2026 Tomatoes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes about this diary cycle..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Start Date */}
            <FormField
              control={form.control}
              name="started_at"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Room */}
            <FormField
              control={form.control}
              name="room_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a room" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No room</SelectItem>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Assign this cycle to a room to filter controllers
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Controllers */}
            <FormField
              control={form.control}
              name="controller_ids"
              render={() => (
                <FormItem>
                  <FormLabel>Controllers (optional)</FormLabel>
                  <FormDescription>
                    Select controllers to track sensor data for this cycle
                  </FormDescription>
                  <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                    {availableControllers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {roomId ? "No controllers in this room" : "No controllers available"}
                      </p>
                    ) : (
                      availableControllers.map((controller) => (
                        <FormField
                          key={controller.id}
                          control={form.control}
                          name="controller_ids"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={controller.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(controller.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), controller.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== controller.id
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {controller.name || controller.controller_id}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Initial Stage */}
            <FormField
              control={form.control}
              name="current_stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Stage</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STAGES.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Logging switches */}
            <div className="space-y-4 border-t pt-4">
              <FormField
                control={form.control}
                name="enable_device_logging"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Enable device logging</FormLabel>
                      <FormDescription>
                        Log device states during this cycle for charts
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enable_sensor_logging"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Enable sensor logging</FormLabel>
                      <FormDescription>
                        Log sensor readings during this cycle for charts
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Update" : "Create"} Cycle
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
