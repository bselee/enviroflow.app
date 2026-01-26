"use client";

import * as React from "react";
import {
  Play,
  Thermometer,
  GitBranch,
  Zap,
  Sun,
  Bell,
  X,
  Settings,
  CheckCircle,
  Filter,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useControllers } from "@/hooks/use-controllers";
import { useControllerPorts } from "@/hooks/use-controller-ports";
import type {
  WorkflowNode,
  WorkflowNodeType,
  SensorType,
  ComparisonOperator,
  DeviceType,
  ActionVariant,
  NotificationPriority,
  NotificationChannel,
  DimmerCurve,
  DeviceModeType,
  ScheduleModeConfig,
} from "./types";
import {
  SENSOR_TYPE_LABELS,
  OPERATOR_LABELS,
  DEVICE_TYPE_LABELS,
  ACTION_VARIANT_LABELS,
  DIMMER_CURVE_LABELS,
  NOTIFICATION_PRIORITY_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  MESSAGE_VARIABLES,
  MODE_LABELS,
} from "./types";

/**
 * PropertiesPanel - Dynamic configuration panel for selected workflow nodes
 *
 * This component displays a form for editing the selected node's properties.
 * Features:
 * - Dynamic form based on node type
 * - Validation with error messages
 * - Apply/Cancel buttons
 * - Controller/device selection
 *
 * Visual Design:
 * - Right-side sliding panel
 * - Grouped form sections
 * - Type-specific icons and colors
 */

/** Node type metadata for display */
const NODE_TYPE_CONFIG: Record<
  WorkflowNodeType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
  }
> = {
  trigger: {
    label: "Trigger",
    icon: Play,
    colorClass: "text-green-500",
  },
  sensor: {
    label: "Sensor",
    icon: Thermometer,
    colorClass: "text-blue-500",
  },
  condition: {
    label: "Condition",
    icon: GitBranch,
    colorClass: "text-cyan-500",
  },
  action: {
    label: "Action",
    icon: Zap,
    colorClass: "text-orange-500",
  },
  dimmer: {
    label: "Dimmer",
    icon: Sun,
    colorClass: "text-yellow-500",
  },
  notification: {
    label: "Notification",
    icon: Bell,
    colorClass: "text-purple-500",
  },
  mode: {
    label: "Mode Programming",
    icon: Settings,
    colorClass: "text-indigo-500",
  },
  verified_action: {
    label: "Verified Action",
    icon: CheckCircle,
    colorClass: "text-emerald-500",
  },
  port_condition: {
    label: "Port Condition",
    icon: Filter,
    colorClass: "text-pink-500",
  },
};

/** Mock controllers for demo - in production, fetch from API */
const MOCK_CONTROLLERS = [
  { id: "ctrl-1", name: "Tent Controller 1", brand: "ac_infinity" },
  { id: "ctrl-2", name: "Inkbird Temp", brand: "inkbird" },
  { id: "ctrl-3", name: "Flower Room", brand: "ac_infinity" },
];

interface PropertiesPanelProps {
  /** Currently selected node (null if none selected) */
  selectedNode: WorkflowNode | null;
  /** Callback when node data is updated */
  onNodeUpdate?: (nodeId: string, data: Record<string, unknown>) => void;
  /** Callback when panel is closed */
  onClose?: () => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * PropertiesPanel - Configuration panel for workflow nodes
 */
export function PropertiesPanel({
  selectedNode,
  onNodeUpdate,
  onClose,
  className,
}: PropertiesPanelProps) {
  // Local state for form values (allows editing without immediate save)
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = React.useState(false);

  // Reset form when selected node changes
  React.useEffect(() => {
    if (selectedNode) {
      setFormData(selectedNode.data as unknown as Record<string, unknown>);
      setErrors({});
      setIsDirty(false);
    }
    // Only depend on selectedNode.id to avoid resetting on every data change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id]);

  /**
   * Updates a form field value.
   */
  const updateField = React.useCallback(
    (path: string, value: unknown) => {
      setFormData((prev) => {
        const newData = { ...prev };
        const keys = path.split(".");
        let current: Record<string, unknown> = newData;

        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (!current[key] || typeof current[key] !== "object") {
            current[key] = {};
          }
          current = current[key] as Record<string, unknown>;
        }

        current[keys[keys.length - 1]] = value;
        return newData;
      });
      setIsDirty(true);

      // Clear error for this field
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[path];
        return newErrors;
      });
    },
    []
  );

  /**
   * Gets a nested field value from form data.
   */
  const getField = React.useCallback(
    <T,>(path: string, defaultValue?: T): T => {
      const keys = path.split(".");
      let current: unknown = formData;

      for (const key of keys) {
        if (current === null || current === undefined || typeof current !== "object") {
          return defaultValue as T;
        }
        current = (current as Record<string, unknown>)[key];
      }

      return (current ?? defaultValue) as T;
    },
    [formData]
  );

  /**
   * Validates the form and returns true if valid.
   */
  const validateForm = React.useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedNode) return false;

    // Common validation: label is required
    if (!getField<string>("label")) {
      newErrors["label"] = "Label is required";
    }

    // Type-specific validation
    switch (selectedNode.type) {
      case "trigger": {
        const triggerType = getField<string>("config.triggerType");
        if (triggerType === "schedule") {
          if (!getField<string>("config.simpleTime") && !getField<string>("config.cronExpression")) {
            newErrors["config.simpleTime"] = "Schedule time is required";
          }
        } else if (triggerType === "sensor_threshold") {
          if (!getField<string>("config.sensorType")) {
            newErrors["config.sensorType"] = "Sensor type is required";
          }
          if (getField<number | undefined>("config.threshold") === undefined) {
            newErrors["config.threshold"] = "Threshold is required";
          }
        }
        break;
      }

      case "sensor": {
        if (!getField<string>("config.controllerId")) {
          newErrors["config.controllerId"] = "Controller is required";
        }
        if (!getField<string>("config.sensorType")) {
          newErrors["config.sensorType"] = "Sensor type is required";
        }
        break;
      }

      case "action": {
        if (!getField<string>("config.controllerId")) {
          newErrors["config.controllerId"] = "Controller is required";
        }
        if (!getField<string>("config.action")) {
          newErrors["config.action"] = "Action is required";
        }
        break;
      }

      case "dimmer": {
        if (!getField<string>("config.controllerId")) {
          newErrors["config.controllerId"] = "Controller is required";
        }
        if (!getField<string>("config.sunriseTime")) {
          newErrors["config.sunriseTime"] = "Sunrise time is required";
        }
        if (!getField<string>("config.sunsetTime")) {
          newErrors["config.sunsetTime"] = "Sunset time is required";
        }
        break;
      }

      case "notification": {
        if (!getField<string>("config.message")) {
          newErrors["config.message"] = "Message is required";
        }
        const channels = getField<string[]>("config.channels", []);
        if (channels.length === 0) {
          newErrors["config.channels"] = "At least one channel is required";
        }
        break;
      }

      case "mode": {
        if (!getField<string>("config.controllerId")) {
          newErrors["config.controllerId"] = "Controller is required";
        }
        if (!getField<number>("config.port")) {
          newErrors["config.port"] = "Port is required";
        }
        if (!getField<string>("config.mode")) {
          newErrors["config.mode"] = "Mode is required";
        }

        // Mode-specific validation
        const mode = getField<DeviceModeType>("config.mode");
        if (mode === "auto") {
          const autoConfig = getField<Record<string, unknown>>("config.autoConfig", {});
          if (autoConfig.tempHighEnabled && autoConfig.tempLowEnabled) {
            const tempLow = autoConfig.tempLowTrigger as number | undefined;
            const tempHigh = autoConfig.tempHighTrigger as number | undefined;
            if (tempLow !== undefined && tempHigh !== undefined && tempLow >= tempHigh) {
              newErrors["config.autoConfig.tempTriggers"] = "Low temp must be less than high temp";
            }
          }
          if (autoConfig.humidityHighEnabled && autoConfig.humidityLowEnabled) {
            const humLow = autoConfig.humidityLowTrigger as number | undefined;
            const humHigh = autoConfig.humidityHighTrigger as number | undefined;
            if (humLow !== undefined && humHigh !== undefined && humLow >= humHigh) {
              newErrors["config.autoConfig.humidityTriggers"] = "Low humidity must be less than high humidity";
            }
          }
        } else if (mode === "vpd") {
          const vpdConfig = getField<Record<string, unknown>>("config.vpdConfig", {});
          if (vpdConfig.vpdHighEnabled && vpdConfig.vpdLowEnabled) {
            const vpdLow = vpdConfig.vpdLowTrigger as number | undefined;
            const vpdHigh = vpdConfig.vpdHighTrigger as number | undefined;
            if (vpdLow !== undefined && vpdHigh !== undefined && vpdLow >= vpdHigh) {
              newErrors["config.vpdConfig.vpdTriggers"] = "Low VPD must be less than high VPD";
            }
          }
        } else if (mode === "schedule") {
          const schedules = getField<ScheduleModeConfig['schedules']>('config.scheduleConfig.schedules', []);
          if (schedules.length === 0) {
            newErrors["config.scheduleConfig.schedules"] = "At least one schedule entry is required";
          } else {
            // Validate each schedule entry
            schedules.forEach((schedule, index) => {
              // Check for at least one day selected
              if (schedule.days.length === 0) {
                newErrors[`config.scheduleConfig.schedules.${index}.days`] = `Schedule ${index + 1}: At least one day must be selected`;
              }

              // Validate time format and order (allow overnight schedules)
              if (!schedule.startTime || !schedule.endTime) {
                newErrors[`config.scheduleConfig.schedules.${index}.time`] = `Schedule ${index + 1}: Start and end times are required`;
              }
            });
          }
        }
        break;
      }

      case "verified_action": {
        if (!getField<string>("config.controllerId")) {
          newErrors["config.controllerId"] = "Controller is required";
        }
        if (!getField<number>("config.port")) {
          newErrors["config.port"] = "Port is required";
        }
        if (!getField<string>("config.action")) {
          newErrors["config.action"] = "Action is required";
        }
        const verifyTimeout = getField<number>("config.verifyTimeout", 5);
        if (verifyTimeout < 1) {
          newErrors["config.verifyTimeout"] = "Timeout must be at least 1 second";
        }
        break;
      }

      case "port_condition": {
        if (!getField<string>("config.controllerId")) {
          newErrors["config.controllerId"] = "Controller is required";
        }
        if (!getField<number>("config.port")) {
          newErrors["config.port"] = "Port is required";
        }
        if (!getField<string>("config.condition")) {
          newErrors["config.condition"] = "Condition is required";
        }
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedNode, getField]);

  /**
   * Applies the current form values to the node.
   */
  const handleApply = React.useCallback(() => {
    if (!selectedNode || !validateForm()) return;

    onNodeUpdate?.(selectedNode.id, formData);
    setIsDirty(false);
  }, [selectedNode, formData, validateForm, onNodeUpdate]);

  /**
   * Cancels changes and resets to original node data.
   */
  const handleCancel = React.useCallback(() => {
    if (selectedNode) {
      setFormData(selectedNode.data as unknown as Record<string, unknown>);
      setErrors({});
      setIsDirty(false);
    }
  }, [selectedNode]);

  // Don't render if no node is selected
  if (!selectedNode) {
    return (
      <div
        className={cn(
          "flex h-full w-80 flex-col border-l border-border bg-background",
          className
        )}
      >
        <div className="flex flex-1 items-center justify-center p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Select a node to view its properties
          </p>
        </div>
      </div>
    );
  }

  const nodeConfig = NODE_TYPE_CONFIG[selectedNode.type as WorkflowNodeType];
  const Icon = nodeConfig?.icon || Play;

  return (
    <div
      className={cn(
        "flex h-full w-80 flex-col border-l border-border bg-background",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", nodeConfig?.colorClass)} />
          <span className="font-semibold text-foreground">
            {nodeConfig?.label} Properties
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Form Content */}
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {/* Common: Label Field */}
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={getField<string>("label", "")}
              onChange={(e) => updateField("label", e.target.value)}
              placeholder="Enter node label"
            />
            {errors["label"] && (
              <p className="text-xs text-destructive">{errors["label"]}</p>
            )}
          </div>

          {/* Type-specific fields */}
          {selectedNode.type === "trigger" && (
            <TriggerFields
              getField={getField}
              updateField={updateField}
              errors={errors}
            />
          )}

          {selectedNode.type === "sensor" && (
            <SensorFields
              getField={getField}
              updateField={updateField}
              errors={errors}
            />
          )}

          {selectedNode.type === "condition" && (
            <ConditionFields
              getField={getField}
              updateField={updateField}
              errors={errors}
            />
          )}

          {selectedNode.type === "action" && (
            <ActionFields
              getField={getField}
              updateField={updateField}
              errors={errors}
            />
          )}

          {selectedNode.type === "dimmer" && (
            <DimmerFields
              getField={getField}
              updateField={updateField}
              errors={errors}
            />
          )}

          {selectedNode.type === "notification" && (
            <NotificationFields
              getField={getField}
              updateField={updateField}
              errors={errors}
            />
          )}

          {selectedNode.type === "mode" && (
            <ModeFields
              getField={getField}
              updateField={updateField}
              errors={errors}
            />
          )}

          {selectedNode.type === "verified_action" && (
            <VerifiedActionFields
              getField={getField}
              updateField={updateField}
              errors={errors}
            />
          )}

          {selectedNode.type === "port_condition" && (
            <PortConditionFields
              getField={getField}
              updateField={updateField}
              errors={errors}
            />
          )}
        </div>
      </ScrollArea>

      {/* Footer with Apply/Cancel */}
      <div className="flex items-center justify-end gap-2 border-t border-border p-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={!isDirty}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={handleApply} disabled={!isDirty}>
          Apply
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Type-Specific Field Components
// ============================================================================

interface FieldsProps {
  getField: <T>(path: string, defaultValue?: T) => T;
  updateField: (path: string, value: unknown) => void;
  errors: Record<string, string>;
}

/**
 * Fields for Trigger node configuration.
 */
function TriggerFields({ getField, updateField, errors }: FieldsProps) {
  const triggerType = getField<string>("config.triggerType", "schedule");

  return (
    <>
      {/* Trigger Type */}
      <div className="space-y-2">
        <Label>Trigger Type</Label>
        <Select
          value={triggerType}
          onValueChange={(value) => updateField("config.triggerType", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="schedule">Schedule</SelectItem>
            <SelectItem value="sensor_threshold">Sensor Threshold</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Schedule-specific fields */}
      {triggerType === "schedule" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="simpleTime">Time</Label>
            <Input
              id="simpleTime"
              type="time"
              value={getField<string>("config.simpleTime", "")}
              onChange={(e) => updateField("config.simpleTime", e.target.value)}
            />
            {errors["config.simpleTime"] && (
              <p className="text-xs text-destructive">{errors["config.simpleTime"]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Days of Week</Label>
            <div className="flex flex-wrap gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => {
                const days = getField<number[]>("config.daysOfWeek", []);
                const isSelected = days.includes(index);

                return (
                  <Button
                    key={day}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-10"
                    onClick={() => {
                      const newDays = isSelected
                        ? days.filter((d) => d !== index)
                        : [...days, index].sort();
                      updateField("config.daysOfWeek", newDays);
                    }}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Sensor threshold fields */}
      {triggerType === "sensor_threshold" && (
        <>
          <div className="space-y-2">
            <Label>Controller</Label>
            <Select
              value={getField<string>("config.controllerId", "")}
              onValueChange={(value) => updateField("config.controllerId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select controller" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_CONTROLLERS.map((ctrl) => (
                  <SelectItem key={ctrl.id} value={ctrl.id}>
                    {ctrl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sensor Type</Label>
            <Select
              value={getField<string>("config.sensorType", "")}
              onValueChange={(value) => updateField("config.sensorType", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sensor" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SENSOR_TYPE_LABELS) as [SensorType, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            {errors["config.sensorType"] && (
              <p className="text-xs text-destructive">{errors["config.sensorType"]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select
                value={getField<string>("config.operator", ">")}
                onValueChange={(value) => updateField("config.operator", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(OPERATOR_LABELS) as [ComparisonOperator, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {value} ({label})
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="threshold">Threshold</Label>
              <Input
                id="threshold"
                type="number"
                value={getField<number | "">("config.threshold", "")}
                onChange={(e) =>
                  updateField(
                    "config.threshold",
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
              />
              {errors["config.threshold"] && (
                <p className="text-xs text-destructive">{errors["config.threshold"]}</p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Fields for Sensor node configuration.
 */
function SensorFields({ getField, updateField, errors }: FieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>Controller</Label>
        <Select
          value={getField<string>("config.controllerId", "")}
          onValueChange={(value) => {
            const ctrl = MOCK_CONTROLLERS.find((c) => c.id === value);
            updateField("config.controllerId", value);
            updateField("config.controllerName", ctrl?.name);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select controller" />
          </SelectTrigger>
          <SelectContent>
            {MOCK_CONTROLLERS.map((ctrl) => (
              <SelectItem key={ctrl.id} value={ctrl.id}>
                {ctrl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors["config.controllerId"] && (
          <p className="text-xs text-destructive">{errors["config.controllerId"]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Sensor Type</Label>
        <Select
          value={getField<string>("config.sensorType", "")}
          onValueChange={(value) => updateField("config.sensorType", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select sensor" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(SENSOR_TYPE_LABELS) as [SensorType, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        {errors["config.sensorType"] && (
          <p className="text-xs text-destructive">{errors["config.sensorType"]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Operator</Label>
          <Select
            value={getField<string>("config.operator", ">")}
            onValueChange={(value) => updateField("config.operator", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(OPERATOR_LABELS) as [ComparisonOperator, string][]).map(
                ([value, _label]) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="threshold">Threshold</Label>
          <Input
            id="threshold"
            type="number"
            value={getField<number | "">("config.threshold", "")}
            onChange={(e) =>
              updateField(
                "config.threshold",
                e.target.value ? Number(e.target.value) : undefined
              )
            }
          />
        </div>
      </div>
    </>
  );
}

/**
 * Fields for Condition node configuration.
 */
function ConditionFields({ getField, updateField, errors: _errors }: FieldsProps) {
  return (
    <div className="space-y-2">
      <Label>Logic Type</Label>
      <Select
        value={getField<string>("config.logicType", "AND")}
        onValueChange={(value) => updateField("config.logicType", value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AND">AND - All conditions must be true</SelectItem>
          <SelectItem value="OR">OR - Any condition can be true</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Fields for Action node configuration.
 */
function ActionFields({ getField, updateField, errors }: FieldsProps) {
  const action = getField<ActionVariant | undefined>("config.action");

  return (
    <>
      <div className="space-y-2">
        <Label>Controller</Label>
        <Select
          value={getField<string>("config.controllerId", "")}
          onValueChange={(value) => {
            const ctrl = MOCK_CONTROLLERS.find((c) => c.id === value);
            updateField("config.controllerId", value);
            updateField("config.controllerName", ctrl?.name);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select controller" />
          </SelectTrigger>
          <SelectContent>
            {MOCK_CONTROLLERS.map((ctrl) => (
              <SelectItem key={ctrl.id} value={ctrl.id}>
                {ctrl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors["config.controllerId"] && (
          <p className="text-xs text-destructive">{errors["config.controllerId"]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Device Type</Label>
          <Select
            value={getField<string>("config.deviceType", "")}
            onValueChange={(value) => updateField("config.deviceType", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(DEVICE_TYPE_LABELS) as [DeviceType, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            min={1}
            max={8}
            value={getField<number | "">("config.port", "")}
            onChange={(e) =>
              updateField(
                "config.port",
                e.target.value ? Number(e.target.value) : undefined
              )
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Action</Label>
        <Select
          value={getField<string>("config.action", "")}
          onValueChange={(value) => updateField("config.action", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select action" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(ACTION_VARIANT_LABELS) as [ActionVariant, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        {errors["config.action"] && (
          <p className="text-xs text-destructive">{errors["config.action"]}</p>
        )}
      </div>

      {/* Action-specific fields */}
      {action === "on_off" && (
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <Label htmlFor="turnOn">Turn Device On</Label>
          <Switch
            id="turnOn"
            checked={getField<boolean>("config.turnOn", true)}
            onCheckedChange={(checked) => updateField("config.turnOn", checked)}
          />
        </div>
      )}

      {(action === "set_speed" || action === "set_level") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>
              {action === "set_speed" ? "Speed" : "Level"}
            </Label>
            <span className="text-sm font-medium">
              {getField<number>("config.value", 50)}%
            </span>
          </div>
          <Slider
            value={[getField<number>("config.value", 50)]}
            onValueChange={([value]) => updateField("config.value", value)}
            min={0}
            max={100}
            step={5}
          />
        </div>
      )}

      {action === "set_temperature" && (
        <div className="space-y-2">
          <Label htmlFor="temperature">Temperature (F)</Label>
          <Input
            id="temperature"
            type="number"
            min={40}
            max={95}
            value={getField<number | "">("config.temperature", "")}
            onChange={(e) =>
              updateField(
                "config.temperature",
                e.target.value ? Number(e.target.value) : undefined
              )
            }
          />
        </div>
      )}
    </>
  );
}

/**
 * Fields for Dimmer node configuration.
 */
function DimmerFields({ getField, updateField, errors }: FieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>Controller</Label>
        <Select
          value={getField<string>("config.controllerId", "")}
          onValueChange={(value) => {
            const ctrl = MOCK_CONTROLLERS.find((c) => c.id === value);
            updateField("config.controllerId", value);
            updateField("config.controllerName", ctrl?.name);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select controller" />
          </SelectTrigger>
          <SelectContent>
            {MOCK_CONTROLLERS.map((ctrl) => (
              <SelectItem key={ctrl.id} value={ctrl.id}>
                {ctrl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors["config.controllerId"] && (
          <p className="text-xs text-destructive">{errors["config.controllerId"]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="port">Light Port</Label>
        <Input
          id="port"
          type="number"
          min={1}
          max={8}
          value={getField<number | "">("config.port", "")}
          onChange={(e) =>
            updateField(
              "config.port",
              e.target.value ? Number(e.target.value) : undefined
            )
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sunriseTime">Sunrise Time</Label>
          <Input
            id="sunriseTime"
            type="time"
            value={getField<string>("config.sunriseTime", "")}
            onChange={(e) => updateField("config.sunriseTime", e.target.value)}
          />
          {errors["config.sunriseTime"] && (
            <p className="text-xs text-destructive">{errors["config.sunriseTime"]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sunsetTime">Sunset Time</Label>
          <Input
            id="sunsetTime"
            type="time"
            value={getField<string>("config.sunsetTime", "")}
            onChange={(e) => updateField("config.sunsetTime", e.target.value)}
          />
          {errors["config.sunsetTime"] && (
            <p className="text-xs text-destructive">{errors["config.sunsetTime"]}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Min Level</Label>
          <span className="text-sm font-medium">
            {getField<number>("config.minLevel", 0)}%
          </span>
        </div>
        <Slider
          value={[getField<number>("config.minLevel", 0)]}
          onValueChange={([value]) => updateField("config.minLevel", value)}
          min={0}
          max={100}
          step={5}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Max Level</Label>
          <span className="text-sm font-medium">
            {getField<number>("config.maxLevel", 100)}%
          </span>
        </div>
        <Slider
          value={[getField<number>("config.maxLevel", 100)]}
          onValueChange={([value]) => updateField("config.maxLevel", value)}
          min={0}
          max={100}
          step={5}
        />
      </div>

      <div className="space-y-2">
        <Label>Transition Curve</Label>
        <Select
          value={getField<string>("config.curve", "linear")}
          onValueChange={(value) => updateField("config.curve", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(DIMMER_CURVE_LABELS) as [DimmerCurve, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

/**
 * Fields for Notification node configuration.
 */
function NotificationFields({ getField, updateField, errors }: FieldsProps) {
  const channels = getField<NotificationChannel[]>("config.channels", []);

  const toggleChannel = (channel: NotificationChannel) => {
    const newChannels = channels.includes(channel)
      ? channels.filter((c) => c !== channel)
      : [...channels, channel];
    updateField("config.channels", newChannels);
  };

  return (
    <>
      <div className="space-y-2">
        <Label>Priority</Label>
        <Select
          value={getField<string>("config.priority", "normal")}
          onValueChange={(value) => updateField("config.priority", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              Object.entries(NOTIFICATION_PRIORITY_LABELS) as [NotificationPriority, string][]
            ).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Channels</Label>
        <div className="space-y-2">
          {(
            Object.entries(NOTIFICATION_CHANNEL_LABELS) as [NotificationChannel, string][]
          ).map(([value, label]) => (
            <div key={value} className="flex items-center space-x-2">
              <Checkbox
                id={`channel-${value}`}
                checked={channels.includes(value)}
                onCheckedChange={() => toggleChannel(value)}
              />
              <Label
                htmlFor={`channel-${value}`}
                className="text-sm font-normal"
              >
                {label}
              </Label>
            </div>
          ))}
        </div>
        {errors["config.channels"] && (
          <p className="text-xs text-destructive">{errors["config.channels"]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={getField<string>("config.message", "")}
          onChange={(e) => updateField("config.message", e.target.value)}
          placeholder="Enter notification message..."
        />
        {errors["config.message"] && (
          <p className="text-xs text-destructive">{errors["config.message"]}</p>
        )}
      </div>

      {/* Variable Suggestions */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Available Variables (click to insert)
        </Label>
        <div className="flex flex-wrap gap-1">
          {MESSAGE_VARIABLES.map(({ variable, label }) => (
            <button
              key={variable}
              type="button"
              className="rounded bg-muted px-2 py-0.5 text-xs hover:bg-muted/80"
              onClick={() => {
                const current = getField<string>("config.message", "");
                updateField("config.message", current + variable);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Fields for Mode Programming node configuration.
 */
function ModeFields({ getField, updateField, errors }: FieldsProps) {
  const { controllers } = useControllers();
  const controllerId = getField<string>("config.controllerId", "");
  const { ports } = useControllerPorts({ controllerId, enabled: !!controllerId });
  const mode = getField<DeviceModeType | undefined>("config.mode");

  return (
    <>
      {/* Controller Selection */}
      <div className="space-y-2">
        <Label>Controller</Label>
        <Select
          value={controllerId}
          onValueChange={(value) => {
            const ctrl = controllers.find((c) => c.id === value);
            updateField("config.controllerId", value);
            updateField("config.controllerName", ctrl?.name);
            updateField("config.port", undefined); // Reset port when controller changes
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select controller" />
          </SelectTrigger>
          <SelectContent>
            {controllers.filter(c => c.brand === 'ac_infinity').map((ctrl) => (
              <SelectItem key={ctrl.id} value={ctrl.id}>
                {ctrl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors["config.controllerId"] && (
          <p className="text-xs text-destructive">{errors["config.controllerId"]}</p>
        )}
      </div>

      {/* Port Selection */}
      {controllerId && (
        <div className="space-y-2">
          <Label>Port</Label>
          <Select
            value={getField<number | undefined>("config.port")?.toString() || ""}
            onValueChange={(value) => {
              const portNum = parseInt(value);
              const port = ports.find(p => p.port_number === portNum);
              updateField("config.port", portNum);
              updateField("config.portName", port?.port_name);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select port" />
            </SelectTrigger>
            <SelectContent>
              {ports.map((port) => (
                <SelectItem key={port.port_number} value={port.port_number.toString()}>
                  Port {port.port_number}{port.port_name ? ` - ${port.port_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors["config.port"] && (
            <p className="text-xs text-destructive">{errors["config.port"]}</p>
          )}
        </div>
      )}

      {/* Mode Type Selection */}
      <div className="space-y-2">
        <Label>Mode Type</Label>
        <Select
          value={mode}
          onValueChange={(value) => updateField("config.mode", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(MODE_LABELS) as [DeviceModeType, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        {errors["config.mode"] && (
          <p className="text-xs text-destructive">{errors["config.mode"]}</p>
        )}
      </div>

      {/* AUTO Mode Configuration */}
      {mode === "auto" && (
        <>
          <div className="space-y-3 rounded-lg border border-border p-3">
            <Label className="text-sm font-semibold">Temperature Triggers</Label>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="tempHighEnabled"
                checked={getField<boolean>("config.autoConfig.tempHighEnabled", false)}
                onCheckedChange={(checked) => updateField("config.autoConfig.tempHighEnabled", checked)}
              />
              <Label htmlFor="tempHighEnabled" className="text-sm font-normal">
                High Temp
              </Label>
              <Input
                type="number"
                className="ml-auto w-20"
                value={getField<number | "">("config.autoConfig.tempHighTrigger", "")}
                onChange={(e) => updateField("config.autoConfig.tempHighTrigger", e.target.value ? Number(e.target.value) : undefined)}
                disabled={!getField<boolean>("config.autoConfig.tempHighEnabled")}
              />
              <span className="text-sm text-muted-foreground">°F</span>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="tempLowEnabled"
                checked={getField<boolean>("config.autoConfig.tempLowEnabled", false)}
                onCheckedChange={(checked) => updateField("config.autoConfig.tempLowEnabled", checked)}
              />
              <Label htmlFor="tempLowEnabled" className="text-sm font-normal">
                Low Temp
              </Label>
              <Input
                type="number"
                className="ml-auto w-20"
                value={getField<number | "">("config.autoConfig.tempLowTrigger", "")}
                onChange={(e) => updateField("config.autoConfig.tempLowTrigger", e.target.value ? Number(e.target.value) : undefined)}
                disabled={!getField<boolean>("config.autoConfig.tempLowEnabled")}
              />
              <span className="text-sm text-muted-foreground">°F</span>
            </div>
            {errors["config.autoConfig.tempTriggers"] && (
              <p className="text-xs text-destructive">{errors["config.autoConfig.tempTriggers"]}</p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <Label className="text-sm font-semibold">Humidity Triggers</Label>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="humidityHighEnabled"
                checked={getField<boolean>("config.autoConfig.humidityHighEnabled", false)}
                onCheckedChange={(checked) => updateField("config.autoConfig.humidityHighEnabled", checked)}
              />
              <Label htmlFor="humidityHighEnabled" className="text-sm font-normal">
                High Humidity
              </Label>
              <Input
                type="number"
                className="ml-auto w-20"
                value={getField<number | "">("config.autoConfig.humidityHighTrigger", "")}
                onChange={(e) => updateField("config.autoConfig.humidityHighTrigger", e.target.value ? Number(e.target.value) : undefined)}
                disabled={!getField<boolean>("config.autoConfig.humidityHighEnabled")}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="humidityLowEnabled"
                checked={getField<boolean>("config.autoConfig.humidityLowEnabled", false)}
                onCheckedChange={(checked) => updateField("config.autoConfig.humidityLowEnabled", checked)}
              />
              <Label htmlFor="humidityLowEnabled" className="text-sm font-normal">
                Low Humidity
              </Label>
              <Input
                type="number"
                className="ml-auto w-20"
                value={getField<number | "">("config.autoConfig.humidityLowTrigger", "")}
                onChange={(e) => updateField("config.autoConfig.humidityLowTrigger", e.target.value ? Number(e.target.value) : undefined)}
                disabled={!getField<boolean>("config.autoConfig.humidityLowEnabled")}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            {errors["config.autoConfig.humidityTriggers"] && (
              <p className="text-xs text-destructive">{errors["config.autoConfig.humidityTriggers"]}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Level Range (0-10)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Min Level</Label>
                <Slider
                  value={[getField<number>("config.autoConfig.levelLow", 0)]}
                  onValueChange={([value]) => updateField("config.autoConfig.levelLow", value)}
                  min={0}
                  max={10}
                  step={1}
                />
                <span className="text-xs">{getField<number>("config.autoConfig.levelLow", 0)}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Max Level</Label>
                <Slider
                  value={[getField<number>("config.autoConfig.levelHigh", 10)]}
                  onValueChange={([value]) => updateField("config.autoConfig.levelHigh", value)}
                  min={0}
                  max={10}
                  step={1}
                />
                <span className="text-xs">{getField<number>("config.autoConfig.levelHigh", 10)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="autoTransition">Smooth Transition</Label>
            <Switch
              id="autoTransition"
              checked={getField<boolean>("config.autoConfig.transition", false)}
              onCheckedChange={(checked) => updateField("config.autoConfig.transition", checked)}
            />
          </div>
        </>
      )}

      {/* VPD Mode Configuration */}
      {mode === "vpd" && (
        <>
          <div className="space-y-3 rounded-lg border border-border p-3">
            <Label className="text-sm font-semibold">VPD Triggers</Label>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="vpdHighEnabled"
                checked={getField<boolean>("config.vpdConfig.vpdHighEnabled", false)}
                onCheckedChange={(checked) => updateField("config.vpdConfig.vpdHighEnabled", checked)}
              />
              <Label htmlFor="vpdHighEnabled" className="text-sm font-normal">
                High VPD
              </Label>
              <Input
                type="number"
                step="0.01"
                className="ml-auto w-20"
                value={getField<number | "">("config.vpdConfig.vpdHighTrigger", "")}
                onChange={(e) => updateField("config.vpdConfig.vpdHighTrigger", e.target.value ? Number(e.target.value) : undefined)}
                disabled={!getField<boolean>("config.vpdConfig.vpdHighEnabled")}
              />
              <span className="text-sm text-muted-foreground">kPa</span>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="vpdLowEnabled"
                checked={getField<boolean>("config.vpdConfig.vpdLowEnabled", false)}
                onCheckedChange={(checked) => updateField("config.vpdConfig.vpdLowEnabled", checked)}
              />
              <Label htmlFor="vpdLowEnabled" className="text-sm font-normal">
                Low VPD
              </Label>
              <Input
                type="number"
                step="0.01"
                className="ml-auto w-20"
                value={getField<number | "">("config.vpdConfig.vpdLowTrigger", "")}
                onChange={(e) => updateField("config.vpdConfig.vpdLowTrigger", e.target.value ? Number(e.target.value) : undefined)}
                disabled={!getField<boolean>("config.vpdConfig.vpdLowEnabled")}
              />
              <span className="text-sm text-muted-foreground">kPa</span>
            </div>
            {errors["config.vpdConfig.vpdTriggers"] && (
              <p className="text-xs text-destructive">{errors["config.vpdConfig.vpdTriggers"]}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Level Range (0-10)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Min Level</Label>
                <Slider
                  value={[getField<number>("config.vpdConfig.levelLow", 0)]}
                  onValueChange={([value]) => updateField("config.vpdConfig.levelLow", value)}
                  min={0}
                  max={10}
                  step={1}
                />
                <span className="text-xs">{getField<number>("config.vpdConfig.levelLow", 0)}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Max Level</Label>
                <Slider
                  value={[getField<number>("config.vpdConfig.levelHigh", 10)]}
                  onValueChange={([value]) => updateField("config.vpdConfig.levelHigh", value)}
                  min={0}
                  max={10}
                  step={1}
                />
                <span className="text-xs">{getField<number>("config.vpdConfig.levelHigh", 10)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="vpdTransition">Smooth Transition</Label>
            <Switch
              id="vpdTransition"
              checked={getField<boolean>("config.vpdConfig.transition", false)}
              onCheckedChange={(checked) => updateField("config.vpdConfig.transition", checked)}
            />
          </div>
        </>
      )}

      {/* TIMER Mode Configuration */}
      {mode === "timer" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="timerDurationOn">Duration On (seconds)</Label>
            <Input
              id="timerDurationOn"
              type="number"
              value={getField<number | "">("config.timerConfig.durationOn", "")}
              onChange={(e) => updateField("config.timerConfig.durationOn", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timerDurationOff">Duration Off (seconds)</Label>
            <Input
              id="timerDurationOff"
              type="number"
              value={getField<number | "">("config.timerConfig.durationOff", "")}
              onChange={(e) => updateField("config.timerConfig.durationOff", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Level (0-10)</Label>
              <span className="text-sm font-medium">
                {getField<number>("config.timerConfig.level", 5)}
              </span>
            </div>
            <Slider
              value={[getField<number>("config.timerConfig.level", 5)]}
              onValueChange={([value]) => updateField("config.timerConfig.level", value)}
              min={0}
              max={10}
              step={1}
            />
          </div>
        </>
      )}

      {/* CYCLE Mode Configuration */}
      {mode === "cycle" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="cycleDurationOn">Duration On (seconds)</Label>
            <Input
              id="cycleDurationOn"
              type="number"
              value={getField<number | "">("config.cycleConfig.durationOn", "")}
              onChange={(e) => updateField("config.cycleConfig.durationOn", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cycleDurationOff">Duration Off (seconds)</Label>
            <Input
              id="cycleDurationOff"
              type="number"
              value={getField<number | "">("config.cycleConfig.durationOff", "")}
              onChange={(e) => updateField("config.cycleConfig.durationOff", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Level (0-10)</Label>
              <span className="text-sm font-medium">
                {getField<number>("config.cycleConfig.level", 5)}
              </span>
            </div>
            <Slider
              value={[getField<number>("config.cycleConfig.level", 5)]}
              onValueChange={([value]) => updateField("config.cycleConfig.level", value)}
              min={0}
              max={10}
              step={1}
            />
          </div>
        </>
      )}

      {/* SCHEDULE Mode Configuration */}
      {mode === "schedule" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Schedule Entries</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const currentSchedules = getField<ScheduleModeConfig['schedules']>('config.scheduleConfig.schedules', []);
                if (currentSchedules.length < 4) {
                  updateField('config.scheduleConfig.schedules', [
                    ...currentSchedules,
                    { startTime: '06:00', endTime: '18:00', level: 5, days: [1,2,3,4,5] }
                  ]);
                }
              }}
              disabled={(getField<ScheduleModeConfig['schedules']>('config.scheduleConfig.schedules', [])?.length ?? 0) >= 4}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Schedule
            </Button>
          </div>

          {(getField<ScheduleModeConfig['schedules']>('config.scheduleConfig.schedules', []) || []).map((schedule, index) => (
            <div key={index} className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Schedule {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const schedules = [...getField<ScheduleModeConfig['schedules']>('config.scheduleConfig.schedules', [])];
                    schedules.splice(index, 1);
                    updateField('config.scheduleConfig.schedules', schedules);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Start Time</Label>
                  <Input
                    type="time"
                    value={schedule.startTime}
                    onChange={(e) => {
                      const schedules = [...getField<ScheduleModeConfig['schedules']>('config.scheduleConfig.schedules', [])];
                      schedules[index] = { ...schedules[index], startTime: e.target.value };
                      updateField('config.scheduleConfig.schedules', schedules);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">End Time</Label>
                  <Input
                    type="time"
                    value={schedule.endTime}
                    onChange={(e) => {
                      const schedules = [...getField<ScheduleModeConfig['schedules']>('config.scheduleConfig.schedules', [])];
                      schedules[index] = { ...schedules[index], endTime: e.target.value };
                      updateField('config.scheduleConfig.schedules', schedules);
                    }}
                  />
                </div>
              </div>

              {/* Level slider */}
              <div>
                <Label className="text-xs">Level: {schedule.level}</Label>
                <Slider
                  value={[schedule.level]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={([value]) => {
                    const schedules = [...getField<ScheduleModeConfig['schedules']>('config.scheduleConfig.schedules', [])];
                    schedules[index] = { ...schedules[index], level: value };
                    updateField('config.scheduleConfig.schedules', schedules);
                  }}
                />
              </div>

              {/* Days of week */}
              <div>
                <Label className="text-xs">Days</Label>
                <div className="flex gap-1 mt-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, dayIndex) => (
                    <button
                      key={dayIndex}
                      type="button"
                      className={`w-8 h-8 rounded text-xs font-medium ${
                        schedule.days.includes(dayIndex)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      onClick={() => {
                        const schedules = [...getField<ScheduleModeConfig['schedules']>('config.scheduleConfig.schedules', [])];
                        const currentDays = schedules[index].days;
                        const newDays = currentDays.includes(dayIndex)
                          ? currentDays.filter(d => d !== dayIndex)
                          : [...currentDays, dayIndex].sort();
                        schedules[index] = { ...schedules[index], days: newDays };
                        updateField('config.scheduleConfig.schedules', schedules);
                      }}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {(getField<ScheduleModeConfig['schedules']>('config.scheduleConfig.schedules', [])?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No schedules configured. Click &quot;Add Schedule&quot; to create one.
            </p>
          )}
        </div>
      )}

      {/* Priority Field */}
      <div className="space-y-2">
        <Label htmlFor="priority">Execution Priority</Label>
        <Input
          id="priority"
          type="number"
          min={0}
          value={getField<number | "">("config.priority", 0)}
          onChange={(e) => updateField("config.priority", e.target.value ? Number(e.target.value) : 0)}
        />
        <p className="text-xs text-muted-foreground">
          Lower numbers execute first
        </p>
      </div>
    </>
  );
}

/**
 * Fields for Verified Action node configuration.
 */
function VerifiedActionFields({ getField, updateField, errors }: FieldsProps) {
  const { controllers } = useControllers();
  const controllerId = getField<string>("config.controllerId", "");
  const { ports } = useControllerPorts({ controllerId, enabled: !!controllerId });
  const action = getField<string>("config.action");

  return (
    <>
      {/* Controller Selection */}
      <div className="space-y-2">
        <Label>Controller</Label>
        <Select
          value={controllerId}
          onValueChange={(value) => {
            const ctrl = controllers.find((c) => c.id === value);
            updateField("config.controllerId", value);
            updateField("config.controllerName", ctrl?.name);
            updateField("config.port", undefined);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select controller" />
          </SelectTrigger>
          <SelectContent>
            {controllers.filter(c => c.brand === 'ac_infinity').map((ctrl) => (
              <SelectItem key={ctrl.id} value={ctrl.id}>
                {ctrl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors["config.controllerId"] && (
          <p className="text-xs text-destructive">{errors["config.controllerId"]}</p>
        )}
      </div>

      {/* Port Selection */}
      {controllerId && (
        <div className="space-y-2">
          <Label>Port</Label>
          <Select
            value={getField<number | undefined>("config.port")?.toString() || ""}
            onValueChange={(value) => {
              const portNum = parseInt(value);
              const port = ports.find(p => p.port_number === portNum);
              updateField("config.port", portNum);
              updateField("config.portName", port?.port_name);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select port" />
            </SelectTrigger>
            <SelectContent>
              {ports.map((port) => (
                <SelectItem key={port.port_number} value={port.port_number.toString()}>
                  Port {port.port_number}{port.port_name ? ` - ${port.port_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors["config.port"] && (
            <p className="text-xs text-destructive">{errors["config.port"]}</p>
          )}
        </div>
      )}

      {/* Action Type */}
      <div className="space-y-2">
        <Label>Action</Label>
        <Select
          value={action}
          onValueChange={(value) => updateField("config.action", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on">Turn On</SelectItem>
            <SelectItem value="off">Turn Off</SelectItem>
            <SelectItem value="set_level">Set Level</SelectItem>
          </SelectContent>
        </Select>
        {errors["config.action"] && (
          <p className="text-xs text-destructive">{errors["config.action"]}</p>
        )}
      </div>

      {/* Level slider (only for set_level) */}
      {action === "set_level" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Level (0-10)</Label>
            <span className="text-sm font-medium">
              {getField<number>("config.level", 5)}
            </span>
          </div>
          <Slider
            value={[getField<number>("config.level", 5)]}
            onValueChange={([value]) => updateField("config.level", value)}
            min={0}
            max={10}
            step={1}
          />
        </div>
      )}

      {/* Verify Timeout */}
      <div className="space-y-2">
        <Label htmlFor="verifyTimeout">Verify Timeout (seconds)</Label>
        <Input
          id="verifyTimeout"
          type="number"
          min={1}
          value={getField<number>("config.verifyTimeout", 5)}
          onChange={(e) => updateField("config.verifyTimeout", e.target.value ? Number(e.target.value) : 5)}
        />
        {errors["config.verifyTimeout"] && (
          <p className="text-xs text-destructive">{errors["config.verifyTimeout"]}</p>
        )}
      </div>

      {/* Retry Count */}
      <div className="space-y-2">
        <Label htmlFor="retryCount">Retry Count</Label>
        <Input
          id="retryCount"
          type="number"
          min={0}
          max={5}
          value={getField<number>("config.retryCount", 3)}
          onChange={(e) => updateField("config.retryCount", e.target.value ? Number(e.target.value) : 3)}
        />
      </div>

      {/* Rollback on Failure */}
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Label htmlFor="rollbackOnFailure">Rollback on Failure</Label>
        <Switch
          id="rollbackOnFailure"
          checked={getField<boolean>("config.rollbackOnFailure", true)}
          onCheckedChange={(checked) => updateField("config.rollbackOnFailure", checked)}
        />
      </div>
    </>
  );
}

/**
 * Fields for Port Condition node configuration.
 */
function PortConditionFields({ getField, updateField, errors }: FieldsProps) {
  const { controllers } = useControllers();
  const controllerId = getField<string>("config.controllerId", "");
  const { ports } = useControllerPorts({ controllerId, enabled: !!controllerId });
  const condition = getField<string>("config.condition");

  return (
    <>
      {/* Controller Selection */}
      <div className="space-y-2">
        <Label>Controller</Label>
        <Select
          value={controllerId}
          onValueChange={(value) => {
            const ctrl = controllers.find((c) => c.id === value);
            updateField("config.controllerId", value);
            updateField("config.controllerName", ctrl?.name);
            updateField("config.port", undefined);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select controller" />
          </SelectTrigger>
          <SelectContent>
            {controllers.filter(c => c.brand === 'ac_infinity').map((ctrl) => (
              <SelectItem key={ctrl.id} value={ctrl.id}>
                {ctrl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors["config.controllerId"] && (
          <p className="text-xs text-destructive">{errors["config.controllerId"]}</p>
        )}
      </div>

      {/* Port Selection */}
      {controllerId && (
        <div className="space-y-2">
          <Label>Port</Label>
          <Select
            value={getField<number | undefined>("config.port")?.toString() || ""}
            onValueChange={(value) => {
              const portNum = parseInt(value);
              const port = ports.find(p => p.port_number === portNum);
              updateField("config.port", portNum);
              updateField("config.portName", port?.port_name);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select port" />
            </SelectTrigger>
            <SelectContent>
              {ports.map((port) => (
                <SelectItem key={port.port_number} value={port.port_number.toString()}>
                  Port {port.port_number}{port.port_name ? ` - ${port.port_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors["config.port"] && (
            <p className="text-xs text-destructive">{errors["config.port"]}</p>
          )}
        </div>
      )}

      {/* Condition Type */}
      <div className="space-y-2">
        <Label>Condition</Label>
        <Select
          value={condition}
          onValueChange={(value) => updateField("config.condition", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="is_on">Is On</SelectItem>
            <SelectItem value="is_off">Is Off</SelectItem>
            <SelectItem value="level_equals">Level Equals</SelectItem>
            <SelectItem value="level_above">Level Above</SelectItem>
            <SelectItem value="level_below">Level Below</SelectItem>
            <SelectItem value="mode_equals">Mode Equals</SelectItem>
          </SelectContent>
        </Select>
        {errors["config.condition"] && (
          <p className="text-xs text-destructive">{errors["config.condition"]}</p>
        )}
      </div>

      {/* Target Level (for level conditions) */}
      {(condition === "level_equals" || condition === "level_above" || condition === "level_below") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Target Level (0-10)</Label>
            <span className="text-sm font-medium">
              {getField<number>("config.targetLevel", 5)}
            </span>
          </div>
          <Slider
            value={[getField<number>("config.targetLevel", 5)]}
            onValueChange={([value]) => updateField("config.targetLevel", value)}
            min={0}
            max={10}
            step={1}
          />
        </div>
      )}

      {/* Target Mode (for mode_equals) */}
      {condition === "mode_equals" && (
        <div className="space-y-2">
          <Label>Target Mode</Label>
          <Select
            value={getField<string>("config.targetMode", "")}
            onValueChange={(value) => updateField("config.targetMode", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(MODE_LABELS) as [DeviceModeType, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}

PropertiesPanel.displayName = "PropertiesPanel";

export default PropertiesPanel;
