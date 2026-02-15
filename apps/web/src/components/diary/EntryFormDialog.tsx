"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RichTextEditor } from "@/components/diary/RichTextEditor";
import { TagSelector } from "@/components/diary/TagSelector";
import type { DiaryEntryTag, DiaryEntryWithPhotos, CreateDiaryEntryInput, UpdateDiaryEntryInput } from "@/types";
import { cn } from "@/lib/utils";

// Validation schema
const entryFormSchema = z.object({
  title: z.string().max(200, "Title must be 200 characters or less").optional(),
  content: z.string().min(1, "Content is required").max(50000, "Content must be 50,000 characters or less"),
  tags: z.array(z.string()).default([]),
  entry_date: z.date(),
  capture_sensor_snapshot: z.boolean().default(true),
});

type EntryFormValues = z.infer<typeof entryFormSchema>;

interface EntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: DiaryEntryWithPhotos | null;
  onSubmit: (input: CreateDiaryEntryInput | UpdateDiaryEntryInput) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Dialog form for creating or editing diary entries.
 *
 * Features:
 * - Entry date/time picker
 * - Title (optional)
 * - Rich text editor for content
 * - Tag selector
 * - Sensor snapshot capture toggle
 * - Photo upload placeholder (Phase 3)
 */
export function EntryFormDialog({ open, onOpenChange, entry, onSubmit }: EntryFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!entry;

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: {
      title: "",
      content: "",
      tags: [],
      entry_date: new Date(),
      capture_sensor_snapshot: true,
    },
  });

  // Reset form when dialog opens with entry data
  useEffect(() => {
    if (open) {
      if (entry) {
        form.reset({
          title: entry.title || "",
          content: entry.content,
          tags: entry.tags || [],
          entry_date: new Date(entry.entry_date),
          capture_sensor_snapshot: false, // Don't capture on edit
        });
      } else {
        form.reset({
          title: "",
          content: "",
          tags: [],
          entry_date: new Date(),
          capture_sensor_snapshot: true,
        });
      }
    }
  }, [open, entry, form]);

  const handleSubmit = async (values: EntryFormValues) => {
    setIsSubmitting(true);

    try {
      const input = {
        title: values.title || undefined,
        content: values.content,
        tags: values.tags as DiaryEntryTag[],
        entry_date: values.entry_date.toISOString(),
        ...(isEditing ? {} : { capture_sensor_snapshot: values.capture_sensor_snapshot }),
      };

      const result = await onSubmit(input);

      if (result.success) {
        onOpenChange(false);
        form.reset();
      } else {
        // Show error in form
        form.setError("root", {
          message: result.error || "Failed to save entry",
        });
      }
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Entry" : "New Diary Entry"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your diary entry details."
              : "Document your diary cycle progress with a new entry."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Entry Date/Time */}
            <FormField
              control={form.control}
              name="entry_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Entry Date & Time</FormLabel>
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
                            format(field.value, "PPP 'at' p")
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
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    When did this event occur? Defaults to now.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title (optional) */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., First signs of flowering"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rich Text Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entry Content</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value}
                      onChange={field.onChange}
                      placeholder="Write your diary entry..."
                    />
                  </FormControl>
                  <FormDescription>
                    Document observations, actions taken, or notes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags */}
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <TagSelector
                      selectedTags={field.value as DiaryEntryTag[]}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    Categorize your entry for easier filtering.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sensor Snapshot Toggle (only for new entries) */}
            {!isEditing && (
              <FormField
                control={form.control}
                name="capture_sensor_snapshot"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Capture Sensor Snapshot</FormLabel>
                      <FormDescription>
                        Save current environmental readings with this entry.
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
            )}

            {/* Photo Upload Placeholder */}
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <div className="text-4xl mb-2">📷</div>
              <p className="text-sm">Photo upload coming in Phase 3</p>
            </div>

            {/* Error Message */}
            {form.formState.errors.root && (
              <div className="rounded-lg bg-destructive/10 border border-destructive text-destructive px-4 py-3 text-sm">
                {form.formState.errors.root.message}
              </div>
            )}

            {/* Actions */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Entry" : "Create Entry"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
