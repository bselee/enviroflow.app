"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Edit } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { StageProgress } from "@/components/diary/StageProgress";
import { CycleFormDialog } from "@/components/diary/CycleFormDialog";
import { DiaryTimeline } from "@/components/diary/DiaryTimeline";
import { EntryFormDialog } from "@/components/diary/EntryFormDialog";
import { useDiaryEntries } from "@/hooks/use-diary-entries";
import type { DiaryCycleWithCounts, DiaryCycleStage, UpdateDiaryCycleInput, DiaryEntryWithPhotos, CreateDiaryEntryInput, UpdateDiaryEntryInput } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  completed: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  archived: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
};

export default function DiaryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cycleId = params.id as string;

  const [cycle, setCycle] = useState<DiaryCycleWithCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntryWithPhotos | null>(null);

  // Use diary entries hook
  const {
    entries,
    loading: entriesLoading,
    createEntry,
    updateEntry,
    deleteEntry,
  } = useDiaryEntries(cycleId);

  // Fetch cycle details
  useEffect(() => {
    async function fetchCycle() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/diaries/${cycleId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Diary cycle not found");
          }
          throw new Error("Failed to load diary cycle");
        }

        const data = await response.json();
        setCycle(data.cycle);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load diary cycle";
        setError(errorMessage);
        console.error("Error fetching cycle:", err);
      } finally {
        setLoading(false);
      }
    }

    if (cycleId) {
      fetchCycle();
    }
  }, [cycleId]);

  const handleBack = () => {
    router.push("/diaries");
  };

  const handleEdit = () => {
    setEditDialogOpen(true);
  };

  const handleStageChange = async (newStage: DiaryCycleStage) => {
    if (!cycle) return;

    try {
      const response = await fetch(`/api/diaries/${cycleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          current_stage: newStage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update stage");
      }

      const data = await response.json();
      setCycle(data.cycle);

      toast.success("Stage updated", {
        description: `Moved to ${newStage} stage.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update stage";
      toast.error("Failed to update stage", {
        description: errorMessage,
      });
    }
  };

  const handleFormSubmit = async (input: UpdateDiaryCycleInput) => {
    try {
      const response = await fetch(`/api/diaries/${cycleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || "Failed to update cycle" };
      }

      const data = await response.json();
      setCycle(data.cycle);

      return { success: true, data: data.cycle };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update cycle";
      return { success: false, error: errorMessage };
    }
  };

  const handleNewEntry = () => {
    setEditingEntry(null);
    setEntryDialogOpen(true);
  };

  const handleEditEntry = (entry: DiaryEntryWithPhotos) => {
    setEditingEntry(entry);
    setEntryDialogOpen(true);
  };

  const handleDeleteEntry = async (entryId: string) => {
    const result = await deleteEntry(entryId);
    if (result.success) {
      toast.success("Entry deleted", {
        description: "The diary entry has been deleted.",
      });
    } else {
      toast.error("Failed to delete entry", {
        description: result.error,
      });
    }
  };

  const handleEntryFormSubmit = async (input: CreateDiaryEntryInput | UpdateDiaryEntryInput) => {
    if (editingEntry) {
      // Update existing entry
      const result = await updateEntry(editingEntry.id, input as UpdateDiaryEntryInput);
      if (result.success) {
        toast.success("Entry updated", {
          description: "Your diary entry has been updated.",
        });
      }
      return result;
    } else {
      // Create new entry
      const result = await createEntry(input as Omit<CreateDiaryEntryInput, "cycle_id">);
      if (result.success) {
        toast.success("Entry created", {
          description: "Your diary entry has been saved.",
        });
      }
      return result;
    }
  };

  // Loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 px-4 max-w-7xl">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error || !cycle) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 px-4 max-w-7xl">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-destructive/10 p-6 mb-4">
              <span className="text-6xl">⚠️</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {error || "Cycle not found"}
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              The diary cycle you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Button onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Diary
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const statusColor = STATUS_COLORS[cycle.status] || STATUS_COLORS.active;

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Diary
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">{cycle.name}</h1>
                <Badge className={cn("border", statusColor)}>
                  {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
                </Badge>
              </div>
              {cycle.description && (
                <p className="text-muted-foreground">{cycle.description}</p>
              )}
            </div>
            <Button onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Stage Progress */}
        <div className="mb-6">
          <StageProgress
            currentStage={cycle.current_stage}
            startedAt={cycle.started_at}
            onStageChange={handleStageChange}
            disabled={cycle.status !== "active"}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="diary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="diary">Diary</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="diary" className="space-y-4">
            <DiaryTimeline
              entries={entries}
              onNewEntry={handleNewEntry}
              onEditEntry={handleEditEntry}
              onDeleteEntry={handleDeleteEntry}
              loading={entriesLoading}
              disabled={cycle.status !== "active"}
            />
          </TabsContent>

          <TabsContent value="photos" className="space-y-4">
            <div className="rounded-lg border bg-card p-8 text-center">
              <span className="text-6xl mb-4 block">📷</span>
              <h3 className="text-lg font-semibold mb-2">Photo Gallery</h3>
              <p className="text-muted-foreground mb-4">
                Photo gallery will be implemented in Phase 3
              </p>
            </div>
          </TabsContent>

          <TabsContent value="charts" className="space-y-4">
            <div className="rounded-lg border bg-card p-8 text-center">
              <span className="text-6xl mb-4 block">📊</span>
              <h3 className="text-lg font-semibold mb-2">Environmental Charts</h3>
              <p className="text-muted-foreground mb-4">
                Sensor and device charts will be implemented in Phase 4
              </p>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Cycle Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Room</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cycle.room?.name || "No room assigned"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Controllers</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cycle.controller_ids?.length || 0} controllers assigned
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Device Logging</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cycle.enable_device_logging ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Sensor Logging</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cycle.enable_sensor_logging ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Started</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(cycle.started_at).toLocaleDateString()}
                  </p>
                </div>
                {cycle.ended_at && (
                  <div>
                    <label className="text-sm font-medium">Ended</label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(cycle.ended_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit cycle dialog */}
        <CycleFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          cycle={cycle}
          onSubmit={handleFormSubmit}
        />

        {/* Entry form dialog */}
        <EntryFormDialog
          open={entryDialogOpen}
          onOpenChange={setEntryDialogOpen}
          entry={editingEntry}
          onSubmit={handleEntryFormSubmit}
        />
      </div>
    </AppLayout>
  );
}
