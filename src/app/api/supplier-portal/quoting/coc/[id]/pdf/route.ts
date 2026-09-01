import { NextRequest, NextResponse } from 'next/server'
import { renderPdfToBuffer } from '@/lib/pdf/render'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { ElecCOCPDF } from '@/lib/pdf/ElecCOCPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import type { ElecCOC, ElecQuote, ElecClient, ElecSettings } from '@/lib/elec-types'

export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  try {
    const { id: cocId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: coc } = await supabaseAdmin
      .from('elec_coc')
      .select('*')
      .eq('id', cocId)
      .single()
    if (!coc) return NextResponse.json({ error: 'COC not found' }, { status: 404 })

    // Verify ownership via quote or job card or portal_account_id
    const isOwned = (coc.portal_account_id === account.id) ||
      (!coc.quote_id && !coc.job_card_id) // fallback for legacy
    if (!isOwned && coc.quote_id) {
      const { data: q } = await supabaseAdmin.from('elec_quotes').select('id').eq('id', coc.quote_id).eq('portal_account_id', account.id).maybeSingle()
      if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!isOwned && coc.job_card_id) {
      const { data: jc } = await supabaseAdmin.from('elec_job_cards').select('id').eq('id', coc.job_card_id).eq('portal_account_id', account.id).maybeSingle()
      if (!jc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Fetch quote (if linked) or build a stub from job card
    let quoteRaw: ElecQuote | null = null
    let clientData: ElecClient | null = null

    if (coc.quote_id) {
      const { data: q } = await supabaseAdmin
        .from('elec_quotes')
        .select('*, client:elec_clients(*)')
        .eq('id', coc.quote_id)
        .maybeSingle()
      quoteRaw = q as ElecQuote | null
      clientData = quoteRaw ? (Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client) : null
    } else if (coc.job_card_id) {
      const { data: jc } = await supabaseAdmin
        .from('elec_job_cards')
        .select('id, job_number, title, location, client_name')
        .eq('id', coc.job_card_id)
        .maybeSingle()
      if (jc) {
        quoteRaw = {
          id: jc.id,
          portal_account_id: account.id,
          quote_number: jc.job_number,
          project_name: jc.title,
          project_address: jc.location ?? null,
          client_id: null,
        } as unknown as ElecQuote
        if (jc.client_name) {
          clientData = { id: '', client_name: jc.client_name } as unknown as ElecClient
        }
      }
    }

    if (!quoteRaw) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

    const { data: settings } = await supabaseAdmin.from('elec_settings').select('*').eq('portal_account_id', account.id).maybeSingle()

    const companyName = account.company_name ?? account.email ?? 'Company'
    const logoUrl = await fetchLogoBase64(account.logo_url)

    const buffer = await renderPdfToBuffer(
      createElement(ElecCOCPDF, {
        coc:         coc as ElecCOC,
        quote:       quoteRaw as ElecQuote,
        client:      clientData as ElecClient | null,
        settings:    (settings ?? null) as ElecSettings | null,
        companyName,
        logoUrl,
      })
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': inline ? `inline; filename="${coc.coc_number}-COC.pdf"` : `attachment; filename="${coc.coc_number}-COC.pdf"`,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
