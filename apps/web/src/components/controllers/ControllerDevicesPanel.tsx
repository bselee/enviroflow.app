/**
 * Controller Devices Panel Component
 *
 * Displays all devices for a controller with control interfaces
 */

import { useEffect } from 'react'
import { Loader2, RefreshCw, AlertCircle, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DeviceControlCard } from './DeviceControlCard'
import { useDeviceControl } from '@/hooks/use-device-control'
import { useToast } from '@/hooks/use-toast'

// ============================================
// Types
// ============================================

interface ControllerDevicesPanelProps {
  controllerId: string
  controllerName: string
  autoRefresh?: boolean
  refreshInterval?: number
}

// ============================================
// Component
// ============================================

export function ControllerDevicesPanel({
  controllerId,
  controllerName,
  autoRefresh = false,
  refreshInterval = 30000, // 30 seconds
}: ControllerDevicesPanelProps) {
  const { devices, isLoading, error, controlDevice, refreshDevices } = useDeviceControl(controllerId)
  const { toast } = useToast()

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refreshDevices()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, refreshDevices])

  const handleControl = async (port: number, action: string, value?: number) => {
    const result = await controlDevice(port, action, value)

    if (result.success) {
      toast({
        title: 'Device controlled',
        description: `Successfully executed ${action} on port ${port}`,
      })
    } else {
      toast({
        title: 'Control failed',
        description: result.error || 'Failed to control device',
        variant: 'destructive',
      })
    }

    return result
  }

  const handleRefresh = async () => {
    await refreshDevices()
    toast({
      title: 'Refreshed',
      description: 'Device status updated',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading devices...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        <div className="mt-4 text-center">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12">
        <Cpu className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="text-sm font-medium text-foreground mb-1">
          No devices found
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          This controller does not have any controllable devices configured
        </p>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{controllerName}</h3>
          <p className="text-sm text-muted-foreground">
            {devices.length} device{devices.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map((device) => (
          <DeviceControlCard
            key={device.port}
            device={device}
            onControl={handleControl}
          />
        ))}
      </div>

      <div className="text-xs text-muted-foreground text-center pt-2">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  )
}
