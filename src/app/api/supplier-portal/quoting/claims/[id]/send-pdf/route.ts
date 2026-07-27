import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { ElecClaimPDF } from '@/lib/pdf/ElecClaimPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import type { ElecClaim, ElecClaimLineItem, ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecSettings } from '@/lib/elec-types'
import type { ClaimLineItemForPDF } from '@/lib/pdf/ElecClaimPDF'

export const maxDuration = 60

const resend = new Resend(process.env.RESEND_API_KEY)

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMonth(dateStr: string) {
  const d = new Date(dateStr.length === 7 ? dateStr + '-01' : dateStr)
  return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: claimId } = await params
    const { email, message } = await req.json() as { email: string; message?: string }
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: claimRaw } = await supabaseAdmin
      .from('elec_claims')
      .select('*, line_items:elec_claim_line_items(*)')
      .eq('id', claimId)
      .eq('portal_account_id', account.id)
      .single()
    if (!claimRaw) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    const claim = claimRaw as ElecClaim & { line_items: ElecClaimLineItem[] }

    const [{ data: quoteRaw }, { data: sections }, { data: quoteItems }, { data: settings }, { data: prevClaims }] = await Promise.all([
      supabaseAdmin.from('elec_quotes').select('*, client:elec_clients(*)').eq('id', claim.quote_id).single(),
      supabaseAdmin.from('elec_quote_sections').select('*').eq('quote_id', claim.quote_id).order('sort_order'),
      supabaseAdmin.from('elec_quote_line_items').select('*').eq('quote_id', claim.quote_id).order('variation_order_id', { nullsFirst: true }).order('sort_order').order('created_at'),
      supabaseAdmin.from('elec_settings').select('*').eq('portal_account_id', account.id).maybeSingle(),
      supabaseAdmin
        .from('elec_claim_line_items')
        .select('quote_line_item_id, amount_claimed, claim:elec_claims!inner(id, status, quote_id)')
        .eq('claim.quote_id', claim.quote_id)
        .neq('claim.id', claimId)
        .neq('claim.status', 'draft'),
    ])
    if (!quoteRaw) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const quoteClient = Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client

    const prevClaimedMap: Record<string, number> = {}
    for (const li of (prevClaims ?? [])) {
      const id = li.quote_line_item_id
      prevClaimedMap[id] = (prevClaimedMap[id] ?? 0) + (li.amount_claimed ?? 0)
    }
    const prevTotalClaimed = Object.values(prevClaimedMap).reduce((s, v) => s + v, 0)

    const quoteItemMap: Record<string, ElecQuoteLineItem> = {}
    for (const qi of (quoteItems ?? [])) quoteItemMap[qi.id] = qi as ElecQuoteLineItem

    const claimItemMap: Record<string, ElecClaimLineItem> = {}
    for (const li of (claim.line_items ?? [])) claimItemMap[li.quote_line_item_id] = li

    const lineItemsForPDF: ClaimLineItemForPDF[] = (quoteItems ?? [])
      .map(qi => {
        const cli = claimItemMap[qi.id]
        if (!cli) return null
        const contractValue = (qi as ElecQuoteLineItem).quoted_quantity * ((qi as ElecQuoteLineItem).quoted_unit_rate + ((qi as ElecQuoteLineItem).labour_rate ?? 0))
        return {
          id: cli.id, description: (qi as ElecQuoteLineItem).description,
          section_id: (qi as ElecQuoteLineItem).section_id,
          contract_value: contractValue, prev_claimed: prevClaimedMap[qi.id] ?? 0,
          this_pct: cli.percentage_claimed ?? 0, this_claimed: cli.amount_claimed ?? 0,
        } satisfies ClaimLineItemForPDF
      })
      .filter((li): li is ClaimLineItemForPDF => li !== null)

    const contractTotal = (quoteItems ?? []).reduce(
      (s, qi) => s + (qi as ElecQuoteLineItem).quoted_quantity * ((qi as ElecQuoteLineItem).quoted_unit_rate + ((qi as ElecQuoteLineItem).labour_rate ?? 0)), 0
    )

    const companyName = account.company_name ?? account.email ?? 'Company'
    const logoUrl = await fetchLogoBase64((account as { logo_url?: string }).logo_url)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(createElement(ElecClaimPDF, {
      claim, lineItems: lineItemsForPDF, sections: (sections ?? []) as ElecQuoteSection[],
      quote: quoteRaw as ElecQuote, client: (quoteClient ?? null) as ElecClient | null,
      settings: (settings ?? null) as ElecSettings | null,
      companyName, companyEmail: account.email, contractTotal, prevTotalClaimed, logoUrl,
    }) as any)

    // Advance to submitted if draft
    if (claim.status === 'draft') {
      await supabaseAdmin
        .from('elec_claims')
        .update({ status: 'submitted', sent_at: new Date().toISOString() })
        .eq('id', claimId)
    }

    const titleWord = claim.claim_type === 'retention' ? 'Retention Release' : ['invoiced', 'paid'].includes(claim.status) ? 'Tax Invoice' : 'Progress Claim'
    const periodLabel = fmtMonth(claim.period_month)
    const clientName = claim.sent_to_name ?? ''
    const subject = `${titleWord} ${claim.claim_number}${quoteRaw.project_name ? ` – ${quoteRaw.project_name}` : ''}`

    await resend.emails.send({
      from: `${companyName} via QuotingHub <noreply@quotinghub.co.za>`,
      replyTo: account.email,
      to: email,
      subject,
      html: buildPdfEmail({ companyName, companyEmail: account.email, clientName, claim, quote: quoteRaw, titleWord, periodLabel, message }),
      text: `Hi ${clientName},\n\n${message ? message + '\n\n' : ''}Please find your ${titleWord.toLowerCase()} ${claim.claim_number} attached for ${quoteRaw.project_name}.\n\nAmount: ${fmtR(claim.total_claimed)}\nPeriod: ${periodLabel}\n\nIf you have any questions, reply to this email and we'll get back to you.\n\nKind regards,\n${companyName}\n${account.email}`,
      attachments: [{
        filename: `${claim.claim_number}-${titleWord.replace(' ', '-')}.pdf`,
        content: Buffer.from(buffer).toString('base64'),
      }],
    })

    return NextResponse.json({ ok: true, status: claim.status === 'draft' ? 'submitted' : claim.status })
  } catch (e) {
    return apiError(e)
  }
}

function buildPdfEmail({ companyName, companyEmail, clientName, claim, quote, titleWord, periodLabel, message }: {
  companyName: string; companyEmail: string; clientName: string
  claim: { claim_number: string; total_claimed: number }
  quote: { project_name: string; project_address: string | null }
  titleWord: string; periodLabel: string; message?: string
}) {
  const bodyText = message
    ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">${message}</p>`
    : `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">Please find your ${titleWord.toLowerCase()} for <strong>${quote.project_name}</strong> attached for ${periodLabel}.</p>`
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titleWord} ${claim.claim_number}</title></head>
<body style="margin:0;padding:0;background-color:#F0F2F5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F2F5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <tr>
          <td style="background-color:#1E2A38;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${companyName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:0.08em;text-transform:uppercase;">${titleWord}</p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #E4E4E7;border-right:1px solid #E4E4E7;">
            ${clientName ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">Hi ${clientName},</p>` : ''}
            ${bodyText}

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4E4E7;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Claim / Invoice Number</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#3A7CA5;">${claim.claim_number}</p>
                </td>
                <td style="padding:16px 20px;border-bottom:1px solid #E4E4E7;border-left:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Amount Claimed</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#18181B;">${fmtR(claim.total_claimed)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Billing Period</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${periodLabel}</p>
                </td>
                <td style="padding:16px 20px;border-left:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Project</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${quote.project_name}</p>
                  ${quote.project_address ? `<p style="margin:2px 0 0;font-size:12px;color:#71717A;">${quote.project_address}</p>` : ''}
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#71717A;">If you have any questions, reply to this email and we'll get back to you.</p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#18181B;">
              Kind regards,<br>
              <strong>${companyName}</strong><br>
              <a href="mailto:${companyEmail}" style="color:#3A7CA5;text-decoration:none;">${companyEmail}</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#F0F2F5;border:1px solid #E4E4E7;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#71717A;">
              Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;text-decoration:none;">QuotingHub</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
