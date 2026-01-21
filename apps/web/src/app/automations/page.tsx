"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Play,
  Pause,
  MoreVertical,
  Workflow,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  Clock,
  Zap,
  Copy,
  Trash2,
  Pencil,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkflows } from "@/hooks/use-workflows";
import { useToast } from "@/hooks/use-toast";
import type { WorkflowWithRoom } from "@/types";

/**
 * Formats a timestamp into a human-readable relative time.
 * Returns "Never" if timestamp is null.
 */
function formatLastRun(timestamp: string | null): string {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}

/**
 * Extracts a trigger summary from workflow nodes.
 * Looks for trigger nodes and returns a descriptive string.
 */
function getTriggerSummary(nodes: WorkflowWithRoom["nodes"]): string {
  const triggerNode = nodes.find((node) => node.type === "trigger");
  if (!triggerNode) return "No trigger";

  const data = triggerNode.data as { config?: { triggerType?: string; simpleTime?: string; sensorType?: string } };
  const config = data.config;

  if (!config) return "Trigger";

  switch (config.triggerType) {
    case "schedule":
      return config.simpleTime ? `At ${config.simpleTime}` : "Scheduled";
    case "sensor_threshold":
      return config.sensorType ? `${config.sensorType} threshold` : "Sensor trigger";
    case "manual":
      return "Manual";
    default:
      return "Trigger";
  }
}

/**
 * Extracts an action summary from workflow nodes.
 * Counts action, dimmer, and notification nodes.
 */
function getActionSummary(nodes: WorkflowWithRoom["nodes"]): string {
  const actionNodes = nodes.filter((node) =>
    ["action", "dimmer", "notification"].includes(node.type)
  );

  if (actionNodes.length === 0) return "No actions";
  if (actionNodes.length === 1) {
    const node = actionNodes[0];
    if (node.type === "action") return "Control device";
    if (node.type === "dimmer") return "Light dimmer";
    if (node.type === "notification") return "Notification";
  }

  return `${actionNodes.length} actions`;
}

// ============================================================================
// WorkflowCard Component
// ============================================================================

interface WorkflowCardProps {
  workflow: WorkflowWithRoom;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isToggling?: boolean;
}

function WorkflowCard({
  workflow,
  onToggleActive,
  onDuplicate,
  onDelete,
  isToggling,
}: WorkflowCardProps) {
  const router = useRouter();

  const triggerSummary = getTriggerSummary(workflow.nodes);
  const actionSummary = getActionSummary(workflow.nodes);

  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              workflow.is_active ? "bg-green-500/10" : "bg-muted"
            )}
          >
            <Workflow
              className={cn(
                "w-5 h-5",
                workflow.is_active ? "text-green-500" : "text-muted-foreground"
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{workflow.name}</h3>
            {workflow.room && (
              <Badge variant="outline" className="text-xs mt-1">
                {workflow.room.name}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Active Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={workflow.is_active ? "Pause workflow" : "Activate workflow"}
            onClick={() => onToggleActive(workflow.id, !workflow.is_active)}
            disabled={isToggling}
          >
            {isToggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : workflow.is_active ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/automations/builder/${workflow.id}`)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(workflow.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(workflow.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Description */}
      {workflow.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {workflow.description}
        </p>
      )}

      {/* Trigger & Action Summary */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{triggerSummary}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          <span>{actionSummary}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
        <Badge
          variant="secondary"
          className={cn(
            workflow.is_active
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          )}
        >
          {workflow.is_active ? "Active" : "Paused"}
        </Badge>
        <span>Last run: {formatLastRun(workflow.last_run)}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AutomationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    workflows,
    loading,
    error,
    refetch,
    toggleActive,
    deleteWorkflow,
    createWorkflow,
    activeCount,
  } = useWorkflows();

  // Local state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [workflowToDelete, setWorkflowToDelete] = React.useState<string | null>(null);

  /**
   * Filters workflows based on search query and status filter.
   */
  const filteredWorkflows = React.useMemo(() => {
    return workflows.filter((workflow) => {
      // Status filter
      if (statusFilter === "active" && !workflow.is_active) return false;
      if (statusFilter === "inactive" && workflow.is_active) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = workflow.name.toLowerCase().includes(query);
        const descMatch = workflow.description?.toLowerCase().includes(query);
        const roomMatch = workflow.room?.name.toLowerCase().includes(query);
        if (!nameMatch && !descMatch && !roomMatch) return false;
      }

      return true;
    });
  }, [workflows, searchQuery, statusFilter]);

  /**
   * Handles toggling a workflow's active status.
   */
  const handleToggleActive = React.useCallback(
    async (id: string, isActive: boolean) => {
      setTogglingId(id);
      const result = await toggleActive(id, isActive);
      setTogglingId(null);

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error ?? "Failed to update workflow",
          variant: "destructive",
        });
      } else {
        toast({
          title: isActive ? "Workflow activated" : "Workflow paused",
          description: `The workflow has been ${isActive ? "activated" : "paused"}.`,
        });
      }
    },
    [toggleActive, toast]
  );

  /**
   * Handles duplicating a workflow.
   */
  const handleDuplicate = React.useCallback(
    async (id: string) => {
      const workflow = workflows.find((w) => w.id === id);
      if (!workflow) return;

      const result = await createWorkflow({
        name: `${workflow.name} (Copy)`,
        description: workflow.description ?? undefined,
        room_id: workflow.room_id ?? undefined,
        nodes: workflow.nodes,
        edges: workflow.edges,
        is_active: false, // Start as inactive
      });

      if (result.success) {
        toast({
          title: "Workflow duplicated",
          description: "A copy of the workflow has been created.",
        });
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to duplicate workflow",
          variant: "destructive",
        });
      }
    },
    [workflows, createWorkflow, toast]
  );

  /**
   * Handles initiating workflow deletion (shows confirmation dialog).
   */
  const handleDeleteClick = React.useCallback((id: string) => {
    setWorkflowToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  /**
   * Handles confirming workflow deletion.
   */
  const handleDeleteConfirm = React.useCallback(async () => {
    if (!workflowToDelete) return;

    const result = await deleteWorkflow(workflowToDelete);
    setDeleteDialogOpen(false);
    setWorkflowToDelete(null);

    if (result.success) {
      toast({
        title: "Workflow deleted",
        description: "The workflow has been permanently deleted.",
      });
    } else {
      toast({
        title: "Error",
        description: result.error ?? "Failed to delete workflow",
        variant: "destructive",
      });
    }
  }, [workflowToDelete, deleteWorkflow, toast]);

  return (
    <AppLayout>
      <div className="min-h-screen">
        <PageHeader
          title="Automations"
          description="Create and manage your automation workflows"
          actions={
            <Button asChild>
              <Link href="/automations/builder">
                <Plus className="h-4 w-4 mr-2" />
                New Workflow
              </Link>
            </Button>
          }
        />

        <div className="p-6 lg:p-8">
          {/* Filters Section */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-4">
              {/* Search Input */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search workflows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as "all" | "active" | "inactive")}
              >
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{workflows.length} total</span>
              <span>{activeCount} active</span>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Failed to load workflows
              </h3>
              <p className="text-sm text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => refetch()}>Try Again</Button>
            </div>
          )}

          {/* Workflows Grid */}
          {!loading && !error && filteredWorkflows.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredWorkflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onToggleActive={handleToggleActive}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDeleteClick}
                  isToggling={togglingId === workflow.id}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredWorkflows.length === 0 && (
            <div className="text-center py-16">
              <Workflow className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {workflows.length === 0
                  ? "No workflows yet"
                  : "No matching workflows"}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {workflows.length === 0
                  ? "Create your first automation workflow to get started"
                  : "Try adjusting your search or filter criteria"}
              </p>
              {workflows.length === 0 && (
                <Button asChild>
                  <Link href="/automations/builder">
                    <Plus className="h-4 w-4 mr-2" />
                    New Workflow
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The workflow and all its automation
              history will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
