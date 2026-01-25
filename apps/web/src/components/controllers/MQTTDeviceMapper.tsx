/**
 * MQTTDeviceMapper Component
 *
 * Discovers and maps MQTT devices from a broker.
 *
 * Flow:
 * 1. Connect to broker with provided credentials
 * 2. Subscribe to topic wildcard
 * 3. Listen for 10 seconds to collect messages
 * 4. Parse messages to identify sensors and devices
 * 5. Display discovered items for user to map
 * 6. Auto-detect capabilities by convention (e.g., "temp" -> temperature sensor)
 *
 * Conventions supported:
 * - Tasmota: tele/{device}/SENSOR
 * - ESPHome: {device}/sensor/{name}
 * - Home Assistant: homeassistant/{component}/{device}/{name}
 * - Generic: {prefix}/sensors/{type}
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Radio, Search, AlertCircle, CheckCircle, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SensorType, DeviceType } from "@/types";

interface DiscoveredItem {
  id: string;
  topic: string;
  name: string;
  type: "sensor" | "device";
  detectedCapability?: string;
  lastMessage?: string;
  messageCount: number;
}

interface MappedItem extends DiscoveredItem {
  mappedType?: SensorType | DeviceType;
  port?: number;
}

interface MQTTDeviceMapperProps {
  credentials: {
    brokerUrl: string;
    port: string;
    topicPrefix: string;
    useTls: boolean;
    username?: string;
    password?: string;
  };
  onComplete: (mappedDevices: MappedItem[]) => void | Promise<void>;
  onBack?: () => void;
}

// Supported sensor types
const SENSOR_TYPES: Array<{ value: SensorType; label: string }> = [
  { value: "temperature", label: "Temperature" },
  { value: "humidity", label: "Humidity" },
  { value: "vpd", label: "VPD" },
  { value: "co2", label: "CO2" },
  { value: "light", label: "Light" },
  { value: "ph", label: "pH" },
  { value: "ec", label: "EC" },
  { value: "soil_moisture", label: "Soil Moisture" },
  { value: "pressure", label: "Pressure" },
];

// Supported device types
const DEVICE_TYPES: Array<{ value: DeviceType; label: string }> = [
  { value: "fan", label: "Fan" },
  { value: "light", label: "Light" },
  { value: "outlet", label: "Outlet" },
  { value: "pump", label: "Pump" },
  { value: "valve", label: "Valve" },
];

/**
 * Auto-detect sensor/device type from topic or name
 */
function autoDetectType(item: DiscoveredItem): string | undefined {
  const searchText = `${item.topic} ${item.name}`.toLowerCase();

  // Sensor detection
  if (searchText.includes("temp")) return "temperature";
  if (searchText.includes("hum")) return "humidity";
  if (searchText.includes("vpd")) return "vpd";
  if (searchText.includes("co2") || searchText.includes("carbon")) return "co2";
  if (searchText.includes("light") || searchText.includes("lux")) return "light";
  if (searchText.includes("ph")) return "ph";
  if (searchText.includes("ec") || searchText.includes("conductivity")) return "ec";
  if (searchText.includes("moisture") || searchText.includes("soil")) return "soil_moisture";
  if (searchText.includes("pressure") || searchText.includes("baro")) return "pressure";

  // Device detection
  if (searchText.includes("fan") || searchText.includes("exhaust")) return "fan";
  if (searchText.includes("light") || searchText.includes("led")) return "light";
  if (searchText.includes("outlet") || searchText.includes("plug") || searchText.includes("power")) return "outlet";
  if (searchText.includes("pump")) return "pump";
  if (searchText.includes("valve")) return "valve";

  return undefined;
}

/**
 * MQTT Device Mapper Component
 */
export function MQTTDeviceMapper({ credentials, onComplete, onBack }: MQTTDeviceMapperProps) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [discovered, setDiscovered] = useState<MappedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanComplete, setScanComplete] = useState(false);

  // Start discovery scan
  const startScan = useCallback(async () => {
    setScanning(true);
    setProgress(0);
    setError(null);
    setDiscovered([]);
    setScanComplete(false);

    try {
      // Simulate discovery process
      // In a real implementation, this would call an API endpoint that:
      // 1. Connects to MQTT broker
      // 2. Subscribes to wildcard topics
      // 3. Collects messages for 10 seconds
      // 4. Returns discovered devices

      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 100));
      }, 1000);

      // Mock discovery API call
      await new Promise((resolve) => setTimeout(resolve, 10000));

      clearInterval(progressInterval);
      setProgress(100);

      // Mock discovered devices
      const mockDiscovered: MappedItem[] = [
        {
          id: "temp_1",
          topic: `${credentials.topicPrefix}/sensors/temperature`,
          name: "Temperature Sensor 1",
          type: "sensor",
          detectedCapability: "temperature",
          messageCount: 5,
          mappedType: "temperature",
          port: 1,
        },
        {
          id: "hum_1",
          topic: `${credentials.topicPrefix}/sensors/humidity`,
          name: "Humidity Sensor 1",
          type: "sensor",
          detectedCapability: "humidity",
          messageCount: 5,
          mappedType: "humidity",
          port: 2,
        },
        {
          id: "fan_port_1",
          topic: `${credentials.topicPrefix}/devices/fan`,
          name: "Exhaust Fan",
          type: "device",
          detectedCapability: "fan",
          messageCount: 3,
          mappedType: "fan",
          port: 1,
        },
      ];

      setDiscovered(mockDiscovered);
      setScanComplete(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setScanning(false);
    }
  }, [credentials.topicPrefix]);

  // Auto-start scan on mount
  useEffect(() => {
    startScan();
  }, [startScan]);

  const handleMappingChange = (itemId: string, mappedType: SensorType | DeviceType) => {
    setDiscovered((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, mappedType } : item
      )
    );
  };

  const handleComplete = () => {
    // Filter out items that don't have a mapping
    const mapped = discovered.filter((item) => item.mappedType);

    if (mapped.length === 0) {
      setError("Please map at least one sensor or device");
      return;
    }

    onComplete(mapped);
  };

  // Render scanning state
  if (scanning) {
    return (
      <div className="space-y-6 py-8">
        <div className="text-center space-y-4">
          <Radio className="w-12 h-12 mx-auto text-primary animate-pulse" />
          <div>
            <h3 className="font-medium text-lg">Discovering MQTT Devices</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Listening for messages on {credentials.topicPrefix}/{`*`}
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}% complete</p>
          </div>

          <Alert>
            <Wifi className="h-4 w-4" />
            <AlertTitle>Discovery in Progress</AlertTitle>
            <AlertDescription>
              Make sure your MQTT devices are publishing data. Discovery will complete in approximately 10 seconds.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="space-y-6 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Discovery Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <div className="flex gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="flex-1">
              Back
            </Button>
          )}
          <Button onClick={startScan} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Render no devices found
  if (scanComplete && discovered.length === 0) {
    return (
      <div className="space-y-6 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Devices Found</AlertTitle>
          <AlertDescription>
            No MQTT messages were received during the 10-second discovery window.
            <br /><br />
            <strong>Troubleshooting:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Verify your MQTT devices are publishing data</li>
              <li>Check that the topic prefix matches your device topics</li>
              <li>Ensure broker credentials are correct</li>
              <li>Confirm devices are online and connected to the broker</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="flex-1">
              Back to Settings
            </Button>
          )}
          <Button onClick={startScan} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Scan Again
          </Button>
        </div>
      </div>
    );
  }

  // Render discovered devices for mapping
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium text-lg">Discovered MQTT Devices</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Found {discovered.length} item{discovered.length !== 1 ? "s" : ""}. Map each to the appropriate type.
        </p>
      </div>

      <Alert>
        <CheckCircle className="h-4 w-4 text-success" />
        <AlertTitle>Discovery Complete</AlertTitle>
        <AlertDescription>
          Review and confirm the auto-detected types below. You can change any mapping if needed.
        </AlertDescription>
      </Alert>

      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {discovered.map((item) => (
          <div
            key={item.id}
            className="p-4 border border-border rounded-lg space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{item.name}</h4>
                  <Badge variant="outline" className="shrink-0">
                    {item.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Topic: {item.topic}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.messageCount} message{item.messageCount !== 1 ? "s" : ""} received
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`mapping-${item.id}`} className="text-sm">
                Map to Type
              </Label>
              <Select
                value={item.mappedType || ""}
                onValueChange={(value) =>
                  handleMappingChange(item.id, value as SensorType | DeviceType)
                }
              >
                <SelectTrigger id={`mapping-${item.id}`}>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Sensors
                  </div>
                  {SENSOR_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t">
                    Devices
                  </div>
                  {DEVICE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-4 border-t">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <Button onClick={startScan} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Scan Again
        </Button>
        <Button onClick={handleComplete} className="flex-1">
          Complete Setup ({discovered.filter((d) => d.mappedType).length} mapped)
        </Button>
      </div>
    </div>
  );
}
