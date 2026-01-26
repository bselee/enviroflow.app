"use client";

import * as React from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  Panel,
  useReactFlow,
  type OnConnect,
  type OnNodesDelete,
  type OnEdgesDelete,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Save,
  Maximize,
  Play,
  Thermometer,
  GitBranch,
  Zap,
  Sun,
  Bell,
} from "lucide-react";

import { TriggerNode } from "./nodes/TriggerNode";
import { SensorNode } from "./nodes/SensorNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { ActionNode } from "./nodes/ActionNode";
import { DimmerNode } from "./nodes/DimmerNode";
import { NotificationNode } from "./nodes/NotificationNode";
import { ModeNode } from "./nodes/ModeNode";
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowDefinition,
  WorkflowNodeType,
  TriggerNodeData,
  SensorNodeData,
  ConditionNodeData,
  ActionNodeData,
  DimmerNodeData,
  NotificationNodeData,
  ModeNodeData,
} from "./types";

/**
 * WorkflowBuilder - Main React Flow canvas component for building automation workflows
 *
 * Features:
 * - Drag and drop nodes from palette
 * - Connect nodes with edges
 * - Snap to grid
 * - Mini map for navigation
 * - Zoom controls
 * - Undo/Redo (future)
 * - Save workflow to API
 *
 * @param workflow - Existing workflow to edit, or undefined for new workflow
 * @param onSave - Callback when workflow is saved
 */

/** Custom node types registered with React Flow */
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  sensor: SensorNode,
  condition: ConditionNode,
  action: ActionNode,
  dimmer: DimmerNode,
  notification: NotificationNode,
  mode: ModeNode,
};

/** Node palette items for drag and drop */
interface NodePaletteItem {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

const NODE_PALETTE: NodePaletteItem[] = [
  {
    type: "trigger",
    label: "Trigger",
    icon: Play,
    description: "Start your workflow",
    color: "bg-green-500",
  },
  {
    type: "sensor",
    label: "Sensor",
    icon: Thermometer,
    description: "Read sensor data",
    color: "bg-blue-500",
  },
  {
    type: "condition",
    label: "Condition",
    icon: GitBranch,
    description: "Branch logic",
    color: "bg-amber-500",
  },
  {
    type: "action",
    label: "Action",
    icon: Zap,
    description: "Control a device",
    color: "bg-orange-500",
  },
  {
    type: "dimmer",
    label: "Dimmer",
    icon: Sun,
    description: "Sunrise/sunset schedule",
    color: "bg-yellow-500",
  },
  {
    type: "notification",
    label: "Notification",
    icon: Bell,
    description: "Send alerts",
    color: "bg-purple-500",
  },
];

/** Props for the WorkflowBuilder component */
interface WorkflowBuilderProps {
  /** Existing workflow to edit, or undefined for new workflow */
  workflow?: WorkflowDefinition;
  /** Callback when workflow is saved */
  onSave?: (workflow: Partial<WorkflowDefinition>) => Promise<void>;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Callback when selected node changes */
  onNodeSelect?: (nodeId: string | null) => void;
  /** ID of currently selected node */
  selectedNodeId?: string | null;
  /** Callback when nodes change (for syncing with parent state) */
  onNodesChange?: (nodes: WorkflowNode[]) => void;
  /** Callback when a node is updated externally (from properties panel) */
  nodeUpdateTrigger?: { nodeId: string; data: Partial<WorkflowNode["data"]> } | null;
}

/** Union type for all node data types */
type AllNodeData = TriggerNodeData | SensorNodeData | ConditionNodeData | ActionNodeData | DimmerNodeData | NotificationNodeData | ModeNodeData;

/**
 * Creates default node data based on node type
 */
function createDefaultNodeData(type: string, label: string): AllNodeData {
  switch (type) {
    case "trigger":
      return {
        label,
        config: { triggerType: "manual" },
      } as TriggerNodeData;
    case "sensor":
      return {
        label,
        config: {},
      } as SensorNodeData;
    case "condition":
      return {
        label,
        config: { logicType: "AND" },
      } as ConditionNodeData;
    case "action":
      return {
        label,
        config: {},
      } as ActionNodeData;
    case "dimmer":
      return {
        label,
        config: {
          minLevel: 0,
          maxLevel: 100,
          curve: "sigmoid",
        },
      } as DimmerNodeData;
    case "notification":
      return {
        label,
        config: {
          priority: "normal",
          channels: ["push"],
        },
      } as NotificationNodeData;
    case "mode":
      return {
        label,
        config: {
          controllerId: "",
          controllerName: "",
          port: 1,
          portName: "",
          mode: "auto",
          priority: 1,
        },
      } as ModeNodeData;
    case "verified_action":
      return {
        label,
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
      } as any; // Will be properly typed when VerifiedActionNodeData is defined
    case "port_condition":
      return {
        label,
        config: {
          controllerId: "",
          controllerName: "",
          port: 1,
          portName: "",
          condition: "is_on",
        },
      } as any; // Will be properly typed when PortConditionNodeData is defined
    default:
      return {
        label,
        config: {},
      } as SensorNodeData;
  }
}

/**
 * Node Palette Component - Displays draggable node options
 */
function NodePalette({ onDragStart }: { onDragStart: (event: React.DragEvent, nodeType: string) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-md">
      <span className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Add Node
      </span>
      {NODE_PALETTE.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            className={cn(
              "flex cursor-grab items-center gap-3 rounded-md border border-transparent p-2",
              "bg-muted/50 transition-all hover:border-border hover:bg-muted",
              "active:cursor-grabbing"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-white",
                item.color
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {item.label}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {item.description}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WorkflowBuilder({
  workflow,
  onSave,
  isSaving = false,
  onNodeSelect,
  selectedNodeId,
  onNodesChange: onNodesChangeCallback,
  nodeUpdateTrigger,
}: WorkflowBuilderProps) {
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
  const [workflowName, setWorkflowName] = React.useState(workflow?.name ?? "Untitled Workflow");
  const [isDirty, setIsDirty] = React.useState(false);

  // Initialize nodes and edges from workflow or empty
  const initialNodes: WorkflowNode[] = workflow?.nodes ?? [];
  const initialEdges: WorkflowEdge[] = workflow?.edges ?? [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as unknown as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as unknown as Edge[]);

  const { screenToFlowPosition, fitView } = useReactFlow();

  // Notify parent when nodes change
  React.useEffect(() => {
    onNodesChangeCallback?.(nodes as unknown as WorkflowNode[]);
  }, [nodes, onNodesChangeCallback]);

  // Handle external node updates from properties panel
  React.useEffect(() => {
    if (nodeUpdateTrigger) {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeUpdateTrigger.nodeId
            ? { ...node, data: { ...node.data, ...nodeUpdateTrigger.data } }
            : node
        )
      );
    }
  }, [nodeUpdateTrigger, setNodes]);

  // Track dirty state when nodes/edges change
  React.useEffect(() => {
    if (workflow) {
      const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(workflow.nodes);
      const edgesChanged = JSON.stringify(edges) !== JSON.stringify(workflow.edges);
      const nameChanged = workflowName !== workflow.name;
      setIsDirty(nodesChanged || edgesChanged || nameChanged);
    } else {
      setIsDirty(nodes.length > 0 || edges.length > 0);
    }
  }, [nodes, edges, workflowName, workflow]);

  /**
   * Handles node selection changes
   */
  const onSelectionChange = React.useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[]; edges: Edge[] }) => {
      const selectedId = selectedNodes.length === 1 ? selectedNodes[0].id : null;
      onNodeSelect?.(selectedId);
    },
    [onNodeSelect]
  );

  /**
   * Handles edge connections between nodes
   */
  const onConnect: OnConnect = React.useCallback(
    (params: Connection) => {
      // Custom edge styling based on connection type
      const newEdge: Edge = {
        ...params,
        id: `e${params.source}-${params.target}`,
        type: "smoothstep",
        animated: true,
        style: { strokeWidth: 2, stroke: "hsl(var(--muted-foreground))" },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  /**
   * Handles node deletion from React Flow's built-in delete functionality
   */
  const onNodesDelete: OnNodesDelete = React.useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  /**
   * Handles node deletion from the delete button in node headers
   * Processes clicks on elements with data-delete-node attribute
   */
  const handleNodeDelete = React.useCallback(
    (nodeId: string) => {
      // Remove the node
      setNodes((currentNodes) => currentNodes.filter((n) => n.id !== nodeId));
      // Remove any edges connected to this node
      setEdges((currentEdges) =>
        currentEdges.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      // Clear selection if the deleted node was selected
      if (selectedNodeId === nodeId) {
        onNodeSelect?.(null);
      }
    },
    [setNodes, setEdges, selectedNodeId, onNodeSelect]
  );

  /**
   * Click handler for the ReactFlow canvas
   * Intercepts clicks on node delete buttons
   */
  const handlePaneClick = React.useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if the click was on a delete button or its child
      const deleteButton = target.closest("[data-delete-node]") as HTMLElement | null;
      if (deleteButton) {
        event.stopPropagation();
        const nodeId = deleteButton.getAttribute("data-delete-node");
        if (nodeId) {
          handleNodeDelete(nodeId);
        }
      }
    },
    [handleNodeDelete]
  );

  /**
   * Handles edge deletion
   */
  const onEdgesDelete: OnEdgesDelete = React.useCallback(() => {
    // Additional cleanup if needed
  }, []);

  /**
   * Handles drag start from palette
   */
  const onDragStart = React.useCallback(
    (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData("application/reactflow", nodeType);
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  /**
   * Handles drop of new node onto canvas
   */
  const onDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      // Calculate position where node was dropped
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Generate unique ID
      const id = `${type}-${Date.now()}`;

      // Create label based on type
      const label = NODE_PALETTE.find((p) => p.type === type)?.label ?? type;

      // Create new node
      const newNode: WorkflowNode = {
        id,
        type: type as WorkflowNodeType,
        position,
        data: createDefaultNodeData(type, label),
      };

      setNodes((nds) => [...nds, newNode as unknown as Node]);
    },
    [screenToFlowPosition, setNodes]
  );

  /**
   * Handles drag over canvas (required for drop to work)
   */
  const onDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  /**
   * Saves the workflow
   */
  const handleSave = React.useCallback(async () => {
    if (!onSave) return;

    const workflowData: Partial<WorkflowDefinition> = {
      id: workflow?.id,
      name: workflowName,
      nodes: nodes as unknown as WorkflowNode[],
      edges: edges as unknown as WorkflowEdge[],
      isActive: workflow?.isActive ?? false,
    };

    await onSave(workflowData);
    setIsDirty(false);
  }, [onSave, workflow, workflowName, nodes, edges]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="h-9 w-64 font-medium"
            placeholder="Workflow name..."
          />
          {isDirty && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fitView({ padding: 0.2 })}
          >
            <Maximize className="mr-2 h-4 w-4" />
            Fit View
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div ref={reactFlowWrapper} className="flex-1" onClick={handlePaneClick}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onSelectionChange={onSelectionChange}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          snapToGrid
          snapGrid={[16, 16]}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          className="bg-background"
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: true,
            style: { strokeWidth: 2 },
          }}
        >
          {/* Mini Map */}
          <MiniMap
            nodeStrokeWidth={3}
            className="!bg-card !border !border-border !rounded-lg"
            maskColor="rgba(0, 0, 0, 0.1)"
          />

          {/* Zoom Controls */}
          <Controls
            className="!bg-card !border !border-border !rounded-lg !shadow-md"
            showInteractive={false}
          />

          {/* Background Grid */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            className="!bg-background"
          />

          {/* Node Palette Panel */}
          <Panel position="top-left" className="!m-4">
            <NodePalette onDragStart={onDragStart} />
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

WorkflowBuilder.displayName = "WorkflowBuilder";

export default WorkflowBuilder;
