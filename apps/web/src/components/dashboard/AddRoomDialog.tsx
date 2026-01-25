"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Home } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { useRooms } from "@/hooks/use-rooms";
import type { CreateRoomInput } from "@/types";

/**
 * Zod validation schema for room creation form.
 * Enforces required fields and length constraints.
 */
const createRoomSchema = z.object({
  name: z
    .string()
    .min(1, "Room name is required")
    .max(100, "Room name must be 100 characters or less")
    .trim(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .transform((val) => val?.trim() || undefined),
});

type CreateRoomFormValues = z.infer<typeof createRoomSchema>;

interface AddRoomDialogProps {
  /** Controls dialog visibility */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Optional callback after successful room creation */
  onRoomCreated?: () => void;
}

/**
 * Dialog component for creating a new room.
 *
 * Uses react-hook-form with Zod validation for form handling.
 * Integrates with useRooms hook for database operations.
 *
 * @example
 * ```tsx
 * const [dialogOpen, setDialogOpen] = useState(false);
 *
 * return (
 *   <>
 *     <Button onClick={() => setDialogOpen(true)}>Add Room</Button>
 *     <AddRoomDialog
 *       open={dialogOpen}
 *       onOpenChange={setDialogOpen}
 *       onRoomCreated={() => console.log("Room created!")}
 *     />
 *   </>
 * );
 * ```
 */
export function AddRoomDialog({
  open,
  onOpenChange,
  onRoomCreated,
}: AddRoomDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createRoom, refetch } = useRooms();

  const form = useForm<CreateRoomFormValues>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  /**
   * Handles form submission.
   * Creates the room via the useRooms hook and shows appropriate feedback.
   */
  async function onSubmit(values: CreateRoomFormValues) {
    setIsSubmitting(true);

    try {
      const input: CreateRoomInput = {
        name: values.name,
        description: values.description,
      };

      const result = await createRoom(input);

      if (result.success) {
        toast.success("Room created", {
          description: `"${values.name}" has been added to your dashboard.`,
        });

        // Reset form and close dialog
        form.reset();
        onOpenChange(false);

        // Trigger refetch to update room list
        await refetch();

        // Call optional callback
        onRoomCreated?.();
      } else {
        toast.error("Failed to create room", {
          description: result.error || "Please try again.",
        });
      }
    } catch (error) {
      console.error("AddRoomDialog submit error:", error);
      toast.error("An unexpected error occurred", {
        description: "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Handles dialog close.
   * Resets form state when dialog is closed.
   */
  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      // Reset form when closing
      form.reset();
    }
    onOpenChange(newOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Home className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Add New Room</DialogTitle>
              <DialogDescription>
                Create a room to group your controllers and monitor your grow space.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    Room Name
                    <HelpTooltip id="room-name" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Veg Room A, Flower Tent 1"
                      autoComplete="off"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for your grow room or space.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add notes about this room..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional notes about size, setup, or growth stage.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Room"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
