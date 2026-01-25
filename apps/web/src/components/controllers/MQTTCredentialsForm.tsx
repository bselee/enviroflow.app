/**
 * MQTTCredentialsForm Component
 *
 * Specialized credentials form for MQTT broker configuration.
 * Supports:
 * - Broker URL and port configuration
 * - Optional authentication (username/password)
 * - TLS/SSL encryption toggle
 * - Topic prefix configuration
 * - Connection testing with real-time feedback
 *
 * Help text includes examples for:
 * - Mosquitto
 * - HiveMQ
 * - AWS IoT
 * - Home Assistant
 */
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle, XCircle, Info, Eye, EyeOff, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Form validation schema
const mqttCredentialsSchema = z.object({
  brokerUrl: z.string()
    .min(1, "Broker URL is required")
    .refine(
      (url) => {
        try {
          // Allow URLs with or without protocol
          if (!url.includes('://')) {
            return true; // Will be validated with port
          }
          const parsed = new URL(url);
          return ['mqtt:', 'mqtts:', 'ws:', 'wss:'].includes(parsed.protocol);
        } catch {
          return true; // Simple hostname, valid
        }
      },
      "Invalid broker URL format"
    ),
  port: z.string()
    .min(1, "Port is required")
    .refine((val) => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0 && num <= 65535;
    }, "Port must be between 1 and 65535"),
  topicPrefix: z.string()
    .min(1, "Topic prefix is required")
    .max(100, "Topic prefix too long"),
  useTls: z.boolean().default(false),
  username: z.string().optional(),
  password: z.string().optional(),
  clientId: z.string().optional(),
});

type MQTTCredentialsFormData = z.infer<typeof mqttCredentialsSchema>;

interface MQTTCredentialsFormProps {
  onSubmit: (credentials: MQTTCredentialsFormData) => void | Promise<void>;
  onTestConnection?: (credentials: MQTTCredentialsFormData) => Promise<{ success: boolean; error?: string }>;
  isLoading?: boolean;
  defaultValues?: Partial<MQTTCredentialsFormData>;
}

/**
 * MQTT Credentials Form Component
 */
export function MQTTCredentialsForm({
  onSubmit,
  onTestConnection,
  isLoading = false,
  defaultValues,
}: MQTTCredentialsFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const form = useForm<MQTTCredentialsFormData>({
    resolver: zodResolver(mqttCredentialsSchema),
    defaultValues: {
      brokerUrl: defaultValues?.brokerUrl || "",
      port: defaultValues?.port || "1883",
      topicPrefix: defaultValues?.topicPrefix || "enviroflow",
      useTls: defaultValues?.useTls || false,
      username: defaultValues?.username || "",
      password: defaultValues?.password || "",
      clientId: defaultValues?.clientId || "",
    },
  });

  const useTls = form.watch("useTls");

  // Update default port when TLS is toggled
  const handleTlsToggle = (checked: boolean) => {
    form.setValue("useTls", checked);
    // Update port if it's still at default
    const currentPort = form.getValues("port");
    if (currentPort === "1883" && checked) {
      form.setValue("port", "8883"); // MQTTS default
    } else if (currentPort === "8883" && !checked) {
      form.setValue("port", "1883"); // MQTT default
    }
  };

  const handleTestConnection = async () => {
    if (!onTestConnection) return;

    const isValid = await form.trigger();
    if (!isValid) return;

    setTestingConnection(true);
    setTestResult(null);

    try {
      const values = form.getValues();
      const result = await onTestConnection(values);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Connection test failed",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleFormSubmit = async (data: MQTTCredentialsFormData) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Help Section */}
      <Collapsible open={showHelp} onOpenChange={setShowHelp}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" type="button" className="w-full justify-start gap-2 text-muted-foreground">
            <Info className="h-4 w-4" />
            {showHelp ? "Hide" : "Show"} Setup Examples
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <Alert>
            <AlertTitle>Common MQTT Brokers</AlertTitle>
            <AlertDescription className="mt-2 space-y-2 text-xs">
              <div>
                <strong>Mosquitto (Local):</strong><br />
                Broker: <code>mqtt://localhost</code> | Port: <code>1883</code>
              </div>
              <div>
                <strong>HiveMQ Cloud:</strong><br />
                Broker: <code>mqtts://your-cluster.hivemq.cloud</code> | Port: <code>8883</code> | TLS: ON
              </div>
              <div>
                <strong>Home Assistant:</strong><br />
                Broker: <code>mqtt://homeassistant.local</code> | Port: <code>1883</code><br />
                Topic: <code>homeassistant</code>
              </div>
              <div>
                <strong>AWS IoT Core:</strong><br />
                Broker: <code>mqtts://xxxxx.iot.us-east-1.amazonaws.com</code> | Port: <code>8883</code> | TLS: ON
              </div>
            </AlertDescription>
          </Alert>
        </CollapsibleContent>
      </Collapsible>

      {/* Broker URL */}
      <div className="space-y-2">
        <Label htmlFor="brokerUrl">
          Broker URL <span className="text-destructive">*</span>
        </Label>
        <Input
          id="brokerUrl"
          placeholder="mqtt://broker.example.com"
          {...form.register("brokerUrl")}
          disabled={isLoading}
          className={cn(form.formState.errors.brokerUrl && "border-destructive")}
        />
        {form.formState.errors.brokerUrl && (
          <p className="text-sm text-destructive">{form.formState.errors.brokerUrl.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Enter your MQTT broker hostname or IP address
        </p>
      </div>

      {/* Port and TLS */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="port">
            Port <span className="text-destructive">*</span>
          </Label>
          <Input
            id="port"
            type="text"
            placeholder="1883"
            {...form.register("port")}
            disabled={isLoading}
            className={cn(form.formState.errors.port && "border-destructive")}
          />
          {form.formState.errors.port && (
            <p className="text-sm text-destructive">{form.formState.errors.port.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {useTls ? "8883 (MQTTS)" : "1883 (MQTT)"}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="useTls" className="block mb-3">
            Use TLS/SSL
          </Label>
          <div className="flex items-center gap-2 h-10">
            <Switch
              id="useTls"
              checked={useTls}
              onCheckedChange={handleTlsToggle}
              disabled={isLoading}
            />
            <span className="text-sm text-muted-foreground">
              {useTls ? "Enabled" : "Disabled"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Enable for encrypted connections
          </p>
        </div>
      </div>

      {/* Topic Prefix */}
      <div className="space-y-2">
        <Label htmlFor="topicPrefix">
          Topic Prefix <span className="text-destructive">*</span>
        </Label>
        <Input
          id="topicPrefix"
          placeholder="enviroflow"
          {...form.register("topicPrefix")}
          disabled={isLoading}
          className={cn(form.formState.errors.topicPrefix && "border-destructive")}
        />
        {form.formState.errors.topicPrefix && (
          <p className="text-sm text-destructive">{form.formState.errors.topicPrefix.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Base topic for your sensors (e.g., &quot;enviroflow&quot;, &quot;sensors/room1&quot;, &quot;tasmota&quot;)
        </p>
      </div>

      {/* Optional: Authentication */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Authentication (Optional)</Label>

        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm text-muted-foreground">
            Username
          </Label>
          <Input
            id="username"
            placeholder="Optional"
            {...form.register("username")}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm text-muted-foreground">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Optional"
              {...form.register("password")}
              disabled={isLoading}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientId" className="text-sm text-muted-foreground">
            Client ID
          </Label>
          <Input
            id="clientId"
            placeholder="Optional (auto-generated if empty)"
            {...form.register("clientId")}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Test Connection Result */}
      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"}>
          {testResult.success ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {testResult.success ? "Connection Successful" : "Connection Failed"}
          </AlertTitle>
          {testResult.error && (
            <AlertDescription>{testResult.error}</AlertDescription>
          )}
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onTestConnection && (
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isLoading || testingConnection}
            className="flex-1"
          >
            {testingConnection ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
        )}

        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </form>
  );
}
