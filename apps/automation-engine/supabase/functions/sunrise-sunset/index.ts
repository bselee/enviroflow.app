/**
 * EnviroFlow Sunrise/Sunset Edge Function
 *
 * This function handles gradual light dimming for sunrise and sunset
 * automation. It calculates the appropriate brightness level based on
 * the current time and configured curves (linear, sigmoid, exponential).
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Types
interface Controller {
  id: string
  brand: string
  controller_id: string
  name: string
  credentials: Record<string, unknown>
  is_online: boolean
}

interface Workflow {
  id: string
  user_id: string
  name: string
  is_active: boolean
}

interface DimmerConfig {
  id: string
  workflow_id: string
  controller_id: string
  dimmer_port: number
  sunrise_time: string // HH:MM:SS
  sunrise_duration: number // minutes
  sunrise_curve: 'linear' | 'sigmoid' | 'exponential'
  sunset_time: string
  sunset_duration: number
  sunset_curve: 'linear' | 'sigmoid' | 'exponential'
  target_intensity: number // 0-100
  is_active: boolean
  workflows: Workflow
  controllers: Controller
}

interface ExecutionResult {
  configId: string
  controllerName: string
  event: 'sunrise' | 'sunset' | 'none'
  brightness: number
  success: boolean
  error?: string
}

// Logger
function log(level: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  console.log(JSON.stringify({
    timestamp,
    level,
    source: 'sunrise-sunset',
    message,
    data,
  }))
}

// Time utilities
function parseTimeToMinutes(time: string): number {
  const parts = time.split(':').map(Number)
  return parts[0] * 60 + parts[1]
}

function getCurrentTimeMinutes(timezone?: string): number {
  const now = new Date()
  // If timezone is specified, convert
  if (timezone) {
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      timeZone: timezone,
    }
    const timeStr = now.toLocaleTimeString('en-US', options)
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }
  return now.getHours() * 60 + now.getMinutes()
}

function isInTimeWindow(
  currentMinutes: number,
  startTime: string,
  durationMinutes: number
): boolean {
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = startMinutes + durationMinutes

  // Handle midnight crossing
  if (endMinutes > 24 * 60) {
    const wrappedEnd = endMinutes - 24 * 60
    return currentMinutes >= startMinutes || currentMinutes <= wrappedEnd
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}

// Curve calculations
function calculateProgress(
  currentMinutes: number,
  startTime: string,
  durationMinutes: number
): number {
  const startMinutes = parseTimeToMinutes(startTime)
  let elapsed = currentMinutes - startMinutes

  // Handle midnight crossing
  if (elapsed < 0) {
    elapsed += 24 * 60
  }

  return Math.min(elapsed / durationMinutes, 1.0)
}

function applyCurve(progress: number, curve: string): number {
  switch (curve) {
    case 'linear':
      return progress

    case 'sigmoid':
      // S-curve: slow start, fast middle, slow end
      // Using logistic function
      return 1 / (1 + Math.exp(-10 * (progress - 0.5)))

    case 'exponential':
      // Starts slow, accelerates (square root for perceived linear brightness)
      return Math.pow(progress, 0.5)

    default:
      return progress
  }
}

function calculateBrightness(
  event: 'sunrise' | 'sunset',
  progress: number,
  curve: string,
  targetIntensity: number
): number {
  const adjustedProgress = applyCurve(progress, curve)

  let brightness: number
  if (event === 'sunrise') {
    // Sunrise: 0% -> target%
    brightness = adjustedProgress * targetIntensity
  } else {
    // Sunset: target% -> 0%
    brightness = (1 - adjustedProgress) * targetIntensity
  }

  return Math.round(brightness)
}

// Controller adapter (simplified for this function)
class LightAdapter {
  private tokens = new Map<string, string>()
  private readonly acInfinityApi = 'https://www.acinfinityserver.com'

  async connect(controller: Controller): Promise<void> {
    if (controller.brand === 'ac_infinity') {
      const credentials = controller.credentials as {
        email?: string
        password?: string
      }

      if (!credentials.email || !credentials.password) {
        throw new Error('Missing credentials')
      }

      const response = await fetch(`${this.acInfinityApi}/api/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appEmail: credentials.email,
          appPasswordl: credentials.password,
        }),
      })

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`)
      }

      const data = await response.json()
      if (data.code !== 200) {
        throw new Error(`Login failed: ${data.msg}`)
      }

      this.tokens.set(controller.controller_id, data.data.token)
    }
  }

  async setDimmerLevel(
    controller: Controller,
    port: number,
    level: number
  ): Promise<boolean> {
    if (controller.brand === 'ac_infinity') {
      const token = this.tokens.get(controller.controller_id)
      if (!token) {
        throw new Error('Not connected')
      }

      // Map 0-100 to AC Infinity's 0-10 scale
      const power = Math.round(level / 10)

      const response = await fetch(`${this.acInfinityApi}/api/dev/updateDevPort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token: token,
        },
        body: JSON.stringify({
          devId: controller.controller_id,
          port,
          speak: power,
          loadState: power > 0 ? 1 : 0,
        }),
      })

      return response.ok
    }

    return false
  }

  disconnect(controller: Controller): void {
    this.tokens.delete(controller.controller_id)
  }
}

// Main processor
async function processDimmerConfigs(
  supabase: SupabaseClient
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = []
  const currentMinutes = getCurrentTimeMinutes()

  log('info', 'Processing dimmer configs', {
    currentTime: `${Math.floor(currentMinutes / 60)}:${currentMinutes % 60}`,
  })

  // Fetch active dimmer configs with related data
  const { data: configs, error } = await supabase
    .from('dimmer_configs')
    .select(`
      *,
      workflows!inner(*),
      controllers!inner(*)
    `)
    .eq('is_active', true)
    .eq('workflows.is_active', true)

  if (error) {
    log('error', 'Failed to fetch dimmer configs', { error: error.message })
    throw error
  }

  log('info', `Found ${configs?.length || 0} active dimmer configs`)

  const adapter = new LightAdapter()

  for (const config of (configs || []) as DimmerConfig[]) {
    const result: ExecutionResult = {
      configId: config.id,
      controllerName: config.controllers.name,
      event: 'none',
      brightness: 0,
      success: true,
    }

    try {
      const controller = config.controllers

      if (!controller.is_online) {
        log('debug', 'Controller offline, skipping', { controllerId: controller.id })
        continue
      }

      // Check if we're in sunrise window
      const inSunrise = isInTimeWindow(
        currentMinutes,
        config.sunrise_time,
        config.sunrise_duration
      )

      // Check if we're in sunset window
      const inSunset = isInTimeWindow(
        currentMinutes,
        config.sunset_time,
        config.sunset_duration
      )

      if (!inSunrise && !inSunset) {
        log('debug', 'Not in sunrise/sunset window', {
          configId: config.id,
          currentMinutes,
          sunriseTime: config.sunrise_time,
          sunsetTime: config.sunset_time,
        })
        continue
      }

      let brightness: number
      let event: 'sunrise' | 'sunset'

      if (inSunrise) {
        event = 'sunrise'
        const progress = calculateProgress(
          currentMinutes,
          config.sunrise_time,
          config.sunrise_duration
        )
        brightness = calculateBrightness(
          'sunrise',
          progress,
          config.sunrise_curve,
          config.target_intensity
        )
      } else {
        event = 'sunset'
        const progress = calculateProgress(
          currentMinutes,
          config.sunset_time,
          config.sunset_duration
        )
        brightness = calculateBrightness(
          'sunset',
          progress,
          config.sunset_curve,
          config.target_intensity
        )
      }

      result.event = event
      result.brightness = brightness

      log('info', `Executing ${event}`, {
        controller: controller.name,
        port: config.dimmer_port,
        brightness,
      })

      // Connect and set level
      await adapter.connect(controller)
      const success = await adapter.setDimmerLevel(controller, config.dimmer_port, brightness)
      adapter.disconnect(controller)

      result.success = success

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: config.workflows.user_id,
        workflow_id: config.workflow_id,
        controller_id: config.controller_id,
        action: event === 'sunrise' ? 'sunrise_executed' : 'sunset_executed',
        result: success ? 'success' : 'failed',
        metadata: {
          brightness,
          port: config.dimmer_port,
          curve: event === 'sunrise' ? config.sunrise_curve : config.sunset_curve,
        },
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      log('error', 'Error processing dimmer config', {
        configId: config.id,
        error: errorMsg,
      })
      result.success = false
      result.error = errorMsg
    }

    results.push(result)
  }

  return results
}

// Main handler
serve(async (req: Request) => {
  const startTime = Date.now()

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    log('info', 'Sunrise/sunset function starting')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

    const results = await processDimmerConfigs(supabase)

    const duration = Date.now() - startTime
    const processed = results.filter((r) => r.event !== 'none').length
    const errors = results.filter((r) => !r.success).length

    log('info', 'Sunrise/sunset execution completed', {
      duration,
      configsProcessed: processed,
      errors,
    })

    return new Response(
      JSON.stringify({
        success: errors === 0,
        duration,
        processed,
        results,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log('error', 'Sunrise/sunset function failed', { error: errorMessage })

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  }
})
