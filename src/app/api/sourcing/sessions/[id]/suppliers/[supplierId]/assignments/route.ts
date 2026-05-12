import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions/[id]/suppliers/[supplierId]/assignments
// Body: { item_id } — assign an item to this supplier
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; supplierId: string }> }) {
  try {
    const { id: sessionId, supplierId: session_supplier_id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data: session } = await supabase
      .from('sourcing_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { item_id } = await req.json() as { item_id: string }
    if (!item_id) return NextResponse.json({ error: 'item_id is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('sourcing_item_assignments')
      .insert({ item_id, session_supplier_id })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Already assigned' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/sourcing/sessions/[id]/suppliers/[supplierId]/assignments?item_id=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; supplierId: string }> }) {
  try {
    const { id: sessionId, supplierId: session_supplier_id } = await params
    const item_id = new URL(req.url).searchParams.get('item_id')
    if (!item_id) return NextResponse.json({ error: 'item_id is required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data: session } = await supabase
      .from('sourcing_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await supabase
      .from('sourcing_item_assignments')
      .delete()
      .eq('item_id', item_id)
      .eq('session_supplier_id', session_supplier_id)

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
