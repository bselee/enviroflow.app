"use client";

import * as React from "react";
import { X, Play, Thermometer, GitBranch, Clock, MousePointer } from "lucide-react";
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
import type {
  WorkflowNode,
  TriggerNodeData,
  SensorNodeData,
  ConditionNodeData,
  TriggerType,
  SensorType,
  ComparisonOperator,
  LogicType,
} from "./types";

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
  controllers?: Array<{ id: string; name: string }>;
}

/** Sensor types available for selection */
const SENSOR_TYPES: Array<{ value: SensorType; label: string }> = [
  { value: "temperature", label: "Temperature" },
  { value: "humidity", label: "Humidity" },
  { value: "vpd", label: "VPD" },
  { value: "co2", label: "CO2" },
  { value: "light", label: "Light Intensity" },
  { value: "soil_moisture", label: "Soil Moisture" },
  { value: "ph", label: "pH" },
  { value: "ec", label: "EC" },
];

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
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
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
        </RadioGroup>
      </div>

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
 * SensorProperties - Configuration panel for sensor nodes
 */
function SensorProperties({
  node,
  onUpdate,
  controllers = [],
}: {
  node: WorkflowNode;
  onUpdate: NodePropertiesPanelProps["onUpdate"];
  controllers?: Array<{ id: string; name: string }>;
}) {
  const data = node.data as SensorNodeData;

  const updateConfig = (field: string, value: string | number | undefined) => {
    onUpdate(node.id, {
      config: { ...data.config, [field]: value },
    } as Partial<SensorNodeData>);
  };

  return (
    <div className="space-y-4">
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

      {/* Sensor Type Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Sensor Type</Label>
        <Select
          value={data.config.sensorType ?? ""}
          onValueChange={(v) => updateConfig("sensorType", v as SensorType)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select sensor type" />
          </SelectTrigger>
          <SelectContent>
            {SENSOR_TYPES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
      </div>
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
          <TriggerProperties node={node} onUpdate={onUpdate} />
        )}
        {nodeType === "sensor" && (
          <SensorProperties node={node} onUpdate={onUpdate} controllers={controllers} />
        )}
        {nodeType === "condition" && (
          <ConditionProperties node={node} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

NodePropertiesPanel.displayName = "NodePropertiesPanel";

export default NodePropertiesPanel;
