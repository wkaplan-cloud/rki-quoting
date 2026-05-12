import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

type Params = { params: Promise<{ id: string; itemId: string }> }

async function assertSessionOwnership(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, sessionId: string, orgId: string) {
  const { data } = await supabase
    .from('sourcing_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('org_id', orgId)
    .maybeSingle()
  return data
}

// PATCH /api/sourcing/sessions/[id]/items/[itemId]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id: sessionId, itemId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    // Verify session ownership — item RLS cascades through session, but an explicit
    // check provides defense-in-depth if RLS is misconfigured or fails silently
    if (!await assertSessionOwnership(supabase, sessionId, orgId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json() as {
      title?: string
      work_type?: string | null
      specifications?: string | null
      item_quantity?: number | null
      dimensions?: string | null
      colour_finish?: string | null
      category?: string
      item_specs?: Record<string, string> | null
    }

    const { data, error } = await supabase
      .from('sourcing_session_items')
      .update({
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.work_type !== undefined && { work_type: body.work_type }),
        ...(body.specifications !== undefined && { specifications: body.specifications?.trim() ?? null }),
        ...(body.item_quantity !== undefined && { item_quantity: body.item_quantity }),
        ...(body.dimensions !== undefined && { dimensions: body.dimensions?.trim() ?? null }),
        ...(body.colour_finish !== undefined && { colour_finish: body.colour_finish?.trim() ?? null }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.item_specs !== undefined && { item_specs: body.item_specs }),
      })
      .eq('id', itemId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/sourcing/sessions/[id]/items/[itemId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id: sessionId, itemId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    if (!await assertSessionOwnership(supabase, sessionId, orgId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await supabase.from('sourcing_session_items').delete().eq('id', itemId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
