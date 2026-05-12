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
      cc_emails?: string[] | null
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

    // If no supplier_id provided, save to main suppliers table so they appear in future sessions
    let resolvedSupplierId = body.supplier_id ?? null
    if (!resolvedSupplierId) {
      const { data: orgId } = await supabase.rpc('get_current_org_id')
      const { data: existingSupplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('org_id', orgId)
        .ilike('email', body.email.trim())
        .maybeSingle()

      if (existingSupplier) {
        resolvedSupplierId = existingSupplier.id
      } else {
        const { data: newSupplier } = await supabase
          .from('suppliers')
          .insert({
            user_id: user.id,
            org_id: orgId,
            supplier_name: body.supplier_name.trim(),
            email: body.email.toLowerCase().trim(),
            markup_percentage: 0,
          })
          .select('id')
          .single()
        if (newSupplier) resolvedSupplierId = newSupplier.id
      }
    }

    const { data, error } = await supabase
      .from('sourcing_session_suppliers')
      .insert({
        session_id,
        supplier_id: resolvedSupplierId,
        portal_account_id: body.portal_account_id ?? null,
        supplier_name: body.supplier_name.trim(),
        email: body.email.toLowerCase().trim(),
        cc_emails: body.cc_emails?.length ? body.cc_emails : null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}
