"use client";

import { useState } from "react";
import { User, Bell, Shield, Palette, Database, Loader2 } from "lucide-react";
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
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useUserPreferences, type TemperatureUnit } from "@/hooks/use-user-preferences";

export default function SettingsPage() {
  const { user } = useAuth();
  const { preferences, updatePreference, isSaving: isSavingPrefs } = useUserPreferences();
  const [name, setName] = useState(user?.user_metadata?.name || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { name },
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been saved.",
      });
    }
    setIsSaving(false);
  };
  return (
    <AppLayout>
      <div className="min-h-screen">
        <PageHeader title="Settings" description="Manage your account and preferences" />

        <div className="p-6 lg:p-8 max-w-3xl">
          {/* Profile Section */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 dark:bg-[rgba(0,212,255,0.1)]">
                <User className="h-5 w-5 text-primary dark:text-[#00d4ff]" />
              </div>
              <h2 className="text-lg font-semibold text-foreground dark:text-[#e8edf4]">Profile</h2>
            </div>

            <div className="bg-card dark:bg-[#151c26] rounded-2xl border border-border dark:border-[rgba(255,255,255,0.06)] p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="dark:text-[#8896a8]">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="dark:bg-[#1e2a3a] dark:border-[rgba(255,255,255,0.06)] dark:text-[#e8edf4] dark:placeholder:text-[#4a5568] dark:focus:border-[#00d4ff]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="dark:text-[#8896a8]">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted dark:bg-[#1e2a3a]/50 dark:border-[rgba(255,255,255,0.04)] dark:text-[#4a5568]"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving} className="dark:bg-[#00d4ff] dark:text-[#0a0e14] dark:hover:bg-[#00d4ff]/90">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </section>

          <Separator className="my-8 dark:bg-[rgba(255,255,255,0.06)]" />

          {/* Notifications Section */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-info/10 dark:bg-[rgba(0,212,255,0.1)]">
                <Bell className="h-5 w-5 text-info dark:text-[#00d4ff]" />
              </div>
              <h2 className="text-lg font-semibold text-foreground dark:text-[#e8edf4]">
                Notifications
              </h2>
            </div>

            <div className="bg-card dark:bg-[#151c26] rounded-2xl border border-border dark:border-[rgba(255,255,255,0.06)] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground dark:text-[#e8edf4]">Email Notifications</p>
                  <p className="text-sm text-muted-foreground dark:text-[#8896a8]">
                    Receive alerts via email
                  </p>
                </div>
                <Switch defaultChecked className="data-[state=checked]:bg-[#00e676]" />
              </div>

              <Separator className="dark:bg-[rgba(255,255,255,0.06)]" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground dark:text-[#e8edf4]">Push Notifications</p>
                  <p className="text-sm text-muted-foreground dark:text-[#8896a8]">
                    Receive alerts on your device
                  </p>
                </div>
                <Switch defaultChecked className="data-[state=checked]:bg-[#00e676]" />
              </div>

              <Separator className="dark:bg-[rgba(255,255,255,0.06)]" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground dark:text-[#e8edf4]">
                    Controller Offline Alerts
                  </p>
                  <p className="text-sm text-muted-foreground dark:text-[#8896a8]">
                    Get notified when a controller goes offline
                  </p>
                </div>
                <Switch defaultChecked className="data-[state=checked]:bg-[#00e676]" />
              </div>
            </div>
          </section>

          <Separator className="my-8 dark:bg-[rgba(255,255,255,0.06)]" />

          {/* Preferences Section */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-warning/10 dark:bg-[rgba(255,145,0,0.1)]">
                <Palette className="h-5 w-5 text-warning dark:text-[#ff9100]" />
              </div>
              <h2 className="text-lg font-semibold text-foreground dark:text-[#e8edf4]">Preferences</h2>
            </div>

            <div className="bg-card dark:bg-[#151c26] rounded-2xl border border-border dark:border-[rgba(255,255,255,0.06)] p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-[#8896a8]">Temperature Unit</Label>
                  <Select
                    value={preferences.temperatureUnit === "F" ? "fahrenheit" : "celsius"}
                    onValueChange={(value) => {
                      const unit: TemperatureUnit = value === "celsius" ? "C" : "F";
                      updatePreference("temperatureUnit", unit);
                      toast({
                        title: "Temperature unit updated",
                        description: `Now displaying temperatures in ${value === "celsius" ? "Celsius (°C)" : "Fahrenheit (°F)"}`,
                      });
                    }}
                  >
                    <SelectTrigger className="dark:bg-[#1e2a3a] dark:border-[rgba(255,255,255,0.06)] dark:text-[#e8edf4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#1e2a3a] dark:border-[rgba(255,255,255,0.06)]">
                      <SelectItem value="fahrenheit" className="dark:text-[#e8edf4] dark:focus:bg-[rgba(0,212,255,0.1)] dark:focus:text-[#00d4ff]">Fahrenheit (°F)</SelectItem>
                      <SelectItem value="celsius" className="dark:text-[#e8edf4] dark:focus:bg-[rgba(0,212,255,0.1)] dark:focus:text-[#00d4ff]">Celsius (°C)</SelectItem>
                    </SelectContent>
                  </Select>
                  {isSavingPrefs && (
                    <p className="text-xs text-muted-foreground dark:text-[#4a5568]">Saving...</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-[#8896a8]">Time Zone</Label>
                  <Select defaultValue="pst">
                    <SelectTrigger className="dark:bg-[#1e2a3a] dark:border-[rgba(255,255,255,0.06)] dark:text-[#e8edf4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#1e2a3a] dark:border-[rgba(255,255,255,0.06)]">
                      <SelectItem value="pst" className="dark:text-[#e8edf4] dark:focus:bg-[rgba(0,212,255,0.1)] dark:focus:text-[#00d4ff]">Pacific Time (PT)</SelectItem>
                      <SelectItem value="mst" className="dark:text-[#e8edf4] dark:focus:bg-[rgba(0,212,255,0.1)] dark:focus:text-[#00d4ff]">Mountain Time (MT)</SelectItem>
                      <SelectItem value="cst" className="dark:text-[#e8edf4] dark:focus:bg-[rgba(0,212,255,0.1)] dark:focus:text-[#00d4ff]">Central Time (CT)</SelectItem>
                      <SelectItem value="est" className="dark:text-[#e8edf4] dark:focus:bg-[rgba(0,212,255,0.1)] dark:focus:text-[#00d4ff]">Eastern Time (ET)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8 dark:bg-[rgba(255,255,255,0.06)]" />

          {/* Security Section */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-destructive/10 dark:bg-[rgba(255,82,82,0.1)]">
                <Shield className="h-5 w-5 text-destructive dark:text-[#ff5252]" />
              </div>
              <h2 className="text-lg font-semibold text-foreground dark:text-[#e8edf4]">Security</h2>
            </div>

            <div className="bg-card dark:bg-[#151c26] rounded-2xl border border-border dark:border-[rgba(255,255,255,0.06)] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground dark:text-[#e8edf4]">Change Password</p>
                  <p className="text-sm text-muted-foreground dark:text-[#8896a8]">
                    Update your account password
                  </p>
                </div>
                <Button variant="outline" className="dark:border-[rgba(255,255,255,0.1)] dark:text-[#8896a8] dark:hover:bg-[#1e2a3a] dark:hover:text-[#e8edf4]">Change</Button>
              </div>

              <Separator className="dark:bg-[rgba(255,255,255,0.06)]" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground dark:text-[#e8edf4]">
                    Two-Factor Authentication
                  </p>
                  <p className="text-sm text-muted-foreground dark:text-[#8896a8]">
                    Add an extra layer of security
                  </p>
                </div>
                <Button variant="outline" className="dark:border-[rgba(255,255,255,0.1)] dark:text-[#8896a8] dark:hover:bg-[#1e2a3a] dark:hover:text-[#e8edf4]">Enable</Button>
              </div>
            </div>
          </section>

          <Separator className="my-8 dark:bg-[rgba(255,255,255,0.06)]" />

          {/* Data Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-success/10 dark:bg-[rgba(0,230,118,0.1)]">
                <Database className="h-5 w-5 text-success dark:text-[#00e676]" />
              </div>
              <h2 className="text-lg font-semibold text-foreground dark:text-[#e8edf4]">Data</h2>
            </div>

            <div className="bg-card dark:bg-[#151c26] rounded-2xl border border-border dark:border-[rgba(255,255,255,0.06)] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground dark:text-[#e8edf4]">Export Data</p>
                  <p className="text-sm text-muted-foreground dark:text-[#8896a8]">
                    Download all your data as JSON
                  </p>
                </div>
                <Button variant="outline" className="dark:border-[rgba(255,255,255,0.1)] dark:text-[#8896a8] dark:hover:bg-[#1e2a3a] dark:hover:text-[#e8edf4]">Export</Button>
              </div>

              <Separator className="dark:bg-[rgba(255,255,255,0.06)]" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive dark:text-[#ff5252]">Delete Account</p>
                  <p className="text-sm text-muted-foreground dark:text-[#8896a8]">
                    Permanently delete your account and data
                  </p>
                </div>
                <Button variant="destructive" className="dark:bg-[rgba(255,82,82,0.2)] dark:text-[#ff5252] dark:hover:bg-[rgba(255,82,82,0.3)] dark:border-[rgba(255,82,82,0.3)]">Delete</Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
