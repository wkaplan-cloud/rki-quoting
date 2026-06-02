import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ElecReconPDF } from '@/lib/pdf/ElecReconPDF'
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
      supabaseAdmin.from('elec_quotes').select('*, client:elec_clients(*)').eq('id', quoteId).eq('portal_account_id', account.id).single(),
      supabaseAdmin.from('elec_quote_sections').select('*').eq('quote_id', quoteId).order('sort_order'),
      supabaseAdmin.from('elec_quote_line_items').select('*').eq('quote_id', quoteId).eq('is_variation', false).order('sort_order'),
      supabaseAdmin.from('elec_settings').select('*').eq('portal_account_id', account.id).maybeSingle(),
    ])

    if (!quoteRaw) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const client = Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client
    const companyName = account.company_name ?? account.email ?? 'Company'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logoUrl = await fetchLogoBase64(account.logo_url)

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(ElecReconPDF, {
        quote: quoteRaw as ElecQuote,
        client: client as ElecClient | null,
        sections: (sections ?? []) as ElecQuoteSection[],
        items: (items ?? []) as ElecQuoteLineItem[],
        settings: settings as ElecSettings | null,
        companyName,
        logoUrl,
      }) as any
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="recon-${quoteId}.pdf"`,
      },
    })
  } catch (e) { return apiError(e) }
}
