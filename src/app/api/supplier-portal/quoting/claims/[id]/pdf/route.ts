import { NextRequest, NextResponse } from 'next/server'
import { renderPdfToBuffer } from '@/lib/pdf/render'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { ElecClaimPDF } from '@/lib/pdf/ElecClaimPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import type { ElecClaim, ElecClaimLineItem, ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecSettings } from '@/lib/elec-types'
import type { ClaimLineItemForPDF } from '@/lib/pdf/ElecClaimPDF'

export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  try {
    const { id: claimId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    // Fetch the claim (verify ownership via portal_account_id)
    const { data: claimRaw } = await supabaseAdmin
      .from('elec_claims')
      .select('*, line_items:elec_claim_line_items(*)')
      .eq('id', claimId)
      .eq('portal_account_id', account.id)
      .single()
    if (!claimRaw) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    const claim = claimRaw as ElecClaim & { line_items: ElecClaimLineItem[] }

    // Fetch quote + sections + all line items + settings in parallel
    const [{ data: quoteRaw }, { data: sections }, { data: quoteItems }, { data: settings }, { data: prevClaims }] = await Promise.all([
      supabaseAdmin
        .from('elec_quotes')
        .select('*, client:elec_clients(*)')
        .eq('id', claim.quote_id)
        .single(),
      supabaseAdmin
        .from('elec_quote_sections')
        .select('*')
        .eq('quote_id', claim.quote_id)
        .order('sort_order'),
      supabaseAdmin
        .from('elec_quote_line_items')
        .select('*')
        .eq('quote_id', claim.quote_id)
        .order('variation_order_id', { nullsFirst: true })
        .order('sort_order')
        .order('created_at'),
      supabaseAdmin
        .from('elec_settings')
        .select('*')
        .eq('portal_account_id', account.id)
        .maybeSingle(),
      // All non-draft claims for this quote EXCEPT the current one
      supabaseAdmin
        .from('elec_claim_line_items')
        .select('quote_line_item_id, amount_claimed, claim:elec_claims!inner(id, status, quote_id)')
        .eq('claim.quote_id', claim.quote_id)
        .neq('claim.id', claimId)
        .neq('claim.status', 'draft'),
    ])

    if (!quoteRaw) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const quoteClient = Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client
    const quote = quoteRaw as ElecQuote

    // Build map of prev claimed amounts per quote line item
    const prevClaimedMap: Record<string, number> = {}
    for (const li of (prevClaims ?? [])) {
      const id = li.quote_line_item_id
      prevClaimedMap[id] = (prevClaimedMap[id] ?? 0) + (li.amount_claimed ?? 0)
    }
    const prevTotalClaimed = Object.values(prevClaimedMap).reduce((s, v) => s + v, 0)

    // Build claim line items for PDF — merge claim line items with quote line items
    const quoteItemMap: Record<string, ElecQuoteLineItem> = {}
    for (const qi of (quoteItems ?? [])) {
      quoteItemMap[qi.id] = qi as ElecQuoteLineItem
    }

    const claimLineItemMap: Record<string, ElecClaimLineItem> = {}
    for (const li of (claim.line_items ?? [])) {
      claimLineItemMap[li.quote_line_item_id] = li
    }

    // Build PDF line items in quote sort order (only items that have a claim line item)
    const lineItemsForPDF: ClaimLineItemForPDF[] = (quoteItems ?? [])
      .map(qi => {
        const cli = claimLineItemMap[qi.id]
        if (!cli) return null
        const qli = qi as ElecQuoteLineItem
        const contractValue = (qli.quoted_quantity ?? 0) * ((qli.quoted_unit_rate ?? 0) + (qli.labour_rate ?? 0))
        return {
          id:             cli.id,
          description:    (qi as ElecQuoteLineItem).description,
          section_id:     (qi as ElecQuoteLineItem).section_id,
          contract_value: contractValue,
          prev_claimed:   prevClaimedMap[qi.id] ?? 0,
          this_pct:       cli.percentage_claimed ?? 0,
          this_claimed:   cli.amount_claimed ?? 0,
        } satisfies ClaimLineItemForPDF
      })
      .filter((li): li is ClaimLineItemForPDF => li !== null)

    const contractTotal = (quoteItems ?? []).reduce((s, qi) => {
      const qli = qi as ElecQuoteLineItem
      return s + (qli.quoted_quantity ?? 0) * ((qli.quoted_unit_rate ?? 0) + (qli.labour_rate ?? 0))
    }, 0)

    const companyName = account.company_name ?? account.email ?? 'Company'
    const logoUrl = await fetchLogoBase64((account as any).logo_url)

    const buffer = await renderPdfToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(ElecClaimPDF, {
        claim,
        lineItems:        lineItemsForPDF,
        sections:         (sections ?? []) as ElecQuoteSection[],
        quote,
        client:           (quoteClient ?? null) as ElecClient | null,
        settings:         (settings ?? null) as ElecSettings | null,
        companyName,
        companyEmail: account.email,
        contractTotal,
        prevTotalClaimed,
        logoUrl,
      })
    )

    const titleWord = claim.claim_type === 'retention' ? 'Retention' : ['invoiced', 'paid'].includes(claim.status) ? 'Tax-Invoice' : 'Claim'
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': inline ? `inline; filename="${claim.claim_number}-${titleWord}.pdf"` : `attachment; filename="${claim.claim_number}-${titleWord}.pdf"`,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
