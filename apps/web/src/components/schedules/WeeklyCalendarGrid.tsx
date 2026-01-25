/**
 * WeeklyCalendarGrid Component
 *
 * Visual weekly calendar grid for displaying and creating device schedules.
 * Displays 7 columns (days) × 24 rows (hours) with drag-to-select functionality.
 */
"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DeviceSchedule, ScheduleAction } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeeklyCalendarGridProps {
  /** Existing schedules to display */
  schedules: DeviceSchedule[];
  /** Callback when user selects time blocks */
  onBlockSelect?: (selection: {
    days: number[];
    start_time: string;
    end_time: string;
  }) => void;
  /** Whether drag selection is enabled */
  enableSelection?: boolean;
  /** Height of the grid in pixels */
  height?: number;
}

interface TimeBlock {
  day: number;
  hour: number;
}

interface ScheduleBlock {
  schedule: DeviceSchedule;
  day: number;
  startHour: number;
  endHour: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * Get action color for visual representation
 */
function getActionColor(action: ScheduleAction | undefined): string {
  switch (action) {
    case "on":
      return "bg-green-500/20 border-green-500";
    case "off":
      return "bg-red-500/20 border-red-500";
    case "set_level":
      return "bg-blue-500/20 border-blue-500";
    default:
      return "bg-gray-500/20 border-gray-500";
  }
}

/**
 * Convert schedule to visual blocks
 */
function scheduleToBlocks(schedule: DeviceSchedule): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];
  const days = schedule.schedule.days || [];
  const startTime = schedule.schedule.start_time;
  const endTime = schedule.schedule.end_time;

  if (!startTime) return blocks;

  const [startHour] = startTime.split(":").map(Number);
  const [endHour] = endTime
    ? endTime.split(":").map(Number)
    : [startHour + 1];

  days.forEach((day) => {
    blocks.push({
      schedule,
      day,
      startHour,
      endHour: endHour > startHour ? endHour : startHour + 1,
    });
  });

  return blocks;
}

export function WeeklyCalendarGrid({
  schedules,
  onBlockSelect,
  enableSelection = false,
  height = 600,
}: WeeklyCalendarGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectionStart, setSelectionStart] = useState<TimeBlock | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<TimeBlock | null>(null);

  // Convert all schedules to visual blocks
  const scheduleBlocks = useMemo(() => {
    return schedules.flatMap(scheduleToBlocks);
  }, [schedules]);

  // Calculate selected blocks
  const selectedBlocks = useMemo(() => {
    if (!selectionStart || !selectionEnd) return [];

    const blocks: TimeBlock[] = [];
    const minDay = Math.min(selectionStart.day, selectionEnd.day);
    const maxDay = Math.max(selectionStart.day, selectionEnd.day);
    const minHour = Math.min(selectionStart.hour, selectionEnd.hour);
    const maxHour = Math.max(selectionStart.hour, selectionEnd.hour);

    for (let day = minDay; day <= maxDay; day++) {
      for (let hour = minHour; hour <= maxHour; hour++) {
        blocks.push({ day, hour });
      }
    }

    return blocks;
  }, [selectionStart, selectionEnd]);

  const handleMouseDown = useCallback(
    (day: number, hour: number) => {
      if (!enableSelection) return;
      setIsDragging(true);
      setSelectionStart({ day, hour });
      setSelectionEnd({ day, hour });
    },
    [enableSelection]
  );

  const handleMouseEnter = useCallback(
    (day: number, hour: number) => {
      if (isDragging && selectionStart) {
        setSelectionEnd({ day, hour });
      }
    },
    [isDragging, selectionStart]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !selectionStart || !selectionEnd || !onBlockSelect) {
      setIsDragging(false);
      return;
    }

    const minDay = Math.min(selectionStart.day, selectionEnd.day);
    const maxDay = Math.max(selectionStart.day, selectionEnd.day);
    const minHour = Math.min(selectionStart.hour, selectionEnd.hour);
    const maxHour = Math.max(selectionStart.hour, selectionEnd.hour);

    const days = Array.from({ length: maxDay - minDay + 1 }, (_, i) => minDay + i);
    const start_time = `${String(minHour).padStart(2, "0")}:00`;
    const end_time = `${String(maxHour + 1).padStart(2, "0")}:00`;

    onBlockSelect({ days, start_time, end_time });

    setIsDragging(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [isDragging, selectionStart, selectionEnd, onBlockSelect]);

  const isBlockSelected = useCallback(
    (day: number, hour: number): boolean => {
      return selectedBlocks.some((b) => b.day === day && b.hour === hour);
    },
    [selectedBlocks]
  );

  const getBlockSchedule = useCallback(
    (day: number, hour: number): ScheduleBlock | undefined => {
      return scheduleBlocks.find(
        (b) => b.day === day && hour >= b.startHour && hour < b.endHour
      );
    },
    [scheduleBlocks]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full overflow-auto border rounded-lg"
        style={{ height }}
        onMouseLeave={() => {
          if (isDragging) {
            setIsDragging(false);
            setSelectionStart(null);
            setSelectionEnd(null);
          }
        }}
      >
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-8 sticky top-0 bg-background z-10 border-b">
            <div className="p-2 text-sm font-medium border-r">Time</div>
            {DAYS.map((day, _index) => (
              <div
                key={day}
                className="p-2 text-sm font-medium text-center border-r last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b last:border-b-0">
                {/* Hour label */}
                <div className="p-2 text-xs text-muted-foreground border-r sticky left-0 bg-background">
                  {`${String(hour).padStart(2, "0")}:00`}
                </div>

                {/* Day cells */}
                {DAYS.map((_, day) => {
                  const blockSchedule = getBlockSchedule(day, hour);
                  const isSelected = isBlockSelected(day, hour);

                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={cn(
                        "relative h-12 border-r last:border-r-0 transition-colors",
                        enableSelection && "cursor-pointer hover:bg-accent/50",
                        isSelected && "bg-primary/20",
                        blockSchedule && getActionColor(blockSchedule.schedule.schedule.action)
                      )}
                      onMouseDown={() => handleMouseDown(day, hour)}
                      onMouseEnter={() => handleMouseEnter(day, hour)}
                      onMouseUp={handleMouseUp}
                    >
                      {blockSchedule && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  getActionColor(blockSchedule.schedule.schedule.action)
                                )}
                              >
                                {blockSchedule.schedule.name}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">{blockSchedule.schedule.name}</p>
                              <p className="text-xs">
                                Port {blockSchedule.schedule.device_port}
                              </p>
                              <p className="text-xs capitalize">
                                Action: {blockSchedule.schedule.schedule.action}
                                {blockSchedule.schedule.schedule.level !== undefined &&
                                  ` (${blockSchedule.schedule.schedule.level}%)`}
                              </p>
                              <p className="text-xs">
                                {blockSchedule.schedule.schedule.start_time}
                                {blockSchedule.schedule.schedule.end_time &&
                                  ` - ${blockSchedule.schedule.schedule.end_time}`}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border bg-green-500/20 border-green-500" />
          <span>Turn On</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border bg-red-500/20 border-red-500" />
          <span>Turn Off</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border bg-blue-500/20 border-blue-500" />
          <span>Set Level</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
