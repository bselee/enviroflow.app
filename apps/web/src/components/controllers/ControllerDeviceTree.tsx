/**
 * Controller Device Tree Component
 *
 * Displays a controller card at the top with connected device cards below,
 * visually connected by animated SVG wires. Wire colors indicate device state.
 */

import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, MoreVertical, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConnectedDeviceCard } from './ConnectedDeviceCard'
import { ControllerStatusIndicator } from './ControllerStatusIndicator'
import { DeviceModeProgramming } from './DeviceModeProgramming'
import type { DeviceState } from '@/hooks/use-device-control'
import { cn } from '@/lib/utils'
import { useDeviceControl } from '@/hooks/use-device-control'
import { useToast } from '@/hooks/use-toast'
import type { ControllerWithRoom } from '@/types'

// ============================================
// Types
// ============================================

interface ControllerDeviceTreeProps {
  controller: ControllerWithRoom
  onViewDiagnostics?: (controller: ControllerWithRoom) => void
  onAssignRoom?: (controller: ControllerWithRoom) => void
  onDelete?: (id: string) => void
  autoRefresh?: boolean
  refreshInterval?: number
}

interface WireCoordinates {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

// ============================================
// Helper Functions
// ============================================

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return 'Never'
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return then.toLocaleDateString()
}

function getControllerHealth(status: string, lastSeen: string | null): 'online' | 'offline' {
  if (status === 'online') return 'online'
  if (!lastSeen) return 'offline'

  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  const lastSeenTime = new Date(lastSeen).getTime()

  return lastSeenTime > fiveMinutesAgo ? 'online' : 'offline'
}

// ============================================
// Component
// ============================================

export function ControllerDeviceTree({
  controller,
  onViewDiagnostics,
  onAssignRoom,
  onDelete,
  autoRefresh = false,
  refreshInterval = 30000,
}: ControllerDeviceTreeProps) {
  const { devices, isLoading, error, controlDevice, refreshDevices } = useDeviceControl(controller.id)
  const { toast } = useToast()

  const controllerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [wires, setWires] = useState<WireCoordinates[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [programmingDevice, setProgrammingDevice] = useState<DeviceState | null>(null)

  const health = getControllerHealth(controller.status, controller.last_seen)

  // Handle opening mode programming panel
  const handleProgramDevice = (device: DeviceState) => {
    setProgrammingDevice(device)
  }

  // Auto-refresh devices
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refreshDevices()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, refreshDevices])

  // Calculate wire paths between controller and devices
  useEffect(() => {
    const calculateWires = () => {
      if (!controllerRef.current || !containerRef.current || devices.length === 0) {
        setWires([])
        return
      }

      const controllerRect = controllerRef.current.getBoundingClientRect()
      const containerRect = containerRef.current.getBoundingClientRect()

      // Controller connection point (bottom center)
      const controllerX = controllerRect.left + controllerRect.width / 2 - containerRect.left
      const controllerY = controllerRect.bottom - containerRect.top

      const newWires: WireCoordinates[] = devices.map((device) => {
        const deviceElement = document.getElementById(`device-wire-${controller.id}-${device.port}`)
        if (!deviceElement) {
          return { fromX: controllerX, fromY: controllerY, toX: controllerX, toY: controllerY }
        }

        const deviceRect = deviceElement.getBoundingClientRect()
        const deviceX = deviceRect.left + deviceRect.width / 2 - containerRect.left
        const deviceY = deviceRect.top - containerRect.top

        return {
          fromX: controllerX,
          fromY: controllerY,
          toX: deviceX,
          toY: deviceY,
        }
      })

      setWires(newWires)
    }

    // Calculate on mount and when devices change
    calculateWires()

    // Recalculate on window resize
    const handleResize = () => {
      calculateWires()
    }

    window.addEventListener('resize', handleResize)

    // Also recalculate after a short delay to ensure layout is settled
    const timer = setTimeout(calculateWires, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timer)
    }
  }, [devices, controller.id])

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
    setIsRefreshing(true)
    await refreshDevices()
    setIsRefreshing(false)
    toast({
      title: 'Refreshed',
      description: 'Device states updated',
    })
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Controller Card */}
      <div ref={controllerRef} className="mb-16">
        <Card className={cn(
          'bg-card border transition-all',
          health === 'online' ? 'border-success/30 shadow-sm' : 'border-border'
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-14 h-14 rounded-lg flex items-center justify-center transition-all',
                    health === 'online' ? 'bg-success/10 ring-2 ring-success/20' : 'bg-muted'
                  )}
                >
                  {health === 'online' ? (
                    <Wifi className="w-7 h-7 text-success" />
                  ) : (
                    <WifiOff className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{controller.name}</h3>
                    <ControllerStatusIndicator
                      controller={controller}
                      size="sm"
                      onClick={onViewDiagnostics ? () => onViewDiagnostics(controller) : undefined}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-muted-foreground capitalize">
                      {controller.brand.replace('_', ' ')}
                    </p>
                    {controller.model && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <p className="text-sm font-medium text-foreground">{controller.model}</p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {controller.room && (
                      <Badge variant="outline" className="text-xs">
                        {controller.room.name}
                      </Badge>
                    )}
                    {controller.firmware_version && (
                      <Badge variant="secondary" className="text-xs">
                        FW: {controller.firmware_version}
                      </Badge>
                    )}
                    {devices.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {devices.length} device{devices.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Controller Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {onViewDiagnostics && (
                      <DropdownMenuItem onClick={() => onViewDiagnostics(controller)}>
                        View Diagnostics
                      </DropdownMenuItem>
                    )}

                    {onAssignRoom && (
                      <DropdownMenuItem onClick={() => onAssignRoom(controller)}>
                        Assign to Room
                      </DropdownMenuItem>
                    )}

                    {onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDelete(controller.id)}
                        >
                          Remove Controller
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="text-xs text-muted-foreground">
              Last seen: {formatRelativeTime(controller.last_seen)}
            </div>
            {controller.last_error && (
              <div className="mt-2 text-xs text-destructive line-clamp-2">
                Error: {controller.last_error}
              </div>
            )}
          </CardContent>

          {/* Controller bottom connection point */}
          <div
            id={`controller-wire-${controller.id}`}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 pointer-events-none"
            aria-hidden="true"
          />
        </Card>
      </div>

      {/* SVG Wires */}
      {wires.length > 0 && (
        <svg
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 0 }}
        >
          <defs>
            {/* Gradient for active (on) wires */}
            <linearGradient id="wire-gradient-on" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(160, 84%, 39%)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(160, 84%, 39%)" stopOpacity="0.4" />
            </linearGradient>

            {/* Gradient for inactive (off) wires */}
            <linearGradient id="wire-gradient-off" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(220, 9%, 46%)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(220, 9%, 46%)" stopOpacity="0.1" />
            </linearGradient>

            {/* Glow filter for active wires */}
            <filter id="wire-glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {wires.map((wire, index) => {
            const device = devices[index]
            if (!device) return null

            const isActive = device.isOn
            const strokeColor = isActive ? 'url(#wire-gradient-on)' : 'url(#wire-gradient-off)'
            const strokeWidth = isActive ? 3 : 2

            // Create a curved path using cubic Bezier
            const midY = (wire.fromY + wire.toY) / 2
            const controlPoint1Y = wire.fromY + (midY - wire.fromY) * 0.6
            const controlPoint2Y = wire.toY - (wire.toY - midY) * 0.6

            const pathData = `
              M ${wire.fromX} ${wire.fromY}
              C ${wire.fromX} ${controlPoint1Y},
                ${wire.toX} ${controlPoint2Y},
                ${wire.toX} ${wire.toY}
            `

            return (
              <g key={`wire-${device.port}`}>
                {/* Wire path */}
                <path
                  d={pathData}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  filter={isActive ? 'url(#wire-glow)' : undefined}
                  className={cn(
                    'transition-all duration-300',
                    isActive && 'animate-pulse'
                  )}
                  style={{
                    animationDuration: '2s',
                    animationIterationCount: 'infinite',
                  }}
                />

                {/* Connection dots */}
                <circle
                  cx={wire.fromX}
                  cy={wire.fromY}
                  r={4}
                  fill={isActive ? 'hsl(160, 84%, 39%)' : 'hsl(220, 9%, 46%)'}
                  className="transition-all duration-300"
                />
                <circle
                  cx={wire.toX}
                  cy={wire.toY}
                  r={4}
                  fill={isActive ? 'hsl(160, 84%, 39%)' : 'hsl(220, 9%, 46%)'}
                  className="transition-all duration-300"
                />

                {/* Animated pulse on active wires */}
                {isActive && (
                  <circle
                    cx={wire.fromX}
                    cy={wire.fromY}
                    r={4}
                    fill="hsl(160, 84%, 39%)"
                    opacity="0.6"
                    className="animate-ping"
                    style={{
                      animationDuration: '2s',
                    }}
                  />
                )}
              </g>
            )
          })}
        </svg>
      )}

      {/* Device Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading devices...</p>
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-destructive mb-4">{error}</div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground">No devices found on this controller</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative" style={{ zIndex: 1 }}>
          {devices.map((device) => (
            <ConnectedDeviceCard
              key={device.port}
              device={device}
              onControl={handleControl}
              onProgram={handleProgramDevice}
              wireId={`device-wire-${controller.id}-${device.port}`}
            />
          ))}
        </div>
      )}

      {/* Mode Programming Dialog */}
      {programmingDevice && (
        <Dialog
          open={!!programmingDevice}
          onOpenChange={(open) => !open && setProgrammingDevice(null)}
        >
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Program {programmingDevice.name}</DialogTitle>
              <DialogDescription>
                Configure operating mode for Port {programmingDevice.port}
              </DialogDescription>
            </DialogHeader>
            <DeviceModeProgramming
              controllerId={controller.id}
              port={programmingDevice.port}
              deviceName={programmingDevice.name}
              onClose={() => setProgrammingDevice(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
