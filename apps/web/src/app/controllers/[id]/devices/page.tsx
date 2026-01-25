"use client";

/**
 * Controller Device Tree View Page
 *
 * Displays a visual tree of a controller with its connected devices,
 * showing animated wire connections and providing device controls.
 */

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { ControllerDeviceTree } from '@/components/controllers/ControllerDeviceTree'
import { AssignRoomDialog } from '@/components/controllers/AssignRoomDialog'
import { ControllerDiagnosticsPanel } from '@/components/controllers/ControllerDiagnosticsPanel'
import { useControllers } from '@/hooks/use-controllers'
import { useRooms } from '@/hooks/use-rooms'
import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ControllerWithRoom } from '@/types'

export default function ControllerDeviceTreePage() {
  const params = useParams()
  const router = useRouter()
  const controllerId = params.id as string

  const { controllers, loading, deleteController, updateController, rooms } = useControllers()
  const { createRoom: createRoomFromHook } = useRooms()
  const [assignRoomController, setAssignRoomController] = useState<ControllerWithRoom | null>(null)
  const [diagnosticsController, setDiagnosticsController] = useState<ControllerWithRoom | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Find the current controller
  const controller = controllers.find((c) => c.id === controllerId)

  const handleOpenAssignRoom = (ctrl: ControllerWithRoom) => {
    setAssignRoomController(ctrl)
  }

  const handleAssignRoomToController = async (ctrlId: string, roomId: string | null) => {
    const result = await updateController(ctrlId, { room_id: roomId })

    if (result.success) {
      toast({
        title: roomId ? 'Room assigned' : 'Removed from room',
        description: roomId
          ? 'The controller has been assigned to the room.'
          : 'The controller has been removed from its room.',
      })
    }
    return result
  }

  const handleCreateRoom = async (name: string) => {
    const result = await createRoomFromHook({ name })
    if (result.success && result.data) {
      return {
        success: true,
        data: { id: result.data.id, name: result.data.name },
      }
    }
    return { success: false, error: result.error || 'Failed to create room' }
  }

  const handleViewDiagnostics = (ctrl: ControllerWithRoom) => {
    setDiagnosticsController(ctrl)
  }

  const handleDelete = async () => {
    if (!controller) return

    const result = await deleteController(controller.id)

    if (result.success) {
      toast({
        title: 'Controller removed',
        description: `${controller.name} has been removed successfully.`,
      })
      router.push('/controllers')
    } else {
      toast({
        title: 'Failed to remove controller',
        description: result.error || 'An unexpected error occurred.',
        variant: 'destructive',
      })
    }

    setDeleteDialogOpen(false)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading controller...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!controller) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Controller Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The controller you are looking for does not exist or has been removed.
            </p>
            <Button onClick={() => router.push('/controllers')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Controllers
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 max-w-7xl">
        <PageHeader
          title={`${controller.name} Device Tree`}
          description="Visual representation of connected devices with real-time controls"
          actions={
            <Button variant="outline" onClick={() => router.push('/controllers')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Controllers
            </Button>
          }
        />

        <div className="mt-8">
          <ControllerDeviceTree
            controller={controller}
            onViewDiagnostics={handleViewDiagnostics}
            onAssignRoom={handleOpenAssignRoom}
            onDelete={() => setDeleteDialogOpen(true)}
            autoRefresh={true}
            refreshInterval={30000}
          />
        </div>

        {/* Assign Room Dialog */}
        <AssignRoomDialog
          controller={assignRoomController}
          open={!!assignRoomController}
          onOpenChange={(open) => !open && setAssignRoomController(null)}
          rooms={rooms}
          onAssign={handleAssignRoomToController}
          onCreateRoom={handleCreateRoom}
        />

        {/* Diagnostics Dialog */}
        {diagnosticsController && (
          <ControllerDiagnosticsPanel
            controller={diagnosticsController}
            open={!!diagnosticsController}
            onOpenChange={(open) => !open && setDiagnosticsController(null)}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Controller?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{controller.name}</strong>?
                This action cannot be undone. All associated data including sensor readings,
                workflows, and schedules will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}
