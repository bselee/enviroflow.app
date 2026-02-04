"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { WorkflowBuilder } from "@/components/workflow/WorkflowBuilder";
import { NodePropertiesPanel } from "@/components/workflow/NodePropertiesPanel";
import type { WorkflowDefinition, WorkflowNode } from "@/components/workflow/types";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useToast } from "@/hooks/use-toast";
import { useControllers } from "@/hooks/use-controllers";

/**
 * WorkflowBuilderPage - Create a new automation workflow
 *
 * Route: /automations/builder
 *
 * This page provides the visual workflow builder for creating new automation workflows.
 * Users can:
 * - Drag and drop nodes from the palette
 * - Connect nodes to define execution flow
 * - Configure node properties in the side panel
 * - Save the workflow to the database
 */

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { controllers } = useControllers();
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [nodes, setNodes] = React.useState<WorkflowNode[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [nodeUpdateTrigger, setNodeUpdateTrigger] = React.useState<{
    nodeId: string;
    data: Partial<WorkflowNode["data"]>;
  } | null>(null);

  // Transform controllers to match NodePropertiesPanel format (includes brand for MQTT filtering)
  const controllerOptions = React.useMemo(() => {
    return controllers.map((c) => ({
      id: c.id,
      name: c.name || c.controller_id || 'Unknown Controller',
      brand: c.brand,
    }));
  }, [controllers]);

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
    async (workflow: Partial<WorkflowDefinition>) => {
      setIsSaving(true);

      try {
        // TODO: Replace with actual API call
        const response = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workflow.name,
            nodes: workflow.nodes,
            edges: workflow.edges,
            isActive: workflow.isActive ?? false,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save workflow");
        }

        const savedWorkflow = await response.json();

        // Navigate to edit page for the saved workflow
        router.push(`/automations/builder/${savedWorkflow.id}`);
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
    [router, toast]
  );

  return (
    <AppLayout hideSidebar>
      <ErrorBoundary componentName="Workflow Builder" showRetry>
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
                <h1 className="text-lg font-semibold">New Workflow</h1>
                <p className="text-sm text-muted-foreground">
                  Create a new automation workflow
                </p>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Builder Canvas */}
            <ReactFlowProvider>
              <div className="flex-1">
                <WorkflowBuilder
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
                controllers={controllerOptions}
              />
            )}
          </div>
        </div>
      </ErrorBoundary>
    </AppLayout>
  );
}
