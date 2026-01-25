/**
 * DimmerScheduleForm Component
 *
 * Form for creating and editing sunrise/sunset dimming schedules.
 *
 * Features:
 * - Schedule type selection (sunrise, sunset, custom time)
 * - Dimming curve selection with live preview
 * - Start/target intensity sliders
 * - Duration configuration
 * - Day of week selection
 * - Offset from sunrise/sunset
 * - Real-time curve visualization
 */
"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Sun,
  Sunset,
  Clock,
  Lightbulb,
  TrendingUp,
  Calendar,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HelpTooltip } from "@/components/ui/HelpTooltip"
import { cn } from "@/lib/utils"
import {
  generateCurvePreview,
  getCurveDescription,
  type DimmerCurveType,
} from "@/lib/dimming-curves"
import type { DimmerScheduleType } from "@/types"

// Form validation schema
const dimmerScheduleSchema = z.object({
  name: z.string().min(1, "Schedule name is required").max(100),
  description: z.string().max(500).optional(),
  controller_id: z.string().uuid("Please select a controller"),
  device_port: z.number().min(1, "Device port is required"),
  schedule_type: z.enum(["sunrise", "sunset", "custom", "dli_curve"]),
  start_time: z.string().optional(),
  offset_minutes: z.number().min(-120).max(120).optional(),
  duration_minutes: z.number().min(1).max(480),
  start_intensity: z.number().min(0).max(100),
  target_intensity: z.number().min(0).max(100),
  curve: z.enum(["linear", "sigmoid", "exponential", "logarithmic"]),
  days: z.array(z.number().min(0).max(6)).min(1, "Select at least one day"),
  is_active: z.boolean().default(true),
})

type DimmerScheduleFormData = z.infer<typeof dimmerScheduleSchema>

interface DimmerScheduleFormProps {
  onSubmit: (data: DimmerScheduleFormData) => Promise<void>
  onCancel: () => void
  controllers: Array<{
    id: string
    name: string
    brand: string
    capabilities: {
      devices?: Array<{ port: number; type: string; supportsDimming: boolean }>
    }
  }>
  rooms?: Array<{
    id: string
    name: string
    latitude: number | null
    longitude: number | null
  }>
  initialData?: Partial<DimmerScheduleFormData>
  isLoading?: boolean
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
]

const CURVE_TYPES: Array<{ value: DimmerCurveType; label: string }> = [
  { value: "linear", label: "Linear" },
  { value: "sigmoid", label: "Natural (S-Curve)" },
  { value: "exponential", label: "Exponential" },
  { value: "logarithmic", label: "Logarithmic" },
]

export function DimmerScheduleForm({
  onSubmit,
  onCancel,
  controllers,
  rooms: _rooms,
  initialData,
  isLoading = false,
}: DimmerScheduleFormProps) {
  const [selectedDays, setSelectedDays] = useState<number[]>(
    initialData?.days || [0, 1, 2, 3, 4, 5, 6]
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DimmerScheduleFormData>({
    resolver: zodResolver(dimmerScheduleSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      controller_id: initialData?.controller_id || "",
      device_port: initialData?.device_port || 1,
      schedule_type: initialData?.schedule_type || "sunrise",
      start_time: initialData?.start_time || "08:00",
      offset_minutes: initialData?.offset_minutes || 0,
      duration_minutes: initialData?.duration_minutes || 60,
      start_intensity: initialData?.start_intensity || 0,
      target_intensity: initialData?.target_intensity || 100,
      curve: initialData?.curve || "sigmoid",
      days: initialData?.days || [0, 1, 2, 3, 4, 5, 6],
      is_active: initialData?.is_active ?? true,
    },
  })

  const watchScheduleType = watch("schedule_type")
  const watchCurve = watch("curve")
  const watchStartIntensity = watch("start_intensity")
  const watchTargetIntensity = watch("target_intensity")
  const watchControllerId = watch("controller_id")
  const watchDuration = watch("duration_minutes")

  // Get available dimming devices for selected controller
  const availableDevices = useMemo(() => {
    if (!watchControllerId) return []

    const controller = controllers.find(c => c.id === watchControllerId)
    if (!controller) return []

    return (
      controller.capabilities.devices?.filter(d => d.supportsDimming) || []
    )
  }, [watchControllerId, controllers])

  // Generate curve preview data
  const curvePreviewData = useMemo(() => {
    return generateCurvePreview(watchCurve, 100)
  }, [watchCurve])

  // Toggle day selection
  const toggleDay = (day: number) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day].sort()

    setSelectedDays(newDays)
    setValue("days", newDays)
  }

  // Handle form submission
  const handleFormSubmit = async (data: DimmerScheduleFormData) => {
    try {
      await onSubmit(data)
    } catch (error) {
      console.error("Failed to submit schedule:", error)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">
            Schedule Name
            <span className="text-destructive ml-1">*</span>
          </Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="Morning Sunrise"
            className={cn(errors.name && "border-destructive")}
          />
          {errors.name && (
            <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <Input
            id="description"
            {...register("description")}
            placeholder="Gradually increase light intensity to simulate sunrise"
          />
        </div>
      </div>

      {/* Controller & Device Selection */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="controller_id">
            Controller
            <span className="text-destructive ml-1">*</span>
          </Label>
          <Select
            value={watchControllerId}
            onValueChange={value => setValue("controller_id", value)}
          >
            <SelectTrigger className={cn(errors.controller_id && "border-destructive")}>
              <SelectValue placeholder="Select controller" />
            </SelectTrigger>
            <SelectContent>
              {controllers.map(controller => (
                <SelectItem key={controller.id} value={controller.id}>
                  {controller.name} ({controller.brand})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.controller_id && (
            <p className="text-sm text-destructive mt-1">
              {errors.controller_id.message}
            </p>
          )}
        </div>

        {watchControllerId && availableDevices.length > 0 && (
          <div>
            <Label htmlFor="device_port">
              Dimming Device
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Select
              value={watch("device_port")?.toString()}
              onValueChange={value => setValue("device_port", parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select device port" />
              </SelectTrigger>
              <SelectContent>
                {availableDevices.map(device => (
                  <SelectItem key={device.port} value={device.port.toString()}>
                    Port {device.port} ({device.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {watchControllerId && availableDevices.length === 0 && (
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
            <Info className="w-4 h-4 inline mr-2" />
            This controller does not have any dimming-capable devices
          </div>
        )}
      </div>

      {/* Schedule Type */}
      <div>
        <Label>
          Schedule Type
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Tabs
          value={watchScheduleType}
          onValueChange={value =>
            setValue("schedule_type", value as DimmerScheduleType)
          }
          className="mt-2"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sunrise">
              <Sun className="w-4 h-4 mr-2" />
              Sunrise
            </TabsTrigger>
            <TabsTrigger value="sunset">
              <Sunset className="w-4 h-4 mr-2" />
              Sunset
            </TabsTrigger>
            <TabsTrigger value="custom">
              <Clock className="w-4 h-4 mr-2" />
              Custom Time
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sunrise" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Automatically trigger at sunrise. Requires room location.
            </p>
            <div>
              <Label htmlFor="offset_minutes">
                Offset (minutes)
                <HelpTooltip id="schedule-offset-sunrise" content={{ description: "Adjust start time before (-) or after (+) sunrise" }} />
              </Label>
              <Input
                id="offset_minutes"
                type="number"
                {...register("offset_minutes", { valueAsNumber: true })}
                placeholder="0"
                min={-120}
                max={120}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Range: -120 to +120 minutes
              </p>
            </div>
          </TabsContent>

          <TabsContent value="sunset" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Automatically trigger at sunset. Requires room location.
            </p>
            <div>
              <Label htmlFor="offset_minutes">
                Offset (minutes)
                <HelpTooltip id="schedule-offset-sunset" content={{ description: "Adjust start time before (-) or after (+) sunset" }} />
              </Label>
              <Input
                id="offset_minutes"
                type="number"
                {...register("offset_minutes", { valueAsNumber: true })}
                placeholder="0"
                min={-120}
                max={120}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Range: -120 to +120 minutes
              </p>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Set a specific time for the schedule to start.
            </p>
            <div>
              <Label htmlFor="start_time">
                Start Time
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="start_time"
                type="time"
                {...register("start_time")}
                className={cn(errors.start_time && "border-destructive")}
              />
              {errors.start_time && (
                <p className="text-sm text-destructive mt-1">
                  {errors.start_time.message}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Days of Week */}
      <div>
        <Label>
          Active Days
          <span className="text-destructive ml-1">*</span>
        </Label>
        <div className="flex gap-2 mt-2">
          {DAYS_OF_WEEK.map(day => (
            <Button
              key={day.value}
              type="button"
              variant={selectedDays.includes(day.value) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleDay(day.value)}
              className="flex-1"
            >
              {day.label}
            </Button>
          ))}
        </div>
        {errors.days && (
          <p className="text-sm text-destructive mt-1">{errors.days.message}</p>
        )}
      </div>

      {/* Dimming Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Dimming Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Duration */}
          <div>
            <Label htmlFor="duration_minutes">
              Duration (minutes)
              <span className="text-destructive ml-1">*</span>
            </Label>
            <div className="flex items-center gap-4 mt-2">
              <Slider
                value={[watchDuration]}
                onValueChange={([value]) =>
                  setValue("duration_minutes", value)
                }
                min={1}
                max={480}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                {...register("duration_minutes", { valueAsNumber: true })}
                className="w-20"
                min={1}
                max={480}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {watchDuration} minute{watchDuration !== 1 ? "s" : ""} (
              {Math.floor(watchDuration / 60)}h {watchDuration % 60}m)
            </p>
          </div>

          {/* Start Intensity */}
          <div>
            <Label htmlFor="start_intensity">
              Start Intensity
              <span className="text-destructive ml-1">*</span>
            </Label>
            <div className="flex items-center gap-4 mt-2">
              <Slider
                value={[watchStartIntensity]}
                onValueChange={([value]) =>
                  setValue("start_intensity", value)
                }
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                {...register("start_intensity", { valueAsNumber: true })}
                className="w-20"
                min={0}
                max={100}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {watchStartIntensity}%
            </p>
          </div>

          {/* Target Intensity */}
          <div>
            <Label htmlFor="target_intensity">
              Target Intensity
              <span className="text-destructive ml-1">*</span>
            </Label>
            <div className="flex items-center gap-4 mt-2">
              <Slider
                value={[watchTargetIntensity]}
                onValueChange={([value]) =>
                  setValue("target_intensity", value)
                }
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                {...register("target_intensity", { valueAsNumber: true })}
                className="w-20"
                min={0}
                max={100}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {watchTargetIntensity}%
            </p>
          </div>

          {/* Curve Type */}
          <div>
            <Label htmlFor="curve">
              Dimming Curve
              <HelpTooltip id="schedule-curve-type" content={{ description: "Choose how intensity changes over time" }} />
            </Label>
            <Select
              value={watchCurve}
              onValueChange={value =>
                setValue("curve", value as DimmerCurveType)
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURVE_TYPES.map(curve => (
                  <SelectItem key={curve.value} value={curve.value}>
                    {curve.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {getCurveDescription(watchCurve)}
            </p>
          </div>

          {/* Curve Preview */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Curve Preview</span>
            </div>
            <div className="h-32 relative">
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full"
                preserveAspectRatio="none"
              >
                {/* Grid lines */}
                <line
                  x1="0"
                  y1="100"
                  x2="100"
                  y2="100"
                  stroke="currentColor"
                  strokeOpacity="0.1"
                />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="100"
                  stroke="currentColor"
                  strokeOpacity="0.1"
                />

                {/* Curve path */}
                <polyline
                  points={curvePreviewData
                    .map(point => `${point.x * 100},${(1 - point.y) * 100}`)
                    .join(" ")}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Start: {watchStartIntensity}%</span>
              <span>Target: {watchTargetIntensity}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Saving...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4 mr-2" />
              Create Schedule
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
