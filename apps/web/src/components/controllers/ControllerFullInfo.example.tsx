/**
 * ControllerFullInfo Usage Example
 *
 * Example implementations showing how to integrate the comprehensive
 * controller information panel in different contexts.
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ControllerFullInfo } from './ControllerFullInfo'

// ============================================
// Example 1: As a Modal Dialog
// ============================================

export function ControllerInfoDialogExample() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Info className="w-4 h-4 mr-2" />
          View Full Info
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ControllerFullInfo
          controllerId="your-controller-id"
          controllerName="Grow Tent Controller"
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Example 2: As a Side Sheet
// ============================================

export function ControllerInfoSheetExample() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Info className="w-4 h-4 mr-2" />
          Device Info
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <ControllerFullInfo
          controllerId="your-controller-id"
          controllerName="Grow Tent Controller"
          onClose={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

// ============================================
// Example 3: Standalone in a Page
// ============================================

export function ControllerInfoPageExample() {
  return (
    <div className="container max-w-4xl py-8">
      <ControllerFullInfo
        controllerId="your-controller-id"
        controllerName="Grow Tent Controller"
      />
    </div>
  )
}

// ============================================
// Example 4: In a Controller Card
// ============================================

export function ControllerCardWithInfoExample() {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="space-y-4">
      {/* Your existing controller card */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Grow Tent Controller</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInfo(!showInfo)}
          >
            <Info className="w-4 h-4 mr-2" />
            {showInfo ? 'Hide' : 'Show'} Details
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          AC Infinity Controller 69 - Online
        </p>
      </div>

      {/* Expandable info panel */}
      {showInfo && (
        <ControllerFullInfo
          controllerId="your-controller-id"
          controllerName="Grow Tent Controller"
          onClose={() => setShowInfo(false)}
        />
      )}
    </div>
  )
}

// ============================================
// Example 5: With Dynamic Controller ID
// ============================================

interface DynamicControllerInfoProps {
  controllerId: string
  controllerName: string
}

export function DynamicControllerInfoExample({
  controllerId,
  controllerName,
}: DynamicControllerInfoProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ControllerFullInfo
          controllerId={controllerId}
          controllerName={controllerName}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
