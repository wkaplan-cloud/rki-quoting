import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ElecCOCPDF } from '@/lib/pdf/ElecCOCPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import type { ElecCOC, ElecQuote, ElecClient, ElecSettings } from '@/lib/elec-types'

export const maxDuration = 60

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cocId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, company_name, email, logo_url')
      .eq('auth_user_id', user.id)
      .single()
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    // Fetch COC and verify ownership via the quote
    const { data: coc } = await supabaseAdmin
      .from('elec_coc')
      .select('*')
      .eq('id', cocId)
      .single()
    if (!coc) return NextResponse.json({ error: 'COC not found' }, { status: 404 })

    const [{ data: quoteRaw }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('elec_quotes')
        .select('*, client:elec_clients(*)')
        .eq('id', coc.quote_id)
        .eq('portal_account_id', account.id)
        .single(),
      supabaseAdmin
        .from('elec_settings')
        .select('*')
        .eq('portal_account_id', account.id)
        .maybeSingle(),
    ])

    if (!quoteRaw) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const client = Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client
    const companyName = account.company_name ?? account.email ?? 'Company'
    const logoUrl = await fetchLogoBase64((account as any).logo_url)

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(ElecCOCPDF, {
        coc:         coc as ElecCOC,
        quote:       quoteRaw as ElecQuote,
        client:      (client ?? null) as ElecClient | null,
        settings:    (settings ?? null) as ElecSettings | null,
        companyName,
        logoUrl,
      }) as any
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${coc.coc_number}-COC.pdf"`,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
