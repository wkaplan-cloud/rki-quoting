import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// GET /api/sourcing/respond/[token]/messages
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: ss } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id')
      .eq('token', token)
      .single()

    if (!ss) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('sourcing_thread_messages')
      .select('*')
      .eq('session_supplier_id', ss.id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}

// POST /api/sourcing/respond/[token]/messages
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: ss } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id')
      .eq('token', token)
      .single()

    if (!ss) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { body: msgBody } = await req.json() as { body: string }
    if (!msgBody?.trim()) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('sourcing_thread_messages')
      .insert({ session_supplier_id: ss.id, sender_type: 'supplier', body: msgBody.trim() })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}
