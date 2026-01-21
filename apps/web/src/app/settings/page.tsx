"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { createClient, User as SupabaseUser } from "@supabase/supabase-js";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/settings/TwoFactorDialog";

/**
 * User preferences stored in user metadata
 */
interface UserPreferences {
  displayName?: string;
  temperatureUnit?: "fahrenheit" | "celsius";
  timezone?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  offlineAlerts?: boolean;
}

/**
 * Settings Page Component
 *
 * Provides user account management functionality including:
 * - Profile settings (display name, email)
 * - Notification preferences
 * - Temperature and timezone preferences
 * - Security settings (password, 2FA)
 * - Data export and account deletion
 *
 * All settings are synchronized with Supabase Auth user metadata.
 */
export default function SettingsPage() {
  // User state
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [temperatureUnit, setTemperatureUnit] = useState<"fahrenheit" | "celsius">("fahrenheit");
  const [timezone, setTimezone] = useState("pst");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [offlineAlerts, setOfflineAlerts] = useState(true);

  // 2FA state
  const [has2FA, setHas2FA] = useState(false);

  // Delete account state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Get Supabase client instance
   */
  const getSupabase = useCallback(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("Supabase configuration is missing");
    }

    return createClient(url, key);
  }, []);

  /**
   * Load user profile on mount
   */
  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = getSupabase();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          console.error("Failed to load user:", error);
          return;
        }

        if (user) {
          setUser(user);

          // Load preferences from user metadata
          const metadata = user.user_metadata || {};
          setDisplayName(metadata.displayName || metadata.full_name || "");
          setEmail(user.email || "");
          setTemperatureUnit(metadata.temperatureUnit || "fahrenheit");
          setTimezone(metadata.timezone || "pst");
          setEmailNotifications(metadata.emailNotifications !== false);
          setPushNotifications(metadata.pushNotifications !== false);
          setOfflineAlerts(metadata.offlineAlerts !== false);

          // Check 2FA status
          const { data: factors } = await supabase.auth.mfa.listFactors();
          setHas2FA(Boolean(factors?.totp && factors.totp.length > 0));
        }
      } catch (err) {
        console.error("Error loading user:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [getSupabase]);

  /**
   * Clears save message after delay
   */
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  /**
   * Saves profile changes to Supabase
   */
  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const supabase = getSupabase();

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          displayName,
          temperatureUnit,
          timezone,
          emailNotifications,
          pushNotifications,
          offlineAlerts,
        },
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      // If email changed, update it (requires confirmation)
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email,
        });

        if (emailError) {
          throw new Error(emailError.message);
        }

        setSaveMessage({
          type: "success",
          text: "Profile saved. Check your email to confirm the email change.",
        });
      } else {
        setSaveMessage({
          type: "success",
          text: "Profile saved successfully!",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setSaveMessage({
        type: "error",
        text: message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Exports all user data as JSON
   */
  const handleExportData = async () => {
    if (!user) return;

    setIsExporting(true);

    try {
      const supabase = getSupabase();

      // Fetch all user data
      const [
        controllersRes,
        roomsRes,
        workflowsRes,
        activityRes,
        readingsRes,
      ] = await Promise.all([
        supabase.from("controllers").select("*").eq("user_id", user.id),
        supabase.from("rooms").select("*").eq("user_id", user.id),
        supabase.from("workflows").select("*").eq("user_id", user.id),
        supabase.from("activity_logs").select("*").eq("user_id", user.id).order("timestamp", { ascending: false }).limit(1000),
        supabase.from("sensor_readings").select("*").eq("user_id", user.id).order("timestamp", { ascending: false }).limit(1000),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          metadata: user.user_metadata,
        },
        controllers: controllersRes.data || [],
        rooms: roomsRes.data || [],
        workflows: workflowsRes.data || [],
        activityLogs: activityRes.data || [],
        sensorReadings: readingsRes.data || [],
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `enviroflow-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSaveMessage({
        type: "success",
        text: "Data exported successfully!",
      });
    } catch (err) {
      console.error("Export error:", err);
      setSaveMessage({
        type: "error",
        text: "Failed to export data. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Deletes user account and all associated data
   */
  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== "DELETE") return;

    setIsDeleting(true);

    try {
      const supabase = getSupabase();

      // Delete user data (cascade delete should handle related records)
      // Note: In production, you may want to use a server-side function
      // to ensure complete cleanup
      await Promise.all([
        supabase.from("activity_logs").delete().eq("user_id", user.id),
        supabase.from("sensor_readings").delete().eq("user_id", user.id),
        supabase.from("workflows").delete().eq("user_id", user.id),
        supabase.from("controllers").delete().eq("user_id", user.id),
        supabase.from("rooms").delete().eq("user_id", user.id),
        supabase.from("push_tokens").delete().eq("user_id", user.id),
      ]);

      // Sign out and redirect
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err) {
      console.error("Delete account error:", err);
      setSaveMessage({
        type: "error",
        text: "Failed to delete account. Please contact support.",
      });
      setIsDeleting(false);
    }
  };

  /**
   * Formats date for display
   */
  const formatDate = (dateString?: string): string => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <p className="text-muted-foreground">
              Please sign in to access settings.
            </p>
            <Button onClick={() => (window.location.href = "/login")}>
              Sign In
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen">
        <PageHeader
          title="Settings"
          description="Manage your account and preferences"
        />

        <div className="p-6 lg:p-8 max-w-3xl">
          {/* Save Message */}
          {saveMessage && (
            <div
              className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
                saveMessage.type === "success"
                  ? "bg-green-500/10 text-green-500"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {saveMessage.type === "success" ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
              {saveMessage.text}
            </div>
          )}

          {/* Profile Section */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Profile</h2>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Account Info */}
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Account created: {formatDate(user.created_at)}
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Notifications Section */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-info/10">
                <Bell className="h-5 w-5 text-info" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Notifications
              </h2>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Email Notifications
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts via email
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Push Notifications
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts on your device
                  </p>
                </div>
                <Switch
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Controller Offline Alerts
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when a controller goes offline
                  </p>
                </div>
                <Switch
                  checked={offlineAlerts}
                  onCheckedChange={setOfflineAlerts}
                />
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Preferences Section */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-warning/10">
                <Palette className="h-5 w-5 text-warning" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Preferences
              </h2>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Temperature Unit</Label>
                  <Select
                    value={temperatureUnit}
                    onValueChange={(v) =>
                      setTemperatureUnit(v as "fahrenheit" | "celsius")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fahrenheit">
                        Fahrenheit (F)
                      </SelectItem>
                      <SelectItem value="celsius">Celsius (C)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time Zone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pst">Pacific Time (PT)</SelectItem>
                      <SelectItem value="mst">Mountain Time (MT)</SelectItem>
                      <SelectItem value="cst">Central Time (CT)</SelectItem>
                      <SelectItem value="est">Eastern Time (ET)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Security Section */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Shield className="h-5 w-5 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Security
              </h2>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Change Password</p>
                  <p className="text-sm text-muted-foreground">
                    Update your account password
                  </p>
                </div>
                <ChangePasswordDialog
                  onSuccess={() =>
                    setSaveMessage({
                      type: "success",
                      text: "Password changed successfully!",
                    })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Two-Factor Authentication
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {has2FA
                      ? "2FA is enabled for your account"
                      : "Add an extra layer of security"}
                  </p>
                </div>
                <TwoFactorDialog
                  isEnabled={has2FA}
                  onStatusChange={(enabled) => {
                    setHas2FA(enabled);
                    setSaveMessage({
                      type: "success",
                      text: enabled ? "2FA enabled successfully!" : "2FA disabled",
                    });
                  }}
                  trigger={
                    <Button variant="outline">
                      {has2FA ? "Manage" : "Enable"}
                    </Button>
                  }
                />
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Data Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-success/10">
                <Database className="h-5 w-5 text-success" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Data</h2>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Export Data</p>
                  <p className="text-sm text-muted-foreground">
                    Download all your data as JSON
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleExportData}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    "Export"
                  )}
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and data
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Account</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-4">
                        <p>
                          This action cannot be undone. This will permanently
                          delete your account and remove all associated data
                          including:
                        </p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          <li>All controllers and their configurations</li>
                          <li>All rooms and workflows</li>
                          <li>All sensor readings and activity logs</li>
                          <li>All notification settings</li>
                        </ul>
                        <div className="pt-4">
                          <Label htmlFor="delete-confirm">
                            Type DELETE to confirm:
                          </Label>
                          <Input
                            id="delete-confirm"
                            value={deleteConfirmText}
                            onChange={(e) =>
                              setDeleteConfirmText(e.target.value.toUpperCase())
                            }
                            placeholder="DELETE"
                            className="mt-2"
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => setDeleteConfirmText("")}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== "DELETE" || isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete Account"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
