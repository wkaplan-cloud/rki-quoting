import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'

// GET /api/supplier-portal/quoting/material-requests
// Query params: status, source_type, job_card_id, quote_id, count (returns {count})
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Support staff auth
    let portalAccountId: string | null = null
    const account = await resolvePortalAccount(user.id)
    if (account) {
      portalAccountId = account.id
    } else {
      const { data: staff } = await supabaseAdmin
        .from('elec_staff')
        .select('portal_account_id')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      portalAccountId = staff?.portal_account_id ?? null
    }
    if (!portalAccountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const statusFilter    = searchParams.get('status')
    const sourceType      = searchParams.get('source_type')
    const jobCardId       = searchParams.get('job_card_id')
    const quoteId         = searchParams.get('quote_id')
    const countOnly       = searchParams.get('count') === '1'

    let q = supabaseAdmin
      .from('elec_material_requests')
      .select(countOnly
        ? 'id'
        : '*, job_card:elec_job_cards(id,job_number,title), quote:elec_quotes(id,quote_number,project_name), line_item:elec_quote_line_items(id,description)'
      )
      .eq('portal_account_id', portalAccountId)

    if (statusFilter) q = q.eq('status', statusFilter)
    if (sourceType)   q = q.eq('source_type', sourceType)
    if (jobCardId)    q = q.eq('job_card_id', jobCardId)
    if (quoteId)      q = q.eq('quote_id', quoteId)

    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) throw error

    if (countOnly) return NextResponse.json({ count: (data ?? []).length })
    return NextResponse.json(data ?? [])
  } catch (e) { return apiError(e) }
}

// POST /api/supplier-portal/quoting/material-requests
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let portalAccountId: string | null = null
    let staffId: string | null = null
    let staffName: string | null = null

    const account = await resolvePortalAccount(user.id)
    if (account) {
      portalAccountId = account.id
    } else {
      const { data: staff } = await supabaseAdmin
        .from('elec_staff')
        .select('id, name, portal_account_id')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (staff) {
        portalAccountId = staff.portal_account_id
        staffId = staff.id
        staffName = staff.name
      }
    }
    if (!portalAccountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const body = await req.json() as {
      source_type: string
      job_card_id?: string
      quote_id?: string
      line_item_id?: string
      is_variation?: boolean
      description: string
      qty: number
      unit?: string
      notes?: string
    }

    if (!body.description?.trim()) return NextResponse.json({ error: 'Description required' }, { status: 400 })
    if (!body.source_type) return NextResponse.json({ error: 'source_type required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('elec_material_requests')
      .insert({
        portal_account_id: portalAccountId,
        source_type: body.source_type,
        job_card_id: body.job_card_id ?? null,
        quote_id: body.quote_id ?? null,
        line_item_id: body.line_item_id ?? null,
        is_variation: body.is_variation ?? false,
        description: body.description.trim(),
        qty: body.qty ?? 1,
        unit: body.unit ?? null,
        notes: body.notes ?? null,
        requested_by_staff_id: staffId,
        requested_by_name: staffName,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error
    // Notify admin when staff submits a material request
    if (staffId) {
      const sourceLabel = body.source_type === 'job_card' ? 'job card' : 'project'
      await supabaseAdmin.from('elec_notifications').insert({
        portal_account_id: portalAccountId,
        type: 'material_request',
        title: `Material needed — ${staffName ?? 'Staff'}`,
        body: `${body.description.trim()} (qty ${body.qty ?? 1}${body.unit ? ' ' + body.unit : ''}) on ${sourceLabel}`,
        metadata: { material_request_id: data.id, staff_id: staffId, source_type: body.source_type },
      })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (e) { return apiError(e) }
}
