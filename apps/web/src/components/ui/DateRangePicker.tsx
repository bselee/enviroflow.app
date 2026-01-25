"use client";

import * as React from "react";
import { addDays, format, startOfDay, endOfDay, startOfYear } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { DateRangePreset, DateRangeValue } from "@/types";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Props for the DateRangePicker component.
 */
export interface DateRangePickerProps {
  /** Current date range value */
  value?: DateRangeValue;
  /** Callback when date range changes */
  onChange?: (range: DateRangeValue) => void;
  /** Additional CSS class names */
  className?: string;
  /** Disable the picker */
  disabled?: boolean;
  /** Show preset buttons */
  showPresets?: boolean;
  /** Custom preset configurations */
  presets?: Array<{
    label: string;
    value: DateRangePreset;
    getRangeValue: () => { from: Date; to: Date };
  }>;
  /** Align popover */
  align?: "start" | "center" | "end";
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default preset configurations.
 */
const DEFAULT_PRESETS = [
  {
    label: "Today",
    value: "today" as const,
    getRangeValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 7 days",
    value: "7d" as const,
    getRangeValue: () => ({
      from: startOfDay(addDays(new Date(), -6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 30 days",
    value: "30d" as const,
    getRangeValue: () => ({
      from: startOfDay(addDays(new Date(), -29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 90 days",
    value: "90d" as const,
    getRangeValue: () => ({
      from: startOfDay(addDays(new Date(), -89)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Year to date",
    value: "ytd" as const,
    getRangeValue: () => ({
      from: startOfYear(new Date()),
      to: endOfDay(new Date()),
    }),
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets the display label for the current date range.
 */
function getDateRangeLabel(range?: DateRangeValue): string {
  if (!range) return "Select date range";

  if (range.preset && range.preset !== "custom") {
    const preset = DEFAULT_PRESETS.find((p) => p.value === range.preset);
    return preset?.label || "Custom range";
  }

  return `${format(range.from, "MMM d, yyyy")} - ${format(range.to, "MMM d, yyyy")}`;
}

/**
 * Checks if two date ranges are equal.
 */
function isDateRangeEqual(a?: DateRangeValue, b?: DateRangeValue): boolean {
  if (!a || !b) return false;
  return (
    a.from.getTime() === b.from.getTime() &&
    a.to.getTime() === b.to.getTime()
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * DateRangePicker Component
 *
 * A date range picker with preset quick selections and custom date range input.
 * Features:
 * - Preset buttons for common ranges (Today, Last 7/30/90 days, YTD)
 * - Custom calendar picker for specific date ranges
 * - Mobile-friendly popover interface
 * - URL params compatible for shareable reports
 *
 * @example
 * ```tsx
 * const [dateRange, setDateRange] = useState<DateRangeValue>({
 *   from: addDays(new Date(), -7),
 *   to: new Date(),
 *   preset: "7d"
 * });
 *
 * <DateRangePicker
 *   value={dateRange}
 *   onChange={setDateRange}
 *   showPresets={true}
 * />
 * ```
 */
export function DateRangePicker({
  value,
  onChange,
  className,
  disabled = false,
  showPresets = true,
  presets = DEFAULT_PRESETS,
  align = "start",
}: DateRangePickerProps): JSX.Element {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>(
    value
      ? {
          from: value.from,
          to: value.to,
        }
      : undefined
  );

  /**
   * Handles preset selection.
   */
  const handlePresetSelect = React.useCallback(
    (preset: DateRangePreset) => {
      const presetConfig = presets.find((p) => p.value === preset);
      if (!presetConfig) return;

      const rangeValue = presetConfig.getRangeValue();
      const newValue: DateRangeValue = {
        from: rangeValue.from,
        to: rangeValue.to,
        preset,
      };

      setSelectedRange({ from: rangeValue.from, to: rangeValue.to });
      onChange?.(newValue);
      setIsOpen(false);
    },
    [presets, onChange]
  );

  /**
   * Handles custom date range selection from calendar.
   */
  const handleCalendarSelect = React.useCallback(
    (range: DateRange | undefined) => {
      setSelectedRange(range);

      // Only trigger onChange when both dates are selected
      if (range?.from && range?.to) {
        const newValue: DateRangeValue = {
          from: startOfDay(range.from),
          to: endOfDay(range.to),
          preset: "custom",
        };
        onChange?.(newValue);
        // Don't close immediately to allow viewing the selection
      }
    },
    [onChange]
  );

  /**
   * Handles preset dropdown change.
   */
  const handlePresetChange = React.useCallback(
    (presetValue: string) => {
      handlePresetSelect(presetValue as DateRangePreset);
    },
    [handlePresetSelect]
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Preset Selector - Mobile Friendly */}
      {showPresets && (
        <Select
          value={value?.preset || "7d"}
          onValueChange={handlePresetChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Custom Date Range Picker */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date-range"
            variant="outline"
            disabled={disabled}
            className={cn(
              "justify-start text-left font-normal",
              !value && "text-muted-foreground",
              showPresets ? "w-[280px]" : "w-[320px]"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {getDateRangeLabel(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="flex flex-col">
            {/* Preset Buttons - Desktop */}
            {showPresets && (
              <div className="hidden sm:flex flex-wrap gap-2 p-3 border-b">
                {presets.map((preset) => {
                  const presetRange = preset.getRangeValue();
                  const presetValue: DateRangeValue = {
                    from: presetRange.from,
                    to: presetRange.to,
                    preset: preset.value,
                  };
                  const isActive = isDateRangeEqual(value, presetValue);

                  return (
                    <Button
                      key={preset.value}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePresetSelect(preset.value)}
                      className="text-xs"
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Calendar */}
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={selectedRange?.from}
              selected={selectedRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              disabled={(date) => date > new Date()}
              className="p-3"
            />

            {/* Apply Button - Only for custom range */}
            {selectedRange?.from && selectedRange?.to && (
              <div className="flex justify-end gap-2 p-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedRange(undefined);
                    setIsOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (selectedRange?.from && selectedRange?.to) {
                      const newValue: DateRangeValue = {
                        from: startOfDay(selectedRange.from),
                        to: endOfDay(selectedRange.to),
                        preset: "custom",
                      };
                      onChange?.(newValue);
                    }
                    setIsOpen(false);
                  }}
                >
                  Apply
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Compact version of DateRangePicker suitable for toolbar/header usage.
 */
export function DateRangePickerCompact(
  props: Omit<DateRangePickerProps, "showPresets">
): JSX.Element {
  return <DateRangePicker {...props} showPresets={false} />;
}
