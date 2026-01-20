/**
 * EnviroFlow Health Check Edge Function
 *
 * This function checks the online status of all controllers and updates
 * their status in the database. Run periodically (every 5-10 minutes)
 * to keep controller status accurate.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Types
interface Controller {
  id: string
  user_id: string
  brand: string
  controller_id: string
  name: string
  credentials: Record<string, unknown>
  is_online: boolean
  last_seen: string | null
}

interface HealthCheckResult {
  controllerId: string
  controllerName: string
  brand: string
  wasOnline: boolean
  isOnline: boolean
  statusChanged: boolean
  error?: string
}

// Logger
function log(level: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  console.log(JSON.stringify({
    timestamp,
    level,
    source: 'health-check',
    message,
    data,
  }))
}

// Status checker for different controller brands
class StatusChecker {
  private readonly acInfinityApi = 'https://www.acinfinityserver.com'

  async checkStatus(controller: Controller): Promise<{
    isOnline: boolean
    error?: string
  }> {
    try {
      switch (controller.brand) {
        case 'ac_infinity':
          return await this.checkACInfinity(controller)
        case 'inkbird':
          return { isOnline: false, error: 'Inkbird not yet implemented' }
        case 'generic_wifi':
          return await this.checkGenericWiFi(controller)
        default:
          return { isOnline: false, error: `Unknown brand: ${controller.brand}` }
      }
    } catch (error) {
      return {
        isOnline: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async checkACInfinity(controller: Controller): Promise<{
    isOnline: boolean
    error?: string
  }> {
    const credentials = controller.credentials as {
      email?: string
      password?: string
    }

    if (!credentials.email || !credentials.password) {
      return { isOnline: false, error: 'Missing credentials' }
    }

    // Login to AC Infinity
    const loginResponse = await fetch(`${this.acInfinityApi}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appEmail: credentials.email,
        appPasswordl: credentials.password,
      }),
    })

    if (!loginResponse.ok) {
      return { isOnline: false, error: `Login failed: ${loginResponse.status}` }
    }

    const loginData = await loginResponse.json()
    if (loginData.code !== 200) {
      return { isOnline: false, error: `Login failed: ${loginData.msg}` }
    }

    const token = loginData.data.token

    // Check device status
    const statusResponse = await fetch(`${this.acInfinityApi}/api/dev/getDevSetting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: token,
      },
      body: JSON.stringify({ devId: controller.controller_id }),
    })

    if (!statusResponse.ok) {
      return { isOnline: false, error: `Status check failed: ${statusResponse.status}` }
    }

    const statusData = await statusResponse.json()

    // Check if device is responding
    if (statusData.code === 200 && statusData.data) {
      return { isOnline: true }
    }

    return { isOnline: false, error: statusData.msg || 'Device not responding' }
  }

  private async checkGenericWiFi(controller: Controller): Promise<{
    isOnline: boolean
    error?: string
  }> {
    const credentials = controller.credentials as {
      apiBase?: string
      apiKey?: string
      endpoints?: {
        status?: string
      }
    }

    if (!credentials.apiBase) {
      return { isOnline: false, error: 'Missing apiBase' }
    }

    const statusEndpoint = credentials.endpoints?.status || '/status'
    const headers: Record<string, string> = {}

    if (credentials.apiKey) {
      headers['Authorization'] = `Bearer ${credentials.apiKey}`
    }

    try {
      const controller_abortController = new AbortController()
      const timeoutId = setTimeout(() => controller_abortController.abort(), 10000)

      const response = await fetch(
        `${credentials.apiBase}${statusEndpoint}`,
        {
          headers,
          signal: controller_abortController.signal,
        }
      )

      clearTimeout(timeoutId)

      return { isOnline: response.ok }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { isOnline: false, error: 'Connection timeout' }
      }
      throw error
    }
  }
}

// Main processor
async function checkAllControllers(
  supabase: SupabaseClient
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []

  // Fetch all controllers
  const { data: controllers, error } = await supabase
    .from('controllers')
    .select('*')

  if (error) {
    log('error', 'Failed to fetch controllers', { error: error.message })
    throw error
  }

  log('info', `Checking ${controllers?.length || 0} controllers`)

  const checker = new StatusChecker()

  for (const controller of (controllers || []) as Controller[]) {
    const result: HealthCheckResult = {
      controllerId: controller.id,
      controllerName: controller.name,
      brand: controller.brand,
      wasOnline: controller.is_online,
      isOnline: false,
      statusChanged: false,
    }

    const { isOnline, error: checkError } = await checker.checkStatus(controller)

    result.isOnline = isOnline
    result.statusChanged = isOnline !== controller.is_online
    result.error = checkError

    // Update controller status in database
    if (result.statusChanged || isOnline) {
      const { error: updateError } = await supabase
        .from('controllers')
        .update({
          is_online: isOnline,
          last_seen: isOnline ? new Date().toISOString() : controller.last_seen,
        })
        .eq('id', controller.id)

      if (updateError) {
        log('error', 'Failed to update controller status', {
          controllerId: controller.id,
          error: updateError.message,
        })
      }
    }

    // Log status changes
    if (result.statusChanged) {
      log('info', 'Controller status changed', {
        controller: controller.name,
        wasOnline: result.wasOnline,
        isOnline: result.isOnline,
      })

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: controller.user_id,
        controller_id: controller.id,
        action: 'health_check',
        result: isOnline ? 'success' : 'failed',
        metadata: {
          statusChange: true,
          previousStatus: result.wasOnline ? 'online' : 'offline',
          currentStatus: isOnline ? 'online' : 'offline',
          error: checkError,
        },
      })
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
    log('info', 'Health check starting')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

    const results = await checkAllControllers(supabase)

    const duration = Date.now() - startTime
    const online = results.filter((r) => r.isOnline).length
    const offline = results.filter((r) => !r.isOnline).length
    const changed = results.filter((r) => r.statusChanged).length

    log('info', 'Health check completed', {
      duration,
      total: results.length,
      online,
      offline,
      statusChanges: changed,
    })

    return new Response(
      JSON.stringify({
        success: true,
        duration,
        summary: {
          total: results.length,
          online,
          offline,
          statusChanges: changed,
        },
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
    log('error', 'Health check failed', { error: errorMessage })

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
