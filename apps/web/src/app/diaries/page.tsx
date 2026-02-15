"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CycleCard } from "@/components/diary/CycleCard";
import { CycleFormDialog } from "@/components/diary/CycleFormDialog";
import { useDiaryCycles } from "@/hooks/use-diary-cycles";
import type { DiaryCycleWithCounts, DiaryCycleStatus } from "@/types";

export default function DiaryPage() {
  const { cycles, loading, error, createCycle, updateCycle, deleteCycle, fetchCycles } = useDiaryCycles();
  const [selectedStatus, setSelectedStatus] = useState<DiaryCycleStatus | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<DiaryCycleWithCounts | null>(null);

  // Filter cycles based on selected status
  const filteredCycles = selectedStatus === "all"
    ? cycles
    : cycles.filter((c) => c.status === selectedStatus);

  const handleCreateCycle = () => {
    setEditingCycle(null);
    setDialogOpen(true);
  };

  const handleEditCycle = (cycle: DiaryCycleWithCounts) => {
    setEditingCycle(cycle);
    setDialogOpen(true);
  };

  const handleArchiveCycle = async (cycleId: string) => {
    const result = await updateCycle(cycleId, { status: "archived" });
    if (result.success) {
      toast.success("Cycle archived", {
        description: "The diary cycle has been archived.",
      });
    } else {
      toast.error("Failed to archive cycle", {
        description: result.error || "Please try again.",
      });
    }
  };

  const handleReactivateCycle = async (cycleId: string) => {
    const result = await updateCycle(cycleId, { status: "active", ended_at: null });
    if (result.success) {
      toast.success("Cycle reactivated", {
        description: "The diary cycle is now active again.",
      });
    } else {
      toast.error("Failed to reactivate cycle", {
        description: result.error || "Please try again.",
      });
    }
  };

  const handleDeleteCycle = async (cycleId: string) => {
    const result = await deleteCycle(cycleId);
    if (result.success) {
      toast.success("Cycle deleted", {
        description: "The diary cycle has been deleted permanently.",
      });
    } else {
      toast.error("Failed to delete cycle", {
        description: result.error || "Please try again.",
      });
    }
  };

  const handleFormSubmit = async (input: Parameters<typeof createCycle>[0]) => {
    if (editingCycle) {
      return await updateCycle(editingCycle.id, input);
    } else {
      return await createCycle(input);
    }
  };

  const handleTabChange = (value: string) => {
    const status = value as DiaryCycleStatus | "all";
    setSelectedStatus(status);
    if (status === "all") {
      fetchCycles();
    } else {
      fetchCycles({ status });
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Diary</h1>
            <p className="text-muted-foreground mt-1">
              Track your growing cycles from seed to harvest
            </p>
          </div>
          <Button onClick={handleCreateCycle}>
            <Plus className="mr-2 h-4 w-4" />
            New Cycle
          </Button>
        </div>

        {/* Filter tabs */}
        <Tabs value={selectedStatus} onValueChange={handleTabChange} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredCycles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <span className="text-6xl">🌱</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {selectedStatus === "all"
                ? "No diary cycles yet"
                : `No ${selectedStatus} cycles`}
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              {selectedStatus === "all"
                ? "Start tracking your growing journey by creating your first cycle."
                : `You don't have any ${selectedStatus} cycles. Try changing the filter or create a new one.`}
            </p>
            {selectedStatus === "all" && (
              <Button onClick={handleCreateCycle}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Cycle
              </Button>
            )}
          </div>
        )}

        {/* Cycles grid */}
        {!loading && filteredCycles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCycles.map((cycle) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                onEdit={handleEditCycle}
                onArchive={handleArchiveCycle}
                onReactivate={handleReactivateCycle}
                onDelete={handleDeleteCycle}
              />
            ))}
          </div>
        )}

        {/* Create/Edit dialog */}
        <CycleFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          cycle={editingCycle}
          onSubmit={handleFormSubmit}
        />
      </div>
    </AppLayout>
  );
}
