"use client";

import { User, Bell, Shield, Palette, Database } from "lucide-react";
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

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="min-h-screen">
        <PageHeader title="Settings" description="Manage your account and preferences" />

        <div className="p-6 lg:p-8 max-w-3xl">
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
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" defaultValue="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="john@example.com" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button>Save Changes</Button>
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
                  <p className="font-medium text-foreground">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts via email
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts on your device
                  </p>
                </div>
                <Switch defaultChecked />
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
                <Switch defaultChecked />
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
              <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Temperature Unit</Label>
                  <Select defaultValue="fahrenheit">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem>
                      <SelectItem value="celsius">Celsius (°C)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time Zone</Label>
                  <Select defaultValue="pst">
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
              <h2 className="text-lg font-semibold text-foreground">Security</h2>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Change Password</p>
                  <p className="text-sm text-muted-foreground">
                    Update your account password
                  </p>
                </div>
                <Button variant="outline">Change</Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Two-Factor Authentication
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security
                  </p>
                </div>
                <Button variant="outline">Enable</Button>
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
                <Button variant="outline">Export</Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and data
                  </p>
                </div>
                <Button variant="destructive">Delete</Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
