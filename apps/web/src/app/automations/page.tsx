"use client";

import Link from "next/link";
import { Plus, Play, Pause, MoreVertical, Workflow } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkflows } from "@/hooks/use-workflows";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { WorkflowWithRoom } from "@/types";

/**
 * Formats relative time from ISO timestamp (e.g., "2 minutes ago").
 */
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "Never";

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else {
    return then.toLocaleDateString();
  }
}

interface WorkflowCardProps {
  workflow: WorkflowWithRoom;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function WorkflowCard({ workflow, onToggleActive, onDelete }: WorkflowCardProps) {
  const handleToggle = async () => {
    await onToggleActive(workflow.id, !workflow.is_active);
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${workflow.name}"?`)) {
      await onDelete(workflow.id);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              workflow.is_active ? "bg-success/10" : "bg-muted"
            )}
          >
            <Workflow
              className={cn(
                "w-5 h-5",
                workflow.is_active ? "text-success" : "text-muted-foreground"
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={workflow.is_active ? "Pause" : "Activate"}
            onClick={handleToggle}
          >
            {workflow.is_active ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/automations/builder/${workflow.id}`}>Edit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {workflow.description || "No description"}
      </p>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
        <Badge
          variant="secondary"
          className={cn(
            workflow.is_active
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
          )}
        >
          {workflow.is_active ? "Active" : "Paused"}
        </Badge>
        <span>Last run: {formatRelativeTime(workflow.last_executed)}</span>
      </div>
    </div>
  );
}

function WorkflowCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-4" />
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  const { workflows, loading, toggleActive, deleteWorkflow } = useWorkflows();
  const { toast } = useToast();

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const result = await toggleActive(id, isActive);
    if (result.success) {
      toast({
        title: isActive ? "Workflow activated" : "Workflow paused",
        description: isActive
          ? "Workflow is now running on schedule"
          : "Workflow will not execute until activated",
      });
    } else {
      toast({
        title: "Failed to update workflow",
        description: result.error || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteWorkflow(id);
    if (result.success) {
      toast({
        title: "Workflow deleted",
        description: "Workflow has been permanently removed",
      });
    } else {
      toast({
        title: "Failed to delete workflow",
        description: result.error || "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <ErrorBoundary componentName="Automations" showRetry>
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
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <WorkflowCardSkeleton />
                <WorkflowCardSkeleton />
                <WorkflowCardSkeleton />
              </div>
            ) : workflows.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {workflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Workflow className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No workflows yet
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Create your first automation workflow
                </p>
                <Button asChild>
                  <Link href="/automations/builder">
                    <Plus className="h-4 w-4 mr-2" />
                    New Workflow
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </AppLayout>
  );
}
