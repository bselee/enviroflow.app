'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ModeConfiguration } from '@/types'
import { Minus, Plus, Power } from 'lucide-react'

interface OnModeConfigProps {
  config: ModeConfiguration
  onChange: (config: ModeConfiguration) => void
  onSave: () => Promise<void>
  onCancel: () => void
  isSaving?: boolean
}

export function OnModeConfig({
  config,
  onChange,
  onSave,
  onCancel,
  isSaving = false
}: OnModeConfigProps) {
  const [localConfig, setLocalConfig] = useState<ModeConfiguration>(config)

  // Sync local state with prop changes
  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  // Ensure level is set and valid (0-10)
  const currentLevel = Math.max(0, Math.min(10, localConfig.level ?? 5))

  const handleLevelChange = (value: number[]) => {
    const newLevel = value[0]
    const updated = { ...localConfig, level: newLevel }
    setLocalConfig(updated)
    onChange(updated)
  }

  const handleIncrement = () => {
    const newLevel = Math.min(10, currentLevel + 1)
    const updated = { ...localConfig, level: newLevel }
    setLocalConfig(updated)
    onChange(updated)
  }

  const handleDecrement = () => {
    const newLevel = Math.max(0, currentLevel - 1)
    const updated = { ...localConfig, level: newLevel }
    setLocalConfig(updated)
    onChange(updated)
  }

  const getLevelDescription = (level: number): string => {
    if (level === 0) return 'OFF'
    if (level <= 2) return 'Low'
    if (level <= 4) return 'Medium-Low'
    if (level <= 6) return 'Medium'
    if (level <= 8) return 'Medium-High'
    return 'High'
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Power className="h-5 w-5 text-green-500" />
          <CardTitle>ON Mode Configuration</CardTitle>
        </div>
        <CardDescription>
          Device will run continuously at the specified level
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Level Control */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Output Level</label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleDecrement}
                disabled={currentLevel === 0}
                className="h-8 w-8"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="w-16 text-center">
                <div className="text-2xl font-bold">{currentLevel}</div>
                <div className="text-xs text-muted-foreground">0-10</div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleIncrement}
                disabled={currentLevel === 10}
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Slider
            value={[currentLevel]}
            onValueChange={handleLevelChange}
            min={0}
            max={10}
            step={1}
            className="w-full"
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0 (OFF)</span>
            <span>5 (50%)</span>
            <span>10 (100%)</span>
          </div>
        </div>

        {/* Visual Level Indicator */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Power Output</div>
          <div className="h-12 bg-muted rounded-lg overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300 flex items-center justify-center"
              style={{ width: `${(currentLevel / 10) * 100}%` }}
            >
              {currentLevel > 0 && (
                <span className="text-white font-semibold text-sm">
                  {Math.round((currentLevel / 10) * 100)}%
                </span>
              )}
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            {getLevelDescription(currentLevel)}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
          <div className="text-sm font-medium">Configuration Preview</div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Mode:</span>
              <span className="font-medium text-foreground">ON (Continuous)</span>
            </div>
            <div className="flex justify-between">
              <span>Output Level:</span>
              <span className="font-medium text-foreground">
                {currentLevel}/10 ({Math.round((currentLevel / 10) * 100)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span>Behavior:</span>
              <span className="font-medium text-foreground">
                {currentLevel === 0 ? 'Device OFF' : 'Runs continuously'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
