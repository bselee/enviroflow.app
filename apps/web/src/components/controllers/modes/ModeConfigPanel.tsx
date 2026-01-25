/**
 * Dynamic configuration panel for different device modes
 *
 * Renders appropriate controls based on selected mode
 */

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ModeConfiguration, ControllerModeType, DeviceBehavior, TimerType } from '@/types'

export interface ModeConfigPanelProps {
  mode: ControllerModeType
  config: ModeConfiguration
  onChange: (config: Partial<ModeConfiguration>) => void
  className?: string
}

export function ModeConfigPanel({ mode, config, onChange, className }: ModeConfigPanelProps) {
  const updateConfig = (updates: Partial<ModeConfiguration>) => {
    onChange({ ...config, ...updates })
  }

  // Render different panels based on mode
  switch (mode) {
    case 'off':
      return (
        <Card className={className}>
          <CardHeader>
            <CardTitle>OFF Mode</CardTitle>
            <CardDescription>Device is turned off</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No configuration needed. The device will remain off.
            </p>
          </CardContent>
        </Card>
      )

    case 'on':
      return (
        <Card className={className}>
          <CardHeader>
            <CardTitle>ON Mode</CardTitle>
            <CardDescription>Constant speed operation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Speed Level (0-10)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[config.level || 5]}
                  onValueChange={([value]) => updateConfig({ level: value })}
                  min={0}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-8 text-right">{config.level || 5}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )

    case 'auto':
      return (
        <Card className={className}>
          <CardHeader>
            <CardTitle>AUTO Mode</CardTitle>
            <CardDescription>Temperature and humidity based triggers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Device Behavior</Label>
              <Select
                value={config.deviceBehavior || 'cooling'}
                onValueChange={(value) => updateConfig({ deviceBehavior: value as DeviceBehavior })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cooling">Cooling</SelectItem>
                  <SelectItem value="heating">Heating</SelectItem>
                  <SelectItem value="humidify">Humidify</SelectItem>
                  <SelectItem value="dehumidify">Dehumidify</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Temperature High (°F)</Label>
                <Input
                  type="number"
                  value={config.tempTriggerHigh || 80}
                  onChange={(e) => updateConfig({ tempTriggerHigh: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Temperature Low (°F)</Label>
                <Input
                  type="number"
                  value={config.tempTriggerLow || 70}
                  onChange={(e) => updateConfig({ tempTriggerLow: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Humidity High (%)</Label>
                <Input
                  type="number"
                  value={config.humidityTriggerHigh || 60}
                  onChange={(e) => updateConfig({ humidityTriggerHigh: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Humidity Low (%)</Label>
                <Input
                  type="number"
                  value={config.humidityTriggerLow || 40}
                  onChange={(e) => updateConfig({ humidityTriggerLow: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Level (0-10)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={config.maxLevel || 10}
                  onChange={(e) => updateConfig({ maxLevel: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Level (0-10)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={config.minLevel || 1}
                  onChange={(e) => updateConfig({ minLevel: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="transition">Smooth Transition</Label>
              <Switch
                id="transition"
                checked={config.transitionEnabled || false}
                onCheckedChange={(checked) => updateConfig({ transitionEnabled: checked })}
              />
            </div>
          </CardContent>
        </Card>
      )

    case 'vpd':
      return (
        <Card className={className}>
          <CardHeader>
            <CardTitle>VPD Mode</CardTitle>
            <CardDescription>Vapor Pressure Deficit control</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>VPD High (kPa)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.vpdTriggerHigh || 1.2}
                  onChange={(e) => updateConfig({ vpdTriggerHigh: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>VPD Low (kPa)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.vpdTriggerLow || 0.8}
                  onChange={(e) => updateConfig({ vpdTriggerLow: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Leaf Temperature Offset (°F)</Label>
              <Input
                type="number"
                step="0.5"
                value={config.leafTempOffset || -2}
                onChange={(e) => updateConfig({ leafTempOffset: Number(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Level (0-10)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={config.maxLevel || 10}
                  onChange={(e) => updateConfig({ maxLevel: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Level (0-10)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={config.minLevel || 1}
                  onChange={(e) => updateConfig({ minLevel: Number(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )

    case 'timer':
      return (
        <Card className={className}>
          <CardHeader>
            <CardTitle>TIMER Mode</CardTitle>
            <CardDescription>Countdown timer operation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Timer Type</Label>
              <Select
                value={config.timerType || 'on'}
                onValueChange={(value) => updateConfig({ timerType: value as TimerType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">Turn ON after timer</SelectItem>
                  <SelectItem value="off">Turn OFF after timer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration (seconds)</Label>
              <Input
                type="number"
                value={config.timerDuration || 60}
                onChange={(e) => updateConfig({ timerDuration: Number(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>
      )

    case 'cycle':
      return (
        <Card className={className}>
          <CardHeader>
            <CardTitle>CYCLE Mode</CardTitle>
            <CardDescription>Repeating on/off cycles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ON Duration (seconds)</Label>
              <Input
                type="number"
                value={config.cycleOnDuration || 60}
                onChange={(e) => updateConfig({ cycleOnDuration: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>OFF Duration (seconds)</Label>
              <Input
                type="number"
                value={config.cycleOffDuration || 60}
                onChange={(e) => updateConfig({ cycleOffDuration: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Speed Level (0-10)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[config.level || 5]}
                  onValueChange={([value]) => updateConfig({ level: value })}
                  min={0}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-8 text-right">{config.level || 5}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )

    case 'schedule':
      return (
        <Card className={className}>
          <CardHeader>
            <CardTitle>SCHEDULE Mode</CardTitle>
            <CardDescription>Time-based schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={config.scheduleStartTime || '08:00'}
                  onChange={(e) => updateConfig({ scheduleStartTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={config.scheduleEndTime || '20:00'}
                  onChange={(e) => updateConfig({ scheduleEndTime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Active Days</Label>
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <button
                    key={day}
                    onClick={() => {
                      const days = config.scheduleDays || [0, 1, 2, 3, 4, 5, 6]
                      const newDays = days.includes(index)
                        ? days.filter((d) => d !== index)
                        : [...days, index].sort()
                      updateConfig({ scheduleDays: newDays })
                    }}
                    className={`p-2 text-xs rounded ${
                      (config.scheduleDays || [0, 1, 2, 3, 4, 5, 6]).includes(index)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Speed Level (0-10)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[config.level || 5]}
                  onValueChange={([value]) => updateConfig({ level: value })}
                  min={0}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-8 text-right">{config.level || 5}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )

    default:
      return null
  }
}
