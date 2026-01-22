"use client";

import { useState, useCallback } from "react";
import { Settings } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DashboardPreferences, type DashboardPreferencesProps } from "./DashboardPreferences";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Props for the SettingsSheet component.
 */
export interface SettingsSheetProps {
  /** Available rooms for room-specific settings */
  rooms: DashboardPreferencesProps["rooms"];
  /** Current metric values for live preview (optional) */
  currentValues?: DashboardPreferencesProps["currentValues"];
  /** Whether the sheet is controlled externally */
  open?: boolean;
  /** Callback when open state changes (for controlled mode) */
  onOpenChange?: (open: boolean) => void;
  /** Render a custom trigger element (defaults to settings icon button) */
  trigger?: React.ReactNode;
  /** Additional CSS class names for the trigger */
  triggerClassName?: string;
  /** Additional CSS class names for the sheet content */
  contentClassName?: string;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * SettingsSheet Component
 *
 * A slide-in sheet/drawer from the right side containing the DashboardPreferences panel.
 * Can be triggered by clicking a settings icon or controlled externally.
 *
 * Features:
 * - Accessible sheet with proper ARIA attributes
 * - Scrollable content area for long settings
 * - Responsive design (wider on desktop)
 * - Auto-close on save (optional)
 *
 * @example
 * ```tsx
 * // With default trigger
 * <SettingsSheet rooms={rooms} currentValues={currentValues} />
 *
 * // With custom trigger
 * <SettingsSheet
 *   rooms={rooms}
 *   trigger={<Button>Open Settings</Button>}
 * />
 *
 * // Controlled mode
 * <SettingsSheet
 *   rooms={rooms}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 * ```
 */
export function SettingsSheet({
  rooms,
  currentValues,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  triggerClassName,
  contentClassName,
}: SettingsSheetProps): JSX.Element {
  // Internal state for uncontrolled mode
  const [internalOpen, setInternalOpen] = useState(false);

  // Determine if we're in controlled or uncontrolled mode
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  /**
   * Handles open state change for both controlled and uncontrolled modes.
   */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (isControlled) {
        controlledOnOpenChange?.(newOpen);
      } else {
        setInternalOpen(newOpen);
      }
    },
    [isControlled, controlledOnOpenChange]
  );

  /**
   * Handles successful save - closes the sheet.
   */
  const handleSave = useCallback(() => {
    // Optionally close sheet on save
    // handleOpenChange(false);
  }, []);

  /**
   * Default trigger element - a settings icon button.
   */
  const defaultTrigger = (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-9 w-9 rounded-lg hover:bg-muted",
        triggerClassName
      )}
      aria-label="Open dashboard settings"
    >
      <Settings className="h-5 w-5" />
    </Button>
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger ?? defaultTrigger}</SheetTrigger>

      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-lg p-0 flex flex-col",
          contentClassName
        )}
      >
        <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Dashboard Settings
          </SheetTitle>
          <SheetDescription>
            Customize your dashboard preferences, metric ranges, and display options.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <DashboardPreferences
            rooms={rooms}
            currentValues={currentValues}
            onSave={handleSave}
          />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// =============================================================================
// Standalone Trigger Component
// =============================================================================

/**
 * Props for the SettingsButton component.
 */
export interface SettingsButtonProps {
  /** Button variant */
  variant?: "ghost" | "outline" | "default";
  /** Button size */
  size?: "default" | "sm" | "icon";
  /** Show label text */
  showLabel?: boolean;
  /** Callback when clicked */
  onClick?: () => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Standalone settings button that can trigger the settings sheet.
 * Useful when you need the button outside of the Sheet context.
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * return (
 *   <>
 *     <SettingsButton onClick={() => setIsOpen(true)} />
 *     <SettingsSheet
 *       rooms={rooms}
 *       open={isOpen}
 *       onOpenChange={setIsOpen}
 *       trigger={null}
 *     />
 *   </>
 * );
 * ```
 */
export function SettingsButton({
  variant = "ghost",
  size = "icon",
  showLabel = false,
  onClick,
  className,
}: SettingsButtonProps): JSX.Element {
  return (
    <Button
      variant={variant}
      size={showLabel ? "default" : size}
      onClick={onClick}
      className={cn(
        !showLabel && "h-9 w-9 rounded-lg",
        className
      )}
      aria-label="Open dashboard settings"
    >
      <Settings className={cn("h-5 w-5", showLabel && "mr-2")} />
      {showLabel && "Settings"}
    </Button>
  );
}
