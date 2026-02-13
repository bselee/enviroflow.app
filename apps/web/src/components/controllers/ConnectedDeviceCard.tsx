/**
 * Connected Device Card Component
 *
 * Individual card for each device (fan, light, outlet, etc.) connected to a controller.
 * Displays device state, provides quick toggle, and includes a menu for device controls.
 */

import { useState, useCallback } from 'react'
import {
  Power,
  MoreVertical,
  Loader2,
  Circle,
  Settings2,
  RotateCcw,
} from 'lucide-react'
import { getPortIconConfig, iconSizes } from '@/config/deviceIcons'
import { Card, CardContent } from '@/components/ui/card'
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
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { DeviceState, DeviceControlOptions, DeviceControlResult } from '@/hooks/use-device-control'

// ============================================
// Types
// ============================================

interface ConnectedDeviceCardProps {
  device: DeviceState
  onControl: (port: number, action: string, value?: number, options?: DeviceControlOptions) => Promise<DeviceControlResult>
  /** Callback to open mode programming panel */
  onProgram?: (device: DeviceState) => void
  disabled?: boolean
  /** Wire connection point ID for SVG path connection */
  wireId: string
}

/** Mode ID to name mapping */
const MODE_NAMES: Record<number, string> = {
  0: 'Off',
  1: 'On',
  2: 'Auto',
  3: 'Timer',
  4: 'Cycle',
  5: 'Schedule',
  6: 'VPD',
  7: 'Advance',
}

// ============================================
// Device Icon Mapping - Uses centralized config
// ============================================

function getDeviceIconConfig(deviceType: string) {
  return getPortIconConfig(deviceType)
}

function getStatusColor(isOn: boolean) {
  return isOn ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
}

// ============================================
// Component
// ============================================

export function ConnectedDeviceCard({
  device,
  onControl,
  onProgram,
  disabled = false,
  wireId,
}: ConnectedDeviceCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [localLevel, setLocalLevel] = useState(device.level)
  const [localIsOn, setLocalIsOn] = useState(device.isOn)
  // Track when native programming was overridden (for showing restore option)
  const [overriddenMode, setOverriddenMode] = useState<{ id: number; name: string } | null>(null)

  const iconConfig = getDeviceIconConfig(device.deviceType)
  const Icon = iconConfig.icon
  const statusColor = getStatusColor(localIsOn)

  // Check if device is currently in manual ON mode but has native programming available
  // This can happen if we overrode native mode or if the device was manually set
  const canRestoreNativeMode = overriddenMode !== null

  const handleQuickToggle = async () => {
    if (disabled || isUpdating) return

    setIsUpdating(true)
    const newState = !localIsOn
    setLocalIsOn(newState)

    const action = newState ? 'turn_on' : 'turn_off'
    const result = await onControl(device.port, action)

    if (!result.success) {
      // Revert on error
      setLocalIsOn(!newState)
    } else if (result.nativeModeOverridden && result.previousMode !== undefined && result.previousModeName) {
      // Track that we overrode native programming
      setOverriddenMode({ id: result.previousMode, name: result.previousModeName })
    }

    setIsUpdating(false)
  }

  const handleRestoreMode = useCallback(async () => {
    if (disabled || isUpdating || !overriddenMode) return

    setIsUpdating(true)

    const result = await onControl(device.port, 'restore_mode', undefined, {
      targetMode: overriddenMode.id,
    })

    if (result.success) {
      // Clear the overridden mode tracker
      setOverriddenMode(null)
    }

    setIsUpdating(false)
  }, [disabled, isUpdating, overriddenMode, onControl, device.port])

  const handleMenuAction = async (action: string, value?: number, options?: DeviceControlOptions) => {
    if (disabled || isUpdating) return

    setIsUpdating(true)

    if (action === 'turn_on') {
      setLocalIsOn(true)
    } else if (action === 'turn_off') {
      setLocalIsOn(false)
    } else if (action === 'set_level' && value !== undefined) {
      setLocalLevel(value)
      setLocalIsOn(value > 0)
    }

    const result = await onControl(device.port, action, value)

    if (!result.success) {
      // Revert on error
      setLocalIsOn(device.isOn)
      setLocalLevel(device.level)
    }

    setIsUpdating(false)
  }

  const handleLevelChange = (value: number[]) => {
    const newLevel = value[0]
    setLocalLevel(newLevel)
  }

  const handleLevelCommit = async (value: number[]) => {
    const newLevel = value[0]
    await handleMenuAction('set_level', newLevel)
  }

  return (
    <Card
      className={cn(
        'transition-all relative group',
        localIsOn
          ? 'border-primary/50 shadow-sm hover:shadow-md'
          : 'border-border hover:border-border/80',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Wire connection point - positioned at top center */}
      <div
        id={wireId}
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 pointer-events-none"
        aria-hidden="true"
      />

      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          {/* Device Icon and Info - Color coded per device type */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all shrink-0"
              style={{
                backgroundColor: localIsOn ? iconConfig.bg : undefined,
                border: localIsOn ? `1px solid ${iconConfig.color}20` : undefined,
              }}
            >
              <Icon
                size={iconSizes.cardHeader}
                style={{ color: localIsOn ? iconConfig.color : '#6b7280' }}
                className="transition-colors"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{device.name}</h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                  Port {device.port}
                </Badge>
                <div className="flex items-center gap-1">
                  <Circle
                    className={cn('w-2 h-2 transition-colors', statusColor)}
                    fill="currentColor"
                  />
                  <span className="text-xs text-muted-foreground capitalize">
                    {localIsOn ? 'On' : 'Off'}
                  </span>
                </div>
                </div>
              {/* Mode info line - matches AC Infinity style: "AUTO · H 75°F / L 54°F · H 54% / L 39%" */}
              {device.mode && device.mode !== 'off' && device.mode !== 'on' && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4 uppercase font-medium",
                      device.mode === 'auto' && "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
                      device.mode === 'vpd' && "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
                      device.mode === 'timer' && "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
                      device.mode === 'cycle' && "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
                      device.mode === 'schedule' && "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",
                    )}
                  >
                    {device.mode}
                  </Badge>
                  {device.modeSummary && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {device.modeSummary}
                    </span>
                  )}
                </div>
              )}
              {/* Simple mode badge for ON mode */}
              {device.mode === 'on' && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4 uppercase font-medium bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20"
                  >
                    ON
                  </Badge>
                  {device.modeSummary && (
                    <span className="text-[10px] text-muted-foreground">
                      {device.modeSummary}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {isUpdating && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}

            {/* Quick Toggle Button */}
            <Button
              variant={localIsOn ? 'default' : 'outline'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleQuickToggle}
              disabled={disabled || isUpdating}
            >
              <Power className="w-4 h-4" />
            </Button>

            {/* Three-Dot Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={disabled || isUpdating}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Device Controls</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => handleMenuAction('turn_on')}>
                  <Power className="w-4 h-4 mr-2 text-green-500" />
                  Turn On
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => handleMenuAction('turn_off')}>
                  <Power className="w-4 h-4 mr-2 text-muted-foreground" />
                  Turn Off
                </DropdownMenuItem>

                {onProgram && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onProgram(device)}>
                      <Settings2 className="w-4 h-4 mr-2 text-blue-500" />
                      Program Mode
                    </DropdownMenuItem>
                  </>
                )}

                {/* Restore native programming option - shown when mode was overridden */}
                {canRestoreNativeMode && overriddenMode && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleRestoreMode}
                      className="text-amber-600 dark:text-amber-400"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Restore {overriddenMode.name} Mode
                    </DropdownMenuItem>
                  </>
                )}

                {device.supportsDimming && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Dimming Control</DropdownMenuLabel>
                    <div className="px-2 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Level</span>
                        <span className="text-xs font-medium">{localLevel}%</span>
                      </div>
                      <Slider
                        value={[localLevel]}
                        onValueChange={handleLevelChange}
                        onValueCommit={handleLevelCommit}
                        min={device.minLevel}
                        max={device.maxLevel}
                        step={10}
                        disabled={disabled || isUpdating}
                        className="cursor-pointer"
                      />
                      <div className="flex justify-between mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleMenuAction('set_level', 0)}
                          disabled={disabled || isUpdating}
                        >
                          0%
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleMenuAction('set_level', 50)}
                          disabled={disabled || isUpdating}
                        >
                          50%
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleMenuAction('set_level', 100)}
                          disabled={disabled || isUpdating}
                        >
                          100%
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-medium capitalize">
                      {device.deviceType.replace('_', ' ')}
                    </span>
                  </div>
                  {device.supportsDimming && (
                    <div className="flex justify-between mt-1">
                      <span>Range:</span>
                      <span className="font-medium">
                        {device.minLevel}% - {device.maxLevel}%
                      </span>
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Inline Dimmer (shown when device is dimmable and on) */}
        {device.supportsDimming && localIsOn && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground">Brightness</span>
              <span className="font-medium">{localLevel}%</span>
            </div>
            <Slider
              value={[localLevel]}
              onValueChange={handleLevelChange}
              onValueCommit={handleLevelCommit}
              min={device.minLevel}
              max={device.maxLevel}
              step={10}
              disabled={disabled || isUpdating}
              className={cn('cursor-pointer')}
            />
          </div>
        )}

        {/* Current State Badge */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Current State</span>
          <Badge
            variant={localIsOn ? 'default' : 'secondary'}
            className={cn('text-xs h-5', localIsOn && 'bg-green-500 hover:bg-green-600')}
          >
            {localIsOn ? (device.supportsDimming ? `${localLevel}%` : 'Active') : 'Inactive'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
