"use client";

import * as React from "react";
import { X, Play, Thermometer, GitBranch, Clock, MousePointer, AlertCircle, Timer, Variable, Filter, Radio, CheckCircle2, Zap, Settings, Sun, Bell, Sunrise, Sunset, Plus, Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import type {
  WorkflowNode,
  TriggerNodeData,
  SensorNodeData,
  ConditionNodeData,
  TriggerType,
  SensorType,
  ComparisonOperator,
  LogicType,
  DelayNodeData,
  DelayTimeUnit,
  VariableNodeData,
  VariableScope,
  VariableOperation,
  VariableValueType,
  DebounceNodeData,
  MQTTTriggerConfig,
  ModeNodeData,
  DeviceModeType,
  PortDeviceType,
  ControlType,
  AutoModeConfig,
  VpdModeConfig,
  TimerToOnConfig,
  TimerToOffConfig,
  CycleModeConfig,
  ScheduleModeConfig,
  DimmerNodeData,
  DimmerCurve,
  NotificationNodeData,
  NotificationPriority,
  NotificationChannel,
} from "./types";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MODE_LABELS,
  PORT_DEVICE_TYPE_LABELS,
  CONTROL_TYPE_LABELS,
  DEVICE_SMART_DEFAULTS,
  DIMMER_CURVE_LABELS,
  NOTIFICATION_PRIORITY_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  MESSAGE_VARIABLES,
} from "./types";
import { useControllerCapabilities } from "@/hooks/use-controller-capabilities";
import { HysteresisViz } from "./HysteresisViz";

/**
 * NodePropertiesPanel - Side panel for configuring selected workflow nodes
 *
 * Displays different configuration options based on the selected node type:
 * - TriggerNode: Trigger type, schedule settings
 * - SensorNode: Controller, sensor type, threshold settings
 * - ConditionNode: Logic type (AND/OR)
 */

interface NodePropertiesPanelProps {
  /** Currently selected node */
  node: WorkflowNode | null;
  /** Callback to update node data */
  onUpdate: (nodeId: string, data: Partial<WorkflowNode["data"]>) => void;
  /** Callback to close the panel */
  onClose: () => void;
  /** List of available controllers for sensor nodes */
  controllers?: Array<{ id: string; name: string; brand?: string }>;
}

/** Comparison operators for thresholds */
const OPERATORS: Array<{ value: ComparisonOperator; label: string }> = [
  { value: ">", label: "Greater than (>)" },
  { value: "<", label: "Less than (<)" },
  { value: "=", label: "Equals (=)" },
  { value: ">=", label: "Greater or equal (>=)" },
  { value: "<=", label: "Less or equal (<=)" },
];

/** Days of week for schedule configuration */
const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

/**
 * TriggerProperties - Configuration panel for trigger nodes
 */
function TriggerProperties({
  node,
  onUpdate,
  controllers = [],
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
  controllers?: Array<{ id: string; name: string; brand?: string }>;
}) {
  const data = node.data as TriggerNodeData;
  const triggerType = data.config.triggerType;

  const updateTriggerType = (type: TriggerType) => {
    let newConfig = { triggerType: type };
    if (type === "schedule") {
      newConfig = { ...newConfig, simpleTime: "06:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] } as typeof newConfig;
    }
    onUpdate(node.id, { config: newConfig } as Partial<TriggerNodeData>);
  };

  const updateSchedule = (field: string, value: string | number[]) => {
    if (data.config.triggerType !== "schedule") return;
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    } as Partial<TriggerNodeData>);
  };

  const toggleDay = (day: number) => {
    if (data.config.triggerType !== "schedule") return;
    const currentDays = data.config.daysOfWeek ?? [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort();
    updateSchedule("daysOfWeek", newDays);
  };

  return (
    <div className="space-y-4">
      {/* Trigger Type Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Trigger Type</Label>
        <RadioGroup
          value={triggerType}
          onValueChange={(v) => updateTriggerType(v as TriggerType)}
          className="grid gap-2"
        >
          <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-muted/50">
            <RadioGroupItem value="schedule" id="schedule" />
            <Label htmlFor="schedule" className="flex items-center gap-2 cursor-pointer">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Schedule</p>
                <p className="text-xs text-muted-foreground">Run at specific times</p>
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-muted/50">
            <RadioGroupItem value="sensor_threshold" id="sensor_threshold" />
            <Label htmlFor="sensor_threshold" className="flex items-center gap-2 cursor-pointer">
              <Thermometer className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Sensor Threshold</p>
                <p className="text-xs text-muted-foreground">Trigger when sensor crosses value</p>
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-muted/50">
            <RadioGroupItem value="manual" id="manual" />
            <Label htmlFor="manual" className="flex items-center gap-2 cursor-pointer">
              <MousePointer className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Manual</p>
                <p className="text-xs text-muted-foreground">Run on demand</p>
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-muted/50 border-purple-200 dark:border-purple-800">
            <RadioGroupItem value="mqtt" id="mqtt" />
            <Label htmlFor="mqtt" className="flex items-center gap-2 cursor-pointer">
              <Radio className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">MQTT</p>
                <p className="text-xs text-muted-foreground">Cross-manufacturer sensor data</p>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* MQTT Configuration */}
      {triggerType === "mqtt" && data.config.triggerType === "mqtt" && (
        <MQTTTriggerConfigPanel
          config={data.config}
          onUpdate={(updates) => {
            onUpdate(node.id, {
              config: { ...data.config, ...updates },
            } as Partial<TriggerNodeData>);
          }}
          controllers={controllers}
        />
      )}

      {/* Schedule Configuration */}
      {triggerType === "schedule" && data.config.triggerType === "schedule" && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Time</Label>
            <Input
              type="time"
              value={data.config.simpleTime ?? "06:00"}
              onChange={(e) => updateSchedule("simpleTime", e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Days</Label>
            <div className="flex flex-wrap gap-1">
              {DAYS_OF_WEEK.map(({ value, label }) => {
                const config = data.config as { daysOfWeek?: number[] };
                const isSelected = (config.daysOfWeek ?? []).includes(value);
                return (
                  <Button
                    key={value}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-10 text-xs"
                    onClick={() => toggleDay(value)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Advanced: Cron Expression
              <span className="text-muted-foreground"> (optional)</span>
            </Label>
            <Input
              value={data.config.cronExpression ?? ""}
              onChange={(e) => updateSchedule("cronExpression", e.target.value)}
              placeholder="e.g., 0 6 * * *"
              className="font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Overrides time/days if provided
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MQTTTriggerConfigPanel - Configuration panel for MQTT triggers
 *
 * SECURITY: MQTT connection credentials (brokerUrl, username, password) are stored
 * encrypted in the controllers table via server-encryption.ts. This panel only stores
 * a controllerId reference in the workflow node config, never raw credentials.
 */
function MQTTTriggerConfigPanel({
  config,
  onUpdate,
  controllers = [],
}: {
  config: MQTTTriggerConfig;
  onUpdate: (updates: Partial<MQTTTriggerConfig>) => void;
  controllers?: Array<{ id: string; name: string; brand?: string }>;
}) {
  // Filter to only show MQTT controllers
  const mqttControllers = controllers.filter((c) => c.brand === "mqtt");
  const [testingConnection, setTestingConnection] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<"idle" | "success" | "error">("idle");

  const handleTestConnection = async () => {
    if (!config.controllerId) return;
    
    setTestingConnection(true);
    setConnectionStatus("idle");
    
    try {
      const response = await fetch("/api/mqtt/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controllerId: config.controllerId,
          topic: config.topic,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus("success");
        if (data.lastMessage) {
          onUpdate({ lastMessage: data.lastMessage, lastReceivedAt: new Date().toISOString() });
        }
      } else {
        setConnectionStatus("error");
      }
    } catch {
      setConnectionStatus("error");
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {/* MQTT Controller Selection - credentials stored securely in controllers table */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">MQTT Controller</Label>
        {mqttControllers.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              No MQTT controllers found. Add an MQTT broker on the Controllers page first,
              then select it here.
            </AlertDescription>
          </Alert>
        ) : (
          <Select
            value={config.controllerId ?? ""}
            onValueChange={(v) => {
              const controller = mqttControllers.find((c) => c.id === v);
              onUpdate({
                controllerId: v,
                controllerName: controller?.name,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an MQTT controller" />
            </SelectTrigger>
            <SelectContent>
              {mqttControllers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-[10px] text-muted-foreground">
          Connection credentials are stored securely with the controller.
        </p>
      </div>

      {/* Topic */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Topic</Label>
        <Input
          value={config.topic ?? ""}
          onChange={(e) => onUpdate({ topic: e.target.value })}
          placeholder="home/growroom/sensors/temperature"
          className="font-mono text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Use + for single level wildcard, # for multi-level (e.g., home/+/sensors/#)
        </p>
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={!config.controllerId || testingConnection}
        >
          {testingConnection ? "Testing..." : "Test Connection"}
        </Button>
        {connectionStatus === "success" && (
          <span className="text-xs text-green-600 dark:text-green-400">✓ Connected</span>
        )}
        {connectionStatus === "error" && (
          <span className="text-xs text-red-600 dark:text-red-400">✗ Connection failed</span>
        )}
      </div>

      {/* Last Message Preview */}
      {config.lastMessage && (
        <div className="space-y-1 rounded-md bg-muted/50 p-2">
          <p className="text-[10px] font-medium text-muted-foreground">Last received message:</p>
          <pre className="text-xs font-mono text-foreground overflow-auto max-h-20">
            {config.lastMessage}
          </pre>
          {config.lastReceivedAt && (
            <p className="text-[10px] text-muted-foreground">
              {new Date(config.lastReceivedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* JSONPath Condition */}
      <div className="space-y-2 border-t pt-4">
        <Label className="text-sm font-medium">Trigger Condition (Optional)</Label>
        <p className="text-[10px] text-muted-foreground">
          Extract a value from the payload and trigger when it crosses a threshold
        </p>
        
        <div className="space-y-2">
          <Label className="text-xs">JSONPath Expression</Label>
          <Input
            value={config.jsonPath ?? ""}
            onChange={(e) => onUpdate({ jsonPath: e.target.value })}
            placeholder="$.temperature or $.sensors[0].value"
            className="font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label className="text-xs">Operator</Label>
            <Select
              value={config.operator ?? ""}
              onValueChange={(v) => onUpdate({ operator: v as ComparisonOperator })}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=">">Greater than (&gt;)</SelectItem>
                <SelectItem value="<">Less than (&lt;)</SelectItem>
                <SelectItem value=">=">Greater or equal (≥)</SelectItem>
                <SelectItem value="<=">Less or equal (≤)</SelectItem>
                <SelectItem value="=">Equal to (=)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Threshold</Label>
            <Input
              type="number"
              value={config.threshold ?? ""}
              onChange={(e) => onUpdate({ threshold: parseFloat(e.target.value) || undefined })}
              placeholder="e.g., 82"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Help text */}
      <Alert className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
        <Radio className="h-4 w-4 text-purple-500" />
        <AlertDescription className="text-xs">
          MQTT triggers enable cross-manufacturer automation. Connect sensors from Inkbird, Ecowitt, 
          Zigbee2MQTT, or any MQTT-compatible device to control AC Infinity equipment.
        </AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * SensorProperties - Configuration panel for sensor nodes
 */
function SensorProperties({
  node,
  onUpdate,
  controllers = [],
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
  controllers?: Array<{ id: string; name: string; brand?: string }>;
}) {
  const data = node.data as SensorNodeData;

  // Fetch capabilities for all controllers
  const { capabilities, loading: capsLoading } = useControllerCapabilities();

  const updateConfig = (field: string, value: string | number | undefined) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    } as Partial<SensorNodeData>);
  };

  // Build a unified list of all sensors from all controllers
  const allSensors = React.useMemo(() => {
    if (!capabilities) return [];
    
    const list = capabilities instanceof Map 
      ? Array.from(capabilities.values())
      : [capabilities];
    
    return list.flatMap(ctrl => 
      (ctrl.sensors || []).map(sensor => ({
        ...sensor,
        controllerId: ctrl.controller_id,
        controllerName: ctrl.controller_name,
        controllerStatus: ctrl.status,
      }))
    );
  }, [capabilities]);

  // Get available sensors for selected controller (legacy flow)
  const selectedControllerCapabilities = React.useMemo(() => {
    if (!data.config.controllerId || !capabilities) return null;

    if (capabilities instanceof Map) {
      return capabilities.get(data.config.controllerId);
    }

    return capabilities.controller_id === data.config.controllerId ? capabilities : null;
  }, [capabilities, data.config.controllerId]);

  const availableSensors = selectedControllerCapabilities?.sensors || [];

  return (
    <div className="space-y-4">
      {/* No Controllers Warning */}
      {!capsLoading && controllers.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Connect a controller first to use sensor nodes. Go to Controllers page to add one.
          </AlertDescription>
        </Alert>
      )}

      {/* Unified Sensor Selection - Browse all sensors across controllers */}
      {allSensors.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Select Sensor</Label>
          <Select
            value={
              data.config.controllerId && data.config.sensorType
                ? `${data.config.controllerId}:${data.config.sensorType}-${data.config.port ?? 0}`
                : ""
            }
            onValueChange={(v) => {
              const [controllerId, sensorKey] = v.split(':');
              const sensor = allSensors.find(
                s => s.controllerId === controllerId && 
                `${s.type}-${s.port || 0}` === sensorKey
              );
              if (sensor) {
                updateConfig("controllerId", sensor.controllerId);
                updateConfig("controllerName", sensor.controllerName);
                updateConfig("sensorType", sensor.type as SensorType);
                updateConfig("port", sensor.port);
                updateConfig("unit", sensor.unit);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Browse all sensors..." />
            </SelectTrigger>
            <SelectContent>
              {allSensors.map((sensor) => {
                const key = `${sensor.controllerId}:${sensor.type}-${sensor.port || 0}`;
                return (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col">
                        <span className="font-medium">{sensor.name}</span>
                        <span className="text-[10px] text-muted-foreground">{sensor.controllerName}</span>
                      </div>
                      {sensor.currentValue !== undefined && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {sensor.currentValue.toFixed(1)}{sensor.unit}
                          {sensor.isStale && " (stale)"}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {capsLoading && (
            <p className="text-xs text-muted-foreground">Loading sensors...</p>
          )}
        </div>
      )}

      {/* Show selected sensor info */}
      {data.config.controllerId && data.config.sensorType && (
        <div className="rounded-md border border-border bg-muted/50 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Selected Sensor</span>
            {selectedControllerCapabilities?.status === 'offline' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                Offline
              </span>
            )}
          </div>
          <p className="text-sm">{data.config.sensorType} ({data.config.unit ?? ''})</p>
          <p className="text-xs text-muted-foreground">via {data.config.controllerName}</p>
        </div>
      )}

      {/* Threshold Configuration */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Condition</Label>
        <div className="flex gap-2">
          <Select
            value={data.config.operator ?? ""}
            onValueChange={(v) => updateConfig("operator", v as ComparisonOperator)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Operator" />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={data.config.threshold ?? ""}
            onChange={(e) =>
              updateConfig("threshold", e.target.value ? parseFloat(e.target.value) : undefined)
            }
            placeholder="Value"
            className="flex-1"
          />
        </div>
      </div>

      {/* Reset Threshold (Hysteresis) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Reset Threshold
          <span className="text-muted-foreground"> (optional)</span>
        </Label>
        <Input
          type="number"
          value={data.config.resetThreshold ?? ""}
          onChange={(e) =>
            updateConfig("resetThreshold", e.target.value ? parseFloat(e.target.value) : undefined)
          }
          placeholder="e.g., 75 to reset after crossing 80"
        />
        <p className="text-[10px] text-muted-foreground">
          Prevents rapid on/off cycling by requiring value to cross reset point before re-triggering
        </p>
        {data.config.resetThreshold !== undefined && data.config.threshold !== undefined && (
          <HysteresisViz
            operator={data.config.operator}
            threshold={data.config.threshold}
            resetThreshold={data.config.resetThreshold}
            unit={data.config.unit ?? ""}
            size="normal"
            className="mt-2"
          />
        )}
      </div>
    </div>
  );
}

/**
 * ActionProperties - Configuration panel for action nodes
 */
function ActionProperties({
  node,
  onUpdate,
  controllers = [],
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
  controllers?: Array<{ id: string; name: string; brand?: string }>;
}) {
  const data = node.data as import("./types").ActionNodeData;

  // Fetch capabilities for all controllers
  const { capabilities, loading: capsLoading } = useControllerCapabilities();

  const updateConfig = (field: string, value: string | number | boolean | undefined) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    } as Partial<import("./types").ActionNodeData>);
  };

  // Get available devices for selected controller
  const selectedControllerCapabilities = React.useMemo(() => {
    if (!data.config.controllerId || !capabilities) return null;

    if (capabilities instanceof Map) {
      return capabilities.get(data.config.controllerId);
    }

    return capabilities.controller_id === data.config.controllerId ? capabilities : null;
  }, [capabilities, data.config.controllerId]);

  const availableDevices = selectedControllerCapabilities?.devices || [];

  // Get selected device details
  const selectedDevice = React.useMemo(() => {
    if (data.config.port === undefined) return null;
    return availableDevices.find((d) => d.port === data.config.port);
  }, [availableDevices, data.config.port]);

  return (
    <div className="space-y-4">
      {/* No Controllers Warning */}
      {!capsLoading && controllers.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Connect a controller first to use action nodes. Go to Controllers page to add one.
          </AlertDescription>
        </Alert>
      )}

      {/* Controller Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Controller</Label>
        <Select
          value={data.config.controllerId ?? ""}
          onValueChange={(v) => {
            const controller = controllers.find((c) => c.id === v);
            updateConfig("controllerId", v);
            if (controller) {
              updateConfig("controllerName", controller.name);
            }
            // Reset device selection when controller changes
            updateConfig("port", undefined);
            updateConfig("deviceType", undefined);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a controller" />
          </SelectTrigger>
          <SelectContent>
            {controllers.length === 0 ? (
              <SelectItem value="" disabled>
                No controllers available
              </SelectItem>
            ) : (
              controllers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Device/Port Selection - Dynamic based on controller capabilities */}
      {data.config.controllerId && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Device / Port</Label>
          {capsLoading ? (
            <div className="text-xs text-muted-foreground">Loading devices...</div>
          ) : availableDevices.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                No devices available for this controller. Make sure the controller is online and supports device control.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Select
                value={data.config.port !== undefined ? String(data.config.port) : ""}
                onValueChange={(v) => {
                  const port = parseInt(v, 10);
                  const device = availableDevices.find((d) => d.port === port);
                  if (device) {
                    updateConfig("port", port);
                    updateConfig("deviceType", device.type as import("./types").DeviceType);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a device" />
                </SelectTrigger>
                <SelectContent>
                  {availableDevices.map((device) => (
                    <SelectItem key={device.port} value={String(device.port)}>
                      <div className="flex items-center justify-between w-full">
                        <span>
                          {device.name}
                          {device.supportsDimming && (
                            <span className="text-xs text-muted-foreground ml-1">(Dimming)</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {device.isOn ? `ON ${device.level}%` : "OFF"}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedControllerCapabilities?.status === 'offline' && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Controller is offline. Device states may be stale.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Action Type Selection */}
      {selectedDevice && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Action</Label>
          <Select
            value={data.config.action ?? ""}
            onValueChange={(v) => updateConfig("action", v as import("./types").ActionVariant)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on_off">Turn On/Off</SelectItem>
              {selectedDevice.supportsDimming && (
                <>
                  <SelectItem value="set_speed">Set Speed/Level</SelectItem>
                  <SelectItem value="set_level">Set Level</SelectItem>
                </>
              )}
              {selectedDevice.type === 'heater' && (
                <SelectItem value="set_temperature">Set Temperature</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Action-specific configuration */}
      {data.config.action === "on_off" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Command</Label>
          <RadioGroup
            value={data.config.turnOn ? "on" : "off"}
            onValueChange={(v) => updateConfig("turnOn", v === "on")}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="on" id="on" />
              <Label htmlFor="on" className="cursor-pointer">Turn ON</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="off" id="off" />
              <Label htmlFor="off" className="cursor-pointer">Turn OFF</Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {(data.config.action === "set_speed" || data.config.action === "set_level") && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Level (0-100%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={data.config.value ?? ""}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
              updateConfig("value", val);
            }}
            placeholder="0-100"
          />
        </div>
      )}

      {data.config.action === "set_temperature" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Temperature (°F)</Label>
          <Input
            type="number"
            value={data.config.temperature ?? ""}
            onChange={(e) => {
              const val = e.target.value ? parseFloat(e.target.value) : undefined;
              updateConfig("temperature", val);
            }}
            placeholder="Temperature"
          />
        </div>
      )}
    </div>
  );
}

/**
 * ConditionProperties - Configuration panel for condition nodes
 */
function ConditionProperties({
  node,
  onUpdate,
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
}) {
  const data = node.data as ConditionNodeData;

  const updateLogicType = (logicType: LogicType) => {
    onUpdate(node.id, {
      config: { ...data.config, logicType },
    } as Partial<ConditionNodeData>);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Logic Type</Label>
        <RadioGroup
          value={data.config.logicType}
          onValueChange={(v) => updateLogicType(v as LogicType)}
          className="grid gap-2"
        >
          <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-muted/50">
            <RadioGroupItem value="AND" id="and" />
            <Label htmlFor="and" className="cursor-pointer">
              <div>
                <p className="text-sm font-medium">AND</p>
                <p className="text-xs text-muted-foreground">All inputs must be true</p>
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-muted/50">
            <RadioGroupItem value="OR" id="or" />
            <Label htmlFor="or" className="cursor-pointer">
              <div>
                <p className="text-sm font-medium">OR</p>
                <p className="text-xs text-muted-foreground">Any input can be true</p>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          <strong>True Path:</strong> Executes when condition evaluates to true
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          <strong>False Path:</strong> Executes when condition evaluates to false
        </p>
      </div>
    </div>
  );
}

/**
 * DelayProperties - Configuration panel for delay nodes
 */
function DelayProperties({
  node,
  onUpdate,
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
}) {
  const data = node.data as DelayNodeData;

  const updateConfig = (field: string, value: number | string) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    } as Partial<DelayNodeData>);
  };

  return (
    <div className="space-y-4">
      {/* Duration */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Duration</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            value={data.config.duration ?? 30}
            onChange={(e) => updateConfig("duration", parseInt(e.target.value, 10) || 1)}
            className="flex-1"
          />
          <Select
            value={data.config.unit ?? "seconds"}
            onValueChange={(v) => updateConfig("unit", v as DelayTimeUnit)}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="seconds">Seconds</SelectItem>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          Workflow execution pauses at this node and resumes after the specified duration.
        </p>
      </div>
    </div>
  );
}

/**
 * VariableProperties - Configuration panel for variable nodes
 */
function VariableProperties({
  node,
  onUpdate,
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
}) {
  const data = node.data as VariableNodeData;

  const updateConfig = (field: string, value: string | number | boolean) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    } as Partial<VariableNodeData>);
  };

  return (
    <div className="space-y-4">
      {/* Variable Name */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Variable Name</Label>
        <Input
          value={data.config.name ?? ""}
          onChange={(e) => updateConfig("name", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
          placeholder="myVariable"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Use letters, numbers, and underscores only
        </p>
      </div>

      {/* Scope */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Scope</Label>
        <Select
          value={data.config.scope ?? "workflow"}
          onValueChange={(v) => updateConfig("scope", v as VariableScope)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="workflow">Workflow (local)</SelectItem>
            <SelectItem value="global">Global (shared)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {data.config.scope === "global" 
            ? "Value persists across all workflow executions" 
            : "Value only exists during this workflow execution"}
        </p>
      </div>

      {/* Operation */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Operation</Label>
        <Select
          value={data.config.operation ?? "set"}
          onValueChange={(v) => updateConfig("operation", v as VariableOperation)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="set">Set value</SelectItem>
            <SelectItem value="get">Get value</SelectItem>
            <SelectItem value="increment">Increment (+)</SelectItem>
            <SelectItem value="decrement">Decrement (-)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Value Type */}
      {(data.config.operation === "set" || data.config.operation === "get") && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Value Type</Label>
          <Select
            value={data.config.valueType ?? "number"}
            onValueChange={(v) => updateConfig("valueType", v as VariableValueType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="string">Text</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Value (for set operation) */}
      {data.config.operation === "set" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Value</Label>
          {data.config.valueType === "boolean" ? (
            <Select
              value={String(data.config.value ?? false)}
              onValueChange={(v) => updateConfig("value", v === "true")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">True</SelectItem>
                <SelectItem value="false">False</SelectItem>
              </SelectContent>
            </Select>
          ) : data.config.valueType === "number" ? (
            <Input
              type="number"
              value={data.config.value as number ?? 0}
              onChange={(e) => updateConfig("value", parseFloat(e.target.value) || 0)}
            />
          ) : (
            <Input
              value={data.config.value as string ?? ""}
              onChange={(e) => updateConfig("value", e.target.value)}
              placeholder="Enter text value..."
            />
          )}
        </div>
      )}

      {/* Amount (for increment/decrement) */}
      {(data.config.operation === "increment" || data.config.operation === "decrement") && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Amount</Label>
          <Input
            type="number"
            value={data.config.amount ?? 1}
            onChange={(e) => updateConfig("amount", parseFloat(e.target.value) || 1)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * DebounceProperties - Configuration panel for debounce nodes
 */
function DebounceProperties({
  node,
  onUpdate,
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
}) {
  const data = node.data as DebounceNodeData;

  const updateConfig = (field: string, value: number | boolean) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    } as Partial<DebounceNodeData>);
  };

  return (
    <div className="space-y-4">
      {/* Cooldown Duration */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Cooldown (seconds)</Label>
        <Input
          type="number"
          min={1}
          value={data.config.cooldownSeconds ?? 60}
          onChange={(e) => updateConfig("cooldownSeconds", parseInt(e.target.value, 10) || 1)}
        />
        <p className="text-xs text-muted-foreground">
          Minimum time between workflow executions
        </p>
      </div>

      {/* Execution Mode */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Execution Mode</Label>
        
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="text-sm">Execute on first trigger</Label>
            <p className="text-xs text-muted-foreground">Run immediately when triggered</p>
          </div>
          <Switch
            checked={data.config.executeOnLead ?? true}
            onCheckedChange={(v) => updateConfig("executeOnLead", v)}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="text-sm">Execute after cooldown</Label>
            <p className="text-xs text-muted-foreground">Run again when cooldown ends</p>
          </div>
          <Switch
            checked={data.config.executeOnTrail ?? false}
            onCheckedChange={(v) => updateConfig("executeOnTrail", v)}
          />
        </div>
      </div>

      <div className="rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          Prevents rapid triggering from sensor fluctuations or repeated events.
        </p>
      </div>
    </div>
  );
}

/**
 * VerifiedActionProperties - Configuration panel for verified action nodes
 */
function VerifiedActionProperties({
  node,
  onUpdate,
  controllers = [],
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
  controllers: NodePropertiesPanelProps["controllers"];
}) {
  const data = node.data as { label: string; config: { 
    controllerId?: string;
    controllerName?: string;
    port?: number;
    portName?: string;
    action?: 'on' | 'off' | 'set_level';
    level?: number;
    verifyTimeout?: number;
    retryCount?: number;
    rollbackOnFailure?: boolean;
  }};
  
  const updateConfig = (field: string, value: unknown) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    });
  };

  return (
    <div className="space-y-4">
      {/* Controller Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Controller</Label>
        <Select
          value={data.config.controllerId ?? ""}
          onValueChange={(value) => {
            const controller = controllers?.find(c => c.id === value);
            updateConfig("controllerId", value);
            if (controller) {
              updateConfig("controllerName", controller.name);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a controller" />
          </SelectTrigger>
          <SelectContent>
            {controllers?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Port Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Port</Label>
        <Select
          value={data.config.port?.toString() ?? ""}
          onValueChange={(value) => updateConfig("port", parseInt(value, 10))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a port" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
              <SelectItem key={p} value={p.toString()}>
                Port {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Action</Label>
        <Select
          value={data.config.action ?? "on"}
          onValueChange={(value) => updateConfig("action", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on">Turn ON</SelectItem>
            <SelectItem value="off">Turn OFF</SelectItem>
            <SelectItem value="set_level">Set Level</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Level (if set_level) */}
      {data.config.action === "set_level" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Level (0-10)</Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={data.config.level ?? 5}
            onChange={(e) => updateConfig("level", parseInt(e.target.value, 10))}
          />
        </div>
      )}

      {/* Verification Settings */}
      <div className="border-t pt-4 mt-4">
        <h4 className="text-sm font-medium mb-3">Verification Settings</h4>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm">Timeout (seconds)</Label>
            <Input
              type="number"
              min={1}
              max={300}
              value={data.config.verifyTimeout ?? 30}
              onChange={(e) => updateConfig("verifyTimeout", parseInt(e.target.value, 10))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Retry Count</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={data.config.retryCount ?? 3}
              onChange={(e) => updateConfig("retryCount", parseInt(e.target.value, 10))}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Rollback on Failure</Label>
              <p className="text-xs text-muted-foreground">Revert if verification fails</p>
            </div>
            <Switch
              checked={data.config.rollbackOnFailure ?? false}
              onCheckedChange={(v) => updateConfig("rollbackOnFailure", v)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-dashed p-3 bg-emerald-500/5">
        <p className="text-xs text-muted-foreground">
          Verified actions confirm device state after sending commands and can automatically retry or rollback.
        </p>
      </div>
    </div>
  );
}

/**
 * PortConditionProperties - Configuration panel for port condition nodes
 */
function PortConditionProperties({
  node,
  onUpdate,
  controllers = [],
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
  controllers: NodePropertiesPanelProps["controllers"];
}) {
  const data = node.data as { label: string; config: {
    controllerId?: string;
    controllerName?: string;
    port?: number;
    portName?: string;
    condition?: 'is_on' | 'is_off' | 'level_equals' | 'level_above' | 'level_below' | 'mode_equals';
    targetLevel?: number;
    targetMode?: string;
  }};

  const updateConfig = (field: string, value: unknown) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    });
  };

  const conditionNeedsLevel = ['level_equals', 'level_above', 'level_below'].includes(data.config.condition ?? '');

  return (
    <div className="space-y-4">
      {/* Controller Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Controller</Label>
        <Select
          value={data.config.controllerId ?? ""}
          onValueChange={(value) => {
            const controller = controllers?.find(c => c.id === value);
            updateConfig("controllerId", value);
            if (controller) {
              updateConfig("controllerName", controller.name);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a controller" />
          </SelectTrigger>
          <SelectContent>
            {controllers?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Port Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Port</Label>
        <Select
          value={data.config.port?.toString() ?? ""}
          onValueChange={(value) => updateConfig("port", parseInt(value, 10))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a port" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
              <SelectItem key={p} value={p.toString()}>
                Port {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Condition Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Condition</Label>
        <Select
          value={data.config.condition ?? "is_on"}
          onValueChange={(value) => updateConfig("condition", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="is_on">Port is ON</SelectItem>
            <SelectItem value="is_off">Port is OFF</SelectItem>
            <SelectItem value="level_equals">Level equals</SelectItem>
            <SelectItem value="level_above">Level above</SelectItem>
            <SelectItem value="level_below">Level below</SelectItem>
            <SelectItem value="mode_equals">Mode equals</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Target Level (if level condition) */}
      {conditionNeedsLevel && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Target Level (0-10)</Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={data.config.targetLevel ?? 5}
            onChange={(e) => updateConfig("targetLevel", parseInt(e.target.value, 10))}
          />
        </div>
      )}

      {/* Target Mode (if mode_equals condition) */}
      {data.config.condition === 'mode_equals' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Target Mode</Label>
          <Select
            value={data.config.targetMode ?? "auto"}
            onValueChange={(value) => updateConfig("targetMode", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="on">On</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="vpd">VPD</SelectItem>
              <SelectItem value="timer">Timer</SelectItem>
              <SelectItem value="cycle">Cycle</SelectItem>
              <SelectItem value="schedule">Schedule</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-md border border-dashed p-3 bg-amber-500/5">
        <p className="text-xs text-muted-foreground">
          Routes workflow based on current port state. Has two outputs: "true" path and "false" path.
        </p>
      </div>
    </div>
  );
}

/**
 * Days of week for schedule configuration
 */
const SCHEDULE_DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

/**
 * ModeProperties - Configuration panel for AC Infinity device mode programming
 *
 * Implements the full mode configuration UI following AC Infinity's patterns:
 * - Off/On: Simple on/off
 * - Auto: Temp + Humidity triggers with level ranges
 * - VPD: VPD triggers with level ranges
 * - Timer: Duration on/off cycling
 * - Cycle: Similar to timer
 * - Schedule: Multiple time windows
 */
/**
 * ModeProperties - Port Programming UI matching AC Infinity's controller model
 * See: docs/spec/enviroflow-port-programming.md
 *
 * Features:
 * - Device type selection with smart defaults
 * - Control type (PWM 0-10 vs Outlet ON/OFF)
 * - 8 programming modes: OFF, ON, AUTO, VPD, TIMER→ON, TIMER→OFF, CYCLE, SCHEDULE
 * - AUTO mode: 4 climate triggers with transition (°F/step) and buffer (hysteresis)
 * - VPD mode: 2 VPD triggers with transition and buffer
 */
function ModeProperties({
  node,
  onUpdate,
  controllers = [],
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
  controllers: NodePropertiesPanelProps["controllers"];
}) {
  const data = node.data as ModeNodeData;
  const { capabilities } = useControllerCapabilities();

  const updateConfig = (updates: Partial<typeof data.config>) => {
    onUpdate(node.id, {
      config: { ...data.config, ...updates },
    });
  };

  // Get available devices for selected controller
  const selectedControllerCapabilities = React.useMemo(() => {
    if (!data.config.controllerId || !capabilities) return null;
    if (capabilities instanceof Map) {
      return capabilities.get(data.config.controllerId);
    }
    return capabilities.controller_id === data.config.controllerId ? capabilities : null;
  }, [capabilities, data.config.controllerId]);

  const availableDevices = selectedControllerCapabilities?.devices || [];
  const selectedMode = data.config.mode;
  const controlType = data.config.controlType ?? "pwm";
  const isOutlet = controlType === "outlet";

  // Apply smart defaults when device type changes
  const handleDeviceTypeChange = (deviceType: PortDeviceType) => {
    const defaults = DEVICE_SMART_DEFAULTS[deviceType];
    updateConfig({
      deviceType,
      ...defaults,
    });
  };

  // Initialize mode-specific configs with spec-compliant defaults
  const initAutoConfig = (): AutoModeConfig => ({
    tempHighTrigger: 80,
    tempHighEnabled: true,
    tempLowTrigger: 65,
    tempLowEnabled: false,
    humidityHighTrigger: 70,
    humidityHighEnabled: false,
    humidityLowTrigger: 50,
    humidityLowEnabled: false,
    tempTransition: 2.0,
    humidityTransition: 5.0,
    tempBuffer: 0,
    humidityBuffer: 0,
  });

  const initVpdConfig = (): VpdModeConfig => ({
    vpdHighTrigger: 1.5,
    vpdHighEnabled: true,
    vpdLowTrigger: 0.8,
    vpdLowEnabled: true,
    vpdTransition: 0.1,
    vpdBuffer: 0,
  });

  const initTimerToOnConfig = (): TimerToOnConfig => ({
    durationMinutes: 60,
  });

  const initTimerToOffConfig = (): TimerToOffConfig => ({
    durationMinutes: 60,
  });

  const initCycleConfig = (): CycleModeConfig => ({
    durationOnMinutes: 15,
    durationOffMinutes: 45,
  });

  const initScheduleConfig = (): ScheduleModeConfig => ({
    onTime: "06:00",
    offTime: "00:00",
    days: [],
  });

  return (
    <div className="space-y-4">
      {/* Controller Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Controller</Label>
        <Select
          value={data.config.controllerId ?? ""}
          onValueChange={(value) => {
            const controller = controllers?.find(c => c.id === value);
            updateConfig({
              controllerId: value,
              controllerName: controller?.name,
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a controller" />
          </SelectTrigger>
          <SelectContent>
            {controllers?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Port Selection */}
      {data.config.controllerId && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Port</Label>
          <Select
            value={data.config.port?.toString() ?? ""}
            onValueChange={(value) => {
              const port = parseInt(value, 10);
              const device = availableDevices.find((d) => d.port === port);
              updateConfig({
                port,
                portName: device?.name,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a port" />
            </SelectTrigger>
            <SelectContent>
              {availableDevices.length === 0 ? (
                <SelectItem value="" disabled>No ports available</SelectItem>
              ) : (
                availableDevices.map((device) => (
                  <SelectItem key={device.port} value={String(device.port)}>
                    Port {device.port}: {device.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Device Configuration Section */}
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device</span>

        {/* Device Name */}
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input
            value={data.config.deviceName ?? ""}
            onChange={(e) => updateConfig({ deviceName: e.target.value })}
            placeholder="e.g., Cloudline T6"
            className="h-8"
          />
        </div>

        {/* Device Type */}
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={data.config.deviceType ?? ""}
            onValueChange={(value) => handleDeviceTypeChange(value as PortDeviceType)}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select device type" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PORT_DEVICE_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Control Type */}
        <div className="space-y-1">
          <Label className="text-xs">Control Type</Label>
          <RadioGroup
            value={controlType}
            onValueChange={(value) => updateConfig({
              controlType: value as ControlType,
              onLevel: value === "outlet" ? 1 : (data.config.onLevel ?? 10),
              offLevel: value === "outlet" ? 0 : (data.config.offLevel ?? 0),
            })}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pwm" id="pwm" />
              <Label htmlFor="pwm" className="text-xs">PWM (0-10)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="outlet" id="outlet" />
              <Label htmlFor="outlet" className="text-xs">Outlet (ON/OFF)</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Level Settings */}
      <div className="space-y-3 rounded-lg border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.05)] p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#00d4ff]">Levels</span>

        {isOutlet ? (
          <p className="text-xs text-muted-foreground">
            Outlet devices use binary ON/OFF (no variable levels)
          </p>
        ) : (
          <div className="space-y-3">
            {/* ON Level (Max) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">ON Level (Max)</Label>
                <span className="font-mono text-sm font-bold text-[#00d4ff]">
                  {data.config.onLevel ?? 10}
                </span>
              </div>
              <Slider
                value={[data.config.onLevel ?? 10]}
                min={0}
                max={10}
                step={1}
                onValueChange={([value]) => updateConfig({ onLevel: value })}
                className="[&_[role=slider]]:bg-[#00d4ff]"
              />
            </div>

            {/* OFF Level (Min) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">OFF Level (Min)</Label>
                <span className="font-mono text-sm font-bold text-muted-foreground">
                  {data.config.offLevel ?? 0}
                </span>
              </div>
              <Slider
                value={[data.config.offLevel ?? 0]}
                min={0}
                max={10}
                step={1}
                onValueChange={([value]) => updateConfig({ offLevel: value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mode Selection - 8 Mode Toggle Strip */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mode</Label>
        <div className="grid grid-cols-4 gap-1">
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={selectedMode === value ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-8 text-xs px-2",
                selectedMode === value && value === "vpd" && "bg-[#b388ff] hover:bg-[#b388ff]/90",
                selectedMode === value && value === "auto" && "bg-[#00d4ff] hover:bg-[#00d4ff]/90",
                selectedMode === value && !["vpd", "auto"].includes(value) && "bg-primary"
              )}
              onClick={() => {
                const mode = value as DeviceModeType;
                const updates: Partial<typeof data.config> = { mode };

                // Initialize mode-specific config if not present
                if (mode === "auto" && !data.config.autoConfig) {
                  updates.autoConfig = initAutoConfig();
                } else if (mode === "vpd" && !data.config.vpdConfig) {
                  updates.vpdConfig = initVpdConfig();
                } else if (mode === "timer_to_on" && !data.config.timerToOnConfig) {
                  updates.timerToOnConfig = initTimerToOnConfig();
                } else if (mode === "timer_to_off" && !data.config.timerToOffConfig) {
                  updates.timerToOffConfig = initTimerToOffConfig();
                } else if (mode === "cycle" && !data.config.cycleConfig) {
                  updates.cycleConfig = initCycleConfig();
                } else if (mode === "schedule" && !data.config.scheduleConfig) {
                  updates.scheduleConfig = initScheduleConfig();
                }

                updateConfig(updates);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* AUTO Mode Configuration */}
      {selectedMode === "auto" && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[#00d4ff]" />
            <h4 className="text-sm font-semibold text-[#00d4ff]">AUTO MODE TRIGGERS</h4>
          </div>

          {/* Temperature Triggers */}
          <div className="space-y-3 rounded-lg border border-[rgba(255,82,82,0.2)] bg-[rgba(255,82,82,0.05)] p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#ff5252]">Temperature</span>

            {/* High Temp Trigger */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="tempHighEnabled"
                checked={data.config.autoConfig?.tempHighEnabled ?? false}
                onCheckedChange={(checked) =>
                  updateConfig({ autoConfig: { ...data.config.autoConfig!, tempHighEnabled: !!checked } })
                }
              />
              <Label htmlFor="tempHighEnabled" className="flex-1 text-xs">High ≥</Label>
              <Input
                type="number"
                className="h-7 w-16 text-sm font-mono"
                value={data.config.autoConfig?.tempHighTrigger ?? 80}
                onChange={(e) =>
                  updateConfig({ autoConfig: { ...data.config.autoConfig!, tempHighTrigger: Number(e.target.value) } })
                }
                disabled={!data.config.autoConfig?.tempHighEnabled}
              />
              <span className="text-xs text-muted-foreground">°F</span>
            </div>

            {/* Low Temp Trigger */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="tempLowEnabled"
                checked={data.config.autoConfig?.tempLowEnabled ?? false}
                onCheckedChange={(checked) =>
                  updateConfig({ autoConfig: { ...data.config.autoConfig!, tempLowEnabled: !!checked } })
                }
              />
              <Label htmlFor="tempLowEnabled" className="flex-1 text-xs">Low ≤</Label>
              <Input
                type="number"
                className="h-7 w-16 text-sm font-mono"
                value={data.config.autoConfig?.tempLowTrigger ?? 65}
                onChange={(e) =>
                  updateConfig({ autoConfig: { ...data.config.autoConfig!, tempLowTrigger: Number(e.target.value) } })
                }
                disabled={!data.config.autoConfig?.tempLowEnabled}
              />
              <span className="text-xs text-muted-foreground">°F</span>
            </div>

            {/* Temp Settings Row */}
            <div className="flex items-center gap-4 pt-2 border-t border-[rgba(255,82,82,0.1)]">
              <div className="flex items-center gap-1">
                <Label className="text-[10px] text-muted-foreground">Transition</Label>
                <Input
                  type="number"
                  step={0.5}
                  className="h-6 w-12 text-xs font-mono"
                  value={data.config.autoConfig?.tempTransition ?? 2.0}
                  onChange={(e) =>
                    updateConfig({ autoConfig: { ...data.config.autoConfig!, tempTransition: Number(e.target.value) } })
                  }
                />
                <span className="text-[10px] text-muted-foreground">°F/step</span>
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-[10px] text-muted-foreground">Buffer</Label>
                <Input
                  type="number"
                  step={1}
                  min={0}
                  max={8}
                  className="h-6 w-12 text-xs font-mono"
                  value={data.config.autoConfig?.tempBuffer ?? 0}
                  onChange={(e) =>
                    updateConfig({ autoConfig: { ...data.config.autoConfig!, tempBuffer: Number(e.target.value) } })
                  }
                />
                <span className="text-[10px] text-muted-foreground">°F</span>
              </div>
            </div>
          </div>

          {/* Humidity Triggers */}
          <div className="space-y-3 rounded-lg border border-[rgba(79,195,247,0.2)] bg-[rgba(79,195,247,0.05)] p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#4fc3f7]">Humidity</span>

            {/* High Humidity Trigger */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="humidityHighEnabled"
                checked={data.config.autoConfig?.humidityHighEnabled ?? false}
                onCheckedChange={(checked) =>
                  updateConfig({ autoConfig: { ...data.config.autoConfig!, humidityHighEnabled: !!checked } })
                }
              />
              <Label htmlFor="humidityHighEnabled" className="flex-1 text-xs">High ≥</Label>
              <Input
                type="number"
                className="h-7 w-16 text-sm font-mono"
                value={data.config.autoConfig?.humidityHighTrigger ?? 70}
                onChange={(e) =>
                  updateConfig({ autoConfig: { ...data.config.autoConfig!, humidityHighTrigger: Number(e.target.value) } })
                }
                disabled={!data.config.autoConfig?.humidityHighEnabled}
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>

            {/* Low Humidity Trigger */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="humidityLowEnabled"
                checked={data.config.autoConfig?.humidityLowEnabled ?? false}
                onCheckedChange={(checked) =>
                  updateConfig({ autoConfig: { ...data.config.autoConfig!, humidityLowEnabled: !!checked } })
                }
              />
              <Label htmlFor="humidityLowEnabled" className="flex-1 text-xs">Low ≤</Label>
              <Input
                type="number"
                className="h-7 w-16 text-sm font-mono"
                value={data.config.autoConfig?.humidityLowTrigger ?? 50}
                onChange={(e) =>
                  updateConfig({ autoConfig: { ...data.config.autoConfig!, humidityLowTrigger: Number(e.target.value) } })
                }
                disabled={!data.config.autoConfig?.humidityLowEnabled}
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>

            {/* Humidity Settings Row */}
            <div className="flex items-center gap-4 pt-2 border-t border-[rgba(79,195,247,0.1)]">
              <div className="flex items-center gap-1">
                <Label className="text-[10px] text-muted-foreground">Transition</Label>
                <Input
                  type="number"
                  step={1}
                  className="h-6 w-12 text-xs font-mono"
                  value={data.config.autoConfig?.humidityTransition ?? 5.0}
                  onChange={(e) =>
                    updateConfig({ autoConfig: { ...data.config.autoConfig!, humidityTransition: Number(e.target.value) } })
                  }
                />
                <span className="text-[10px] text-muted-foreground">%/step</span>
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-[10px] text-muted-foreground">Buffer</Label>
                <Input
                  type="number"
                  step={1}
                  min={0}
                  max={10}
                  className="h-6 w-12 text-xs font-mono"
                  value={data.config.autoConfig?.humidityBuffer ?? 0}
                  onChange={(e) =>
                    updateConfig({ autoConfig: { ...data.config.autoConfig!, humidityBuffer: Number(e.target.value) } })
                  }
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VPD Mode Configuration */}
      {selectedMode === "vpd" && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[#b388ff]" />
            <h4 className="text-sm font-semibold text-[#b388ff]">VPD MODE TRIGGERS</h4>
          </div>

          <div className="space-y-3 rounded-lg border border-[rgba(179,136,255,0.2)] bg-[rgba(179,136,255,0.05)] p-3">
            {/* High VPD Trigger */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="vpdHighEnabled"
                checked={data.config.vpdConfig?.vpdHighEnabled ?? true}
                onCheckedChange={(checked) =>
                  updateConfig({ vpdConfig: { ...data.config.vpdConfig!, vpdHighEnabled: !!checked } })
                }
              />
              <Label htmlFor="vpdHighEnabled" className="flex-1 text-xs">High ≥</Label>
              <Input
                type="number"
                step={0.1}
                className="h-7 w-16 text-sm font-mono"
                value={data.config.vpdConfig?.vpdHighTrigger ?? 1.5}
                onChange={(e) =>
                  updateConfig({ vpdConfig: { ...data.config.vpdConfig!, vpdHighTrigger: Number(e.target.value) } })
                }
                disabled={!data.config.vpdConfig?.vpdHighEnabled}
              />
              <span className="text-xs text-muted-foreground">kPa</span>
            </div>

            {/* Low VPD Trigger */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="vpdLowEnabled"
                checked={data.config.vpdConfig?.vpdLowEnabled ?? true}
                onCheckedChange={(checked) =>
                  updateConfig({ vpdConfig: { ...data.config.vpdConfig!, vpdLowEnabled: !!checked } })
                }
              />
              <Label htmlFor="vpdLowEnabled" className="flex-1 text-xs">Low ≤</Label>
              <Input
                type="number"
                step={0.1}
                className="h-7 w-16 text-sm font-mono"
                value={data.config.vpdConfig?.vpdLowTrigger ?? 0.8}
                onChange={(e) =>
                  updateConfig({ vpdConfig: { ...data.config.vpdConfig!, vpdLowTrigger: Number(e.target.value) } })
                }
                disabled={!data.config.vpdConfig?.vpdLowEnabled}
              />
              <span className="text-xs text-muted-foreground">kPa</span>
            </div>

            {/* VPD Settings Row */}
            <div className="flex items-center gap-4 pt-2 border-t border-[rgba(179,136,255,0.1)]">
              <div className="flex items-center gap-1">
                <Label className="text-[10px] text-muted-foreground">Transition</Label>
                <Input
                  type="number"
                  step={0.05}
                  className="h-6 w-14 text-xs font-mono"
                  value={data.config.vpdConfig?.vpdTransition ?? 0.1}
                  onChange={(e) =>
                    updateConfig({ vpdConfig: { ...data.config.vpdConfig!, vpdTransition: Number(e.target.value) } })
                  }
                />
                <span className="text-[10px] text-muted-foreground">kPa/step</span>
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-[10px] text-muted-foreground">Buffer</Label>
                <Input
                  type="number"
                  step={0.05}
                  min={0}
                  max={0.5}
                  className="h-6 w-14 text-xs font-mono"
                  value={data.config.vpdConfig?.vpdBuffer ?? 0}
                  onChange={(e) =>
                    updateConfig({ vpdConfig: { ...data.config.vpdConfig!, vpdBuffer: Number(e.target.value) } })
                  }
                />
                <span className="text-[10px] text-muted-foreground">kPa</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timer To On Mode Configuration */}
      {selectedMode === "timer_to_on" && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-[#00d4ff]" />
            <h4 className="text-sm font-semibold text-[#00d4ff]">TIMER → ON</h4>
          </div>
          <p className="text-xs text-muted-foreground">Device turns ON after countdown completes</p>

          <div className="space-y-2">
            <Label className="text-xs">Countdown Duration</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="h-8 w-20 font-mono"
                value={Math.floor((data.config.timerToOnConfig?.durationMinutes ?? 60) / 60)}
                onChange={(e) => {
                  const hours = Number(e.target.value);
                  const mins = (data.config.timerToOnConfig?.durationMinutes ?? 60) % 60;
                  updateConfig({ timerToOnConfig: { durationMinutes: hours * 60 + mins } });
                }}
              />
              <span className="text-xs">h</span>
              <Input
                type="number"
                min={0}
                max={59}
                className="h-8 w-16 font-mono"
                value={(data.config.timerToOnConfig?.durationMinutes ?? 60) % 60}
                onChange={(e) => {
                  const hours = Math.floor((data.config.timerToOnConfig?.durationMinutes ?? 60) / 60);
                  const mins = Number(e.target.value);
                  updateConfig({ timerToOnConfig: { durationMinutes: hours * 60 + mins } });
                }}
              />
              <span className="text-xs">m</span>
            </div>
          </div>
        </div>
      )}

      {/* Timer To Off Mode Configuration */}
      {selectedMode === "timer_to_off" && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-[#00d4ff]" />
            <h4 className="text-sm font-semibold text-[#00d4ff]">TIMER → OFF</h4>
          </div>
          <p className="text-xs text-muted-foreground">Device turns OFF after countdown completes</p>

          <div className="space-y-2">
            <Label className="text-xs">Countdown Duration</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="h-8 w-20 font-mono"
                value={Math.floor((data.config.timerToOffConfig?.durationMinutes ?? 60) / 60)}
                onChange={(e) => {
                  const hours = Number(e.target.value);
                  const mins = (data.config.timerToOffConfig?.durationMinutes ?? 60) % 60;
                  updateConfig({ timerToOffConfig: { durationMinutes: hours * 60 + mins } });
                }}
              />
              <span className="text-xs">h</span>
              <Input
                type="number"
                min={0}
                max={59}
                className="h-8 w-16 font-mono"
                value={(data.config.timerToOffConfig?.durationMinutes ?? 60) % 60}
                onChange={(e) => {
                  const hours = Math.floor((data.config.timerToOffConfig?.durationMinutes ?? 60) / 60);
                  const mins = Number(e.target.value);
                  updateConfig({ timerToOffConfig: { durationMinutes: hours * 60 + mins } });
                }}
              />
              <span className="text-xs">m</span>
            </div>
          </div>
        </div>
      )}

      {/* Cycle Mode Configuration */}
      {selectedMode === "cycle" && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-[#00d4ff]" />
            <h4 className="text-sm font-semibold text-[#00d4ff]">CYCLE MODE</h4>
          </div>
          <p className="text-xs text-muted-foreground">Repeating ON/OFF cycle</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-[#00e676]">ON Duration</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  className="h-8 font-mono"
                  value={data.config.cycleConfig?.durationOnMinutes ?? 15}
                  onChange={(e) =>
                    updateConfig({ cycleConfig: { ...data.config.cycleConfig!, durationOnMinutes: Number(e.target.value) } })
                  }
                />
                <span className="text-xs">min</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">OFF Duration</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  className="h-8 font-mono"
                  value={data.config.cycleConfig?.durationOffMinutes ?? 45}
                  onChange={(e) =>
                    updateConfig({ cycleConfig: { ...data.config.cycleConfig!, durationOffMinutes: Number(e.target.value) } })
                  }
                />
                <span className="text-xs">min</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Mode Configuration */}
      {selectedMode === "schedule" && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#ffd740]" />
            <h4 className="text-sm font-semibold text-[#ffd740]">SCHEDULE MODE</h4>
          </div>
          <p className="text-xs text-muted-foreground">Daily ON/OFF times (24h clock)</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Sunrise className="h-3 w-3 text-amber-500" />
                ON Time
              </Label>
              <Input
                type="time"
                className="h-8 font-mono"
                value={data.config.scheduleConfig?.onTime ?? "06:00"}
                onChange={(e) =>
                  updateConfig({ scheduleConfig: { ...data.config.scheduleConfig!, onTime: e.target.value } })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Sunset className="h-3 w-3 text-orange-500" />
                OFF Time
              </Label>
              <Input
                type="time"
                className="h-8 font-mono"
                value={data.config.scheduleConfig?.offTime ?? "00:00"}
                onChange={(e) =>
                  updateConfig({ scheduleConfig: { ...data.config.scheduleConfig!, offTime: e.target.value } })
                }
              />
            </div>
          </div>

          {/* Days of Week */}
          <div className="space-y-2">
            <Label className="text-xs">Active Days (empty = everyday)</Label>
            <div className="flex flex-wrap gap-1">
              {SCHEDULE_DAYS.map((day) => (
                <Button
                  key={day.value}
                  type="button"
                  variant={(data.config.scheduleConfig?.days ?? []).includes(day.value) ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 w-9 text-xs px-1",
                    (data.config.scheduleConfig?.days ?? []).includes(day.value) && "bg-[#ffd740] text-black hover:bg-[#ffd740]/90"
                  )}
                  onClick={() => {
                    const days = data.config.scheduleConfig?.days ?? [];
                    const newDays = days.includes(day.value)
                      ? days.filter(d => d !== day.value)
                      : [...days, day.value].sort();
                    updateConfig({ scheduleConfig: { ...data.config.scheduleConfig!, days: newDays } });
                  }}
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Priority (for automation engine) */}
      <div className="space-y-2 border-t pt-4">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority</Label>
        <Input
          type="number"
          min={0}
          className="h-8 w-20 font-mono"
          value={data.config.priority ?? 0}
          onChange={(e) => updateConfig({ priority: parseInt(e.target.value, 10) })}
        />
        <p className="text-[10px] text-muted-foreground">
          Higher priority overrides lower when multiple automations target the same port
        </p>
      </div>
    </div>
  );
}

/**
 * DimmerProperties - Light schedule configuration with sunrise/sunset simulation
 *
 * Timeline (ramps happen WITHIN the on/off window):
 * - onTime: Lights turn on at minLevel, sunrise ramp begins
 * - sunriseEnd (onTime + sunriseMinutes): At maxLevel
 * - sunsetStart (offTime - sunsetMinutes): Sunset ramp begins from maxLevel
 * - offTime: Lights at minLevel, turn off
 */
function DimmerProperties({
  node,
  onUpdate,
  controllers = [],
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
  controllers: NodePropertiesPanelProps["controllers"];
}) {
  const data = node.data as DimmerNodeData;
  const { capabilities } = useControllerCapabilities();

  const updateConfig = (field: string, value: unknown) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    });
  };

  const selectedControllerCapabilities = React.useMemo(() => {
    if (!data.config.controllerId || !capabilities) return null;
    if (capabilities instanceof Map) {
      return capabilities.get(data.config.controllerId);
    }
    return capabilities.controller_id === data.config.controllerId ? capabilities : null;
  }, [capabilities, data.config.controllerId]);

  const availableDevices = selectedControllerCapabilities?.devices || [];

  // Calculate when sunrise ramp ends (reaches max level) - AFTER onTime
  const getSunriseEndTime = (): string => {
    if (!data.config.onTime) return "--:--";
    const [hours, mins] = data.config.onTime.split(":").map(Number);
    const totalMins = hours * 60 + mins + (data.config.sunriseMinutes ?? 0);
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Calculate when sunset ramp starts (begins dimming) - BEFORE offTime
  const getSunsetStartTime = (): string => {
    if (!data.config.offTime) return "--:--";
    const [hours, mins] = data.config.offTime.split(":").map(Number);
    const totalMins = hours * 60 + mins - (data.config.sunsetMinutes ?? 0);
    const h = Math.floor((totalMins + 1440) / 60) % 24; // Handle negative wrap
    const m = ((totalMins % 60) + 60) % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* Controller Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Controller</Label>
        <Select
          value={data.config.controllerId ?? ""}
          onValueChange={(value) => {
            const controller = controllers?.find(c => c.id === value);
            updateConfig("controllerId", value);
            if (controller) {
              updateConfig("controllerName", controller.name);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a controller" />
          </SelectTrigger>
          <SelectContent>
            {controllers?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Port Selection */}
      {data.config.controllerId && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Light Port</Label>
          <Select
            value={data.config.port?.toString() ?? ""}
            onValueChange={(value) => updateConfig("port", parseInt(value, 10))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a port" />
            </SelectTrigger>
            <SelectContent>
              {availableDevices.filter(d => d.type === 'light' || d.supportsDimming).map((device) => (
                <SelectItem key={device.port} value={String(device.port)}>
                  Port {device.port}: {device.name}
                </SelectItem>
              ))}
              {availableDevices.filter(d => d.type === 'light' || d.supportsDimming).length === 0 && (
                <SelectItem value="" disabled>No dimmable devices</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ON/OFF Schedule */}
      <div className="space-y-3 rounded-lg border border-[rgba(255,215,64,0.2)] bg-[rgba(255,215,64,0.05)] p-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#ffd740]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#ffd740]">Light Schedule</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#00e676]">ON Time</Label>
            <Input
              type="time"
              className="h-8 font-mono"
              value={data.config.onTime ?? "06:00"}
              onChange={(e) => updateConfig("onTime", e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">Lights turn on, ramp up starts</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">OFF Time</Label>
            <Input
              type="time"
              className="h-8 font-mono"
              value={data.config.offTime ?? "22:00"}
              onChange={(e) => updateConfig("offTime", e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">Ramp down ends, lights off</p>
          </div>
        </div>

        {/* Days of week */}
        <div className="space-y-1 pt-2 border-t border-[rgba(255,215,64,0.1)]">
          <Label className="text-[10px] text-muted-foreground">Days (empty = everyday)</Label>
          <div className="flex flex-wrap gap-1">
            {SCHEDULE_DAYS.map((day) => (
              <Button
                key={day.value}
                type="button"
                variant={(data.config.days ?? []).includes(day.value) ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-6 w-8 text-xs px-1",
                  (data.config.days ?? []).includes(day.value) && "bg-[#ffd740] text-black hover:bg-[#ffd740]/90"
                )}
                onClick={() => {
                  const days = data.config.days ?? [];
                  const newDays = days.includes(day.value)
                    ? days.filter(d => d !== day.value)
                    : [...days, day.value].sort();
                  updateConfig("days", newDays);
                }}
              >
                {day.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Sunrise/Sunset Ramp */}
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sunrise / Sunset Ramp</span>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-xs">
              <Sunrise className="h-3 w-3 text-amber-500" /> Sunrise
            </Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={120}
                className="h-8 w-16 font-mono"
                value={data.config.sunriseMinutes ?? 0}
                onChange={(e) => updateConfig("sunriseMinutes", Number(e.target.value))}
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
            {(data.config.sunriseMinutes ?? 0) > 0 && (
              <p className="text-[10px] text-muted-foreground">
                At max by {getSunriseEndTime()}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-xs">
              <Sunset className="h-3 w-3 text-orange-500" /> Sunset
            </Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={120}
                className="h-8 w-16 font-mono"
                value={data.config.sunsetMinutes ?? 0}
                onChange={(e) => updateConfig("sunsetMinutes", Number(e.target.value))}
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
            {(data.config.sunsetMinutes ?? 0) > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Dims from {getSunsetStartTime()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Level Range */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Level Range</Label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs">Min Level (night)</span>
            <span className="font-mono text-sm">{data.config.minLevel ?? 0}%</span>
          </div>
          <Slider
            value={[data.config.minLevel ?? 0]}
            min={0}
            max={100}
            step={1}
            onValueChange={([value]) => updateConfig("minLevel", value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs">Max Level (day)</span>
            <span className="font-mono text-sm text-[#ffd740]">{data.config.maxLevel ?? 100}%</span>
          </div>
          <Slider
            value={[data.config.maxLevel ?? 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([value]) => updateConfig("maxLevel", value)}
            className="[&_[role=slider]]:bg-[#ffd740]"
          />
        </div>
      </div>

      {/* Curve Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transition Curve</Label>
        <Select
          value={data.config.curve ?? "sigmoid"}
          onValueChange={(value) => updateConfig("curve", value as DimmerCurve)}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DIMMER_CURVE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline Preview */}
      <div className="rounded-md border border-dashed p-3 bg-[rgba(255,215,64,0.05)]">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong className="text-[#00e676]">{data.config.onTime ?? "06:00"}</strong> - ON ({data.config.minLevel ?? 0}%)
          {(data.config.sunriseMinutes ?? 0) > 0 && (
            <>
              {" → "}<strong>{getSunriseEndTime()}</strong> - Max ({data.config.maxLevel ?? 100}%)
            </>
          )}
          {(data.config.sunsetMinutes ?? 0) > 0 && (
            <>
              {" → "}<strong>{getSunsetStartTime()}</strong> - Dim begins
            </>
          )}
          {" → "}<strong>{data.config.offTime ?? "22:00"}</strong> - OFF ({data.config.minLevel ?? 0}%)
        </p>
      </div>
    </div>
  );
}

/**
 * NotificationProperties - Configuration panel for notification nodes
 */
function NotificationProperties({
  node,
  onUpdate,
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
}) {
  const data = node.data as NotificationNodeData;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const updateConfig = (field: string, value: unknown) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    });
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentMessage = data.config.message ?? "";
    const newMessage = currentMessage.slice(0, start) + variable + currentMessage.slice(end);
    updateConfig("message", newMessage);

    // Restore cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const priorityColors: Record<NotificationPriority, string> = {
    low: "text-blue-500 bg-blue-500/10",
    normal: "text-purple-500 bg-purple-500/10",
    high: "text-orange-500 bg-orange-500/10",
    critical: "text-red-500 bg-red-500/10",
  };

  return (
    <div className="space-y-4">
      {/* Message Template */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Message</Label>
        <Textarea
          ref={textareaRef}
          value={data.config.message ?? ""}
          onChange={(e) => updateConfig("message", e.target.value)}
          placeholder="Enter notification message..."
          className="min-h-[80px] font-mono text-sm"
        />
      </div>

      {/* Variable Insertion */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Insert Variables
        </Label>
        <div className="flex flex-wrap gap-1">
          {MESSAGE_VARIABLES.map((v) => (
            <Button
              key={v.variable}
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => insertVariable(v.variable)}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      {data.config.message && (
        <div className="rounded-md border bg-muted/50 p-3">
          <Label className="text-xs text-muted-foreground mb-1 block">Preview</Label>
          <p className="text-sm">
            {(data.config.message ?? "")
              .replace("{{sensor.temperature}}", "75.2°F")
              .replace("{{sensor.humidity}}", "52%")
              .replace("{{sensor.vpd}}", "1.34 kPa")
              .replace("{{sensor.co2}}", "800 ppm")
              .replace("{{controller.name}}", "Grow Tent 2x2")
              .replace("{{room.name}}", "Veg Room")
              .replace("{{time}}", new Date().toLocaleTimeString())
              .replace("{{date}}", new Date().toLocaleDateString())}
          </p>
        </div>
      )}

      {/* Priority */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Priority</Label>
        <Select
          value={data.config.priority ?? "normal"}
          onValueChange={(value) => updateConfig("priority", value as NotificationPriority)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(NOTIFICATION_PRIORITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium", priorityColors[value as NotificationPriority])}>
                  {label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Channels */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Channels</Label>
        <div className="space-y-2">
          {(Object.entries(NOTIFICATION_CHANNEL_LABELS) as [NotificationChannel, string][]).map(([channel, label]) => (
            <div key={channel} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                {channel === "push" && <Bell className="h-4 w-4 text-muted-foreground" />}
                {channel === "email" && <span className="text-muted-foreground">✉</span>}
                {channel === "sms" && <span className="text-muted-foreground">📱</span>}
                <Label className="text-sm">{label}</Label>
              </div>
              <Switch
                checked={(data.config.channels ?? []).includes(channel)}
                onCheckedChange={(checked) => {
                  const channels = data.config.channels ?? [];
                  if (checked) {
                    updateConfig("channels", [...channels, channel]);
                  } else {
                    updateConfig("channels", channels.filter((c) => c !== channel));
                  }
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Help */}
      <div className="rounded-md border border-dashed p-3 bg-purple-500/5">
        <p className="text-xs text-muted-foreground">
          Notifications are sent when the workflow reaches this node. Use variables to include dynamic sensor data.
        </p>
      </div>
    </div>
  );
}

/**
 * Main NodePropertiesPanel component
 */
export function NodePropertiesPanel({
  node,
  onUpdate,
  onClose,
  controllers = [],
}: NodePropertiesPanelProps) {
  if (!node) return null;

  const nodeType = node.type;
  let title = "Node Properties";
  let icon: React.ReactNode = null;
  let colorClass = "border-muted";

  switch (nodeType) {
    case "trigger":
      title = "Trigger";
      icon = <Play className="h-4 w-4" />;
      colorClass = "border-green-500";
      break;
    case "sensor":
      title = "Sensor";
      icon = <Thermometer className="h-4 w-4" />;
      colorClass = "border-blue-500";
      break;
    case "condition":
      title = "Condition";
      icon = <GitBranch className="h-4 w-4" />;
      colorClass = "border-amber-500";
      break;
    case "delay":
      title = "Delay";
      icon = <Timer className="h-4 w-4" />;
      colorClass = "border-amber-500";
      break;
    case "variable":
      title = "Variable";
      icon = <Variable className="h-4 w-4" />;
      colorClass = "border-violet-500";
      break;
    case "debounce":
      title = "Debounce";
      icon = <Filter className="h-4 w-4" />;
      colorClass = "border-slate-500";
      break;
    case "verified_action":
      title = "Verified Action";
      icon = <CheckCircle2 className="h-4 w-4" />;
      colorClass = "border-emerald-500";
      break;
    case "port_condition":
      title = "Port Condition";
      icon = <Zap className="h-4 w-4" />;
      colorClass = "border-amber-500";
      break;
    case "mode":
      title = "Mode Programming";
      icon = <Settings className="h-4 w-4" />;
      colorClass = "border-cyan-500";
      break;
    case "dimmer":
      title = "Dimmer Schedule";
      icon = <Sun className="h-4 w-4" />;
      colorClass = "border-yellow-500";
      break;
    case "notification":
      title = "Notification";
      icon = <Bell className="h-4 w-4" />;
      colorClass = "border-purple-500";
      break;
  }

  return (
    <div className={cn("w-80 border-l bg-card", colorClass)}>
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold">{title}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Panel Content */}
      <div className="p-4">
        {/* Node Label */}
        <div className="mb-4 space-y-2">
          <Label className="text-sm font-medium">Label</Label>
          <Input
            value={(node.data as { label: string }).label ?? ""}
            onChange={(e) => onUpdate(node.id, { label: e.target.value })}
            placeholder="Enter node label..."
          />
        </div>

        {/* Type-specific properties */}
        {nodeType === "trigger" && (
          <TriggerProperties node={node} onUpdate={onUpdate} controllers={controllers} />
        )}
        {nodeType === "sensor" && (
          <SensorProperties node={node} onUpdate={onUpdate} controllers={controllers} />
        )}
        {nodeType === "action" && (
          <ActionProperties node={node} onUpdate={onUpdate} controllers={controllers} />
        )}
        {nodeType === "condition" && (
          <ConditionProperties node={node} onUpdate={onUpdate} />
        )}
        {nodeType === "delay" && (
          <DelayProperties node={node} onUpdate={onUpdate} />
        )}
        {nodeType === "variable" && (
          <VariableProperties node={node} onUpdate={onUpdate} />
        )}
        {nodeType === "debounce" && (
          <DebounceProperties node={node} onUpdate={onUpdate} />
        )}
        {nodeType === "verified_action" && (
          <VerifiedActionProperties node={node} onUpdate={onUpdate} controllers={controllers} />
        )}
        {nodeType === "port_condition" && (
          <PortConditionProperties node={node} onUpdate={onUpdate} controllers={controllers} />
        )}
        {nodeType === "mode" && (
          <ModeProperties node={node} onUpdate={onUpdate} controllers={controllers} />
        )}
        {nodeType === "dimmer" && (
          <DimmerProperties node={node} onUpdate={onUpdate} controllers={controllers} />
        )}
        {nodeType === "notification" && (
          <NotificationProperties node={node} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

NodePropertiesPanel.displayName = "NodePropertiesPanel";

export default NodePropertiesPanel;
