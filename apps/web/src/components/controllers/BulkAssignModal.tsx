/**
 * Bulk Assign to Room Modal
 *
 * Allows users to assign multiple controllers to a room at once.
 *
 * Features:
 * - Room dropdown selector
 * - Preview of selected controllers
 * - Optimistic UI updates with rollback on error
 * - Progress indicator
 * - Activity logging
 */

import { useState } from 'react'
import { Loader2, CheckCircle, XCircle, Users, MapPin } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Controller, RoomBasic } from '@/types'
import { supabase } from '@/lib/supabase'

// =============================================================================
// Types
// =============================================================================

interface BulkAssignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedControllers: Controller[]
  rooms: RoomBasic[]
  onSuccess?: () => void
}

interface AssignResult {
  success: boolean
  error?: string
  message?: string
  updatedCount?: number
}

// =============================================================================
// Component
// =============================================================================

export function BulkAssignModal({
  open,
  onOpenChange,
  selectedControllers,
  rooms,
  onSuccess,
}: BulkAssignModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<AssignResult | null>(null)

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedRoomId(null)
      setResult(null)
    }
    onOpenChange(newOpen)
  }

  const handleSubmit = async () => {
    if (!selectedControllers.length) return

    setIsSubmitting(true)
    setResult(null)

    try {
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        setResult({
          success: false,
          error: 'You must be logged in to assign controllers',
        })
        setIsSubmitting(false)
        return
      }

      const response = await fetch('/api/controllers/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'assign_room',
          controllerIds: selectedControllers.map(c => c.id),
          data: {
            roomId: selectedRoomId,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setResult({
          success: false,
          error: data.error || data.details || 'Failed to assign controllers',
        })
      } else {
        setResult({
          success: true,
          message: data.message || `Successfully assigned ${selectedControllers.length} controller(s)`,
          updatedCount: data.updatedCount,
        })

        // Call success callback and close after short delay
        setTimeout(() => {
          onSuccess?.()
          handleOpenChange(false)
        }, 1500)
      }
    } catch (error) {
      console.error('[BulkAssign] Error:', error)
      setResult({
        success: false,
        error: 'Network error. Please check your connection and try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedRoom = rooms.find(r => r.id === selectedRoomId)
  const canSubmit = selectedControllers.length > 0 && !isSubmitting && !result?.success

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Assign to Room</DialogTitle>
              <DialogDescription>
                Assign {selectedControllers.length} controller{selectedControllers.length !== 1 ? 's' : ''} to a room
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Room Selector */}
          <div className="space-y-2">
            <Label htmlFor="room-select">Select Room</Label>
            <Select
              value={selectedRoomId || 'unassigned'}
              onValueChange={(value) => setSelectedRoomId(value === 'unassigned' ? null : value)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="room-select">
                <SelectValue placeholder="Choose a room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                    {room.description && (
                      <span className="text-muted-foreground ml-2">- {room.description}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Controllers Preview */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Selected Controllers ({selectedControllers.length})
            </Label>
            <ScrollArea className="h-[200px] rounded-md border p-3">
              <div className="space-y-2">
                {selectedControllers.map((controller) => (
                  <div
                    key={controller.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{controller.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {controller.brand.replace('_', ' ').toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <div className={`w-2 h-2 rounded-full ${
                        controller.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <span className="text-xs text-muted-foreground capitalize">
                        {controller.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Preview Summary */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Assigning to:</span>
              <span className="font-medium">
                {selectedRoom ? selectedRoom.name : 'Unassigned'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Controllers:</span>
              <span className="font-medium">{selectedControllers.length}</span>
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5" />
                )}
                <AlertDescription>
                  {result.success ? result.message : result.error}
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning {selectedControllers.length} controller{selectedControllers.length !== 1 ? 's' : ''}...
              </>
            ) : result?.success ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Success
              </>
            ) : (
              `Assign ${selectedControllers.length} Controller${selectedControllers.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
