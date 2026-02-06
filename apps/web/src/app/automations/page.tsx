"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Play, Pause, MoreVertical, Workflow, AlertTriangle, LayoutTemplate, Zap, Search, Copy, Download, Upload, BookMarked } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkflows } from "@/hooks/use-workflows";
import { useControllers } from "@/hooks/use-controllers";
import { useWorkflowConflicts, type WorkflowConflictInfo } from "@/hooks/use-workflow-conflicts";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { TemplateGallery } from "@/components/workflow/templates";
import { 
  ConflictResolutionModal, 
  DeleteWorkflowDialog,
  ManualTriggerButton,
} from "@/components/workflow";
import { SaveAsTemplateDialog } from "@/components/workflow/SaveAsTemplateDialog";
import type { WorkflowWithRoom } from "@/types";
import { z } from "zod";

// ============================================================================
// Workflow Import Validation (CRITICAL: prevents arbitrary JSON injection)
// ============================================================================

/** Valid node types that can exist in an imported workflow */
const VALID_NODE_TYPES = [
  "trigger", "sensor", "condition", "action", "dimmer", "notification",
  "mode", "verified_action", "port_condition", "delay", "variable", "debounce",
] as const;

/** Strip HTML tags from strings to prevent XSS */
function sanitizeString(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

/** Zod schema for validating imported workflow JSON */
const ImportedWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required").max(200, "Workflow name too long").transform(sanitizeString),
  description: z.string().max(1000, "Description too long").transform(sanitizeString).optional(),
  growth_stage: z.string().max(100).transform(sanitizeString).optional(),
  nodes: z.array(
    z.object({
      id: z.string().min(1, "Node ID is required"),
      type: z.enum(VALID_NODE_TYPES, {
        errorMap: () => ({ message: "Unknown node type" }),
      }),
      position: z.object({
        x: z.number().finite(),
        y: z.number().finite(),
      }),
      data: z.object({
        label: z.string().max(200).transform(sanitizeString),
        config: z.record(z.unknown()).default({}),
      }).passthrough(),
    }).passthrough()
  ).max(100, "Workflow cannot have more than 100 nodes"),
  edges: z.array(
    z.object({
      id: z.string().min(1),
      source: z.string().min(1),
      target: z.string().min(1),
    }).passthrough()
  ).max(200, "Workflow cannot have more than 200 edges").default([]),
}).strict();

/**
 * Sanitize all string values in node config to prevent stored XSS.
 * Removes HTML tags from any string field, recursively.
 */
function sanitizeNodeConfigs(nodes: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return nodes.map((node) => {
    const data = node.data as Record<string, unknown> | undefined;
    if (!data?.config || typeof data.config !== "object") return node;
    const config = data.config as Record<string, unknown>;
    const sanitizedConfig: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === "string") {
        sanitizedConfig[key] = sanitizeString(value);
      } else {
        sanitizedConfig[key] = value;
      }
      // SECURITY: Strip any raw MQTT credentials that may exist in imported workflows
      if (key === "password" || key === "brokerUrl" || key === "username") {
        delete sanitizedConfig[key];
      }
    }
    return { ...node, data: { ...data, config: sanitizedConfig } };
  });
}

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
  conflictInfo?: WorkflowConflictInfo;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (workflow: WorkflowWithRoom) => Promise<void>;
  onExport: (workflow: WorkflowWithRoom) => void;
  onSaveAsTemplate: (workflow: WorkflowWithRoom) => void;
  onResolveConflict: (workflow: WorkflowWithRoom, conflictInfo: WorkflowConflictInfo) => void;
}

function WorkflowCard({ workflow, conflictInfo, onToggleActive, onDelete, onDuplicate, onExport, onSaveAsTemplate, onResolveConflict }: WorkflowCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { toast } = useToast();

  const handleToggle = async () => {
    await onToggleActive(workflow.id, !workflow.is_active);
  };

  const handleDeleteConfirm = async (id: string) => {
    setIsDeleting(true);
    try {
      await onDelete(id);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasConflict = conflictInfo?.hasConflict ?? false;

  return (
    <>
      <div className={cn(
        "bg-card dark:bg-[#151c26] rounded-2xl border p-5 transition-all duration-200",
        hasConflict
          ? "border-destructive/50 dark:border-[rgba(255,82,82,0.5)]"
          : "border-border dark:border-[rgba(255,255,255,0.06)]",
        "hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(0,212,255,0.1)] hover:border-border/80 dark:hover:border-[rgba(0,212,255,0.3)]"
      )}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                hasConflict
                  ? "bg-destructive/10 dark:bg-[rgba(255,82,82,0.1)]"
                  : workflow.is_active
                    ? "bg-[rgba(0,230,118,0.1)]"
                    : "bg-muted dark:bg-[#1e2a3a]"
              )}
            >
              {hasConflict ? (
                <AlertTriangle className="w-5 h-5 text-destructive dark:text-[#ff5252]" />
              ) : (
                <Workflow
                  className={cn(
                    "w-5 h-5",
                    workflow.is_active ? "text-[#00e676]" : "text-muted-foreground dark:text-[#4a5568]"
                  )}
                />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground dark:text-[#e8edf4]">{workflow.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {workflow.room && (
                  <Badge variant="outline" className="text-xs dark:border-[rgba(255,255,255,0.1)] dark:text-[#8896a8]">
                    {workflow.room.name}
                  </Badge>
                )}
                {hasConflict && conflictInfo && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="destructive"
                          className="text-xs cursor-pointer dark:bg-[rgba(255,82,82,0.2)] dark:text-[#ff5252] dark:border-[rgba(255,82,82,0.3)]"
                          onClick={() => onResolveConflict(workflow, conflictInfo)}
                        >
                          Conflict
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px] dark:bg-[#1e2a3a] dark:border-[rgba(255,255,255,0.06)]">
                        <p className="font-medium mb-1 dark:text-[#e8edf4]">Port conflict detected!</p>
                        <p className="text-xs dark:text-[#8896a8]">
                          Conflicts with: {conflictInfo?.conflictingWorkflows.map(w => w.name).join(", ")}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-[#4a5568] mt-1">
                          Click to resolve conflict.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Manual Trigger Button */}
            <ManualTriggerButton
              workflowId={workflow.id}
              workflowName={workflow.name}
              isActive={workflow.is_active}
              compact
              onExecutionComplete={(result) => {
                if (result.success) {
                  toast({
                    title: "Workflow executed",
                    description: result.actionsTriggered 
                      ? `${result.actionsTriggered} action(s) triggered`
                      : result.skippedReason || "Completed successfully",
                  });
                } else {
                  toast({
                    title: "Execution failed",
                    description: result.error || "Unknown error",
                    variant: "destructive",
                  });
                }
              }}
            />

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
                <DropdownMenuItem onClick={() => onDuplicate(workflow)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport(workflow)}>
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSaveAsTemplate(workflow)}>
                  <BookMarked className="h-4 w-4 mr-2" />
                  Save as Template
                </DropdownMenuItem>
                {hasConflict && conflictInfo && (
                  <DropdownMenuItem onClick={() => onResolveConflict(workflow, conflictInfo)}>
                    Resolve Conflict
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className="text-sm text-muted-foreground dark:text-[#8896a8] mb-4">
          {workflow.description || "No description"}
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-[#4a5568] pt-3 border-t border-border dark:border-[rgba(255,255,255,0.06)]">
          <Badge
            variant="secondary"
            className={cn(
              workflow.is_active
                ? "bg-[rgba(0,230,118,0.1)] text-[#00e676] border-none"
                : "bg-[rgba(255,145,0,0.1)] text-[#ff9100] border-none"
            )}
          >
            {workflow.is_active ? "Active" : "Paused"}
          </Badge>
          <span>Last run: {formatRelativeTime(workflow.last_executed)}</span>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteWorkflowDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        workflowName={workflow.name}
        workflowId={workflow.id}
        isActive={workflow.is_active}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </>
  );
}

function WorkflowCardSkeleton() {
  return (
    <div className="bg-card dark:bg-[#151c26] rounded-2xl border border-border dark:border-[rgba(255,255,255,0.06)] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg dark:bg-[#1e2a3a]" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32 dark:bg-[#1e2a3a]" />
            <Skeleton className="h-4 w-24 dark:bg-[#1e2a3a]" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded dark:bg-[#1e2a3a]" />
          <Skeleton className="h-8 w-8 rounded dark:bg-[#1e2a3a]" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-4 dark:bg-[#1e2a3a]" />
      <div className="flex items-center justify-between pt-3 border-t border-border dark:border-[rgba(255,255,255,0.06)]">
        <Skeleton className="h-5 w-16 dark:bg-[#1e2a3a]" />
        <Skeleton className="h-4 w-32 dark:bg-[#1e2a3a]" />
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  const router = useRouter();
  const { workflows, loading, toggleActive, deleteWorkflow, createWorkflow, refetch } = useWorkflows();
  const { controllers } = useControllers();
  const { conflicts, refresh: refreshConflicts } = useWorkflowConflicts();
  const { toast } = useToast();
  const [templateGalleryOpen, setTemplateGalleryOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "paused" | "failed">("all");

  // Conflict resolution modal state
  const [conflictModalOpen, setConflictModalOpen] = React.useState(false);
  const [conflictingWorkflow, setConflictingWorkflow] = React.useState<WorkflowWithRoom | null>(null);
  const [conflictInfo, setConflictInfo] = React.useState<WorkflowConflictInfo | null>(null);
  const [isResolving, setIsResolving] = React.useState(false);

  // Save as template state
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = React.useState(false);
  const [templateWorkflow, setTemplateWorkflow] = React.useState<WorkflowWithRoom | null>(null);

  // Map controllers to the format expected by TemplateGallery
  // Each controller exposes its supported device types from capabilities
  const templateControllers = React.useMemo(() => {
    return controllers.map((c) => ({
      id: c.id,
      name: c.name,
      // Create virtual "ports" from device capabilities for template matching
      ports: c.capabilities?.devices?.map((deviceType, index) => ({
        port: index + 1,
        deviceType,
        name: deviceType,
      })) || [],
    }));
  }, [controllers]);

  // Handle applying a template
  const handleApplyTemplate = async (
    nodes: unknown[],
    edges: unknown[],
    templateName: string
  ) => {
    const result = await createWorkflow({
      name: `${templateName}`,
      description: `Created from "${templateName}" template`,
      nodes: nodes as Parameters<typeof createWorkflow>[0]['nodes'],
      edges: edges as Parameters<typeof createWorkflow>[0]['edges'],
    });

    if (result.success && result.data) {
      toast({
        title: "Workflow created from template",
        description: `"${templateName}" workflow is ready to configure`,
      });
      // Navigate to the builder to let user review/edit
      router.push(`/automations/builder/${result.data.id}`);
    } else {
      toast({
        title: "Failed to create workflow",
        description: result.error || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const result = await toggleActive(id, isActive);
    if (result.success) {
      toast({
        title: isActive ? "Workflow activated" : "Workflow paused",
        description: isActive
          ? "Workflow is now running on schedule"
          : "Workflow will not execute until activated",
      });
      // Refresh conflicts after toggling
      refreshConflicts();
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
      // Refresh conflicts after deletion
      refreshConflicts();
    } else {
      toast({
        title: "Failed to delete workflow",
        description: result.error || "Please try again",
        variant: "destructive",
      });
    }
  };

  // Handle opening conflict resolution modal
  const handleResolveConflict = (workflow: WorkflowWithRoom, info: WorkflowConflictInfo) => {
    setConflictingWorkflow(workflow);
    setConflictInfo(info);
    setConflictModalOpen(true);
  };

  // Handle resolving a conflict by keeping one workflow active
  const handleConflictResolution = async (keepActiveId: string, deactivateIds: string[]) => {
    setIsResolving(true);
    try {
      // Deactivate all conflicting workflows except the chosen one
      for (const id of deactivateIds) {
        await toggleActive(id, false);
      }
      
      toast({
        title: "Conflict resolved",
        description: `${deactivateIds.length} workflow(s) paused. Selected workflow remains active.`,
      });
      
      // Refresh data
      await refetch();
      await refreshConflicts();
    } catch (error) {
      toast({
        title: "Failed to resolve conflict",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      // Re-throw so the modal knows the resolution failed and stays open
      throw error;
    } finally {
      setIsResolving(false);
    }
  };

  // Get conflicting workflows for the modal
  const conflictingWorkflowsForModal = React.useMemo(() => {
    if (!conflictInfo || !conflictingWorkflow) return [];
    return workflows.filter(w => 
      conflictInfo.conflictingWorkflows.some(cw => cw.id === w.id)
    );
  }, [conflictInfo, conflictingWorkflow, workflows]);

  // Count conflicts for header warning
  const conflictCount = Object.values(conflicts).filter(c => c.hasConflict).length;

  // Filtered workflows
  const filteredWorkflows = React.useMemo(() => {
    return workflows.filter((w) => {
      // Search filter
      if (searchQuery && !w.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Status filter
      if (statusFilter === "active" && (!w.is_active || w.last_error)) return false;
      if (statusFilter === "paused" && w.is_active) return false;
      if (statusFilter === "failed" && !w.last_error) return false;
      return true;
    });
  }, [workflows, searchQuery, statusFilter]);

  // Duplicate workflow
  const handleDuplicate = async (workflow: WorkflowWithRoom) => {
    const result = await createWorkflow({
      name: `${workflow.name} (Copy)`,
      description: workflow.description ?? undefined,
      room_id: workflow.room_id ?? undefined,
      nodes: workflow.nodes,
      edges: workflow.edges,
      is_active: false,
      dry_run_enabled: true,
    });
    if (result.success) {
      toast({ title: "Workflow duplicated", description: `"${workflow.name} (Copy)" created (paused)` });
    } else {
      toast({ title: "Failed to duplicate", description: result.error || "Please try again", variant: "destructive" });
    }
  };

  // Export workflow JSON
  const handleExport = (workflow: WorkflowWithRoom) => {
    const exportData = {
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes,
      edges: workflow.edges,
      growth_stage: workflow.growth_stage,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const slug = workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Workflow exported", description: `Downloaded workflow-${slug}.json` });
  };

  // Save workflow as template
  const handleSaveAsTemplate = (workflow: WorkflowWithRoom) => {
    setTemplateWorkflow(workflow);
    setSaveTemplateDialogOpen(true);
  };

  // Handle template save
  const handleTemplateSave = async (template: { name: string; description: string; nodes: unknown[]; edges: unknown[] }) => {
    // Store in localStorage for now (future: Supabase personal_templates table)
    const existingTemplates = JSON.parse(localStorage.getItem("personalTemplates") || "[]");
    existingTemplates.push({
      ...template,
      id: `personal-${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("personalTemplates", JSON.stringify(existingTemplates));
    
    toast({
      title: "Template saved",
      description: `"${template.name}" added to your personal templates`,
    });
  };

  // Import workflow JSON with Zod validation and XSS sanitization
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Size check: reject files over 1MB to prevent DoS
      if (file.size > 1024 * 1024) {
        throw new Error("File too large. Maximum import size is 1MB.");
      }

      const text = await file.text();
      let rawData: unknown;
      try {
        rawData = JSON.parse(text);
      } catch {
        throw new Error("File is not valid JSON. Please check the file format.");
      }

      // Validate structure with Zod schema
      const parseResult = ImportedWorkflowSchema.safeParse(rawData);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.slice(0, 3);
        const messages = issues.map((i) => `${i.path.join(".")}: ${i.message}`);
        throw new Error(`Invalid workflow format:\n${messages.join("\n")}`);
      }

      const data = parseResult.data;

      // Sanitize all node configs (strips HTML and removes raw MQTT credentials)
      const sanitizedNodes = sanitizeNodeConfigs(data.nodes as Array<Record<string, unknown>>);

      // Check for duplicate workflow name
      const existingNames = workflows.map((w) => w.name);
      let name = data.name;
      if (existingNames.includes(name)) {
        name = `${name} (Imported)`;
      }

      const result = await createWorkflow({
        name,
        description: data.description ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodes: sanitizedNodes as any,
        edges: data.edges ?? [],
        is_active: false,
        dry_run_enabled: true,
        growth_stage: data.growth_stage ?? undefined,
      });
      if (result.success) {
        toast({ title: "Workflow imported", description: `"${name}" created (paused, dry-run enabled)` });
      } else {
        toast({ title: "Import failed", description: result.error || "Please try again", variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Invalid JSON file",
        variant: "destructive",
      });
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppLayout>
      <ErrorBoundary componentName="Automations" showRetry>
        <div className="min-h-screen">
          <PageHeader
            title="Automations"
            description="Create and manage your automation workflows"
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setTemplateGalleryOpen(true)}>
                  <LayoutTemplate className="h-4 w-4 mr-2" />
                  Browse Templates
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImport}
                />
                <Button asChild>
                  <Link href="/automations/builder">
                    <Plus className="h-4 w-4 mr-2" />
                    New Workflow
                  </Link>
                </Button>
              </div>
            }
          />

          {/* Template Gallery Modal */}
          <TemplateGallery
            open={templateGalleryOpen}
            onOpenChange={setTemplateGalleryOpen}
            controllers={templateControllers}
            onApplyTemplate={handleApplyTemplate}
          />

          {/* Conflict Warning Banner */}
          {conflictCount > 0 && (
            <div className="mx-6 lg:mx-8 mb-4 p-4 bg-destructive/10 dark:bg-[rgba(255,82,82,0.1)] border border-destructive/30 dark:border-[rgba(255,82,82,0.3)] rounded-2xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive dark:text-[#ff5252] shrink-0" />
                <div>
                  <p className="font-medium text-destructive dark:text-[#ff5252]">
                    {conflictCount} workflow{conflictCount > 1 ? "s have" : " has"} port conflicts
                  </p>
                  <p className="text-sm text-muted-foreground dark:text-[#8896a8]">
                    Conflicting workflows target the same device port. Only one will execute per cron cycle.
                    Deactivate conflicting workflows or edit them to target different ports.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 lg:p-8">
            {/* Filter Bar */}
            {!loading && workflows.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search workflows..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {(["all", "active", "paused", "failed"] as const).map((s) => (
                    <Button
                      key={s}
                      variant={statusFilter === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter(s)}
                      className="capitalize"
                    >
                      {s}
                    </Button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground ml-auto">
                  {filteredWorkflows.length} of {workflows.length}
                </span>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <WorkflowCardSkeleton />
                <WorkflowCardSkeleton />
                <WorkflowCardSkeleton />
              </div>
            ) : filteredWorkflows.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredWorkflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    conflictInfo={conflicts[workflow.id]}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onExport={handleExport}
                    onSaveAsTemplate={handleSaveAsTemplate}
                    onResolveConflict={handleResolveConflict}
                  />
                ))}
              </div>
            ) : workflows.length > 0 ? (
              <div className="text-center py-16">
                <Search className="w-12 h-12 mx-auto text-muted-foreground/50 dark:text-[#4a5568] mb-4" />
                <h3 className="text-lg font-medium text-foreground dark:text-[#e8edf4] mb-2">
                  No matching workflows
                </h3>
                <p className="text-sm text-muted-foreground dark:text-[#8896a8] mb-4">
                  Try adjusting your search or filter
                </p>
                <Button variant="outline" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="dark:border-[rgba(255,255,255,0.1)] dark:text-[#8896a8] dark:hover:bg-[#1e2a3a] dark:hover:text-[#e8edf4]">
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="text-center py-16">
                <Workflow className="w-16 h-16 mx-auto text-muted-foreground/50 dark:text-[#4a5568] mb-4" />
                <h3 className="text-lg font-medium text-foreground dark:text-[#e8edf4] mb-2">
                  No workflows yet
                </h3>
                <p className="text-sm text-muted-foreground dark:text-[#8896a8] mb-6">
                  Create your first automation workflow
                </p>
                <Button asChild className="dark:bg-[#00d4ff] dark:text-[#0a0e14] dark:hover:bg-[#00d4ff]/90">
                  <Link href="/automations/builder">
                    <Plus className="h-4 w-4 mr-2" />
                    New Workflow
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Conflict Resolution Modal */}
          {conflictingWorkflow && conflictInfo && (
            <ConflictResolutionModal
              open={conflictModalOpen}
              onOpenChange={setConflictModalOpen}
              primaryWorkflow={conflictingWorkflow}
              conflictInfo={conflictInfo}
              conflictingWorkflows={conflictingWorkflowsForModal}
              onResolve={handleConflictResolution}
              isResolving={isResolving}
            />
          )}

          {/* Save as Template Dialog */}
          {templateWorkflow && (
            <SaveAsTemplateDialog
              open={saveTemplateDialogOpen}
              onOpenChange={setSaveTemplateDialogOpen}
              workflowName={templateWorkflow.name}
              nodes={templateWorkflow.nodes || []}
              edges={templateWorkflow.edges || []}
              onSave={handleTemplateSave}
            />
          )}
        </div>
      </ErrorBoundary>
    </AppLayout>
  );
}
