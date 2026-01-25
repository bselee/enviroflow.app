/**
 * Bulk Delete Modal
 *
 * Allows users to delete multiple controllers at once.
 *
 * Features:
 * - Confirmation with controller preview
 * - Option to delete associated sensor data
 * - Warning about affected workflows
 * - Cascade delete of schedules and data
 * - Activity logging
 */

import { useState } from 'react'
import { Loader2, Trash2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { Controller } from '@/types'
import { supabase } from '@/lib/supabase'

// =============================================================================
// Types
// =============================================================================

interface BulkDeleteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedControllers: Controller[]
  onSuccess?: () => void
}

interface DeleteResult {
  success: boolean
  error?: string
  message?: string
  deletedCount?: number
  affectedWorkflows?: string[]
  deletedData?: boolean
}

// =============================================================================
// Component
// =============================================================================

export function BulkDeleteModal({
  open,
  onOpenChange,
  selectedControllers,
  onSuccess,
}: BulkDeleteModalProps) {
  const [deleteData, setDeleteData] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [result, setResult] = useState<DeleteResult | null>(null)

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDeleteData(false)
      setResult(null)
    }
    onOpenChange(newOpen)
  }

  const handleDelete = async () => {
    if (!selectedControllers.length) return

    setIsDeleting(true)
    setResult(null)

    try {
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        setResult({
          success: false,
          error: 'You must be logged in to delete controllers',
        })
        setIsDeleting(false)
        return
      }

      const response = await fetch('/api/controllers/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          controllerIds: selectedControllers.map(c => c.id),
          data: {
            deleteData,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setResult({
          success: false,
          error: data.error || data.details || 'Failed to delete controllers',
        })
      } else {
        setResult({
          success: true,
          message: data.message || `Successfully deleted ${selectedControllers.length} controller(s)`,
          deletedCount: data.deletedCount,
          affectedWorkflows: data.affectedWorkflows || [],
          deletedData: data.deletedData,
        })

        // Call success callback and close after short delay
        setTimeout(() => {
          onSuccess?.()
          handleOpenChange(false)
        }, 2000)
      }
    } catch (error) {
      console.error('[BulkDelete] Error:', error)
      setResult({
        success: false,
        error: 'Network error. Please check your connection and try again.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const canDelete = selectedControllers.length > 0 && !isDeleting && !result?.success

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Delete Controllers</DialogTitle>
              <DialogDescription>
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Alert */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You are about to delete {selectedControllers.length} controller{selectedControllers.length !== 1 ? 's' : ''}.
              This action is permanent and cannot be undone.
            </AlertDescription>
          </Alert>

          {/* Controllers to Delete */}
          <div className="space-y-2">
            <Label>Controllers to Delete</Label>
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
                        {controller.model && ` - ${controller.model}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <div className={`w-2 h-2 rounded-full ${
                        controller.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Delete Data Option */}
          <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/50">
            <Checkbox
              id="delete-data"
              checked={deleteData}
              onCheckedChange={(checked) => setDeleteData(checked === true)}
              disabled={isDeleting}
            />
            <div className="flex-1 space-y-1">
              <Label
                htmlFor="delete-data"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Also delete associated sensor data
              </Label>
              <p className="text-xs text-muted-foreground">
                This will permanently delete all sensor readings and dimmer schedules for these controllers.
                If unchecked, historical data will be retained but orphaned.
              </p>
            </div>
          </div>

          {/* Cascade Information */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm space-y-2">
              <p className="font-medium">What will be deleted:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>{selectedControllers.length} controller{selectedControllers.length !== 1 ? 's' : ''}</li>
                {deleteData && (
                  <>
                    <li>All sensor readings for these controllers</li>
                    <li>All dimmer schedules for these controllers</li>
                  </>
                )}
                <li>References in workflows (workflows themselves will not be deleted)</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Result Display */}
          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <AlertDescription className="font-medium">
                    {result.success ? result.message : result.error}
                  </AlertDescription>
                  {result.success && result.affectedWorkflows && result.affectedWorkflows.length > 0 && (
                    <AlertDescription className="text-sm">
                      Affected workflows ({result.affectedWorkflows.length}): {result.affectedWorkflows.join(', ')}
                      <br />
                      <span className="text-xs opacity-90">
                        These workflows still exist but may have broken references. Please review them.
                      </span>
                    </AlertDescription>
                  )}
                </div>
              </div>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : result?.success ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Deleted
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {selectedControllers.length} Controller{selectedControllers.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
