"use client";

import Link from "next/link";
import { Plus, Play, Pause, MoreVertical, Workflow } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";

interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  lastRun: string;
  roomName: string;
}

const mockWorkflows: AutomationWorkflow[] = [
  {
    id: "1",
    name: "VPD Control",
    description: "Automatically adjust fan speed based on VPD readings",
    isActive: true,
    lastRun: "2 minutes ago",
    roomName: "Veg Room A",
  },
  {
    id: "2",
    name: "Lights Schedule",
    description: "Turn lights on at 6am and off at 12am",
    isActive: true,
    lastRun: "6 hours ago",
    roomName: "Flower Room 1",
  },
  {
    id: "3",
    name: "Humidity Alert",
    description: "Send notification when humidity exceeds 70%",
    isActive: false,
    lastRun: "2 days ago",
    roomName: "Clone Tent",
  },
];

function WorkflowCard({ workflow }: { workflow: AutomationWorkflow }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              workflow.isActive ? "bg-success/10" : "bg-muted"
            )}
          >
            <Workflow
              className={cn(
                "w-5 h-5",
                workflow.isActive ? "text-success" : "text-muted-foreground"
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{workflow.name}</h3>
            <Badge variant="outline" className="text-xs mt-1">
              {workflow.roomName}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={workflow.isActive ? "Pause" : "Activate"}
          >
            {workflow.isActive ? (
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
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{workflow.description}</p>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
        <Badge
          variant="secondary"
          className={cn(
            workflow.isActive
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
          )}
        >
          {workflow.isActive ? "Active" : "Paused"}
        </Badge>
        <span>Last run: {workflow.lastRun}</span>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
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
          {mockWorkflows.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {mockWorkflows.map((workflow) => (
                <WorkflowCard key={workflow.id} workflow={workflow} />
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
    </AppLayout>
  );
}
