import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ElecSnagPDF } from '@/lib/pdf/ElecSnagPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import type { ElecQuote, ElecClient, ElecSettings, ElecSnagItem } from '@/lib/elec-types'

export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  try {
    const { id: quoteId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const [{ data: quoteRaw }, { data: snags }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('elec_quotes')
        .select('*, client:elec_clients(*)')
        .eq('id', quoteId)
        .eq('portal_account_id', account.id)
        .single(),
      supabaseAdmin
        .from('elec_snag_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('raised_date'),
      supabaseAdmin
        .from('elec_settings')
        .select('*')
        .eq('portal_account_id', account.id)
        .maybeSingle(),
    ])

    if (!quoteRaw) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const client      = Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client
    const quote       = quoteRaw as ElecQuote
    const companyName = account.company_name ?? account.email ?? 'Company'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logoUrl     = await fetchLogoBase64(account.logo_url)

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(ElecSnagPDF, {
        quote,
        client:   (client ?? null) as ElecClient | null,
        settings: (settings ?? null) as ElecSettings | null,
        snags:    (snags ?? []) as ElecSnagItem[],
        companyName,
        companyEmail: account.email,
        logoUrl,
      }) as any
    )

    const slug = quote.quote_number ?? quoteId
    const disposition = inline ? `inline; filename="${slug}-Snag-List.pdf"` : `attachment; filename="${slug}-Snag-List.pdf"`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
