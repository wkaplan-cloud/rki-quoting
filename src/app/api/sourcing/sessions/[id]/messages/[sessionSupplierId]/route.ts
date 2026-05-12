import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

type Params = { params: Promise<{ id: string; sessionSupplierId: string }> }

// GET /api/sourcing/sessions/[id]/messages/[sessionSupplierId]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: sessionId, sessionSupplierId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Security: verify session belongs to this org BEFORE the supabaseAdmin unread reset.
    // Without this check, any authenticated user could zero-out any org's supplier badge
    // because supabaseAdmin bypasses RLS and the RLS-scoped messages query returns [] silently.
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data: session } = await supabase
      .from('sourcing_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('sourcing_thread_messages')
      .select('*')
      .eq('session_supplier_id', sessionSupplierId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Reset unread count now that the designer has read the thread (admin bypasses RLS)
    await supabaseAdmin
      .from('sourcing_session_suppliers')
      .update({ supplier_message_count: 0 })
      .eq('id', sessionSupplierId)

    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}

// POST /api/sourcing/sessions/[id]/messages/[sessionSupplierId]
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: sessionId, sessionSupplierId } = await params
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

    const { body: msgBody } = await req.json() as { body: string }
    if (!msgBody?.trim()) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })

    const { data, error } = await supabase
      .from('sourcing_thread_messages')
      .insert({ session_supplier_id: sessionSupplierId, sender_type: 'designer', body: msgBody.trim() })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}
