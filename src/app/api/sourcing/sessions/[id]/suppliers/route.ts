import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions/[id]/suppliers — add a supplier to a session
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: session_id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      supplier_id?: string        // from studio's supplier list
      portal_account_id?: string  // registered platform supplier
      supplier_name: string
      email: string
    }

    if (!body.supplier_name?.trim() || !body.email?.trim()) {
      return NextResponse.json({ error: 'Supplier name and email are required' }, { status: 400 })
    }

    // Check not already in session
    const { data: existing } = await supabase
      .from('sourcing_session_suppliers')
      .select('id')
      .eq('session_id', session_id)
      .eq('email', body.email.toLowerCase().trim())
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'Supplier already added to this session' }, { status: 409 })

    const { data, error } = await supabase
      .from('sourcing_session_suppliers')
      .insert({
        session_id,
        supplier_id: body.supplier_id ?? null,
        portal_account_id: body.portal_account_id ?? null,
        supplier_name: body.supplier_name.trim(),
        email: body.email.toLowerCase().trim(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}
