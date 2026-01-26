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
];

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
