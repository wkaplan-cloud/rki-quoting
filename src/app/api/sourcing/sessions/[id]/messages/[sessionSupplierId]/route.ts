import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

type Params = { params: Promise<{ id: string; sessionSupplierId: string }> }

// GET /api/sourcing/sessions/[id]/messages/[sessionSupplierId]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { sessionSupplierId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('sourcing_thread_messages')
      .select('*')
      .eq('session_supplier_id', sessionSupplierId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}

// POST /api/sourcing/sessions/[id]/messages/[sessionSupplierId]
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { sessionSupplierId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
