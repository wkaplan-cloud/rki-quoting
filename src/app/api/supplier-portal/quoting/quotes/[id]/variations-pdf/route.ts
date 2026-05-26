import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ElecVariationsPDF } from '@/lib/pdf/ElecVariationsPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import type { ElecQuote, ElecClient, ElecSettings, ElecVariationOrder } from '@/lib/elec-types'

export const maxDuration = 60

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quoteId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, company_name, email, logo_url')
      .eq('auth_user_id', user.id)
      .single()
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const [{ data: quoteRaw }, { data: vos }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('elec_quotes')
        .select('*, client:elec_clients(*)')
        .eq('id', quoteId)
        .eq('portal_account_id', account.id)
        .single(),
      supabaseAdmin
        .from('elec_variation_orders')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at'),
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
    const logoUrl     = await fetchLogoBase64((account as any).logo_url)

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(ElecVariationsPDF, {
        quote,
        client:          (client ?? null) as ElecClient | null,
        settings:        (settings ?? null) as ElecSettings | null,
        variationOrders: (vos ?? []) as ElecVariationOrder[],
        companyName,
        logoUrl,
      }) as any
    )

    const slug = quote.quote_number ?? quoteId
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${slug}-Variations.pdf"`,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
