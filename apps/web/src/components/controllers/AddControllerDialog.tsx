/**
 * AddControllerDialog Component
 *
 * Multi-step dialog for adding a new controller to EnviroFlow.
 * Steps:
 * 1. Select brand OR discover devices (AC Infinity, Inkbird, CSV Upload)
 * 2. Enter credentials (brand-specific form) OR select from discovered devices
 * 3. Optionally assign to room
 * 4. Name the controller
 *
 * Features:
 * - Device discovery for cloud-connected controllers
 * - Brand-specific credential forms
 * - CSV file upload support
 * - Connection progress indicator
 * - Error handling with retry option
 * - Room assignment
 */
"use client";

import { useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Cpu,
  Upload,
  Wifi,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Search,
  Radar,
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { NetworkDiscovery, type DeviceSelectionResult } from "@/components/controllers/NetworkDiscovery";
import { supportsDiscovery } from "@/lib/network-discovery";
import { ErrorGuidance } from "@/components/ui/error-guidance";
import type { Brand, ControllerBrand, Controller, DiscoveredDevice } from "@/types";

// Form validation schemas
const credentialsSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const controllerNameSchema = z.object({
  name: z.string().min(1, "Controller name is required").max(50, "Name too long"),
  roomId: z.string().optional(),
});

type CredentialsFormData = z.infer<typeof credentialsSchema>;
type ControllerNameFormData = z.infer<typeof controllerNameSchema>;

/**
 * Step indicators for the wizard
 */
const STEPS = [
  { id: 1, label: "Select Brand" },
  { id: 2, label: "Credentials" },
  { id: 3, label: "Name & Room" },
  { id: 4, label: "Connect" },
] as const;

/**
 * Props for AddControllerDialog
 */
interface AddControllerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brands: Brand[];
  rooms: Array<{ id: string; name: string }>;
  /** Auth token for discovery (to check already-registered devices) */
  authToken?: string;
  onAdd: (data: {
    brand: ControllerBrand;
    name: string;
    credentials?: { email?: string; password?: string };
    room_id?: string | null;
    /** Pre-discovered device info (skips connection test) */
    discoveredDevice?: DiscoveredDevice;
  }) => Promise<{ success: boolean; data?: Controller; error?: string }>;
}

/**
 * Brand icon component
 */
function BrandIcon({ brand, className }: { brand: ControllerBrand; className?: string }) {
  switch (brand) {
    case "csv_upload":
      return <Upload className={className} />;
    default:
      return <Cpu className={className} />;
  }
}

/**
 * Step indicator component
 */
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              currentStep >= step.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {step.id}
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={cn(
                "w-8 h-0.5 mx-1",
                currentStep > step.id ? "bg-primary" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * AddControllerDialog - Main component
 */
export function AddControllerDialog({
  open,
  onOpenChange,
  brands,
  rooms,
  authToken,
  onAdd,
}: AddControllerDialogProps) {
  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [credentials, setCredentials] = useState<CredentialsFormData | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Discovery state - for adding devices discovered through network scan
  const [discoveredDevice, setDiscoveredDevice] = useState<DiscoveredDevice | null>(null);
  const [discoveryCredentials, setDiscoveryCredentials] = useState<{ email: string; password: string } | null>(null);
  const [addMode, setAddMode] = useState<"manual" | "discover">("manual");

  // Multi-add state - queue of devices to add
  const [pendingDevices, setPendingDevices] = useState<DeviceSelectionResult[]>([]);
  const [addingMultiple, setAddingMultiple] = useState(false);
  const [multiAddProgress, setMultiAddProgress] = useState({ current: 0, total: 0, results: [] as Array<{ name: string; success: boolean; error?: string }> });

  // Connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "success" | "error">("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<string[]>([]);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Credentials form
  const credentialsForm = useForm<CredentialsFormData>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });

  // Name form
  const nameForm = useForm<ControllerNameFormData>({
    resolver: zodResolver(controllerNameSchema),
    defaultValues: { name: "", roomId: undefined },
  });

  // Filter available brands
  const availableBrands = brands.filter((b) => b.status === "available");
  const comingSoonBrands = brands.filter((b) => b.status === "coming_soon");

  /**
   * Reset dialog state
   */
  const resetDialog = useCallback(() => {
    setStep(1);
    setSelectedBrand(null);
    setCredentials(null);
    setCsvFile(null);
    setDiscoveredDevice(null);
    setDiscoveryCredentials(null);
    setAddMode("manual");
    setIsConnecting(false);
    setConnectionProgress(0);
    setConnectionStatus("idle");
    setConnectionError(null);
    setDiscoveredDevices([]);
    setPendingDevices([]);
    setAddingMultiple(false);
    setMultiAddProgress({ current: 0, total: 0, results: [] });
    credentialsForm.reset();
    nameForm.reset();
  }, [credentialsForm, nameForm]);

  /**
   * Handle dialog close
   */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        resetDialog();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, resetDialog]
  );

  /**
   * Handle brand selection
   */
  const handleBrandSelect = useCallback((brand: Brand) => {
    setSelectedBrand(brand);
    setAddMode("manual");
    setDiscoveredDevice(null);
    // Pre-fill controller name based on brand
    nameForm.setValue("name", `My ${brand.name}`);
    setStep(2);
  }, [nameForm]);

  /**
   * Handle discovered device selection from NetworkDiscovery component
   * Now receives credentials along with the device
   */
  const handleDiscoveredDeviceSelect = useCallback((result: DeviceSelectionResult) => {
    const { device, credentials: creds } = result;
    // Find the brand info for this device
    const brand = brands.find(b => b.id === device.brand);
    if (!brand) return;

    setSelectedBrand(brand);
    setDiscoveredDevice(device);
    setDiscoveryCredentials(creds);
    setAddMode("discover");
    // Pre-fill controller name from discovered device
    nameForm.setValue("name", device.name);
    // Skip credentials step and go directly to name/room step
    setStep(3);
  }, [brands, nameForm]);

  /**
   * Handle multiple device selection from NetworkDiscovery
   * Adds all selected devices at once
   */
  const handleMultipleDeviceSelect = useCallback(async (results: DeviceSelectionResult[]) => {
    if (results.length === 0) return;

    setAddingMultiple(true);
    setMultiAddProgress({ current: 0, total: results.length, results: [] });

    const addResults: Array<{ name: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < results.length; i++) {
      const { device, credentials: creds } = results[i];

      setMultiAddProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        const result = await onAdd({
          brand: device.brand,
          name: device.name,
          credentials: creds,
          room_id: null,
          discoveredDevice: device,
        });

        addResults.push({
          name: device.name,
          success: result.success,
          error: result.error,
        });
      } catch (err) {
        addResults.push({
          name: device.name,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }

      setMultiAddProgress(prev => ({ ...prev, results: [...addResults] }));
    }

    // Show results briefly, then close
    setTimeout(() => {
      handleOpenChange(false);
    }, 2000);
  }, [onAdd, handleOpenChange]);

  /**
   * Handle credentials submit
   */
  const handleCredentialsSubmit = useCallback(
    (data: CredentialsFormData) => {
      setCredentials(data);
      setStep(3);
    },
    []
  );

  /**
   * Handle CSV file selection
   */
  const handleCsvSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setStep(3);
    }
  }, []);

  /**
   * Skip credentials step for CSV upload
   */
  const handleCsvContinue = useCallback(() => {
    if (selectedBrand?.id === "csv_upload") {
      setStep(3);
    }
  }, [selectedBrand]);

  /**
   * Handle final submission and connection
   */
  const handleConnect = useCallback(
    async (data: ControllerNameFormData) => {
      if (!selectedBrand) return;

      setIsConnecting(true);
      setConnectionStatus("connecting");
      setConnectionError(null);
      setConnectionProgress(10);

      try {
        // Simulate connection progress
        const progressInterval = setInterval(() => {
          setConnectionProgress((prev) => Math.min(prev + 15, 85));
        }, 300);

        // Determine which credentials to use:
        // - For discovery flow: use discoveryCredentials (from NetworkDiscovery)
        // - For manual flow: use credentials (from credentials form)
        const effectiveCredentials = addMode === "discover" && discoveryCredentials
          ? discoveryCredentials
          : credentials;

        // Build the request - include discovered device info if available
        const addRequest: Parameters<typeof onAdd>[0] = {
          brand: selectedBrand.id,
          name: data.name,
          credentials: effectiveCredentials || undefined,
          room_id: data.roomId || null,
        };

        // If this is a discovered device, include the device info
        // This allows the backend to skip the connection test and use pre-validated device info
        if (addMode === "discover" && discoveredDevice) {
          addRequest.discoveredDevice = discoveredDevice;
        }

        // Call the add controller function
        const result = await onAdd(addRequest);

        clearInterval(progressInterval);

        if (result.success) {
          setConnectionProgress(100);
          setConnectionStatus("success");

          // Show the device that was added
          if (discoveredDevice) {
            // For discovered devices, show the actual device
            setDiscoveredDevices([discoveredDevice.name]);
          } else if (selectedBrand.id === "ac_infinity") {
            setDiscoveredDevices(["Controller 69 Pro", "UIS Inline Fan", "UIS Light Bar"]);
          } else if (selectedBrand.id === "inkbird") {
            setDiscoveredDevices(["ITC-308 Temp Probe"]);
          } else {
            setDiscoveredDevices(["Manual CSV Data Source"]);
          }

          // Close dialog after short delay on success
          setTimeout(() => {
            handleOpenChange(false);
          }, 2000);
        } else {
          setConnectionProgress(0);
          setConnectionStatus("error");
          setConnectionError(result.error || "Failed to connect");
        }
      } catch (err) {
        setConnectionProgress(0);
        setConnectionStatus("error");
        setConnectionError(err instanceof Error ? err.message : "Connection failed");
      } finally {
        setIsConnecting(false);
      }
    },
    [selectedBrand, credentials, discoveryCredentials, addMode, discoveredDevice, onAdd, handleOpenChange]
  );

  /**
   * Handle retry connection
   */
  const handleRetry = useCallback(() => {
    setConnectionStatus("idle");
    setConnectionError(null);
    setConnectionProgress(0);
    // Re-submit the form
    nameForm.handleSubmit(handleConnect)();
  }, [nameForm, handleConnect]);

  /**
   * Render step content
   */
  const renderStepContent = () => {
    // Show multi-add progress if adding multiple devices
    if (addingMultiple) {
      const successCount = multiAddProgress.results.filter(r => r.success).length;
      const failCount = multiAddProgress.results.filter(r => !r.success).length;

      return (
        <div className="space-y-6 py-4">
          <div className="text-center space-y-4">
            {multiAddProgress.current < multiAddProgress.total ? (
              <>
                <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                <div>
                  <p className="font-medium">Adding devices...</p>
                  <p className="text-sm text-muted-foreground">
                    {multiAddProgress.current} of {multiAddProgress.total}
                  </p>
                </div>
                <Progress value={(multiAddProgress.current / multiAddProgress.total) * 100} className="h-2" />
              </>
            ) : (
              <>
                <CheckCircle className="w-12 h-12 mx-auto text-success" />
                <div>
                  <p className="font-medium text-success">Done!</p>
                  <p className="text-sm text-muted-foreground">
                    Added {successCount} device{successCount !== 1 ? "s" : ""}
                    {failCount > 0 && `, ${failCount} failed`}
                  </p>
                </div>
              </>
            )}
          </div>

          {multiAddProgress.results.length > 0 && (
            <div className="bg-muted rounded-lg p-4 text-left max-h-[200px] overflow-y-auto">
              <p className="text-sm font-medium mb-2">Results:</p>
              <ul className="space-y-1">
                {multiAddProgress.results.map((result, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    )}
                    <span className={result.success ? "" : "text-destructive"}>
                      {result.name}
                      {result.error && <span className="text-xs ml-1">({result.error})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    switch (step) {
      case 1:
        return (
          <Tabs defaultValue="discover" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="discover" className="gap-2">
                <Radar className="w-4 h-4" />
                Discover
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <Search className="w-4 h-4" />
                Manual
              </TabsTrigger>
            </TabsList>

            {/* Discover Tab - Network Discovery */}
            <TabsContent value="discover" className="space-y-4 mt-4">
              <DialogDescription>
                Discover devices registered with your AC Infinity or Inkbird account.
                Enter your app credentials to find and add your devices automatically.
              </DialogDescription>

              <NetworkDiscovery
                onSelectDevice={handleDiscoveredDeviceSelect}
                onSelectMultiple={handleMultipleDeviceSelect}
                authToken={authToken}
                className="border-0 shadow-none p-0"
              />
            </TabsContent>

            {/* Manual Tab - Brand Selection */}
            <TabsContent value="manual" className="space-y-4 mt-4">
              <DialogDescription>
                Select your controller brand to add it manually. You will need to enter
                your credentials in the next step.
              </DialogDescription>

              {/* Available brands */}
              <div className="space-y-3">
                {availableBrands.map((brand) => (
                  <button
                    key={brand.id}
                    onClick={() => handleBrandSelect(brand)}
                    className="w-full flex items-center gap-4 p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      <BrandIcon brand={brand.id} className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{brand.name}</span>
                        {supportsDiscovery(brand.id) && (
                          <Badge variant="outline" className="text-xs">
                            <Radar className="w-3 h-3 mr-1" />
                            Discovery
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {brand.description}
                      </div>
                      {brand.note && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          {brand.note}
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      Available
                    </Badge>
                  </button>
                ))}
              </div>

              {/* Coming soon brands */}
              {comingSoonBrands.length > 0 && (
                <>
                  <div className="text-sm font-medium text-muted-foreground pt-2">
                    Coming Soon
                  </div>
                  <div className="space-y-2">
                    {comingSoonBrands.map((brand) => (
                      <div
                        key={brand.id}
                        className="flex items-center gap-4 p-4 border border-border rounded-lg opacity-60"
                      >
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">
                          <BrandIcon brand={brand.id} className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">{brand.name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {brand.description}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          Coming Soon
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        );

      case 2:
        if (selectedBrand?.id === "csv_upload") {
          return (
            <div className="space-y-4">
              <DialogDescription>
                Upload a CSV file with your sensor data. This is perfect for controllers
                without API access or for importing historical data.
              </DialogDescription>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium text-foreground">
                  {csvFile ? csvFile.name : "Click to upload CSV file"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or drag and drop
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvSelect}
                  className="hidden"
                />
              </div>

              {csvFile && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="text-sm">{csvFile.name}</span>
                </div>
              )}

              <Button
                variant="link"
                className="text-sm"
                onClick={() => window.open("/api/controllers/csv-template", "_blank")}
              >
                Download CSV template
              </Button>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleCsvContinue}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </DialogFooter>
            </div>
          );
        }

        return (
          <form onSubmit={credentialsForm.handleSubmit(handleCredentialsSubmit)} className="space-y-4">
            <DialogDescription>
              Enter your {selectedBrand?.name} account credentials. These are encrypted and
              used only to connect to your devices.
            </DialogDescription>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  {...credentialsForm.register("email")}
                />
                {credentialsForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {credentialsForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  {...credentialsForm.register("password")}
                />
                {credentialsForm.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {credentialsForm.formState.errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {selectedBrand?.helpUrl && (
              <p className="text-xs text-muted-foreground">
                Need help?{" "}
                <a
                  href={selectedBrand.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {selectedBrand.name} Support
                </a>
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button type="submit">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </form>
        );

      case 3:
        return (
          <form onSubmit={nameForm.handleSubmit(handleConnect)} className="space-y-4">
            <DialogDescription>
              {addMode === "discover" && discoveredDevice
                ? "Confirm the device details and optionally assign it to a room."
                : "Give your controller a name and optionally assign it to a room for better organization."
              }
            </DialogDescription>

            {/* Show discovered device info if available */}
            {addMode === "discover" && discoveredDevice && (
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    discoveredDevice.isOnline ? "bg-success/10" : "bg-muted-foreground/10"
                  )}>
                    {discoveredDevice.isOnline ? (
                      <Wifi className="w-5 h-5 text-success" />
                    ) : (
                      <Wifi className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{discoveredDevice.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {discoveredDevice.model || selectedBrand?.name}
                      {discoveredDevice.isOnline && (
                        <span className="text-success ml-2">Online</span>
                      )}
                    </p>
                  </div>
                </div>
                {discoveredDevice.capabilities && (
                  <div className="flex gap-1 flex-wrap">
                    {discoveredDevice.capabilities.sensors?.map((sensor) => (
                      <Badge key={sensor} variant="outline" className="text-xs">
                        {sensor}
                      </Badge>
                    ))}
                    {discoveredDevice.capabilities.supportsDimming && (
                      <Badge variant="outline" className="text-xs">
                        Dimming
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Controller Name</Label>
                <Input
                  id="name"
                  placeholder="My Controller"
                  {...nameForm.register("name")}
                />
                {nameForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {nameForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="room">Room (Optional)</Label>
                <Select
                  value={nameForm.watch("roomId") || "none"}
                  onValueChange={(value) =>
                    nameForm.setValue("roomId", value === "none" ? undefined : value)
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

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // If from discovery, go back to step 1 (discovery tab)
                  // If from manual, go back to credentials (step 2) or step 1
                  if (addMode === "discover") {
                    setStep(1);
                    setDiscoveredDevice(null);
                  } else {
                    setStep(selectedBrand?.requiresCredentials ? 2 : 1);
                  }
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button type="submit" disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {addMode === "discover" ? "Adding..." : "Connecting..."}
                  </>
                ) : (
                  <>
                    {addMode === "discover" ? "Add Controller" : "Connect Controller"}
                    <Wifi className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        );

      case 4:
        return (
          <div className="space-y-6 py-4">
            {connectionStatus === "connecting" && (
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                <div>
                  <p className="font-medium">Connecting to {selectedBrand?.name}...</p>
                  <p className="text-sm text-muted-foreground">
                    Discovering devices and sensors
                  </p>
                </div>
                <Progress value={connectionProgress} className="h-2" />
              </div>
            )}

            {connectionStatus === "success" && (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 mx-auto text-success" />
                <div>
                  <p className="font-medium text-success">Connected Successfully!</p>
                  <p className="text-sm text-muted-foreground">
                    Your controller is now ready to use
                  </p>
                </div>

                {discoveredDevices.length > 0 && (
                  <div className="bg-muted rounded-lg p-4 text-left">
                    <p className="text-sm font-medium mb-2">Discovered Devices:</p>
                    <ul className="space-y-1">
                      {discoveredDevices.map((device, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-success" />
                          {device}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {connectionStatus === "error" && (
              <div className="space-y-4">
                <ErrorGuidance
                  error={connectionError || "Connection failed"}
                  brand={selectedBrand?.id}
                  context="connection"
                  onRetry={handleRetry}
                  defaultExpanded={true}
                />

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setStep(addMode === "discover" ? 1 : 2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {addMode === "discover" ? "Back to Discovery" : "Edit Credentials"}
                  </Button>
                  <Button onClick={handleRetry}>
                    <Loader2 className="w-4 h-4 mr-2" />
                    Retry Connection
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-[500px]",
        // Wider dialog for discovery step to accommodate the NetworkDiscovery component
        step === 1 && "sm:max-w-[600px]"
      )}>
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Add Controller"}
            {step === 2 && (selectedBrand?.id === "csv_upload" ? "Upload CSV" : "Enter Credentials")}
            {step === 3 && (addMode === "discover" ? "Confirm Device" : "Name Your Controller")}
            {step === 4 && (addMode === "discover" ? "Adding Device..." : "Connecting...")}
          </DialogTitle>
        </DialogHeader>

        {/* Only show step indicator for manual flow or after discovery selection */}
        {(addMode === "manual" || step > 1) && (
          <StepIndicator currentStep={step} />
        )}

        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
