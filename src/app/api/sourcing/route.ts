import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// Guard: returns 403 if sourcing is not enabled for this user's settings
async function guardSourcing(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: settings } = await supabase.from('settings').select('sourcing_enabled').maybeSingle()
  if (!settings?.sourcing_enabled) {
    return NextResponse.json({ error: 'Sourcing Requests is not enabled for this studio' }, { status: 403 })
  }
  return null
}

// POST /api/sourcing — create a new sourcing request (draft)
export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guard = await guardSourcing(supabase)
  if (guard) return guard

  const body = await req.json() as {
    title: string
    work_type?: string
    specifications?: string
    item_quantity?: number
    dimensions?: string
    colour_finish?: string
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data, error } = await supabase.from('sourcing_requests').insert({
    user_id: user.id,
    title: body.title.trim(),
    work_type: body.work_type?.trim() || null,
    specifications: body.specifications?.trim() || null,
    item_quantity: body.item_quantity ?? null,
    dimensions: body.dimensions?.trim() || null,
    colour_finish: body.colour_finish?.trim() || null,
    status: 'draft',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}
