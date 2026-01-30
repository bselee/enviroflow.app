"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { ArrowLeft, Trash2, Power, PowerOff, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { WorkflowBuilder } from "@/components/workflow/WorkflowBuilder";
import { NodePropertiesPanel } from "@/components/workflow/NodePropertiesPanel";
import type { WorkflowDefinition, WorkflowNode } from "@/components/workflow/types";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/**
 * EditWorkflowPage - Edit an existing automation workflow
 *
 * Route: /automations/builder/[id]
 *
 * This page loads an existing workflow and provides the visual editor for modifications.
 * Users can:
 * - Edit nodes and connections
 * - Configure node properties
 * - Toggle workflow active/inactive status
 * - Delete the workflow
 */

/** Mock controllers for development - replace with real data from API */
const MOCK_CONTROLLERS = [
  { id: "ctrl-1", name: "AC Infinity Controller 69 Pro" },
  { id: "ctrl-2", name: "Inkbird ITC-308" },
  { id: "ctrl-3", name: "Veg Tent Controller" },
];

/** Mock workflow data for development - replace with API call */
const MOCK_WORKFLOWS: Record<string, WorkflowDefinition> = {
  "1": {
    id: "1",
    name: "VPD Control",
    description: "Automatically adjust fan speed based on VPD readings",
    isActive: true,
    roomId: "room-1",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          label: "Every 5 minutes",
          config: {
            triggerType: "schedule",
            cronExpression: "*/5 * * * *",
          },
        },
      },
      {
        id: "sensor-1",
        type: "sensor",
        position: { x: 350, y: 200 },
        data: {
          label: "Check VPD",
          config: {
            controllerId: "ctrl-1",
            controllerName: "AC Infinity Controller 69 Pro",
            sensorType: "vpd",
            operator: ">",
            threshold: 1.2,
            resetThreshold: 1.0,
            unit: "kPa",
          },
          currentValue: 1.15,
        },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 600, y: 200 },
        data: {
          label: "VPD High?",
          config: { logicType: "AND" },
        },
      },
    ],
    edges: [
      {
        id: "e-trigger-sensor",
        source: "trigger-1",
        target: "sensor-1",
        type: "smoothstep",
        animated: true,
      },
      {
        id: "e-sensor-condition",
        source: "sensor-1",
        target: "condition-1",
        type: "smoothstep",
        animated: true,
      },
    ],
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-20T14:45:00Z",
    userId: "user-1",
  },
  "2": {
    id: "2",
    name: "Lights Schedule",
    description: "Turn lights on at 6am and off at 12am",
    isActive: true,
    roomId: "room-2",
    nodes: [
      {
        id: "trigger-2",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          label: "Daily at 6am",
          config: {
            triggerType: "schedule",
            simpleTime: "06:00",
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          },
        },
      },
    ],
    edges: [],
    createdAt: "2024-01-10T08:00:00Z",
    updatedAt: "2024-01-18T16:20:00Z",
    userId: "user-1",
  },
  "3": {
    id: "3",
    name: "Humidity Alert",
    description: "Send notification when humidity exceeds 70%",
    isActive: false,
    roomId: "room-3",
    nodes: [
      {
        id: "trigger-3",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          label: "Humidity Trigger",
          config: {
            triggerType: "sensor_threshold",
          },
        },
      },
    ],
    edges: [],
    createdAt: "2024-01-05T12:00:00Z",
    updatedAt: "2024-01-12T09:15:00Z",
    userId: "user-1",
  },
};

export default function EditWorkflowPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = React.useState<WorkflowDefinition | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [nodes, setNodes] = React.useState<WorkflowNode[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isTogglingActive, setIsTogglingActive] = React.useState(false);
  const [nodeUpdateTrigger, setNodeUpdateTrigger] = React.useState<{
    nodeId: string;
    data: Partial<WorkflowNode["data"]>;
  } | null>(null);

  /**
   * Loads the workflow data from the API
   */
  React.useEffect(() => {
    async function loadWorkflow() {
      setIsLoading(true);

      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/workflows/${workflowId}`);
        // const data = await response.json();

        // Mock data for development
        const mockWorkflow = MOCK_WORKFLOWS[workflowId];

        if (mockWorkflow) {
          setWorkflow(mockWorkflow);
          setNodes(mockWorkflow.nodes);
        } else {
          // Workflow not found, redirect to automations list
          router.push("/automations");
        }
      } catch (error) {
        console.error("Failed to load workflow:", error);
        router.push("/automations");
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkflow();
  }, [workflowId, router]);

  /**
   * Finds the currently selected node from the nodes array
   */
  const selectedNode = React.useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [nodes, selectedNodeId]);

  /**
   * Handles node selection changes from the builder
   */
  const handleNodeSelect = React.useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  /**
   * Updates nodes state when builder reports changes
   */
  const handleNodesChange = React.useCallback((newNodes: WorkflowNode[]) => {
    setNodes(newNodes);
  }, []);

  /**
   * Updates a node's data when edited in the properties panel
   */
  const handleNodeUpdate = React.useCallback(
    (nodeId: string, data: Partial<WorkflowNode["data"]>) => {
      // Trigger update in the builder
      setNodeUpdateTrigger({ nodeId, data });
      // Clear trigger after a tick to allow re-triggers
      setTimeout(() => setNodeUpdateTrigger(null), 0);
    },
    []
  );

  /**
   * Closes the properties panel
   */
  const handleClosePanel = React.useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  /**
   * Saves the workflow to the API
   */
  const handleSave = React.useCallback(
    async (updatedWorkflow: Partial<WorkflowDefinition>) => {
      setIsSaving(true);

      try {
        // TODO: Replace with actual API call
        const response = await fetch(`/api/workflows/${workflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: updatedWorkflow.name,
            nodes: updatedWorkflow.nodes,
            edges: updatedWorkflow.edges,
            isActive: updatedWorkflow.isActive,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save workflow");
        }

        const savedWorkflow = await response.json();
        setWorkflow(savedWorkflow);
        toast({
          title: "Workflow Saved",
          description: "Your workflow has been saved successfully.",
        });
      } catch (error) {
        console.error("Failed to save workflow:", error);
        toast({
          title: "Save Failed",
          description: error instanceof Error ? error.message : "Failed to save workflow. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [workflowId, toast]
  );

  /**
   * Toggles the workflow active/inactive status
   */
  const handleToggleActive = React.useCallback(async () => {
    if (!workflow) return;

    setIsTogglingActive(true);

    try {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: !workflow.isActive,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle workflow status");
      }

      setWorkflow((prev) =>
        prev ? { ...prev, isActive: !prev.isActive } : prev
      );
      toast({
        title: workflow.isActive ? "Workflow Deactivated" : "Workflow Activated",
        description: workflow.isActive
          ? "The workflow has been deactivated and will no longer run."
          : "The workflow is now active and will run according to its triggers.",
      });
    } catch (error) {
      console.error("Failed to toggle workflow:", error);
      toast({
        title: "Action Failed",
        description: error instanceof Error ? error.message : "Failed to update workflow status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingActive(false);
    }
  }, [workflow, workflowId, toast]);

  /**
   * Deletes the workflow
   */
  const handleDelete = React.useCallback(async () => {
    setIsDeleting(true);

    try {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete workflow");
      }

      toast({
        title: "Workflow Deleted",
        description: "The workflow has been permanently deleted.",
      });
      router.push("/automations");
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete workflow. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  }, [workflowId, router, toast]);

  // Show loading state
  if (isLoading) {
    return (
      <AppLayout hideSidebar>
        <div className="flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading workflow...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Workflow not found (should redirect, but show message just in case)
  if (!workflow) {
    return (
      <AppLayout hideSidebar>
        <div className="flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">Workflow not found</p>
            <Button asChild>
              <Link href="/automations">Back to Automations</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideSidebar>
      <ErrorBoundary componentName="Workflow Editor" showRetry>
        <div className="flex h-screen flex-col">
          {/* Header */}
          <header className="flex items-center justify-between border-b bg-card px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/automations">
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back to automations</span>
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold">{workflow.name}</h1>
                  <Badge
                    variant="secondary"
                    className={cn(
                      workflow.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                    )}
                  >
                    {workflow.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {workflow.description || "Edit your automation workflow"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Active Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleActive}
                disabled={isTogglingActive}
              >
                {isTogglingActive ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : workflow.isActive ? (
                  <PowerOff className="mr-2 h-4 w-4" />
                ) : (
                  <Power className="mr-2 h-4 w-4" />
                )}
                {workflow.isActive ? "Deactivate" : "Activate"}
              </Button>

              {/* Delete Button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{workflow.name}&quot;? This action
                      cannot be undone and will permanently remove the workflow and its
                      execution history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Delete"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </header>

          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Builder Canvas */}
            <ReactFlowProvider>
              <div className="flex-1">
                <WorkflowBuilder
                  workflow={workflow}
                  onSave={handleSave}
                  isSaving={isSaving}
                  onNodeSelect={handleNodeSelect}
                  selectedNodeId={selectedNodeId}
                  onNodesChange={handleNodesChange}
                  nodeUpdateTrigger={nodeUpdateTrigger}
                />
              </div>
            </ReactFlowProvider>

            {/* Properties Panel */}
            {selectedNode && (
              <NodePropertiesPanel
                node={selectedNode}
                onUpdate={handleNodeUpdate}
                onClose={handleClosePanel}
                controllers={MOCK_CONTROLLERS}
              />
            )}
          </div>
        </div>
      </ErrorBoundary>
    </AppLayout>
  );
}
