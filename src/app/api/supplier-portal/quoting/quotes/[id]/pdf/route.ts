import { NextRequest, NextResponse } from 'next/server'
import { renderPdfToBuffer } from '@/lib/pdf/render'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ElecQuotePDF } from '@/lib/pdf/ElecQuotePDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import type { ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecSettings } from '@/lib/elec-types'

export const maxDuration = 60

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quoteId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const [{ data: quoteRaw }, { data: sections }, { data: items }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('elec_quotes')
        .select('*, client:elec_clients(*)')
        .eq('id', quoteId)
        .eq('portal_account_id', account.id)
        .single(),
      supabaseAdmin
        .from('elec_quote_sections')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order'),
      supabaseAdmin
        .from('elec_quote_line_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('variation_order_id', { nullsFirst: true })
        .order('sort_order')
        .order('created_at'),
      supabaseAdmin
        .from('elec_settings')
        .select('*')
        .eq('portal_account_id', account.id)
        .maybeSingle(),
    ])

    if (!quoteRaw) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const client = Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client
    const quote  = quoteRaw as ElecQuote
    const companyName = account.company_name ?? account.email ?? 'Company'
    const logoUrl = await fetchLogoBase64(account.logo_url)

    const buffer = await renderPdfToBuffer(
      createElement(ElecQuotePDF, {
        quote,
        client:      (client ?? null) as ElecClient | null,
        sections:    (sections ?? []) as ElecQuoteSection[],
        items:       (items    ?? []) as ElecQuoteLineItem[],
        settings:    (settings ?? null) as ElecSettings | null,
        companyName,
        logoUrl,
      })
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quote.quote_number}.pdf"`,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
