import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ElecQuotePDF } from '@/lib/pdf/ElecQuotePDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import type { ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecSettings } from '@/lib/elec-types'

export const maxDuration = 60

const resend = new Resend(process.env.RESEND_API_KEY)

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quoteId } = await params
    const { email, message, company, qs_name, qs_email } = await req.json() as { email: string; message?: string; company?: string; qs_name?: string; qs_email?: string }
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const [{ data: quoteRaw }, { data: sections }, { data: items }, { data: settings }] = await Promise.all([
      supabaseAdmin.from('elec_quotes').select('*, client:elec_clients(*)').eq('id', quoteId).eq('portal_account_id', account.id).single(),
      supabaseAdmin.from('elec_quote_sections').select('*').eq('quote_id', quoteId).order('sort_order'),
      supabaseAdmin.from('elec_quote_line_items').select('*').eq('quote_id', quoteId).order('sort_order'),
      supabaseAdmin.from('elec_settings').select('*').eq('portal_account_id', account.id).maybeSingle(),
    ])
    if (!quoteRaw) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    // Transition to quoted if still draft
    if (quoteRaw.status === 'draft') {
      await supabaseAdmin
        .from('elec_quotes')
        .update({ status: 'quoted', quoted_date: new Date().toISOString().split('T')[0] })
        .eq('id', quoteId)
    }

    const client = Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client
    const companyName = account.company_name ?? account.email ?? 'Your contractor'
    const clientName = (client as ElecClient | null)?.client_name ?? ''
    const logoUrl = await fetchLogoBase64(account.logo_url)

    // Generate PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(createElement(ElecQuotePDF, {
      quote: quoteRaw as ElecQuote,
      client: (client ?? null) as ElecClient | null,
      sections: (sections ?? []) as ElecQuoteSection[],
      items: (items ?? []) as ElecQuoteLineItem[],
      settings: (settings ?? null) as ElecSettings | null,
      companyName,
      logoUrl,
    }) as any)

    const subtotal = (items ?? []).reduce((s, i) => s + (i as ElecQuoteLineItem).quoted_quantity * (i as ElecQuoteLineItem).quoted_unit_rate, 0)
    const total = subtotal * (1 + quoteRaw.vat_rate / 100)
    const subject = `Quote ${quoteRaw.quote_number} – ${quoteRaw.project_name}`

    // Sync client details back to the client record
    if (quoteRaw.client_id) {
      const clientPatch: Record<string, string> = { email }
      if (quoteRaw.project_address?.trim()) clientPatch.address = quoteRaw.project_address.trim()
      if (company?.trim()) clientPatch.company = company.trim()
      if (qs_name?.trim()) clientPatch.qs_name = qs_name.trim()
      if (qs_email?.trim()) clientPatch.qs_email = qs_email.trim()
      await supabaseAdmin.from('elec_clients').update(clientPatch).eq('id', quoteRaw.client_id)
    }

    await resend.emails.send({
      from: `${companyName} via QuotingHub <noreply@quotinghub.co.za>`,
      replyTo: account.email,
      to: email,
      subject,
      html: buildPdfEmail({ companyName, companyEmail: account.email, clientName, quote: quoteRaw, total, message }),
      text: `Hi ${clientName},\n\nThank you for the opportunity — please find your quote for ${quoteRaw.project_name} attached.\n\n${message ? message + '\n\n' : ''}Quote: ${quoteRaw.quote_number}\nTotal (incl. VAT): ${fmtR(total)}\n\nIf you have any questions or would like to discuss anything, don't hesitate to reach out.\n\nKind regards,\n${companyName}\n${account.email}`,
      attachments: [{
        filename: `${quoteRaw.quote_number}.pdf`,
        content: Buffer.from(buffer).toString('base64'),
      }],
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

function buildPdfEmail({ companyName, companyEmail, clientName, quote, total, message }: {
  companyName: string
  companyEmail: string
  clientName: string
  quote: { quote_number: string; project_name: string; project_address: string | null }
  total: number
  message?: string
}) {
  const bodyText = message
    ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">${message}</p>`
    : `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">Thank you for the opportunity — please find your quote for <strong>${quote.project_name}</strong> attached.</p>`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quote ${quote.quote_number}</title></head>
<body style="margin:0;padding:0;background-color:#F0F2F5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F2F5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <tr>
          <td style="background-color:#3A7CA5;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${companyName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.08em;text-transform:uppercase;">Quotation</p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #E4E4E7;border-right:1px solid #E4E4E7;">
            ${clientName ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">Hi ${clientName},</p>` : ''}
            ${bodyText}

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4E4E7;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Quote Number</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#3A7CA5;">${quote.quote_number}</p>
                </td>
                <td style="padding:16px 20px;border-bottom:1px solid #E4E4E7;border-left:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Total (incl. VAT)</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#18181B;">${fmtR(total)}</p>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:16px 20px;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Project</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${quote.project_name}</p>
                  ${quote.project_address ? `<p style="margin:2px 0 0;font-size:12px;color:#71717A;">${quote.project_address}</p>` : ''}
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#71717A;">
              If you have any questions or would like to discuss anything, don't hesitate to reach out.
            </p>

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
