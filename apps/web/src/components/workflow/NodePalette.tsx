"use client";

import * as React from "react";
import {
  Play,
  Thermometer,
  GitBranch,
  Zap,
  Sun,
  Bell,
  Clock,
  Search,
  ChevronDown,
  GripVertical,
  Cog,
  CheckCircle2,
  Timer,
  Variable,
  Filter,
  ChevronRight,
  Plug,
  Fan,
  Lightbulb,
  Loader2,
  Droplets,
  Wind,
  Gauge,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { WorkflowNodeType } from "./types";
import { useControllerCapabilities, type DeviceCapability, type SensorCapability } from "@/hooks/use-controller-capabilities";

/**
 * NodePalette - Sidebar with draggable workflow node types
 *
 * This component provides a categorized list of node types that users can
 * drag and drop onto the workflow canvas. Features:
 * - Categories: Triggers, Sensors, Logic, Actions, Notifications
 * - Drag and drop onto canvas
 * - Node description on hover
 * - Search/filter nodes
 *
 * Visual Design:
 * - Collapsible categories
 * - Drag handle indicator
 * - Color-coded icons matching node colors
 */

/** Configuration for a draggable node type in the palette */
interface PaletteNodeConfig {
  /** Node type identifier (matches WorkflowNodeType) */
  type: WorkflowNodeType;
  /** Display label */
  label: string;
  /** Description shown on hover */
  description: string;
  /** Lucide icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind color classes for the icon background */
  iconBgClass: string;
  /** Tailwind color classes for the icon */
  iconClass: string;
  /** Default data for creating a new node */
  defaultData: Record<string, unknown>;
}

/** Configuration for a category of nodes */
interface PaletteCategoryConfig {
  /** Category identifier */
  id: string;
  /** Display label */
  label: string;
  /** Nodes in this category */
  nodes: PaletteNodeConfig[];
}

/** All node categories and their configurations */
const PALETTE_CATEGORIES: PaletteCategoryConfig[] = [
  {
    id: "triggers",
    label: "Triggers",
    nodes: [
      {
        type: "trigger",
        label: "Schedule",
        description: "Trigger workflow on a schedule (cron or simple time)",
        icon: Clock,
        iconBgClass: "bg-green-500",
        iconClass: "text-white",
        defaultData: {
          label: "Schedule Trigger",
          config: {
            triggerType: "schedule",
            simpleTime: "06:00",
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          },
        },
      },
      {
        type: "trigger",
        label: "Sensor Threshold",
        description: "Trigger when a sensor reading crosses a threshold",
        icon: Thermometer,
        iconBgClass: "bg-green-500",
        iconClass: "text-white",
        defaultData: {
          label: "Sensor Trigger",
          config: {
            triggerType: "sensor_threshold",
            sensorType: "temperature",
            operator: ">",
            threshold: 80,
          },
        },
      },
      {
        type: "trigger",
        label: "Manual",
        description: "Manually trigger the workflow",
        icon: Play,
        iconBgClass: "bg-green-500",
        iconClass: "text-white",
        defaultData: {
          label: "Manual Trigger",
          config: {
            triggerType: "manual",
          },
        },
      },
    ],
  },
  {
    id: "sensors",
    label: "Sensors",
    nodes: [
      {
        type: "sensor",
        label: "Sensor Reading",
        description: "Read a value from a connected sensor",
        icon: Thermometer,
        iconBgClass: "bg-blue-500",
        iconClass: "text-white",
        defaultData: {
          label: "Sensor",
          config: {
            sensorType: "temperature",
          },
        },
      },
    ],
  },
  {
    id: "logic",
    label: "Logic",
    nodes: [
      {
        type: "condition",
        label: "Condition (AND)",
        description: "All inputs must be true to continue",
        icon: GitBranch,
        iconBgClass: "bg-cyan-500",
        iconClass: "text-white",
        defaultData: {
          label: "AND",
          config: {
            logicType: "AND",
          },
        },
      },
      {
        type: "condition",
        label: "Condition (OR)",
        description: "Any input can be true to continue",
        icon: GitBranch,
        iconBgClass: "bg-cyan-500",
        iconClass: "text-white",
        defaultData: {
          label: "OR",
          config: {
            logicType: "OR",
          },
        },
      },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    nodes: [
      {
        type: "action",
        label: "Control Device",
        description: "Control a fan, light, or other connected device",
        icon: Zap,
        iconBgClass: "bg-orange-500",
        iconClass: "text-white",
        defaultData: {
          label: "Control Device",
          config: {
            action: "on_off",
            turnOn: true,
          },
        },
      },
      {
        type: "dimmer",
        label: "Light Dimmer",
        description: "Configure sunrise/sunset light dimming schedule",
        icon: Sun,
        iconBgClass: "bg-yellow-500",
        iconClass: "text-white",
        defaultData: {
          label: "Light Dimmer",
          config: {
            sunriseTime: "06:00",
            sunsetTime: "20:00",
            minLevel: 0,
            maxLevel: 100,
            curve: "sigmoid",
          },
        },
      },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    nodes: [
      {
        type: "notification",
        label: "Send Notification",
        description: "Send a push notification, email, or SMS",
        icon: Bell,
        iconBgClass: "bg-purple-500",
        iconClass: "text-white",
        defaultData: {
          label: "Notification",
          config: {
            message: "Alert: {{sensor.temperature}} in {{room.name}}",
            priority: "normal",
            channels: ["push"],
          },
        },
      },
    ],
  },
  {
    id: "device-programming",
    label: "Device Programming",
    nodes: [
      {
        type: "mode",
        label: "Program Mode",
        description: "Program AC Infinity device modes (AUTO, VPD, Timer, etc.)",
        icon: Cog,
        iconBgClass: "bg-cyan-500",
        iconClass: "text-white",
        defaultData: {
          label: "Program Mode",
          config: {
            controllerId: "",
            controllerName: "",
            port: 1,
            portName: "",
            mode: "auto",
            priority: 1,
          },
        },
      },
      {
        type: "verified_action",
        label: "Verified Action",
        description: "Execute device action with verification and rollback",
        icon: CheckCircle2,
        iconBgClass: "bg-teal-500",
        iconClass: "text-white",
        defaultData: {
          label: "Verified Action",
          config: {
            controllerId: "",
            controllerName: "",
            port: 1,
            portName: "",
            action: "set_level",
            level: 5,
            verifyTimeout: 30,
            retryCount: 3,
            rollbackOnFailure: true,
          },
        },
      },
      {
        type: "port_condition",
        label: "Port Condition",
        description: "Branch workflow based on port state or level",
        icon: GitBranch,
        iconBgClass: "bg-amber-500",
        iconClass: "text-white",
        defaultData: {
          label: "Port Condition",
          config: {
            controllerId: "",
            controllerName: "",
            port: 1,
            portName: "",
            condition: "is_on",
          },
        },
      },
    ],
  },
  {
    id: "flow-control",
    label: "Flow Control",
    nodes: [
      {
        type: "delay",
        label: "Delay",
        description: "Pause workflow execution for a specified duration",
        icon: Timer,
        iconBgClass: "bg-amber-500",
        iconClass: "text-white",
        defaultData: {
          label: "Delay",
          config: {
            duration: 30,
            unit: "seconds",
          },
        },
      },
      {
        type: "variable",
        label: "Set Variable",
        description: "Store a value for use later in the workflow",
        icon: Variable,
        iconBgClass: "bg-violet-500",
        iconClass: "text-white",
        defaultData: {
          label: "Set Variable",
          config: {
            name: "myVar",
            scope: "workflow",
            operation: "set",
            valueType: "number",
            value: 0,
          },
        },
      },
      {
        type: "variable",
        label: "Get Variable",
        description: "Retrieve a previously stored value",
        icon: Variable,
        iconBgClass: "bg-violet-500",
        iconClass: "text-white",
        defaultData: {
          label: "Get Variable",
          config: {
            name: "myVar",
            scope: "workflow",
            operation: "get",
            valueType: "number",
          },
        },
      },
      {
        type: "debounce",
        label: "Debounce",
        description: "Prevent rapid triggering with a cooldown period",
        icon: Filter,
        iconBgClass: "bg-slate-500",
        iconClass: "text-white",
        defaultData: {
          label: "Debounce",
          config: {
            cooldownSeconds: 60,
            executeOnLead: true,
            executeOnTrail: false,
          },
        },
      },
    ],
  },
];

// ============================================
// Device Tree Components
// ============================================

/** Get icon for device type */
function getDeviceIcon(type: string): React.ComponentType<{ className?: string }> {
  switch (type.toLowerCase()) {
    case 'fan':
      return Fan;
    case 'light':
      return Lightbulb;
    default:
      return Plug;
  }
}

interface DeviceTreeItemProps {
  device: DeviceCapability;
  controllerId: string;
  controllerName: string;
  onDragStart: (event: React.DragEvent, nodeType: string, nodeData: Record<string, unknown>) => void;
}

/**
 * Draggable device/port item in the device tree
 */
function DeviceTreeItem({ device, controllerId, controllerName, onDragStart }: DeviceTreeItemProps) {
  const Icon = getDeviceIcon(device.type);
  
  const defaultData = {
    label: `${device.name}`,
    config: {
      controllerId,
      controllerName,
      port: device.port,
      portName: device.name,
      deviceType: device.type,
      action: "on_off",
      turnOn: true,
    },
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "group flex cursor-grab items-center gap-2 rounded-md border border-border bg-card p-1.5 ml-4",
              "transition-all hover:border-orange-500/50 hover:shadow-sm",
              "active:cursor-grabbing active:scale-[0.98]"
            )}
            draggable
            onDragStart={(event) => onDragStart(event, "action", defaultData)}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-orange-500/10">
              <Icon className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-foreground truncate block">
                {device.name}
              </span>
            </div>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded",
              device.isOn ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"
            )}>
              {device.isOn ? `${device.level}%` : "OFF"}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="text-sm">Drag to add control for <strong>{device.name}</strong></p>
          <p className="text-xs text-muted-foreground mt-1">
            Port {device.port} • {device.type}
            {device.supportsDimming && " • Dimming supported"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ControllerTreeProps {
  controllerId: string;
  controllerName: string;
  devices: DeviceCapability[];
  status: 'online' | 'offline' | 'error' | 'initializing';
  onDragStart: (event: React.DragEvent, nodeType: string, nodeData: Record<string, unknown>) => void;
}

/**
 * Controller with expandable list of devices/ports
 */
function ControllerTree({ controllerId, controllerName, devices, status, onDragStart }: ControllerTreeProps) {
  const [isOpen, setIsOpen] = React.useState(true);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-1.5 text-sm hover:text-primary">
        <ChevronRight className={cn(
          "h-4 w-4 text-muted-foreground transition-transform",
          isOpen && "rotate-90"
        )} />
        <span className="flex-1 text-left font-medium truncate">{controllerName}</span>
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded",
          status === 'online' ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
        )}>
          {devices.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 py-1">
        {devices.map((device) => (
          <DeviceTreeItem
            key={`${controllerId}-${device.port}`}
            device={device}
            controllerId={controllerId}
            controllerName={controllerName}
            onDragStart={onDragStart}
          />
        ))}
        {devices.length === 0 && (
          <p className="text-xs text-muted-foreground ml-6 py-1">No devices found</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface DeviceTreeSectionProps {
  onDragStart: (event: React.DragEvent, nodeType: string, nodeData: Record<string, unknown>) => void;
  capabilities: ReturnType<typeof useControllerCapabilities>["capabilities"];
  loading: boolean;
  error: string | null;
}

/**
 * Device Tree section showing all controllers and their ports
 */
function DeviceTreeSection({ onDragStart, capabilities, loading, error }: DeviceTreeSectionProps) {
  const [isOpen, setIsOpen] = React.useState(true);
  
  // Convert capabilities to array for rendering
  const controllers = React.useMemo(() => {
    if (!capabilities) return [];
    if (capabilities instanceof Map) {
      return Array.from(capabilities.values());
    }
    return [capabilities];
  }, [capabilities]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold text-foreground hover:text-primary">
        <span>My Devices</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pb-4">
        {loading && (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading controllers...
          </div>
        )}
        {error && (
          <p className="text-xs text-destructive py-2">{error}</p>
        )}
        {!loading && controllers.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            No controllers connected. Add a controller to see your devices here.
          </p>
        )}
        {controllers.map((ctrl) => (
          <ControllerTree
            key={ctrl.controller_id}
            controllerId={ctrl.controller_id}
            controllerName={ctrl.controller_name}
            devices={ctrl.devices}
            status={ctrl.status}
            onDragStart={onDragStart}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// Sensor Tree Components
// ============================================

/** Get icon for sensor type */
function getSensorIcon(type: string): React.ComponentType<{ className?: string }> {
  switch (type.toLowerCase()) {
    case 'temperature':
      return Thermometer;
    case 'humidity':
      return Droplets;
    case 'vpd':
      return Gauge;
    case 'co2':
      return Wind;
    case 'soil_moisture':
      return Droplets;
    case 'light':
      return Sun;
    default:
      return Activity;
  }
}

/** Get color classes for sensor type */
function getSensorColorClasses(type: string): { bg: string; text: string } {
  switch (type.toLowerCase()) {
    case 'temperature':
      return { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' };
    case 'humidity':
      return { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' };
    case 'vpd':
      return { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' };
    case 'co2':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' };
    case 'soil_moisture':
      return { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400' };
    case 'light':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' };
    default:
      return { bg: 'bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400' };
  }
}

interface SensorTreeItemProps {
  sensor: SensorCapability;
  controllerId: string;
  controllerName: string;
  onDragStart: (event: React.DragEvent, nodeType: string, nodeData: Record<string, unknown>) => void;
}

/**
 * Draggable sensor item in the sensor tree
 */
function SensorTreeItem({ sensor, controllerId, controllerName, onDragStart }: SensorTreeItemProps) {
  const Icon = getSensorIcon(sensor.type);
  const colors = getSensorColorClasses(sensor.type);
  
  // Create data for a sensor trigger node when dragged
  const defaultData = {
    label: `${sensor.name} Trigger`,
    config: {
      triggerType: "sensor_threshold",
      controllerId,
      controllerName,
      sensorType: sensor.type,
      port: sensor.port,
      unit: sensor.unit,
      operator: ">",
      threshold: sensor.currentValue ?? 0,
    },
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "group flex cursor-grab items-center gap-2 rounded-md border border-border bg-card p-1.5 ml-4",
              "transition-all hover:border-cyan-500/50 hover:shadow-sm",
              "active:cursor-grabbing active:scale-[0.98]"
            )}
            draggable
            onDragStart={(event) => onDragStart(event, "trigger", defaultData)}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
            <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded", colors.bg)}>
              <Icon className={cn("h-3.5 w-3.5", colors.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-foreground truncate block">
                {sensor.name}
              </span>
            </div>
            {sensor.currentValue !== undefined && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                sensor.isStale ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
              )}>
                {sensor.currentValue.toFixed(1)}{sensor.unit}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="text-sm">Drag to add <strong>{sensor.name}</strong> as trigger</p>
          <p className="text-xs text-muted-foreground mt-1">
            {sensor.type} • {controllerName}
            {sensor.isStale && " • Data may be stale"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface SensorControllerTreeProps {
  controllerId: string;
  controllerName: string;
  sensors: SensorCapability[];
  status: 'online' | 'offline' | 'error' | 'initializing';
  onDragStart: (event: React.DragEvent, nodeType: string, nodeData: Record<string, unknown>) => void;
}

/**
 * Controller with expandable list of sensors
 */
function SensorControllerTree({ controllerId, controllerName, sensors, status, onDragStart }: SensorControllerTreeProps) {
  const [isOpen, setIsOpen] = React.useState(true);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-1.5 text-sm hover:text-primary">
        <ChevronRight className={cn(
          "h-4 w-4 text-muted-foreground transition-transform",
          isOpen && "rotate-90"
        )} />
        <span className="flex-1 text-left font-medium truncate">{controllerName}</span>
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded",
          status === 'online' ? "bg-cyan-500/10 text-cyan-600" : "bg-muted text-muted-foreground"
        )}>
          {sensors.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 py-1">
        {sensors.map((sensor, index) => (
          <SensorTreeItem
            key={`${controllerId}-${sensor.type}-${sensor.port ?? index}`}
            sensor={sensor}
            controllerId={controllerId}
            controllerName={controllerName}
            onDragStart={onDragStart}
          />
        ))}
        {sensors.length === 0 && (
          <p className="text-xs text-muted-foreground ml-6 py-1">No sensors found</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface SensorTreeSectionProps {
  onDragStart: (event: React.DragEvent, nodeType: string, nodeData: Record<string, unknown>) => void;
  capabilities: ReturnType<typeof useControllerCapabilities>["capabilities"];
  loading: boolean;
  error: string | null;
}

/**
 * Sensor Tree section showing all controllers and their sensors
 * Used as triggers in automation workflows
 */
function SensorTreeSection({ onDragStart, capabilities, loading, error }: SensorTreeSectionProps) {
  const [isOpen, setIsOpen] = React.useState(true);
  
  // Convert capabilities to array and filter to only those with sensors
  const controllersWithSensors = React.useMemo(() => {
    if (!capabilities) return [];
    const list = capabilities instanceof Map 
      ? Array.from(capabilities.values())
      : [capabilities];
    return list.filter(ctrl => ctrl.sensors && ctrl.sensors.length > 0);
  }, [capabilities]);

  // Count total sensors across all controllers
  const totalSensors = controllersWithSensors.reduce(
    (sum, ctrl) => sum + (ctrl.sensors?.length || 0), 0
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold text-foreground hover:text-primary">
        <span>My Sensors</span>
        <div className="flex items-center gap-2">
          {totalSensors > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600">
              {totalSensors}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pb-4">
        {loading && (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading sensors...
          </div>
        )}
        {error && (
          <p className="text-xs text-destructive py-2">{error}</p>
        )}
        {!loading && controllersWithSensors.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            No sensors available. Add a controller (AC Infinity, Ecowitt, MQTT) to see sensors here.
          </p>
        )}
        {controllersWithSensors.map((ctrl) => (
          <SensorControllerTree
            key={ctrl.controller_id}
            controllerId={ctrl.controller_id}
            controllerName={ctrl.controller_name}
            sensors={ctrl.sensors}
            status={ctrl.status}
            onDragStart={onDragStart}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// Main Palette Components
// ============================================

interface PaletteNodeItemProps {
  node: PaletteNodeConfig;
  onDragStart: (event: React.DragEvent, nodeType: string, nodeData: Record<string, unknown>) => void;
}

/**
 * Individual draggable node item in the palette.
 */
function PaletteNodeItem({ node, onDragStart }: PaletteNodeItemProps) {
  const Icon = node.icon;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "group flex cursor-grab items-center gap-3 rounded-lg border border-border bg-card p-2",
              "transition-all hover:border-primary/50 hover:shadow-sm",
              "active:cursor-grabbing active:scale-[0.98]"
            )}
            draggable
            onDragStart={(event) => onDragStart(event, node.type, node.defaultData)}
          >
            {/* Drag Handle */}
            <div className="flex items-center text-muted-foreground/50 group-hover:text-muted-foreground">
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Icon */}
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                node.iconBgClass
              )}
            >
              <Icon className={cn("h-4 w-4", node.iconClass)} />
            </div>

            {/* Label */}
            <span className="flex-1 text-sm font-medium text-foreground">
              {node.label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="text-sm">{node.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface PaletteCategoryProps {
  category: PaletteCategoryConfig;
  defaultOpen?: boolean;
  onDragStart: (event: React.DragEvent, nodeType: string, nodeData: Record<string, unknown>) => void;
}

/**
 * Collapsible category section in the palette.
 */
function PaletteCategory({ category, defaultOpen = true, onDragStart }: PaletteCategoryProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold text-foreground hover:text-primary">
        <span>{category.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pb-4">
        {category.nodes.map((node, index) => (
          <PaletteNodeItem
            key={`${node.type}-${index}`}
            node={node}
            onDragStart={onDragStart}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface NodePaletteProps {
  /** Callback when a node starts being dragged */
  onDragStart?: (
    event: React.DragEvent,
    nodeType: string,
    nodeData: Record<string, unknown>
  ) => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * NodePalette - Sidebar component with draggable node types
 *
 * @param onDragStart - Callback fired when user starts dragging a node
 * @param className - Additional CSS classes for the container
 */
export function NodePalette({ onDragStart, className }: NodePaletteProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const { capabilities, loading: capabilitiesLoading, error: capabilitiesError } = useControllerCapabilities();

  /**
   * Handles drag start event for nodes.
   * Sets the data transfer with node type and default data.
   */
  const handleDragStart = React.useCallback(
    (event: React.DragEvent, nodeType: string, nodeData: Record<string, unknown>) => {
      // Set the drag data for the canvas to receive
      event.dataTransfer.setData("application/reactflow", nodeType);
      event.dataTransfer.setData("application/json", JSON.stringify(nodeData));
      event.dataTransfer.effectAllowed = "move";

      // Call the parent callback if provided
      onDragStart?.(event, nodeType, nodeData);
    },
    [onDragStart]
  );

  /**
   * Filters categories and nodes based on search query.
   */
  const filteredCategories = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return PALETTE_CATEGORIES;
    }

    const query = searchQuery.toLowerCase();

    return PALETTE_CATEGORIES.map((category) => ({
      ...category,
      nodes: category.nodes.filter(
        (node) =>
          node.label.toLowerCase().includes(query) ||
          node.description.toLowerCase().includes(query)
      ),
    })).filter((category) => category.nodes.length > 0);
  }, [searchQuery]);

  return (
    <div
      className={cn(
        "flex h-full w-64 flex-col border-r border-border bg-background",
        className
      )}
    >
      {/* Header */}
      <div className="border-b border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Node Palette</h2>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Node Categories */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Sensor Tree - Live sensors from all controllers (triggers) */}
          {!searchQuery && (
            <SensorTreeSection onDragStart={handleDragStart} capabilities={capabilities} loading={capabilitiesLoading} error={capabilitiesError} />
          )}
          
          {/* Device Tree - Live controllers and controllable ports */}
          {!searchQuery && (
            <DeviceTreeSection onDragStart={handleDragStart} capabilities={capabilities} loading={capabilitiesLoading} error={capabilitiesError} />
          )}
          
          {/* Standard node categories */}
          {filteredCategories.length > 0 ? (
            filteredCategories.map((category) => (
              <PaletteCategory
                key={category.id}
                category={category}
                defaultOpen={!searchQuery}
                onDragStart={handleDragStart}
              />
            ))
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No nodes match your search
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Help Text */}
      <div className="border-t border-border p-3">
        <p className="text-xs text-muted-foreground">
          Drag and drop nodes onto the canvas to build your workflow
        </p>
      </div>
    </div>
  );
}

NodePalette.displayName = "NodePalette";

export default NodePalette;
