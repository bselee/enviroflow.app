/**
 * AddControllerDialog Component
 *
 * Multi-step dialog for adding a new controller to EnviroFlow.
 * Steps:
 * 1. Select brand (AC Infinity, Inkbird, CSV Upload)
 * 2. Enter credentials (brand-specific form)
 * 3. Optionally assign to room
 * 4. Name the controller
 *
 * Features:
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
import { cn } from "@/lib/utils";
import type { Brand, ControllerBrand, Room, Controller } from "@/types";

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
  onAdd: (data: {
    brand: ControllerBrand;
    name: string;
    credentials?: { email?: string; password?: string };
    room_id?: string | null;
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
  onAdd,
}: AddControllerDialogProps) {
  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [credentials, setCredentials] = useState<CredentialsFormData | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);

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
    setIsConnecting(false);
    setConnectionProgress(0);
    setConnectionStatus("idle");
    setConnectionError(null);
    setDiscoveredDevices([]);
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
    // Pre-fill controller name based on brand
    nameForm.setValue("name", `My ${brand.name}`);
    setStep(2);
  }, [nameForm]);

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

        // Call the add controller function
        const result = await onAdd({
          brand: selectedBrand.id,
          name: data.name,
          credentials: credentials || undefined,
          room_id: data.roomId || null,
        });

        clearInterval(progressInterval);

        if (result.success) {
          setConnectionProgress(100);
          setConnectionStatus("success");

          // Simulate discovered devices for demo
          if (selectedBrand.id === "ac_infinity") {
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
    [selectedBrand, credentials, onAdd, handleOpenChange]
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
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <DialogDescription>
              Select your controller brand to get started. We support major environmental
              controller brands with automatic device discovery.
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
                    <div className="font-medium text-foreground">{brand.name}</div>
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
          </div>
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
              Give your controller a name and optionally assign it to a room for better
              organization.
            </DialogDescription>

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
                onClick={() => setStep(selectedBrand?.requiresCredentials ? 2 : 1)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button type="submit" disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect Controller
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
              <div className="text-center space-y-4">
                <XCircle className="w-12 h-12 mx-auto text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Connection Failed</p>
                  <p className="text-sm text-muted-foreground">{connectionError}</p>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg text-left">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Troubleshooting Tips:
                    </p>
                    <ul className="text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                      <li>Check your email and password</li>
                      <li>Ensure your controller is powered on</li>
                      <li>Verify your controller is connected to WiFi</li>
                    </ul>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Edit Credentials
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Add Controller"}
            {step === 2 && (selectedBrand?.id === "csv_upload" ? "Upload CSV" : "Enter Credentials")}
            {step === 3 && "Name Your Controller"}
            {step === 4 && "Connecting..."}
          </DialogTitle>
        </DialogHeader>

        <StepIndicator currentStep={step} />

        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
