"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookMarked, Loader2 } from "lucide-react";

// Use generic types to accept nodes/edges from different type sources
interface GenericNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

interface GenericEdge {
  id: string;
  source: string;
  target: string;
}

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowName: string;
  nodes: GenericNode[];
  edges: GenericEdge[];
  onSave: (template: PersonalTemplate) => Promise<void>;
}

export interface PersonalTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: GenericNode[];
  edges: GenericEdge[];
  createdAt: string;
}

/**
 * SaveAsTemplateDialog - Save current workflow as a personal template
 *
 * Allows users to save their workflow configuration for reuse.
 * Templates strip device-specific IDs and keep the structure.
 */
export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  workflowName,
  nodes,
  edges,
  onSave,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("Personal");
  const [isSaving, setIsSaving] = React.useState(false);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setName(`${workflowName} Template`);
      setDescription("");
      setCategory("Personal");
    }
  }, [open, workflowName]);

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      // Strip device-specific IDs from nodes to make them generic
      const templateNodes = nodes.map((node) => ({
        ...node,
        id: node.id, // Keep node IDs for edge references
        data: node.data ? {
          ...node.data,
          config: sanitizeConfigForTemplate(node.data.config as Record<string, unknown>),
        } : {},
      }));

      const template: PersonalTemplate = {
        id: `personal-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        category,
        nodes: templateNodes,
        edges,
        createdAt: new Date().toISOString(),
      };

      await onSave(template);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-primary" />
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Save this workflow as a reusable template. Device-specific settings
            will be cleared so the template can be applied to any controller.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Template"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template does..."
              rows={3}
            />
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1">Template will include:</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• {nodes.length} node(s) with their configuration</li>
              <li>• {edges.length} connection(s) between nodes</li>
              <li>• Controller/port selections will be cleared</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sanitize node config for template - removes device-specific IDs
 */
function sanitizeConfigForTemplate(
  config: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!config) return {};

  const sanitized = { ...config };

  // Remove device-specific fields that should be re-mapped
  // SECURITY: Also strip raw MQTT credentials that may exist in legacy workflow nodes
  const fieldsToRemove = [
    "controllerId",
    "controllerName",
    "sensorId",
    "deviceId",
    "password",
    "username",
    "brokerUrl",
  ];

  for (const field of fieldsToRemove) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }

  // Keep port numbers as placeholders (user will remap)
  // Keep threshold values, durations, etc.

  return sanitized;
}

SaveAsTemplateDialog.displayName = "SaveAsTemplateDialog";

export default SaveAsTemplateDialog;
