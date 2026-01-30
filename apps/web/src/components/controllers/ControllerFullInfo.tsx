/**
 * Controller Full Info Component
 *
 * Displays comprehensive device information for AC Infinity controllers
 * including metadata, modes, ports, sensors, and device status.
 */

'use client'

import { useEffect, useState } from 'react'
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Copy,
  Wifi,
  WifiOff,
  Cpu,
  Clock,
  Hash,
  Zap,
  Settings,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'

// ============================================
// Types
// ============================================

interface ControllerFullInfoProps {
  controllerId: string
  controllerName: string
  onClose?: () => void
}

interface ControllerMetadata {
  brand: string
  model?: string
  firmwareVersion?: string
  macAddress?: string
  lastOnlineTime?: string
  deviceType?: number
  status?: 'online' | 'offline' | 'error' | 'initializing'
  capabilities?: {
    sensors?: Array<{
      port: number
      name?: string
      type: string
      unit: string
    }>
    devices?: Array<{
      port: number
      name?: string
      type: string
      supportsDimming: boolean
      currentLevel?: number
      isOn?: boolean
      loadType?: number
      externalPort?: number
    }>
    supportsDimming?: boolean
    supportsScheduling?: boolean
    maxPorts?: number
  }
  modes?: Array<{
    modeId: number
    modeName: string
    isActive: boolean
  }>
}

interface FullInfoData {
  success: boolean
  controllerId: string
  controllerName: string
  metadata: ControllerMetadata
  timestamp: string
  error?: string
}

// ============================================
// Component
// ============================================

export function ControllerFullInfo({
  controllerId,
  controllerName,
  onClose,
}: ControllerFullInfoProps) {
  const [data, setData] = useState<FullInfoData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Collapsible states
  const [metadataOpen, setMetadataOpen] = useState(true)
  const [modesOpen, setModesOpen] = useState(true)
  const [portsOpen, setPortsOpen] = useState(true)
  const [sensorsOpen, setSensorsOpen] = useState(true)

  const fetchInfo = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/controllers/${controllerId}/full-info`)

      if (!response.ok) {
        throw new Error(`Failed to fetch controller info: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to retrieve controller information')
      }

      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching controller full info:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerId])

  const handleRefresh = async () => {
    await fetchInfo()
    toast({
      title: 'Refreshed',
      description: 'Controller information updated',
    })
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`,
    })
  }

  const getDeviceTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      fan: '🌀',
      light: '💡',
      outlet: '🔌',
      heater: '🔥',
      cooler: '❄️',
      humidifier: '💧',
      dehumidifier: '🌵',
      pump: '⚙️',
      valve: '🚰',
    }
    return icons[type] || '⚡'
  }

  const getSensorTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      temperature: '🌡️',
      humidity: '💧',
      vpd: '📊',
      co2: '☁️',
      light: '☀️',
      ph: '⚗️',
      ec: '⚡',
      soil_moisture: '🌱',
      pressure: '📈',
      water_level: '🌊',
      wind_speed: '💨',
      pm25: '🌫️',
      uv: '☀️',
      solar_radiation: '☀️',
      rain: '🌧️',
    }
    return icons[type] || '📡'
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Controller Information</CardTitle>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading controller information...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Controller Information</CardTitle>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  const { metadata } = data
  const onlineStatus = metadata.status || 'offline'
  const isOnline = onlineStatus === 'online'

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              {controllerName}
            </CardTitle>
            <CardDescription className="mt-1">
              Complete device information and capabilities
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controller Metadata */}
        <Collapsible open={metadataOpen} onOpenChange={setMetadataOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="font-semibold">Controller Metadata</span>
              </div>
              {metadataOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <div className="space-y-3 rounded-lg border p-4">
              {/* Online Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  Status
                </span>
                <Badge variant={isOnline ? 'default' : 'destructive'}>
                  {isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>

              <Separator />

              {/* Model */}
              {metadata.model && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Model</span>
                    <span className="text-sm text-muted-foreground">{metadata.model}</span>
                  </div>
                  <Separator />
                </>
              )}

              {/* Firmware Version */}
              {metadata.firmwareVersion && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Firmware Version
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {metadata.firmwareVersion}
                    </span>
                  </div>
                  <Separator />
                </>
              )}

              {/* MAC Address */}
              {metadata.macAddress && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      MAC Address
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground font-mono">
                        {metadata.macAddress}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopy(metadata.macAddress!, 'MAC Address')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Device Type */}
              {metadata.deviceType !== undefined && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Device Type Code</span>
                    <span className="text-sm text-muted-foreground">{metadata.deviceType}</span>
                  </div>
                  <Separator />
                </>
              )}

              {/* Last Online Time */}
              {metadata.lastOnlineTime && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Last Seen
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(metadata.lastOnlineTime), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Active Modes/Schedules */}
        {metadata.modes && metadata.modes.length > 0 && (
          <Collapsible open={modesOpen} onOpenChange={setModesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span className="font-semibold">
                    Active Modes ({metadata.modes.filter((m) => m.isActive).length}/
                    {metadata.modes.length})
                  </span>
                </div>
                {modesOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <div className="space-y-2 rounded-lg border p-4">
                {metadata.modes.map((mode, index) => (
                  <div key={mode.modeId}>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        {mode.isActive && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        <span className="text-sm font-medium">{mode.modeName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={mode.isActive ? 'default' : 'outline'} className="text-xs">
                          {mode.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">ID: {mode.modeId}</span>
                      </div>
                    </div>
                    {index < (metadata.modes?.length ?? 0) - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Port/Device Details */}
        {metadata.capabilities?.devices && metadata.capabilities.devices.length > 0 && (
          <Collapsible open={portsOpen} onOpenChange={setPortsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span className="font-semibold">
                    Ports & Devices ({metadata.capabilities.devices.length})
                  </span>
                </div>
                {portsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <div className="space-y-3">
                {metadata.capabilities.devices.map((device, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-3">
                    {/* Port Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getDeviceTypeIcon(device.type)}</span>
                        <div>
                          <h4 className="text-sm font-semibold">
                            {device.name || `Port ${device.port}`}
                          </h4>
                          <p className="text-xs text-muted-foreground capitalize">
                            {device.type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <Badge variant={device.isOn ? 'default' : 'outline'}>
                        {device.isOn ? 'ON' : 'OFF'}
                      </Badge>
                    </div>

                    <Separator />

                    {/* Port Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Port Number:</span>
                        <span className="ml-2 font-medium">{device.port}</span>
                      </div>
                      {device.currentLevel !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Current Level:</span>
                          <span className="ml-2 font-medium">{device.currentLevel}%</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Dimming Support:</span>
                        <span className="ml-2 font-medium">
                          {device.supportsDimming ? 'Yes' : 'No'}
                        </span>
                      </div>
                      {device.loadType !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Load Type:</span>
                          <span className="ml-2 font-medium">{device.loadType}</span>
                        </div>
                      )}
                      {device.externalPort !== undefined && (
                        <div>
                          <span className="text-muted-foreground">External Port:</span>
                          <span className="ml-2 font-medium">{device.externalPort}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Sensor Details */}
        {metadata.capabilities?.sensors && metadata.capabilities.sensors.length > 0 && (
          <Collapsible open={sensorsOpen} onOpenChange={setSensorsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span className="font-semibold">
                    Sensors ({metadata.capabilities.sensors.length})
                  </span>
                </div>
                {sensorsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {metadata.capabilities.sensors.map((sensor, index) => (
                  <div key={index} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getSensorTypeIcon(sensor.type)}</span>
                        <div>
                          <h4 className="text-sm font-semibold capitalize">
                            {sensor.name || sensor.type.replace('_', ' ')}
                          </h4>
                          <p className="text-xs text-muted-foreground">Port {sensor.port}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {sensor.unit}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Capabilities Summary */}
        {metadata.capabilities && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-3">Capabilities Summary</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Max Ports:</span>
                <span className="font-medium">{metadata.capabilities.maxPorts || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dimming Support:</span>
                <span className="font-medium">
                  {metadata.capabilities.supportsDimming ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Scheduling:</span>
                <span className="font-medium">
                  {metadata.capabilities.supportsScheduling ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Devices:</span>
                <span className="font-medium">
                  {metadata.capabilities.devices?.length || 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-center text-xs text-muted-foreground pt-2">
          Last updated: {formatDistanceToNow(new Date(data.timestamp), { addSuffix: true })}
        </div>
      </CardContent>
    </Card>
  )
}
