/**
 * Device Control Card Component
 *
 * Displays a single device with control interface (on/off, dimmer slider)
 */

import { useState } from 'react'
import { Fan, Lightbulb, Power, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { DeviceState } from '@/hooks/use-device-control'

// ============================================
// Types
// ============================================

interface DeviceControlCardProps {
  device: DeviceState
  onControl: (port: number, action: string, value?: number) => Promise<{ success: boolean; error?: string; actualValue?: number; previousValue?: number }>
  disabled?: boolean
}

// ============================================
// Device Icon Mapping
// ============================================

function getDeviceIcon(deviceType: string) {
  switch (deviceType) {
    case 'fan':
      return Fan
    case 'light':
      return Lightbulb
    case 'outlet':
    case 'heater':
    case 'cooler':
    case 'humidifier':
    case 'dehumidifier':
      return Power
    default:
      return Power
  }
}

function getDeviceColor(deviceType: string, isOn: boolean) {
  if (!isOn) return 'text-muted-foreground'

  switch (deviceType) {
    case 'fan':
      return 'text-blue-500'
    case 'light':
      return 'text-yellow-500'
    case 'heater':
      return 'text-red-500'
    case 'cooler':
      return 'text-cyan-500'
    case 'humidifier':
      return 'text-blue-400'
    case 'dehumidifier':
      return 'text-orange-400'
    default:
      return 'text-green-500'
  }
}

// ============================================
// Component
// ============================================

export function DeviceControlCard({ device, onControl, disabled }: DeviceControlCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [localLevel, setLocalLevel] = useState(device.level)
  const [localIsOn, setLocalIsOn] = useState(device.isOn)

  const Icon = getDeviceIcon(device.deviceType)
  const iconColor = getDeviceColor(device.deviceType, localIsOn)

  const handleToggle = async (checked: boolean) => {
    if (disabled || isUpdating) return

    setIsUpdating(true)
    setLocalIsOn(checked)

    const action = checked ? 'turn_on' : 'turn_off'
    const result = await onControl(device.port, action)

    if (!result.success) {
      // Revert on error
      setLocalIsOn(!checked)
    } else if (result.actualValue !== undefined) {
      setLocalLevel(result.actualValue)
    }

    setIsUpdating(false)
  }

  const handleLevelChange = async (value: number[]) => {
    if (disabled || isUpdating) return

    const newLevel = value[0]
    setLocalLevel(newLevel)

    // Debounce API calls
    if (!device.supportsDimming) return

    setIsUpdating(true)

    const result = await onControl(device.port, 'set_level', newLevel)

    if (!result.success) {
      // Revert on error
      setLocalLevel(device.level)
      setLocalIsOn(device.isOn)
    } else {
      if (result.actualValue !== undefined) {
        setLocalLevel(result.actualValue)
      }
      // Update on/off state based on level
      setLocalIsOn(newLevel > 0)
    }

    setIsUpdating(false)
  }

  const handleLevelCommit = async (_value: number[]) => {
    // This is called when user releases the slider
    // We already handled it in handleLevelChange
  }

  return (
    <Card className={cn(
      "transition-all",
      localIsOn ? "border-primary/50" : "border-border"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              localIsOn ? "bg-primary/10" : "bg-muted"
            )}>
              <Icon className={cn("w-5 h-5 transition-colors", iconColor)} />
            </div>
            <div>
              <CardTitle className="text-base">{device.name}</CardTitle>
              <p className="text-xs text-muted-foreground capitalize">
                {device.deviceType.replace('_', ' ')} - Port {device.port}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUpdating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={localIsOn}
              onCheckedChange={handleToggle}
              disabled={disabled || isUpdating}
            />
          </div>
        </div>
      </CardHeader>

      {device.supportsDimming && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Level</span>
              <span className="font-medium">{localLevel}%</span>
            </div>
            <Slider
              value={[localLevel]}
              onValueChange={handleLevelChange}
              onValueCommit={handleLevelCommit}
              min={device.minLevel}
              max={device.maxLevel}
              step={10}
              disabled={disabled || isUpdating || !localIsOn}
              className={cn(!localIsOn && "opacity-50")}
            />
          </div>
        </CardContent>
      )}
    </Card>
  )
}
