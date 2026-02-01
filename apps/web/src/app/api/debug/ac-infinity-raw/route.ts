/**
 * DEBUG: Raw AC Infinity API Response
 *
 * This endpoint fetches and returns the raw API response from AC Infinity
 * so we can see exactly what fields are available.
 *
 * Usage: GET /api/debug/ac-infinity-raw?controllerId=<uuid>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { decryptCredentials } from '@/lib/server-encryption'

const API_BASE = 'http://www.acinfinityserver.com'
const USER_AGENT = 'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4'

export async function GET(request: NextRequest) {
  try {
    const controllerId = request.nextUrl.searchParams.get('controllerId')

    if (!controllerId) {
      return NextResponse.json({ error: 'controllerId query param required' }, { status: 400 })
    }

    // Get controller from database
    const supabase = createServerClient()
    const { data: controller, error: dbError } = await supabase
      .from('controllers')
      .select('*')
      .eq('id', controllerId)
      .single()

    if (dbError || !controller) {
      return NextResponse.json({ error: 'Controller not found', dbError }, { status: 404 })
    }

    // Decrypt credentials
    const credentials = decryptCredentials(controller.credentials_encrypted) as { email?: string; password?: string }
    if (!credentials || !credentials.email || !credentials.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 })
    }

    // Step 1: Login to AC Infinity
    const loginResponse = await fetch(`${API_BASE}/api/user/appUserLogin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({
        appEmail: credentials.email,
        appPasswordl: credentials.password,
      }).toString(),
    })

    const loginData = await loginResponse.json()

    if (loginData.code !== 200 || !loginData.data?.appId) {
      return NextResponse.json({
        step: 'login',
        error: 'Login failed',
        loginResponse: loginData
      }, { status: 401 })
    }

    const token = loginData.data.appId

    // Step 2: Get device mode settings (the endpoint we're debugging)
    const deviceId = controller.controller_id

    // Try with port=1
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

    // Also try getting the device list to compare
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

    // Return everything for debugging
    return NextResponse.json({
      success: true,
      controller: {
        id: controller.id,
        name: controller.name,
        controller_id: controller.controller_id,
        brand: controller.brand,
      },
      getdevModeSettingList: {
        requestBody: { devId: deviceId, port: '1' },
        response: settingsData,
        responseKeys: settingsData.data ? Object.keys(settingsData.data) : [],
      },
      devInfoListAll: {
        response: devicesData,
      },
    }, { status: 200 })

  } catch (error) {
    return NextResponse.json({
      error: 'Exception occurred',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
