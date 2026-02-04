"use client";

import * as React from "react";
import { X, Play, Thermometer, GitBranch, Clock, MousePointer, AlertCircle, Timer, Variable, Filter, Radio, CheckCircle2, Zap } from "lucide-react";
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

      <div className="rounded-md border border-dashed p-3 bg-amber-500/5">
        <p className="text-xs text-muted-foreground">
          Routes workflow based on current port state. Has two outputs: "true" path and "false" path.
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
      </div>
    </div>
  );
}

NodePropertiesPanel.displayName = "NodePropertiesPanel";

export default NodePropertiesPanel;
