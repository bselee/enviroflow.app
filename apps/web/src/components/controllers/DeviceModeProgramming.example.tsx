/**
 * Example usage of DeviceModeProgramming component
 *
 * This demonstrates how to integrate the device mode programming panel
 * into a dialog, modal, or page.
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DeviceModeProgramming } from './DeviceModeProgramming'

export function DeviceModeProgrammingExample() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPort, setSelectedPort] = useState<number>(1)

  // Example controller data
  const controllerId = 'example-controller-123'
  const deviceName = 'Exhaust Fan'
  const deviceType = 'fan'

  return (
    <div className="p-8 space-y-4">
      <h2 className="text-2xl font-bold">Device Mode Programming Example</h2>

      {/* Port selector */}
      <div className="flex gap-2">
        <span className="text-sm font-medium">Select Port:</span>
        {[1, 2, 3, 4].map((port) => (
          <Button
            key={port}
            variant={selectedPort === port ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPort(port)}
          >
            Port {port}
          </Button>
        ))}
      </div>

      {/* Open programming panel button */}
      <Button onClick={() => setIsOpen(true)}>
        Program Port {selectedPort}
      </Button>

      {/* Programming dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Program {deviceName}</DialogTitle>
          </DialogHeader>
          <DeviceModeProgramming
            controllerId={controllerId}
            port={selectedPort}
            deviceType={deviceType}
            deviceName={deviceName}
            onClose={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Example in full page */}
      <div className="mt-8 border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Full Page Example</h3>
        <DeviceModeProgramming
          controllerId={controllerId}
          port={selectedPort}
          deviceType={deviceType}
          deviceName={deviceName}
        />
      </div>
    </div>
  )
}

export default DeviceModeProgrammingExample
