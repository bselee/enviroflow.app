/**
 * Diary Entries API Routes
 *
 * GET  /api/diaries/[id]/entries  - List entries for a diary cycle
 * POST /api/diaries/[id]/entries  - Create a new diary entry
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sanitizeName } from '@/lib/sanitize-input'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// ============================================
// Validation Schemas
// ============================================

const DiaryEntryTags = [
  'watering',
  'feeding',
  'training',
  'issue',
  'milestone',
  'observation',
  'harvest'
] as const

const CreateDiaryEntrySchema = z.object({
  title: z
    .string()
    .transform(sanitizeName)
    .pipe(z.string().max(200, 'Title must be 200 characters or less'))
    .optional()
    .nullable(),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be 50,000 characters or less'),
  tags: z.array(z.enum(DiaryEntryTags)).optional().default([]),
  entry_date: z.string().datetime().optional(),
  capture_sensor_snapshot: z.boolean().optional().default(false)
})

// ============================================
// Supabase Client Setup
// ============================================

let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error('Supabase credentials not configured')
    }

    supabase = createClient(url, key)
  }
  return supabase
}

// ============================================
// Authentication Helper
// ============================================

async function getUserId(request: NextRequest, supabase: SupabaseClient): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (!error && user) {
      return user.id
    }
  }
  return null
}

// ============================================
// Sensor Snapshot Helper
// ============================================

interface SensorSnapshot {
  temperature?: number
  humidity?: number
  vpd?: number
  co2?: number
  timestamp: string
  controllerId?: string
  controllerName?: string
}

async function captureSensorSnapshot(
  request: NextRequest,
  controllerIds: string[]
): Promise<SensorSnapshot | null> {
  if (!controllerIds || controllerIds.length === 0) {
    return null
  }

  try {
    // Internal fetch to sensors/live API
    const baseUrl = request.nextUrl.origin
    const authHeader = request.headers.get('authorization') || ''

    const response = await fetch(`${baseUrl}/api/sensors/live`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    })

    if (!response.ok) {
      console.warn('Failed to capture sensor snapshot:', response.status)
      return null
    }

    const data = await response.json()
    const sensors = data.sensors || []

    // Find sensors matching cycle's controller IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matching = sensors.filter((s: any) =>
      controllerIds.some((cid: string) => s.controllerId === cid || s.controller_id === cid)
    )

    if (matching.length === 0) {
      return null
    }

    // Average values across matching sensors
    const snapshot: SensorSnapshot = {
      timestamp: new Date().toISOString(),
      controllerId: matching[0].controllerId || matching[0].controller_id,
      controllerName: matching[0].controllerName || matching[0].controller_name,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const temps = matching.map((s: any) => s.temperature).filter((v: any) => v != null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const humids = matching.map((s: any) => s.humidity).filter((v: any) => v != null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vpds = matching.map((s: any) => s.vpd).filter((v: any) => v != null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const co2s = matching.map((s: any) => s.co2).filter((v: any) => v != null)

    if (temps.length > 0) snapshot.temperature = parseFloat((temps.reduce((a: number, b: number) => a + b, 0) / temps.length).toFixed(1))
    if (humids.length > 0) snapshot.humidity = parseFloat((humids.reduce((a: number, b: number) => a + b, 0) / humids.length).toFixed(1))
    if (vpds.length > 0) snapshot.vpd = parseFloat((vpds.reduce((a: number, b: number) => a + b, 0) / vpds.length).toFixed(2))
    if (co2s.length > 0) snapshot.co2 = Math.round(co2s.reduce((a: number, b: number) => a + b, 0) / co2s.length)

    return snapshot
  } catch (err) {
    console.warn('Sensor snapshot capture failed:', err)
    return null
  }
}

// ============================================
// GET /api/diaries/[id]/entries
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cycleId } = params

    // Verify cycle belongs to user
    const { data: cycle, error: cycleError } = await supabase
      .from('grow_cycles')
      .select('id')
      .eq('id', cycleId)
      .eq('user_id', userId)
      .single()

    if (cycleError || !cycle) {
      return NextResponse.json({ error: 'Diary cycle not found' }, { status: 404 })
    }

    // Fetch entries with photos
    const { data: entries, error: entriesError } = await supabase
      .from('diary_entries')
      .select(`
        id,
        cycle_id,
        user_id,
        title,
        content,
        tags,
        sensor_snapshot,
        entry_date,
        created_at,
        updated_at,
        diary_photos (
          id,
          entry_id,
          storage_path,
          thumbnail_path,
          filename,
          content_type,
          size_bytes,
          width,
          height,
          sort_order,
          created_at
        )
      `)
      .eq('cycle_id', cycleId)
      .order('entry_date', { ascending: false })

    if (entriesError) {
      console.error('Failed to fetch diary entries:', entriesError)
      return NextResponse.json(
        { error: 'Failed to fetch diary entries', details: entriesError.message },
        { status: 500 }
      )
    }

    // Map photos field name
    const enrichedEntries = (entries || []).map(entry => ({
      ...entry,
      photos: entry.diary_photos || [],
    }))

    return NextResponse.json({
      entries: enrichedEntries,
      count: enrichedEntries.length
    })

  } catch (error) {
    console.error('Diary entries GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/diaries/[id]/entries
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cycleId } = params

    // Verify cycle belongs to user and is active
    const { data: cycle, error: cycleError } = await supabase
      .from('grow_cycles')
      .select('id, name, room_id, controller_ids, status')
      .eq('id', cycleId)
      .eq('user_id', userId)
      .single()

    if (cycleError || !cycle) {
      return NextResponse.json({ error: 'Diary cycle not found' }, { status: 404 })
    }

    if (cycle.status !== 'active') {
      return NextResponse.json(
        { error: 'Cannot add entries to a non-active cycle' },
        { status: 400 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const validationResult = CreateDiaryEntrySchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
    }

    const input = validationResult.data

    // Capture sensor snapshot if requested
    let sensorSnapshot: SensorSnapshot | null = null
    if (input.capture_sensor_snapshot && cycle.controller_ids?.length > 0) {
      sensorSnapshot = await captureSensorSnapshot(request, cycle.controller_ids)
    }

    // Insert the entry
    const { data: entry, error: insertError } = await supabase
      .from('diary_entries')
      .insert({
        cycle_id: cycleId,
        user_id: userId,
        title: input.title || null,
        content: input.content,
        tags: input.tags,
        sensor_snapshot: sensorSnapshot,
        entry_date: input.entry_date || new Date().toISOString()
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Failed to create diary entry:', insertError)
      return NextResponse.json(
        { error: 'Failed to create diary entry', details: insertError.message },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        room_id: cycle.room_id || null,
        action_type: 'diary_entry_created',
        details: {
          cycle_id: cycleId,
          cycle_name: cycle.name,
          entry_id: entry.id,
          tags: input.tags,
          has_sensor_snapshot: !!sensorSnapshot
        },
        result: 'success'
      })

    return NextResponse.json(
      {
        entry: { ...entry, photos: [] },
        message: 'Diary entry created successfully'
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Diary entry POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
