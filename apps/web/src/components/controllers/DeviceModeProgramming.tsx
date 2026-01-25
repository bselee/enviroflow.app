/**
 * Main device mode programming panel
 *
 * Integrates mode selector, sensor gauges, and configuration panels
 * for comprehensive device programming interface
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Save, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useDeviceMode } from '@/hooks/use-device-mode'
import { ModeSelector } from './modes/ModeSelector'
import { ModeConfigPanel } from './modes/ModeConfigPanel'
import { SensorGaugePanel } from './gauges/SensorGaugePanel'
import type { ModeConfiguration, ControllerModeType } from '@/types'
import { cn } from '@/lib/utils'

export interface DeviceModeProgrammingProps {
  controllerId: string
  port: number | 'all'
  deviceType?: string
  deviceName: string
  onClose?: () => void
  className?: string
}

export function DeviceModeProgramming({
  controllerId,
  port,
  deviceName,
  onClose,
  className,
}: DeviceModeProgrammingProps) {
  const { toast } = useToast()
  const {
    modeState,
    sensorReadings,
    isLoading,
    error,
    updateMode,
  } = useDeviceMode(controllerId, port)

  // Local state for draft configuration
  const [selectedMode, setSelectedMode] = useState<ControllerModeType>('off')
  const [draftConfig, setDraftConfig] = useState<ModeConfiguration>({ mode: 'off' })
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Initialize from fetched state
  useEffect(() => {
    if (modeState?.currentMode) {
      setSelectedMode(modeState.currentMode.mode)
      setDraftConfig(modeState.currentMode)
      setHasUnsavedChanges(false)
    }
  }, [modeState])

  // Get latest sensor readings for gauges
  const latestSensorData = useMemo(() => {
    const temperature = sensorReadings.find((r) => r.sensor_type === 'temperature')
    const humidity = sensorReadings.find((r) => r.sensor_type === 'humidity')
    const vpd = sensorReadings.find((r) => r.sensor_type === 'vpd')

    return {
      temperature: temperature?.value,
      humidity: humidity?.value,
      vpd: vpd?.value,
    }
  }, [sensorReadings])

  // Handle mode change
  const handleModeChange = (mode: ControllerModeType) => {
    setSelectedMode(mode)
    setDraftConfig((prev) => ({ ...prev, mode }))
    setHasUnsavedChanges(true)
  }

  // Handle config updates
  const handleConfigChange = (updates: Partial<ModeConfiguration>) => {
    setDraftConfig((prev) => ({ ...prev, ...updates }))
    setHasUnsavedChanges(true)
  }

  // Save configuration
  const handleSave = async () => {
    if (port === 'all') {
      toast({
        title: 'Invalid Selection',
        description: 'Please select a specific port to program.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await updateMode(draftConfig)

      if (result.success) {
        toast({
          title: 'Mode Updated',
          description: `Successfully updated ${deviceName} to ${selectedMode.toUpperCase()} mode.`,
        })
        setHasUnsavedChanges(false)
        onClose?.()
      } else {
        toast({
          title: 'Update Failed',
          description: result.error || 'Failed to update device mode.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to last saved state
  const handleReset = () => {
    if (modeState?.currentMode) {
      setSelectedMode(modeState.currentMode.mode)
      setDraftConfig(modeState.currentMode)
      setHasUnsavedChanges(false)
      toast({
        title: 'Changes Discarded',
        description: 'Configuration reset to last saved state.',
      })
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hasUnsavedChanges) {
          const confirm = window.confirm('You have unsaved changes. Discard them?')
          if (!confirm) return
        }
        onClose?.()
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (hasUnsavedChanges && !isSaving) {
          handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedChanges, isSaving, onClose])

  // Warn on close with unsaved changes
  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm('You have unsaved changes. Discard them?')
      if (!confirm) return
    }
    onClose?.()
  }

  if (port === 'all') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Master Control</CardTitle>
          <CardDescription>
            Select a specific port to program individual device modes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use the port selector below to choose which device to program. You can program each
            port independently with different modes and settings.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Device Mode Programming</h2>
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-orange-500 border-orange-500">
                Unsaved Changes
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {deviceName} - Port {port}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content */}
      {!isLoading && !error && modeState && (
        <>
          {/* Desktop layout: side-by-side */}
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
            {/* Left: Mode selector and gauges */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Select Mode</CardTitle>
                  <CardDescription>Choose device operating mode</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <ModeSelector
                    currentMode={selectedMode}
                    onModeChange={handleModeChange}
                    temperature={latestSensorData.temperature}
                    humidity={latestSensorData.humidity}
                    vpd={latestSensorData.vpd}
                    size="md"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Current Conditions</CardTitle>
                  <CardDescription>Live sensor readings</CardDescription>
                </CardHeader>
                <CardContent>
                  <SensorGaugePanel readings={sensorReadings} />
                </CardContent>
              </Card>
            </div>

            {/* Right: Configuration panel */}
            <div className="space-y-6">
              <ModeConfigPanel
                mode={selectedMode}
                config={draftConfig}
                onChange={handleConfigChange}
              />

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges || isSaving}
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={!hasUnsavedChanges || isSaving}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile/Tablet layout: tabs */}
          <div className="lg:hidden">
            <Tabs defaultValue="mode" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="mode">Mode</TabsTrigger>
                <TabsTrigger value="config">Settings</TabsTrigger>
                <TabsTrigger value="sensors">Sensors</TabsTrigger>
              </TabsList>

              <TabsContent value="mode" className="space-y-4">
                <Card>
                  <CardContent className="pt-6 flex justify-center">
                    <ModeSelector
                      currentMode={selectedMode}
                      onModeChange={handleModeChange}
                      temperature={latestSensorData.temperature}
                      humidity={latestSensorData.humidity}
                      vpd={latestSensorData.vpd}
                      size="md"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="config" className="space-y-4">
                <ModeConfigPanel
                  mode={selectedMode}
                  config={draftConfig}
                  onChange={handleConfigChange}
                />
              </TabsContent>

              <TabsContent value="sensors" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <SensorGaugePanel readings={sensorReadings} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Separator className="my-4" />

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving}
                className="flex-1"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasUnsavedChanges || isSaving}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-muted-foreground text-center">
        Press <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> to close or{' '}
        <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+S</kbd> to save
      </div>
    </div>
  )
}
