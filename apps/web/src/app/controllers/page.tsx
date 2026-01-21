"use client";

import { useState } from "react";
import { Plus, Cpu, Wifi, WifiOff, MoreVertical, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { mockControllers, MockController as Controller } from "@/data/mockData";
import { AppLayout } from "@/components/layout/AppLayout";

const brands = [
  {
    id: "ac_infinity",
    name: "AC Infinity",
    description: "Controller 69, UIS Series",
    icon: Cpu,
  },
  {
    id: "inkbird",
    name: "Inkbird",
    description: "WiFi Controllers",
    icon: Cpu,
  },
  {
    id: "generic_wifi",
    name: "Generic WiFi",
    description: "Other brands",
    icon: Cpu,
  },
] as const;

function ControllerCard({ controller }: { controller: Controller }) {
  const brandInfo = brands.find((b) => b.id === controller.brand);

  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center",
              controller.isOnline ? "bg-success/10" : "bg-muted"
            )}
          >
            {controller.isOnline ? (
              <Wifi className="w-6 h-6 text-success" />
            ) : (
              <WifiOff className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{controller.name}</h3>
            <p className="text-sm text-muted-foreground">{brandInfo?.name}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  controller.isOnline
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {controller.isOnline ? "Online" : "Offline"}
              </Badge>
              {controller.roomName && (
                <Badge variant="outline" className="text-xs">
                  {controller.roomName}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Assign to Room</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>ID: {controller.controllerId}</span>
          <span>Last seen: {controller.lastSeen}</span>
        </div>
      </div>
    </div>
  );
}

export default function ControllersPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const handleBrandSelect = (brandId: string) => {
    setSelectedBrand(brandId);
    setStep(2);
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setSelectedBrand(null);
    setStep(1);
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        <PageHeader
          title="Controllers"
          description="Manage your connected controllers"
          actions={
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Controller
            </Button>
          }
        />

        <div className="p-6 lg:p-8">
          {mockControllers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {mockControllers.map((controller) => (
                <ControllerCard key={controller.id} controller={controller} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Cpu className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No controllers yet
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Get started by adding your first controller
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Controller
              </Button>
            </div>
          )}
        </div>

        {/* Add Controller Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {step === 1 ? "Add Controller" : "Enter Credentials"}
              </DialogTitle>
              <DialogDescription>
                {step === 1
                  ? "Select your controller brand to get started"
                  : "Enter your controller credentials"}
              </DialogDescription>
            </DialogHeader>

            {step === 1 ? (
              <div className="space-y-3 py-4">
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    onClick={() => handleBrandSelect(brand.id)}
                    className="w-full flex items-center gap-3 p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                      <brand.icon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {brand.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {brand.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="controller-name">Controller Name</Label>
                  <Input id="controller-name" placeholder="My Controller" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key / Token</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your API key"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleCloseDialog} className="flex-1">
                    Add Controller
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
