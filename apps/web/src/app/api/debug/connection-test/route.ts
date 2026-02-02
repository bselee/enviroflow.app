/**
 * Debug endpoint to test AC Infinity connection
 *
 * GET /api/debug/connection-test?controllerId=xxx
 *
 * Returns detailed connection and device info for debugging.
 * TEMPORARY - remove after debugging.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { decryptCredentials } from '@/lib/server-encryption'
import {
  getAdapter,
  type ControllerBrand,
  type ACInfinityCredentials,
} from '@enviroflow/automation-engine/adapters'

type SupabaseClient = ReturnType<typeof createClient<never>>

let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase not configured')
    supabase = createClient(url, key)
  }
  return supabase
}

async function getUserId(request: NextRequest, client: SupabaseClient): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data: { user } } = await client.auth.getUser(token)
    if (user?.id) return user.id
  }
  return null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(`[DEBUG] ${msg}`)
    logs.push(`${new Date().toISOString()} - ${msg}`)
  }

  try {
    const { searchParams } = new URL(request.url)
    const controllerId = searchParams.get('controllerId')

    log(`Starting connection test for controller: ${controllerId}`)

    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      log('ERROR: No user ID - unauthorized')
      return NextResponse.json({ error: 'Unauthorized', logs }, { status: 401 })
    }

    log(`User ID: ${userId}`)

    // Get controller
    const { data: controller, error: fetchError } = await client
      .from('controllers')
      .select('*')
      .eq('id', controllerId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !controller) {
      log(`ERROR: Controller not found - ${fetchError?.message}`)
      return NextResponse.json({ error: 'Controller not found', logs }, { status: 404 })
    }

    log(`Controller found: ${controller.name} (brand: ${controller.brand})`)
    log(`Controller device ID: ${controller.controller_id}`)
    log(`Status: ${controller.status}, Last seen: ${controller.last_seen}`)

    // Decrypt credentials
    log('Decrypting credentials...')
    let creds: Record<string, unknown>
    try {
      creds = decryptCredentials(controller.credentials)
      log(`Decryption successful. Keys: ${Object.keys(creds).join(', ')}`)
      log(`Has email: ${!!creds.email}, Has password: ${!!creds.password}`)
    } catch (e) {
      log(`ERROR: Decryption failed - ${e instanceof Error ? e.message : 'Unknown'}`)
      return NextResponse.json({ error: 'Decryption failed', logs }, { status: 500 })
    }

    // Build credentials
    const adapterCreds: ACInfinityCredentials = {
      type: 'ac_infinity',
      email: creds.email as string,
      password: creds.password as string,
      deviceId: controller.controller_id,
    }

    log(`Connecting with deviceId: ${adapterCreds.deviceId}`)

    // Connect
    const adapter = getAdapter(controller.brand as ControllerBrand)
    log('Calling adapter.connect()...')

    const result = await adapter.connect(adapterCreds)

    log(`Connection result: success=${result.success}`)
    if (result.error) log(`Error: ${result.error}`)
    if (result.controllerId) log(`Controller ID returned: ${result.controllerId}`)

    if (result.metadata) {
      log(`Metadata brand: ${result.metadata.brand}`)
      log(`Metadata model: ${result.metadata.model}`)

      if (result.metadata.capabilities) {
        const caps = result.metadata.capabilities
        log(`Sensors: ${caps.sensors?.length || 0}`)
        log(`Devices: ${caps.devices?.length || 0}`)
        log(`Supports dimming: ${caps.supportsDimming}`)

        if (caps.devices && caps.devices.length > 0) {
          caps.devices.forEach((d, i) => {
            log(`  Device ${i}: port=${d.port}, name=${d.name}, type=${d.type}, level=${d.currentLevel}`)
          })
        }
      } else {
        log('WARNING: No capabilities in metadata')
      }
    } else {
      log('WARNING: No metadata in result')
    }

    // Disconnect
    try {
      await adapter.disconnect(result.controllerId || '')
      log('Disconnected')
    } catch (e) {
      log(`Disconnect error: ${e instanceof Error ? e.message : 'Unknown'}`)
    }

    return NextResponse.json({
      success: result.success,
      controllerId: result.controllerId,
      error: result.error,
      metadata: result.metadata,
      logs,
    })

  } catch (error) {
    log(`EXCEPTION: ${error instanceof Error ? error.message : 'Unknown'}`)
    log(`Stack: ${error instanceof Error ? error.stack : 'N/A'}`)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      logs
    }, { status: 500 })
  }
}
