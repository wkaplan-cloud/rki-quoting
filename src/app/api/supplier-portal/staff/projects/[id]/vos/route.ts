import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id, name, portal_account_id, is_active')
      .eq('auth_user_id', user.id)
      .single()
    if (!staff || !staff.is_active) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Verify project is assigned to this staff member
    const { data: quote } = await supabaseAdmin
      .from('elec_quotes')
      .select('id, portal_account_id')
      .eq('id', id)
      .eq('portal_account_id', staff.portal_account_id)
      .eq('staff_id', staff.id)
      .single()
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { description, notes, items } = await req.json() as {
      description: string
      notes?: string
      items: { description: string; unit: string; qty: number }[]
    }
    if (!description?.trim()) return NextResponse.json({ error: 'Description required' }, { status: 400 })

    // Get next VO number
    const { data: existingVOs } = await supabaseAdmin
      .from('elec_variation_orders')
      .select('vo_number')
      .eq('quote_id', id)
    const num = String((existingVOs?.length ?? 0) + 1).padStart(3, '0')
    const voNumber = `VO-${num}`

    const { data: vo, error: voErr } = await supabaseAdmin
      .from('elec_variation_orders')
      .insert({
        quote_id: id,
        vo_number: voNumber,
        description: description.trim(),
        notes: notes?.trim() || null,
        requested_by: staff.name,
        value: 0,
        status: 'pending',
      })
      .select()
      .single()
    if (voErr) return NextResponse.json({ error: voErr.message }, { status: 500 })

    if (items && items.length > 0) {
      await supabaseAdmin.from('elec_quote_line_items').insert(
        items.filter(i => i.description?.trim()).map((i, idx) => ({
          quote_id: id,
          section_id: null,
          description: i.description.trim(),
          unit: i.unit || null,
          item_type: 'both' as const,
          quoted_quantity: i.qty || 1,
          quoted_unit_rate: 0,
          is_variation: true,
          variation_order_id: vo.id,
          sort_order: idx,
        }))
      )
    }

    // Notify admin
    const { data: quoteInfo } = await supabaseAdmin
      .from('elec_quotes').select('project_name').eq('id', id).maybeSingle()
    await supabaseAdmin.from('elec_notifications').insert({
      portal_account_id: staff.portal_account_id,
      type: 'vo_submitted',
      title: `VO submitted by ${staff.name}`,
      body: `"${description.trim()}"${quoteInfo?.project_name ? ` on ${quoteInfo.project_name}` : ''}`,
      metadata: { vo_id: vo.id, quote_id: id, staff_id: staff.id },
    })

    return NextResponse.json({ ok: true, vo })
  } catch (e) {
    return apiError(e)
  }
}
