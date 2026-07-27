import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolveCreatorName } from '@/lib/resolve-creator'
import { resolvePortalAccount } from '@/lib/portal-account'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: source } = await supabaseAdmin
      .from('elec_quotes')
      .select('*')
      .eq('id', id)
      .eq('portal_account_id', account.id)
      .single()

    if (!source) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const [{ data: sections }, { data: items }, { data: settings }] = await Promise.all([
      supabaseAdmin.from('elec_quote_sections').select('*').eq('quote_id', id).order('sort_order'),
      supabaseAdmin.from('elec_quote_line_items').select('*').eq('quote_id', id).order('variation_order_id', { nullsFirst: true }).order('sort_order').order('created_at'),
      supabaseAdmin
        .from('elec_settings')
        .select('company_code, quote_prefix')
        .eq('portal_account_id', account.id)
        .maybeSingle(),
    ])

    // Same numbering scheme as new-project creation: {COMPANYCODE}-{PREFIX}-{YEAR}-{seq}
    const autoCode = (account.company_name ?? '').split(/\s+/).map((w: string) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 5)
    const companyCode = (settings?.company_code ?? '').trim() || autoCode
    const prefix = settings?.quote_prefix ?? 'QU'
    const year = new Date().getFullYear()

    const { count } = await supabaseAdmin
      .from('elec_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('portal_account_id', account.id)

    const num = String((count ?? 0) + 1).padStart(3, '0')
    const quoteNumber = companyCode ? `${companyCode}-${prefix}-${year}-${num}` : `${prefix}-${year}-${num}`

    const createdByName = await resolveCreatorName(user.id)

    const insertRow = {
      portal_account_id: account.id,
      client_id: source.client_id,
      quote_number: quoteNumber,
      project_name: `${source.project_name} (Copy)`,
      project_address: source.project_address,
      description: source.description,
      project_type: source.project_type,
      contract_type: source.contract_type,
      status: 'draft',
      vat_rate: source.vat_rate,
      retention_percentage: source.retention_percentage,
      payment_terms_days: source.payment_terms_days,
      liquidated_damages_per_day: source.liquidated_damages_per_day,
      defects_liability_period_days: source.defects_liability_period_days,
      staff_id: source.staff_id,
      additional_staff_ids: source.additional_staff_ids,
      drawing_reference: source.drawing_reference,
      is_quick_job: source.is_quick_job,
      created_by_name: createdByName,
      // Explicitly reset: quoted_date, approved_date, expected/practical_completion_date,
      // notes, archived_at, invoiced, share_token(_created_at) — a duplicate is a fresh
      // draft, not a continuation of the source project's timeline or sharing state.
    }

    const { data: newQuote, error: insertErr } = await supabaseAdmin
      .from('elec_quotes')
      .insert(insertRow)
      .select()
      .single()

    if (insertErr || !newQuote) return NextResponse.json({ error: insertErr?.message ?? 'Failed to duplicate' }, { status: 500 })

    // Duplicate sections, preserving old id -> new id so line items can be re-linked
    const sectionIdMap = new Map<string, string>()
    if (sections && sections.length > 0) {
      const { data: newSections, error: sectionsErr } = await supabaseAdmin
        .from('elec_quote_sections')
        .insert(sections.map(s => ({ quote_id: newQuote.id, title: s.title, sort_order: s.sort_order })))
        .select()
      if (sectionsErr) return NextResponse.json({ error: sectionsErr.message }, { status: 500 })
      newSections?.forEach((ns, i) => sectionIdMap.set(sections[i].id, ns.id))
    }

    // Duplicate line items (both sectioned and free), resetting variation/as-built state
    if (items && items.length > 0) {
      const { error: itemsErr } = await supabaseAdmin.from('elec_quote_line_items').insert(
        items.map(i => ({
          quote_id: newQuote.id,
          section_id: i.section_id ? sectionIdMap.get(i.section_id) ?? null : null,
          description: i.description,
          unit: i.unit,
          item_type: i.item_type,
          drawing_reference: i.drawing_reference,
          subcontractor_name: i.subcontractor_name,
          quoted_quantity: i.quoted_quantity,
          quoted_unit_rate: i.quoted_unit_rate,
          labour_rate: i.labour_rate,
          material_rate: i.material_rate,
          cost_unit_rate: i.cost_unit_rate,
          markup_percentage: i.markup_percentage,
          as_built_quantity: null,
          as_built_unit_rate: null,
          variation_order_id: null,
          is_variation: false,
          sort_order: i.sort_order,
        }))
      )
      if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })
    }

    return NextResponse.json({ id: newQuote.id, quote_number: quoteNumber })
  } catch (e) {
    return apiError(e)
  }
}
