/**
 * EditControllerDialog Component
 *
 * Dialog for editing an existing controller's settings.
 * Features:
 * - Edit controller name
 * - Change room assignment
 * - Update credentials (optional, shows masked current)
 * - Re-test connection button
 *
 * @example
 * ```tsx
 * <EditControllerDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   controller={selectedController}
 *   rooms={rooms}
 *   onUpdate={updateController}
 *   onTestConnection={testConnection}
 * />
 * ```
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ControllerWithRoom, Room, UpdateControllerInput } from "@/types";

/**
 * Form validation schema
 */
const editControllerSchema = z.object({
  name: z.string().min(1, "Controller name is required").max(50, "Name too long"),
  roomId: z.string().optional(),
  updateCredentials: z.boolean().default(false),
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  password: z.string().optional().or(z.literal("")),
});

type EditControllerFormData = z.infer<typeof editControllerSchema>;

/**
 * Props for EditControllerDialog
 */
interface EditControllerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Controller to edit */
  controller: ControllerWithRoom | null;
  /** Available rooms for assignment */
  rooms: Array<{ id: string; name: string }>;
  /** Update controller callback */
  onUpdate: (id: string, data: UpdateControllerInput) => Promise<{ success: boolean; error?: string }>;
  /** Test connection callback */
  onTestConnection: (id: string) => Promise<{ success: boolean; data?: { isOnline: boolean }; error?: string }>;
}

/**
 * Brand display names
 */
const BRAND_NAMES: Record<string, string> = {
  ac_infinity: "AC Infinity",
  inkbird: "Inkbird",
  csv_upload: "CSV Upload",
  govee: "Govee",
  mqtt: "MQTT",
  custom: "Custom",
};

/**
 * EditControllerDialog - Main component
 */
export function EditControllerDialog({
  open,
  onOpenChange,
  controller,
  rooms,
  onUpdate,
  onTestConnection,
}: EditControllerDialogProps) {
  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Connection test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; isOnline?: boolean } | null>(null);

  // Form setup
  const form = useForm<EditControllerFormData>({
    resolver: zodResolver(editControllerSchema),
    defaultValues: {
      name: "",
      roomId: undefined,
      updateCredentials: false,
      email: "",
      password: "",
    },
  });

  // Reset form when controller changes
  useEffect(() => {
    if (controller && open) {
      form.reset({
        name: controller.name,
        roomId: controller.room_id || undefined,
        updateCredentials: false,
        email: "",
        password: "",
      });
      setShowCredentials(false);
      setTestResult(null);
      setSubmitError(null);
    }
  }, [controller, open, form]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (data: EditControllerFormData) => {
      if (!controller) return;

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const updateData: UpdateControllerInput = {
          name: data.name,
          room_id: data.roomId === "none" ? null : data.roomId || null,
        };

        // Only include credentials if user chose to update them
        if (data.updateCredentials && data.email && data.password) {
          updateData.credentials = {
            email: data.email,
            password: data.password,
          };
        }

        const result = await onUpdate(controller.id, updateData);

        if (result.success) {
          onOpenChange(false);
        } else {
          setSubmitError(result.error || "Failed to update controller");
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [controller, onUpdate, onOpenChange]
  );

  /**
   * Handle connection test
   */
  const handleTestConnection = useCallback(async () => {
    if (!controller) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await onTestConnection(controller.id);
      setTestResult({
        success: result.success,
        isOnline: result.data?.isOnline,
      });
    } catch (err) {
      setTestResult({ success: false });
    } finally {
      setIsTesting(false);
    }
  }, [controller, onTestConnection]);

  // Watch form values
  const updateCredentials = form.watch("updateCredentials");

  if (!controller) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Controller</DialogTitle>
          <DialogDescription>
            Update the settings for your {BRAND_NAMES[controller.brand] || controller.brand} controller.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Controller Info Header */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                controller.is_online ? "bg-success/10" : "bg-muted"
              )}
            >
              {controller.is_online ? (
                <Wifi className="w-5 h-5 text-success" />
              ) : (
                <WifiOff className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{controller.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {BRAND_NAMES[controller.brand] || controller.brand}
                </Badge>
                <Badge
                  variant={controller.is_online ? "default" : "outline"}
                  className={cn(
                    "text-xs",
                    controller.is_online && "bg-success/10 text-success hover:bg-success/20"
                  )}
                >
                  {controller.is_online ? "Online" : "Offline"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Basic Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Controller Name</Label>
              <Input
                id="name"
                placeholder="My Controller"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="room">Room Assignment</Label>
              <Select
                value={form.watch("roomId") || "none"}
                onValueChange={(value) =>
                  form.setValue("roomId", value === "none" ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No room</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Credentials Section (only for brands that need credentials) */}
          {controller.brand !== "csv_upload" && (
            <>
              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Credentials</Label>
                    <p className="text-sm text-muted-foreground">
                      Update your {BRAND_NAMES[controller.brand]} account credentials
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={showCredentials ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setShowCredentials(!showCredentials);
                      form.setValue("updateCredentials", !showCredentials);
                    }}
                  >
                    {showCredentials ? "Hide" : "Update Credentials"}
                  </Button>
                </div>

                {showCredentials && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        {...form.register("email")}
                      />
                      {form.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">New Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          {...form.register("password")}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Leave password blank if you only want to update the email
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Connection Test Section */}
          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Connection</Label>
                <p className="text-sm text-muted-foreground">
                  Test the connection to your controller
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>

            {testResult && (
              <div
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg",
                  testResult.isOnline
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {testResult.isOnline ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Connection successful</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Connection failed</span>
                  </>
                )}
              </div>
            )}

            {controller.last_error && !testResult && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Last Error</p>
                  <p className="text-sm text-destructive/80">{controller.last_error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
              <XCircle className="w-5 h-5" />
              <span className="text-sm">{submitError}</span>
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
