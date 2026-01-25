'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ModeConfiguration, DeviceBehavior } from '@/types'
import { Thermometer, Droplets, Settings2, TrendingUp, TrendingDown } from 'lucide-react'

interface AutoModeConfigProps {
  config: ModeConfiguration
  onChange: (config: ModeConfiguration) => void
  onSave: () => Promise<void>
  onCancel: () => void
  isSaving?: boolean
}

export function AutoModeConfig({
  config,
  onChange,
  onSave,
  onCancel,
  isSaving = false
}: AutoModeConfigProps) {
  const [localConfig, setLocalConfig] = useState<ModeConfiguration>(config)

  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  const updateConfig = (updates: Partial<ModeConfiguration>) => {
    const updated = { ...localConfig, ...updates }
    setLocalConfig(updated)
    onChange(updated)
  }

  // Set sensible defaults
  const deviceBehavior = localConfig.deviceBehavior ?? 'cooling'
  const tempHigh = localConfig.tempTriggerHigh ?? 80
  const tempLow = localConfig.tempTriggerLow ?? 70
  const humidityHigh = localConfig.humidityTriggerHigh ?? 60
  const humidityLow = localConfig.humidityTriggerLow ?? 40
  const maxLevel = localConfig.maxLevel ?? 10
  const minLevel = localConfig.minLevel ?? 0
  const transitionEnabled = localConfig.transitionEnabled ?? false
  const transitionSpeed = localConfig.transitionSpeed ?? 60
  const bufferEnabled = localConfig.bufferEnabled ?? false
  const bufferValue = localConfig.bufferValue ?? 2

  const getBehaviorIcon = (behavior: DeviceBehavior) => {
    switch (behavior) {
      case 'cooling':
      case 'dehumidify':
        return <TrendingDown className="h-4 w-4" />
      case 'heating':
      case 'humidify':
        return <TrendingUp className="h-4 w-4" />
    }
  }

  const getBehaviorDescription = (behavior: DeviceBehavior): string => {
    switch (behavior) {
      case 'cooling':
        return 'Device activates when temperature is above high threshold'
      case 'heating':
        return 'Device activates when temperature is below low threshold'
      case 'humidify':
        return 'Device activates when humidity is below low threshold'
      case 'dehumidify':
        return 'Device activates when humidity is above high threshold'
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-blue-500" />
          <CardTitle>AUTO Mode Configuration</CardTitle>
        </div>
        <CardDescription>
          Device responds automatically to temperature and humidity conditions
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Device Behavior */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Device Type</label>
          <Select
            value={deviceBehavior}
            onValueChange={(value) => updateConfig({ deviceBehavior: value as DeviceBehavior })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cooling">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Cooling (Fan, AC)
                </div>
              </SelectItem>
              <SelectItem value="heating">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Heating
                </div>
              </SelectItem>
              <SelectItem value="dehumidify">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Dehumidifier
                </div>
              </SelectItem>
              <SelectItem value="humidify">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Humidifier
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {getBehaviorDescription(deviceBehavior)}
          </p>
        </div>

        {/* Temperature Triggers */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Temperature Triggers</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">High Threshold (°F)</label>
              <Input
                type="number"
                value={tempHigh}
                onChange={(e) => updateConfig({ tempTriggerHigh: parseFloat(e.target.value) })}
                min={32}
                max={120}
                step={0.1}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Low Threshold (°F)</label>
              <Input
                type="number"
                value={tempLow}
                onChange={(e) => updateConfig({ tempTriggerLow: parseFloat(e.target.value) })}
                min={32}
                max={120}
                step={0.1}
              />
            </div>
          </div>
        </div>

        {/* Humidity Triggers */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Humidity Triggers</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">High Threshold (%)</label>
              <Input
                type="number"
                value={humidityHigh}
                onChange={(e) => updateConfig({ humidityTriggerHigh: parseFloat(e.target.value) })}
                min={0}
                max={100}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Low Threshold (%)</label>
              <Input
                type="number"
                value={humidityLow}
                onChange={(e) => updateConfig({ humidityTriggerLow: parseFloat(e.target.value) })}
                min={0}
                max={100}
                step={1}
              />
            </div>
          </div>
        </div>

        {/* Level Settings */}
        <div className="space-y-4">
          <div className="text-sm font-medium">Output Level Range</div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Minimum Level: {minLevel}/10</span>
              <span className="text-muted-foreground">Maximum Level: {maxLevel}/10</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Slider
                value={[minLevel]}
                onValueChange={(val) => updateConfig({ minLevel: val[0] })}
                min={0}
                max={10}
                step={1}
              />
              <Slider
                value={[maxLevel]}
                onValueChange={(val) => updateConfig({ maxLevel: val[0] })}
                min={0}
                max={10}
                step={1}
              />
            </div>
          </div>
        </div>

        {/* Transition Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Gradual Transitions</div>
              <div className="text-xs text-muted-foreground">
                Ramp up/down gradually instead of instant changes
              </div>
            </div>
            <Switch
              checked={transitionEnabled}
              onCheckedChange={(checked) => updateConfig({ transitionEnabled: checked })}
            />
          </div>

          {transitionEnabled && (
            <div className="space-y-2 ml-6">
              <label className="text-sm text-muted-foreground">Transition Speed (seconds)</label>
              <Input
                type="number"
                value={transitionSpeed}
                onChange={(e) => updateConfig({ transitionSpeed: parseInt(e.target.value) })}
                min={10}
                max={300}
                step={10}
              />
            </div>
          )}
        </div>

        {/* Buffer Settings (Hysteresis) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Buffer Zone (Hysteresis)</div>
              <div className="text-xs text-muted-foreground">
                Prevents rapid on/off cycling near thresholds
              </div>
            </div>
            <Switch
              checked={bufferEnabled}
              onCheckedChange={(checked) => updateConfig({ bufferEnabled: checked })}
            />
          </div>

          {bufferEnabled && (
            <div className="space-y-2 ml-6">
              <label className="text-sm text-muted-foreground">Buffer Value (±)</label>
              <Input
                type="number"
                value={bufferValue}
                onChange={(e) => updateConfig({ bufferValue: parseFloat(e.target.value) })}
                min={0.5}
                max={10}
                step={0.5}
              />
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2">
            {getBehaviorIcon(deviceBehavior)}
            <div className="text-sm font-medium">Configuration Preview</div>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Mode:</span>
              <span className="font-medium text-foreground">AUTO ({deviceBehavior})</span>
            </div>
            <div className="flex justify-between">
              <span>Temperature Range:</span>
              <span className="font-medium text-foreground">{tempLow}°F - {tempHigh}°F</span>
            </div>
            <div className="flex justify-between">
              <span>Humidity Range:</span>
              <span className="font-medium text-foreground">{humidityLow}% - {humidityHigh}%</span>
            </div>
            <div className="flex justify-between">
              <span>Output Range:</span>
              <span className="font-medium text-foreground">{minLevel} - {maxLevel}</span>
            </div>
            {transitionEnabled && (
              <div className="flex justify-between">
                <span>Transitions:</span>
                <span className="font-medium text-foreground">{transitionSpeed}s ramp</span>
              </div>
            )}
            {bufferEnabled && (
              <div className="flex justify-between">
                <span>Buffer:</span>
                <span className="font-medium text-foreground">±{bufferValue}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button onClick={onSave} disabled={isSaving} className="flex-1">
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
          <Button onClick={onCancel} variant="outline" disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
