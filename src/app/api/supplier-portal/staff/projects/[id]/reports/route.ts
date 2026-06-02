import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const TYPE_LABELS: Record<string, string> = {
  damage: 'Damage report',
  loss:   'Loss report',
  other:  'Report',
}

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

    const { data: quote } = await supabaseAdmin
      .from('elec_quotes')
      .select('id, project_name, portal_account_id')
      .eq('id', id)
      .eq('portal_account_id', staff.portal_account_id)
      .maybeSingle()
    if (!quote) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const body = await req.json() as {
      report_type: string
      description: string
      amount?: number | null
      notes?: string | null
      photo_url?: string | null
    }
    if (!body.description?.trim()) return NextResponse.json({ error: 'Description required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('elec_project_reports')
      .insert({
        quote_id: id,
        portal_account_id: staff.portal_account_id,
        report_type: body.report_type || 'other',
        description: body.description.trim(),
        amount: body.amount ?? null,
        notes: body.notes?.trim() || null,
        photo_url: body.photo_url ?? null,
      })
      .select()
      .single()
    if (error) throw error

    // Notify admin
    const typeLabel = TYPE_LABELS[body.report_type] ?? 'Report'
    await supabaseAdmin.from('elec_notifications').insert({
      portal_account_id: staff.portal_account_id,
      type: 'report_submitted',
      title: `${typeLabel} — ${staff.name}`,
      body: `${body.description.trim().slice(0, 100)}${body.description.trim().length > 100 ? '…' : ''}` +
            (quote.project_name ? ` on ${quote.project_name}` : ''),
      metadata: { report_id: data.id, quote_id: id, staff_id: staff.id, report_type: body.report_type },
    })

    return NextResponse.json(data, { status: 201 })
  } catch (e) { return apiError(e) }
}
