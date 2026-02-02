/**
 * DEBUG: Raw AC Infinity API Response
 *
 * Returns raw API responses from AC Infinity for debugging.
 * Usage: GET /api/debug/ac-infinity-raw?controllerId=<uuid>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptCredentials } from '@/lib/server-encryption'

const API_BASE = 'http://www.acinfinityserver.com'
const USER_AGENT = 'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request: NextRequest) {
  try {
    const controllerId = request.nextUrl.searchParams.get('controllerId')
    if (!controllerId) {
      return NextResponse.json({ error: 'controllerId query param required' }, { status: 400 })
    }

    // Get controller from database
    const supabase = getSupabase()
    const { data: controller, error: dbError } = await supabase
      .from('controllers')
      .select('*')
      .eq('id', controllerId)
      .single()

    if (dbError || !controller) {
      return NextResponse.json({ error: 'Controller not found', dbError }, { status: 404 })
    }

    // Show what columns we got from DB
    const dbColumns = Object.keys(controller)

    // The column is 'credentials' (JSONB), not 'credentials_encrypted'
    const rawCredentials = controller.credentials
    if (!rawCredentials) {
      return NextResponse.json({
        error: 'No credentials field in controller',
        availableColumns: dbColumns,
      }, { status: 400 })
    }

    // Decrypt credentials
    let credentials: Record<string, unknown>
    try {
      credentials = decryptCredentials(rawCredentials) as Record<string, unknown>
    } catch (err) {
      return NextResponse.json({
        error: 'Failed to decrypt',
        message: err instanceof Error ? err.message : String(err),
        rawType: typeof rawCredentials,
        rawPreview: typeof rawCredentials === 'string' ? rawCredentials.substring(0, 100) : JSON.stringify(rawCredentials).substring(0, 100),
      }, { status: 400 })
    }

    const email = (credentials.email || credentials.Email) as string | undefined
    const password = (credentials.password || credentials.Password) as string | undefined

    if (!email || !password) {
      return NextResponse.json({
        error: 'Missing email/password',
        credentialsKeys: Object.keys(credentials),
      }, { status: 400 })
    }

    // Login to AC Infinity
    const loginResponse = await fetch(`${API_BASE}/api/user/appUserLogin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ appEmail: email, appPasswordl: password }).toString(),
    })
    const loginData = await loginResponse.json()

    if (loginData.code !== 200 || !loginData.data?.appId) {
      return NextResponse.json({ step: 'login', error: 'Login failed', loginResponse: loginData }, { status: 401 })
    }

    const token = loginData.data.appId
    const deviceId = controller.controller_id

    // Get ALL devices for this account first
    const devicesResponse = await fetch(`${API_BASE}/api/user/devInfoListAll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
        'token': token,
      },
      body: new URLSearchParams({ userId: token }).toString(),
    })
    const devicesData = await devicesResponse.json()

    // Get device settings with port=1
    const settingsResponse = await fetch(`${API_BASE}/api/dev/getdevModeSettingList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
        'token': token,
      },
      body: new URLSearchParams({ devId: deviceId, port: '1' }).toString(),
    })
    const settingsData = await settingsResponse.json()

    // Try the Home Assistant endpoint: getDevInfoList (different from devInfoListAll)
    const devInfoResponse = await fetch(`${API_BASE}/api/user/getDevInfoList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
        'token': token,
      },
      body: new URLSearchParams({ userId: token }).toString(),
    })
    const devInfoData = await devInfoResponse.json()

    // Return all responses for analysis
    return NextResponse.json({
      success: true,
      controller: {
        id: controller.id,
        name: controller.name,
        controller_id: controller.controller_id,
        brand: controller.brand,
      },
      api_responses: {
        devInfoListAll: devicesData,
        getDevInfoList: devInfoData,
        getdevModeSettingList: {
          request: { devId: deviceId, port: '1' },
          response: settingsData,
          dataKeys: settingsData.data ? Object.keys(settingsData.data) : [],
        },
      },
    }, { status: 200 })

  } catch (error) {
    return NextResponse.json({
      error: 'Exception',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
