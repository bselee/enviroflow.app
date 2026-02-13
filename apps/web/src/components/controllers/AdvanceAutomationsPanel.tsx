/**
 * Advance Automations Panel
 *
 * Displays and manages AC Infinity Advance Automations (time-windowed mode overrides).
 * Allows creating, editing, and deleting automations that sync to AC Infinity cloud.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus,
  Clock,
  Power,
  Loader2,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import type { AdvanceAutomation } from '@/types/modes'

// ============================================
// Types
// ============================================

interface AdvanceAutomationsPanelProps {
  controllerId: string
  controllerName: string
  /** Port to filter automations by (optional) */
  portFilter?: number
  /** Available ports for automation */
  availablePorts: Array<{ port: number; name: string }>
  /** Callback when panel should close */
  onClose?: () => void
  className?: string
}

interface ACAutomation {
  autoId?: string | number
  autoName?: string
  devId: string
  port: number
  isOpen: number
  startTime: string
  endTime: string
  week?: string
  devModeOne: number
  [key: string]: unknown
}

// ============================================
// Constants
// ============================================

const MODE_OPTIONS = [
  { value: 0, label: 'OFF', description: 'Device disabled' },
  { value: 1, label: 'ON', description: 'Continuous operation' },
  { value: 2, label: 'AUTO', description: 'Temperature/humidity triggered' },
  { value: 4, label: 'CYCLE', description: 'Repeating on/off cycles' },
]

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

// ============================================
// Component
// ============================================

export function AdvanceAutomationsPanel({
  controllerId,
  controllerName,
  portFilter,
  availablePorts,
  className,
}: AdvanceAutomationsPanelProps) {
  const [automations, setAutomations] = useState<ACAutomation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<'available' | 'unavailable' | 'unknown'>('unknown')
  const [explorationResults, setExplorationResults] = useState<Record<string, unknown> | null>(null)

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<ACAutomation | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Pending toggle operations to prevent race conditions
  const [pendingToggles, setPendingToggles] = useState<Set<string | number>>(new Set())

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    port: availablePorts[0]?.port || 1,
    enabled: true,
    startTime: '09:00',
    endTime: '17:00',
    days: [0, 1, 2, 3, 4, 5, 6] as number[],
    mode: 2, // AUTO by default
  })

  const supabase = createClient()
  const isMountedRef = useRef(true)

  // ============================================
  // Data Fetching
  // ============================================

  const fetchAutomations = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!isMountedRef.current) return

      if (!session) {
        setError('Not authenticated')
        setIsLoading(false)
        return
      }

      const response = await fetch(`/api/controllers/${controllerId}/automations`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json()

      if (!isMountedRef.current) return

      if (data.success) {
        setAutomations(data.automations || [])
        setApiStatus('available')
        if (data.explorationResults) {
          setExplorationResults(data.explorationResults)
        }
      } else {
        // Check if it's an "API not available" vs actual error
        if (data.error?.includes('not available') || data.error?.includes('endpoints not found')) {
          setApiStatus('unavailable')
          setExplorationResults(data.explorationResults || null)
        } else {
          setError(data.error || 'Failed to fetch automations')
        }
        setAutomations([])
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setAutomations([])
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [controllerId, supabase])

  useEffect(() => {
    isMountedRef.current = true
    fetchAutomations()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchAutomations])

  // ============================================
  // Actions
  // ============================================

  const handleCreate = () => {
    setEditingAutomation(null)
    setFormData({
      name: `Automation ${automations.length + 1}`,
      port: portFilter || availablePorts[0]?.port || 1,
      enabled: true,
      startTime: '09:00',
      endTime: '17:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      mode: 2,
    })
    setIsDialogOpen(true)
  }

  const handleEdit = (automation: ACAutomation) => {
    setEditingAutomation(automation)
    setFormData({
      name: automation.autoName || 'Automation',
      port: automation.port,
      enabled: automation.isOpen === 1,
      startTime: automation.startTime || '09:00',
      endTime: automation.endTime || '17:00',
      days: automation.week
        ? automation.week.split(',').map(d => parseInt(d, 10) - 1) // AC Infinity uses 1-7
        : [0, 1, 2, 3, 4, 5, 6],
      mode: automation.devModeOne,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Not authenticated')
        setIsSaving(false)
        return
      }

      const response = await fetch(`/api/controllers/${controllerId}/automations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...formData,
          ...(editingAutomation?.autoId ? { autoId: editingAutomation.autoId } : {}),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setIsDialogOpen(false)
        fetchAutomations()
      } else {
        setError(data.error || 'Failed to save automation')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle = async (automation: ACAutomation) => {
    // Prevent concurrent toggle requests for the same automation
    if (!automation.autoId) return
    if (pendingToggles.has(automation.autoId)) return

    setPendingToggles(prev => new Set([...prev, automation.autoId!]))

    // Toggle enabled state
    const newState = automation.isOpen === 1 ? 0 : 1

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setPendingToggles(prev => {
          const next = new Set(prev)
          next.delete(automation.autoId!)
          return next
        })
        return
      }

      const response = await fetch(`/api/controllers/${controllerId}/automations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          autoId: automation.autoId,
          name: automation.autoName,
          port: automation.port,
          enabled: newState === 1,
          startTime: automation.startTime,
          endTime: automation.endTime,
          mode: automation.devModeOne,
        }),
      })

      if (response.ok) {
        // Optimistic update
        setAutomations(prev =>
          prev.map(a =>
            a.autoId === automation.autoId
              ? { ...a, isOpen: newState }
              : a
          )
        )
      } else {
        fetchAutomations() // Refresh on error
      }
    } catch (err) {
      console.error('Failed to toggle automation:', err)
      fetchAutomations() // Refresh on error
    } finally {
      setPendingToggles(prev => {
        const next = new Set(prev)
        next.delete(automation.autoId!)
        return next
      })
    }
  }

  // ============================================
  // Helpers
  // ============================================

  const formatTime = (time: string) => {
    if (!time) return '?'
    const [h, m] = time.split(':').map(Number)
    const period = h >= 12 ? 'pm' : 'am'
    const hour = h % 12 || 12
    return `${hour}:${m.toString().padStart(2, '0')}${period}`
  }

  const formatDays = (week?: string) => {
    if (!week) return 'Everyday'
    const days = week.split(',').map(d => parseInt(d, 10) - 1) // AC Infinity uses 1-7
    if (days.length === 7) return 'Everyday'
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays'
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends'
    return days.map(d => DAYS_OF_WEEK[d]?.label || '?').join(', ')
  }

  const getModeName = (modeId: number) => {
    return MODE_OPTIONS.find(m => m.value === modeId)?.label || 'Unknown'
  }

  const getModeColor = (modeId: number) => {
    switch (modeId) {
      case 0: return 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
      case 1: return 'bg-green-500/10 text-green-600 dark:text-green-400'
      case 2: return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      case 4: return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
      default: return 'bg-gray-500/10 text-gray-600'
    }
  }

  const filteredAutomations = portFilter
    ? automations.filter(a => a.port === portFilter)
    : automations

  // ============================================
  // Render
  // ============================================

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Advance Automations
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Time-windowed mode overrides synced to AC Infinity
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAutomations}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            {apiStatus === 'available' && (
              <Button size="sm" onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* API Unavailable State */}
        {!isLoading && apiStatus === 'unavailable' && (
          <Alert variant="default" className="border-amber-500/20 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-sm">Automations API Not Available</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              The AC Infinity cloud API for Advance Automations was not found.
              This feature may not be supported for your controller model, or the API endpoint may have changed.
              <br /><br />
              You can still program modes directly using the <strong>Program Mode</strong> option in each device&apos;s menu.
            </AlertDescription>
          </Alert>
        )}

        {/* Error State */}
        {!isLoading && error && apiStatus !== 'unavailable' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-sm">Error</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Empty State */}
        {!isLoading && apiStatus === 'available' && filteredAutomations.length === 0 && (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No automations configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create time-based mode schedules for your devices
            </p>
            <Button size="sm" variant="outline" className="mt-4" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Create Automation
            </Button>
          </div>
        )}

        {/* Automations List */}
        {!isLoading && filteredAutomations.length > 0 && (
          <div className="space-y-2">
            {filteredAutomations.map((automation) => {
              const portName = availablePorts.find(p => p.port === automation.port)?.name || `Port ${automation.port}`

              return (
                <div
                  key={automation.autoId || `${automation.port}-${automation.startTime}`}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    automation.isOpen === 1
                      ? "bg-card border-border"
                      : "bg-muted/30 border-muted"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {automation.autoName || 'Automation'}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                        {portName}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{formatTime(automation.startTime)} - {formatTime(automation.endTime)}</span>
                      <span>·</span>
                      <Badge className={cn("text-[10px] px-1.5 h-4", getModeColor(automation.devModeOne))}>
                        {getModeName(automation.devModeOne)}
                      </Badge>
                      <span>·</span>
                      <span>{formatDays(automation.week)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleToggle(automation)}
                    >
                      {automation.isOpen === 1 ? (
                        <ToggleRight className="w-4 h-4 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleEdit(automation)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAutomation ? 'Edit Automation' : 'Create Automation'}
            </DialogTitle>
            <DialogDescription>
              Configure a time-windowed mode override for your device
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Veg Auto"
              />
            </div>

            {/* Port */}
            {!portFilter && (
              <div className="space-y-2">
                <Label>Device Port</Label>
                <Select
                  value={String(formData.port)}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, port: parseInt(v, 10) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePorts.map((port) => (
                      <SelectItem key={port.port} value={String(port.port)}>
                        Port {port.port}: {port.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            {/* Days */}
            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-1">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={formData.days.includes(day.value) ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 w-10 text-xs"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        days: prev.days.includes(day.value)
                          ? prev.days.filter(d => d !== day.value)
                          : [...prev.days, day.value].sort()
                      }))
                    }}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Mode */}
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select
                value={String(formData.mode)}
                onValueChange={(v) => setFormData(prev => ({ ...prev, mode: parseInt(v, 10) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((mode) => (
                    <SelectItem key={mode.value} value={String(mode.value)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{mode.label}</span>
                        <span className="text-muted-foreground text-xs">- {mode.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Enabled</Label>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
