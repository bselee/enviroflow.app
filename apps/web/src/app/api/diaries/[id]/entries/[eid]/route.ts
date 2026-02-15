/**
 * Individual Diary Entry API Routes
 *
 * PATCH  /api/diaries/[id]/entries/[eid]  - Update a diary entry
 * DELETE /api/diaries/[id]/entries/[eid]  - Delete a diary entry
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

const UpdateDiaryEntrySchema = z.object({
  title: z
    .string()
    .transform(sanitizeName)
    .pipe(z.string().max(200, 'Title must be 200 characters or less'))
    .optional()
    .nullable(),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be 50,000 characters or less')
    .optional(),
  tags: z.array(z.enum(DiaryEntryTags)).optional(),
  entry_date: z.string().datetime().optional()
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
// PATCH /api/diaries/[id]/entries/[eid]
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; eid: string } }
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cycleId, eid: entryId } = params

    // Verify cycle belongs to user
    const { data: cycle, error: cycleError } = await supabase
      .from('grow_cycles')
      .select('id, name, room_id')
      .eq('id', cycleId)
      .eq('user_id', userId)
      .single()

    if (cycleError || !cycle) {
      return NextResponse.json({ error: 'Diary cycle not found' }, { status: 404 })
    }

    // Verify entry belongs to this cycle
    const { data: existingEntry, error: fetchError } = await supabase
      .from('diary_entries')
      .select('id')
      .eq('id', entryId)
      .eq('cycle_id', cycleId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existingEntry) {
      return NextResponse.json({ error: 'Diary entry not found' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const validationResult = UpdateDiaryEntrySchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
    }

    const input = validationResult.data

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (input.title !== undefined) updateData.title = input.title
    if (input.content !== undefined) updateData.content = input.content
    if (input.tags !== undefined) updateData.tags = input.tags
    if (input.entry_date !== undefined) updateData.entry_date = input.entry_date

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update the entry
    const { data: entry, error: updateError } = await supabase
      .from('diary_entries')
      .update(updateData)
      .eq('id', entryId)
      .eq('user_id', userId)
      .select(`
        *,
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
      .single()

    if (updateError) {
      console.error('Failed to update diary entry:', updateError)
      return NextResponse.json(
        { error: 'Failed to update diary entry', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      entry: { ...entry, photos: entry.diary_photos || [] },
      message: 'Diary entry updated successfully'
    })

  } catch (error) {
    console.error('Diary entry PATCH error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/diaries/[id]/entries/[eid]
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; eid: string } }
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: cycleId, eid: entryId } = params

    // Verify cycle belongs to user
    const { data: cycle, error: cycleError } = await supabase
      .from('grow_cycles')
      .select('id, name, room_id')
      .eq('id', cycleId)
      .eq('user_id', userId)
      .single()

    if (cycleError || !cycle) {
      return NextResponse.json({ error: 'Diary cycle not found' }, { status: 404 })
    }

    // Fetch photos for Storage cleanup before deleting
    const { data: photos } = await supabase
      .from('diary_photos')
      .select('storage_path, thumbnail_path')
      .eq('entry_id', entryId)

    // Delete the entry (cascade handles photos in DB)
    const { error: deleteError } = await supabase
      .from('diary_entries')
      .delete()
      .eq('id', entryId)
      .eq('cycle_id', cycleId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Failed to delete diary entry:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete diary entry', details: deleteError.message },
        { status: 500 }
      )
    }

    // Clean up Storage files (best effort)
    if (photos && photos.length > 0) {
      const storagePaths = photos
        .flatMap(p => [p.storage_path, p.thumbnail_path])
        .filter(Boolean) as string[]

      if (storagePaths.length > 0) {
        try {
          await supabase.storage
            .from('diary-photos')
            .remove(storagePaths)
        } catch (storageErr) {
          console.warn('Failed to clean up Storage files:', storageErr)
        }
      }
    }

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        room_id: cycle.room_id || null,
        action_type: 'diary_entry_deleted',
        details: {
          cycle_id: cycleId,
          cycle_name: cycle.name,
          entry_id: entryId,
          photos_deleted: photos?.length || 0
        },
        result: 'success'
      })

    return NextResponse.json({
      message: 'Diary entry deleted successfully'
    })

  } catch (error) {
    console.error('Diary entry DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
