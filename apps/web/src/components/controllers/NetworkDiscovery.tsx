/**
 * NetworkDiscovery Component
 *
 * Provides cloud-based device discovery functionality for supported controller brands.
 * Users can enter their cloud credentials to discover all devices registered with
 * their account, then select devices to add to EnviroFlow.
 *
 * Features:
 * - Brand selection (AC Infinity, Inkbird)
 * - Credential form with validation
 * - Real-time scan progress indication
 * - Device list with online status
 * - Mark already-registered devices
 * - Select devices to add
 * - Error handling with retry option
 */
"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Search,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  Cpu,
  Thermometer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { discoverDevices, supportsDiscovery } from "@/lib/network-discovery";
import type { ControllerBrand, DiscoveredDevice } from "@/types";

// Form validation schema
const discoveryFormSchema = z.object({
  brand: z.enum(["ac_infinity", "inkbird"]),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type DiscoveryFormData = z.infer<typeof discoveryFormSchema>;

/**
 * Brand configuration for the discovery form
 */
const DISCOVERABLE_BRANDS = [
  {
    id: "ac_infinity" as const,
    name: "AC Infinity",
    description: "Controller 69, UIS Series",
    icon: Cpu,
    helpText: "Enter your AC Infinity app login credentials",
  },
  {
    id: "inkbird" as const,
    name: "Inkbird",
    description: "ITC-308, ITC-310T, IHC-200",
    icon: Thermometer,
    helpText: "Enter your Inkbird app login credentials",
  },
];

/**
 * Props for the NetworkDiscovery component
 */
interface NetworkDiscoveryProps {
  /** Callback when user selects a device to add */
  onSelectDevice: (device: DiscoveredDevice) => void;
  /** Optional: Initial brand to pre-select */
  initialBrand?: ControllerBrand;
  /** Optional: Auth token for checking already-registered devices */
  authToken?: string;
  /** Optional: Additional CSS classes */
  className?: string;
}

/**
 * Discovery state type
 */
type DiscoveryState =
  | "idle"           // Initial state, ready to start
  | "scanning"       // Discovery in progress
  | "success"        // Discovery completed with results
  | "no_devices"     // Discovery completed but no devices found
  | "error";         // Discovery failed

/**
 * NetworkDiscovery Component
 */
export function NetworkDiscovery({
  onSelectDevice,
  initialBrand,
  authToken,
  className,
}: NetworkDiscoveryProps) {
  // Form state
  const form = useForm<DiscoveryFormData>({
    resolver: zodResolver(discoveryFormSchema),
    defaultValues: {
      brand: initialBrand && supportsDiscovery(initialBrand)
        ? initialBrand as "ac_infinity" | "inkbird"
        : "ac_infinity",
      email: "",
      password: "",
    },
  });

  // Discovery state
  const [state, setState] = useState<DiscoveryState>("idle");
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showRegistered, setShowRegistered] = useState(false);

  // Get current brand info
  const selectedBrand = DISCOVERABLE_BRANDS.find(
    (b) => b.id === form.watch("brand")
  );

  /**
   * Handle form submission - start discovery
   */
  const handleSubmit = useCallback(
    async (data: DiscoveryFormData) => {
      setState("scanning");
      setError(null);
      setDevices([]);
      setProgress(10);

      // Simulate progress animation
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 85));
      }, 200);

      try {
        const result = await discoverDevices(
          {
            brand: data.brand,
            email: data.email,
            password: data.password,
          },
          authToken
        );

        clearInterval(progressInterval);

        if (!result.success) {
          setState("error");
          setError(result.error || "Discovery failed");
          setProgress(0);
          return;
        }

        setProgress(100);

        if (result.devices.length === 0) {
          setState("no_devices");
        } else {
          setDevices(result.devices);
          setState("success");
        }
      } catch (err) {
        clearInterval(progressInterval);
        setState("error");
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
        setProgress(0);
      }
    },
    [authToken]
  );

  /**
   * Handle retry after error
   */
  const handleRetry = useCallback(() => {
    setState("idle");
    setError(null);
    setProgress(0);
  }, []);

  /**
   * Handle device selection
   */
  const handleSelectDevice = useCallback(
    (device: DiscoveredDevice) => {
      onSelectDevice(device);
    },
    [onSelectDevice]
  );

  /**
   * Filter devices based on showRegistered toggle
   */
  const filteredDevices = showRegistered
    ? devices
    : devices.filter((d) => !d.isAlreadyRegistered);

  /**
   * Render content based on current state
   */
  const renderContent = () => {
    switch (state) {
      case "idle":
        return (
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Brand Selection */}
            <div className="space-y-2">
              <Label>Controller Brand</Label>
              <Select
                value={form.watch("brand")}
                onValueChange={(value) =>
                  form.setValue("brand", value as "ac_infinity" | "inkbird")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCOVERABLE_BRANDS.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      <div className="flex items-center gap-2">
                        <brand.icon className="w-4 h-4" />
                        <span>{brand.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBrand && (
                <p className="text-xs text-muted-foreground">
                  {selectedBrand.helpText}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="discover-email">Email</Label>
              <Input
                id="discover-email"
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

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="discover-password">Password</Label>
              <Input
                id="discover-password"
                type="password"
                placeholder="Enter your password"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Security Note */}
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              Your credentials are used only for discovery and are NOT stored.
              We connect directly to the {selectedBrand?.name} cloud to find your
              devices.
            </p>

            {/* Submit Button */}
            <Button type="submit" className="w-full">
              <Search className="w-4 h-4 mr-2" />
              Discover Devices
            </Button>
          </form>
        );

      case "scanning":
        return (
          <div className="text-center space-y-4 py-8">
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <div>
              <p className="font-medium">Discovering devices...</p>
              <p className="text-sm text-muted-foreground">
                Connecting to {selectedBrand?.name} cloud
              </p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        );

      case "success":
        return (
          <div className="space-y-4">
            {/* Header with count and toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  Found {devices.length} device{devices.length !== 1 ? "s" : ""}
                </p>
                {devices.some((d) => d.isAlreadyRegistered) && (
                  <p className="text-xs text-muted-foreground">
                    {devices.filter((d) => d.isAlreadyRegistered).length} already
                    in EnviroFlow
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegistered(!showRegistered)}
              >
                {showRegistered ? "Hide Registered" : "Show All"}
              </Button>
            </div>

            {/* Device List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {filteredDevices.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  All devices are already registered.
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowRegistered(true)}
                    className="px-1"
                  >
                    Show all devices
                  </Button>
                </p>
              ) : (
                filteredDevices.map((device) => (
                  <DeviceCard
                    key={device.deviceId}
                    device={device}
                    onSelect={handleSelectDevice}
                  />
                ))
              )}
            </div>

            {/* Scan Again Button */}
            <Button
              variant="outline"
              onClick={handleRetry}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Scan Again
            </Button>
          </div>
        );

      case "no_devices":
        return (
          <div className="text-center space-y-4 py-8">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No devices found</p>
              <p className="text-sm text-muted-foreground">
                Make sure your {selectedBrand?.name} devices are registered in the
                app and try again.
              </p>
            </div>
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        );

      case "error":
        return (
          <div className="text-center space-y-4 py-8">
            <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-destructive">Discovery Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-md text-left">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Troubleshooting Tips:
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-300 mt-1 space-y-1 list-disc list-inside">
                <li>Verify your email and password are correct</li>
                <li>Check if you can log in to the {selectedBrand?.name} app</li>
                <li>Ensure your account has devices registered</li>
              </ul>
            </div>
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Discover Devices
        </CardTitle>
        <CardDescription>
          Find devices registered with your {selectedBrand?.name || "controller"}{" "}
          account
        </CardDescription>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}

/**
 * Device Card Component
 */
interface DeviceCardProps {
  device: DiscoveredDevice;
  onSelect: (device: DiscoveredDevice) => void;
}

function DeviceCard({ device, onSelect }: DeviceCardProps) {
  const BrandIcon = device.brand === "ac_infinity" ? Cpu : Thermometer;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors",
        device.isAlreadyRegistered
          ? "bg-muted/50 border-muted"
          : "bg-card border-border hover:border-primary"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Status Indicator */}
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            device.isOnline ? "bg-success/10" : "bg-muted"
          )}
        >
          {device.isOnline ? (
            <Wifi className="w-5 h-5 text-success" />
          ) : (
            <WifiOff className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Device Info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{device.name}</span>
            {device.isAlreadyRegistered && (
              <Badge variant="secondary" className="text-xs">
                <CheckCircle className="w-3 h-3 mr-1" />
                Added
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BrandIcon className="w-3 h-3" />
            <span>{device.model || device.brand}</span>
            {device.isOnline && (
              <>
                <span className="text-success">Online</span>
              </>
            )}
          </div>
          {device.capabilities && (
            <div className="flex gap-1 mt-1">
              {device.capabilities.sensors?.slice(0, 3).map((sensor) => (
                <Badge
                  key={sensor}
                  variant="outline"
                  className="text-[10px] px-1 py-0"
                >
                  {sensor}
                </Badge>
              ))}
              {device.capabilities.supportsDimming && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  Dimming
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Button */}
      {!device.isAlreadyRegistered && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelect(device)}
          className="shrink-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      )}
    </div>
  );
}

export default NetworkDiscovery;
