"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FlaskConical,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Bell,
  GitBranch,
  Thermometer,
  Sun,
  Variable,
  Timer,
  Filter,
  ArrowRight,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  WorkflowNode,
  WorkflowEdge,
  TriggerNodeData,
  ActionNodeData,
  DimmerNodeData,
  ConditionNodeData,
  NotificationNodeData,
  DelayNodeData,
  VariableNodeData,
  DebounceNodeData,
  SensorNodeData,
  ModeNodeData,
} from "./types";

interface DryRunPreviewProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isDisabled?: boolean;
}

interface ExecutionStep {
  nodeId: string;
  nodeType: string;
  label: string;
  status: "pending" | "running" | "success" | "skipped" | "warning";
  description: string;
  details?: Record<string, unknown>;
  children?: ExecutionStep[];
}

interface SimulationResult {
  steps: ExecutionStep[];
  totalNodes: number;
  actionsWouldExecute: number;
  warnings: string[];
  errors: string[];
}

/**
 * Get icon for node type
 */
function getNodeIcon(type: string) {
  switch (type) {
    case "trigger":
      return Play;
    case "sensor":
      return Thermometer;
    case "condition":
      return GitBranch;
    case "action":
      return Zap;
    case "dimmer":
      return Sun;
    case "notification":
      return Bell;
    case "delay":
      return Clock;
    case "variable":
      return Variable;
    case "debounce":
      return Filter;
    case "mode":
      return Zap;
    case "verified_action":
      return CheckCircle2;
    case "port_condition":
      return GitBranch;
    default:
      return Zap;
  }
}

/**
 * Get description for a node's simulated execution
 */
function getNodeDescription(node: WorkflowNode): string {
  const data = node.data;

  switch (node.type) {
    case "trigger": {
      const triggerData = data as TriggerNodeData;
      const config = triggerData.config;
      switch (config?.triggerType) {
        case "schedule": {
          const schedConfig = config as { cronExpression?: string; simpleTime?: string };
          return `Would trigger on schedule (cron: ${schedConfig.cronExpression || schedConfig.simpleTime || "not configured"})`;
        }
        case "sensor_threshold":
          return `Would trigger when sensor crosses threshold`;
        case "mqtt": {
          const mqttConfig = config as { topic?: string };
          return `Would trigger on MQTT message to topic: ${mqttConfig.topic || "not configured"}`;
        }
        case "manual":
        default:
          return "Manual trigger - would execute immediately";
      }
    }

    case "sensor": {
      const sensorData = data as SensorNodeData;
      const sensorConfig = sensorData.config as { controllerId?: string; sensorType?: string };
      return `Would read sensor: ${sensorConfig?.sensorType || sensorConfig?.controllerId || "not configured"}`;
    }

    case "condition": {
      const conditionData = data as ConditionNodeData;
      const logicType = conditionData.config?.logicType || "AND";
      return `Would evaluate ${logicType} condition and branch accordingly`;
    }

    case "action": {
      const actionData = data as ActionNodeData;
      const config = actionData.config;
      if (config?.controllerId && config?.port) {
        return `Would send command to ${config.controllerName || config.controllerId} port ${config.port}`;
      }
      return "Would execute action (not fully configured)";
    }

    case "dimmer": {
      const dimmerData = data as DimmerNodeData;
      const config = dimmerData.config;
      return `Would adjust dimmer from ${config?.minLevel || 0}% to ${config?.maxLevel || 100}% using ${config?.curve || "linear"} curve`;
    }

    case "notification": {
      const notificationData = data as NotificationNodeData;
      const config = notificationData.config;
      const channels = config?.channels?.join(", ") || "push";
      return `Would send ${config?.priority || "normal"} priority notification via ${channels}`;
    }

    case "delay": {
      const delayData = data as DelayNodeData;
      const config = delayData.config;
      return `Would wait ${config?.duration || 0} ${config?.unit || "seconds"} before continuing`;
    }

    case "variable": {
      const variableData = data as VariableNodeData;
      const config = variableData.config;
      const op = config?.operation || "set";
      const scope = config?.scope || "workflow";
      return `Would ${op} ${scope}-scoped variable "${config?.name || "unnamed"}"`;
    }

    case "debounce": {
      const debounceData = data as DebounceNodeData;
      const config = debounceData.config;
      return `Would debounce with ${config?.cooldownSeconds || 60}s cooldown`;
    }

    case "mode": {
      const modeData = data as ModeNodeData;
      const config = modeData.config;
      return `Would set ${config?.controllerName || "controller"} port ${config?.port || 1} to ${config?.mode || "auto"} mode`;
    }

    case "verified_action": {
      const config = data.config as Record<string, unknown>;
      return `Would send verified action to ${config?.controllerName || "controller"} port ${config?.port || 1} with ${config?.retryCount || 3} retries`;
    }

    case "port_condition": {
      const config = data.config as Record<string, unknown>;
      return `Would check if ${config?.controllerName || "controller"} port ${config?.port || 1} ${config?.condition || "is_on"}`;
    }

    default:
      return `Would execute ${node.type} node`;
  }
}

/**
 * Simulate workflow execution without actually running it
 */
function simulateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): SimulationResult {
  const result: SimulationResult = {
    steps: [],
    totalNodes: 0,
    actionsWouldExecute: 0,
    warnings: [],
    errors: [],
  };

  if (nodes.length === 0) {
    result.errors.push("No nodes in workflow");
    return result;
  }

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push(edge.target);
  }

  // Build node map
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Find trigger node
  const triggerNode = nodes.find((n) => n.type === "trigger");
  if (!triggerNode) {
    result.errors.push("No trigger node found - workflow needs a starting point");
    return result;
  }

  // Check for unreachable nodes
  const reachable = new Set<string>();
  const queue: string[] = [triggerNode.id];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (reachable.has(currentId)) continue;
    reachable.add(currentId);
    const nextIds = adjacency.get(currentId) || [];
    queue.push(...nextIds);
  }

  const unreachableNodes = nodes.filter((n) => !reachable.has(n.id));
  if (unreachableNodes.length > 0) {
    result.warnings.push(
      `${unreachableNodes.length} node(s) are not reachable from the trigger`
    );
  }

  // BFS simulation
  const visited = new Set<string>();
  const simulationQueue: string[] = [triggerNode.id];

  while (simulationQueue.length > 0) {
    const currentId = simulationQueue.shift()!;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = nodeMap.get(currentId);
    if (!node) continue;

    result.totalNodes++;

    // Determine status based on node configuration
    let status: ExecutionStep["status"] = "success";
    const config = node.data?.config as Record<string, unknown> | undefined;

    // Check if node is properly configured
    if (node.type === "action" || node.type === "verified_action") {
      if (!config?.controllerId || !config?.port) {
        status = "warning";
        result.warnings.push(`${node.data?.label || node.type} node is not fully configured`);
      } else {
        result.actionsWouldExecute++;
      }
    } else if (node.type === "notification") {
      result.actionsWouldExecute++;
    } else if (node.type === "mode") {
      if (!config?.controllerId) {
        status = "warning";
        result.warnings.push(`${node.data?.label || node.type} node is not fully configured`);
      } else {
        result.actionsWouldExecute++;
      }
    }

    const step: ExecutionStep = {
      nodeId: node.id,
      nodeType: node.type,
      label: (node.data?.label as string) || node.type,
      status,
      description: getNodeDescription(node),
      details: config,
    };

    result.steps.push(step);

    // Queue connected nodes
    const nextNodes = adjacency.get(currentId) || [];
    for (const nextId of nextNodes) {
      if (!visited.has(nextId)) {
        simulationQueue.push(nextId);
      }
    }
  }

  return result;
}

/**
 * Single execution step in the preview
 */
function ExecutionStepRow({
  step,
  index,
  isExpanded,
  onToggle,
}: {
  step: ExecutionStep;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = getNodeIcon(step.nodeType);
  const hasDetails = step.details && Object.keys(step.details).length > 0;

  return (
    <div className="border-l-2 border-muted pl-4 pb-4 last:pb-0">
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg p-3 transition-colors",
          step.status === "success" && "bg-green-500/10",
          step.status === "warning" && "bg-amber-500/10",
          step.status === "skipped" && "bg-muted/50",
          step.status === "pending" && "bg-muted/30"
        )}
      >
        {/* Step number and icon */}
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {index + 1}
          </span>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md",
              step.status === "success" && "bg-green-500/20 text-green-600",
              step.status === "warning" && "bg-amber-500/20 text-amber-600",
              step.status === "skipped" && "bg-muted text-muted-foreground",
              step.status === "pending" && "bg-blue-500/20 text-blue-600"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{step.label}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {step.nodeType}
            </Badge>
            {step.status === "warning" && (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{step.description}</p>

          {/* Expandable details */}
          {hasDetails && (
            <button
              onClick={onToggle}
              className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {isExpanded ? "Hide details" : "Show details"}
            </button>
          )}
          {hasDetails && isExpanded && (
            <pre className="mt-2 p-2 rounded bg-muted/50 text-[10px] overflow-auto max-h-32">
              {JSON.stringify(step.details, null, 2)}
            </pre>
          )}
        </div>

        {/* Arrow indicator */}
        <ArrowRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}

/**
 * DryRunPreview - Shows a preview of workflow execution without actually running it
 * 
 * Features:
 * - Step-by-step visualization of execution path
 * - Warnings for unconfigured nodes
 * - Count of actions that would execute
 * - Detection of unreachable nodes
 */
export function DryRunPreview({ nodes, edges, isDisabled }: DryRunPreviewProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [expandedSteps, setExpandedSteps] = React.useState<Set<number>>(new Set());
  const [simulation, setSimulation] = React.useState<SimulationResult | null>(null);

  const handleOpen = () => {
    // Run simulation when dialog opens
    const result = simulateWorkflow(nodes, edges);
    setSimulation(result);
    setExpandedSteps(new Set());
    setIsOpen(true);
  };

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpen}
          disabled={isDisabled || nodes.length === 0}
        >
          <FlaskConical className="mr-2 h-4 w-4" />
          Test Run
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-blue-500" />
            Dry Run Preview
          </DialogTitle>
          <DialogDescription>
            Preview how this workflow would execute without actually sending any commands.
          </DialogDescription>
        </DialogHeader>

        {simulation && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Summary stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{simulation.totalNodes}</span>
                <span className="text-muted-foreground">nodes would execute</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-orange-500" />
                <span className="font-medium">{simulation.actionsWouldExecute}</span>
                <span className="text-muted-foreground">actions would trigger</span>
              </div>
            </div>

            {/* Errors */}
            {simulation.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {simulation.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {simulation.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-600">
                  <ul className="list-disc list-inside space-y-1">
                    {simulation.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Execution steps */}
            {simulation.steps.length > 0 && (
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-0 py-2">
                  {simulation.steps.map((step, index) => (
                    <ExecutionStepRow
                      key={step.nodeId}
                      step={step}
                      index={index}
                      isExpanded={expandedSteps.has(index)}
                      onToggle={() => toggleStep(index)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* No steps (shouldn't happen normally) */}
            {simulation.steps.length === 0 && simulation.errors.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FlaskConical className="h-12 w-12 mb-3 opacity-50" />
                <p>No execution path found</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

DryRunPreview.displayName = "DryRunPreview";

export default DryRunPreview;
