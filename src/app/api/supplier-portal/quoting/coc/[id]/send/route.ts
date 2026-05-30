import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ElecCOCPDF } from '@/lib/pdf/ElecCOCPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import type { ElecCOC, ElecQuote, ElecClient, ElecSettings } from '@/lib/elec-types'

export const maxDuration = 60

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cocId } = await params
    const { email, message } = await req.json() as { email: string; message?: string }
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, company_name, email, logo_url')
      .eq('auth_user_id', user.id)
      .single()
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: coc } = await supabaseAdmin
      .from('elec_coc')
      .select('*')
      .eq('id', cocId)
      .single()
    if (!coc) return NextResponse.json({ error: 'COC not found' }, { status: 404 })

    const [{ data: quoteRaw }, { data: settings }] = await Promise.all([
      supabaseAdmin.from('elec_quotes').select('*, client:elec_clients(*)').eq('id', coc.quote_id).eq('portal_account_id', account.id).single(),
      supabaseAdmin.from('elec_settings').select('*').eq('portal_account_id', account.id).maybeSingle(),
    ])
    if (!quoteRaw) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const client = Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client
    const companyName = account.company_name ?? account.email ?? 'Company'
    const logoUrl = await fetchLogoBase64((account as { logo_url?: string }).logo_url)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(createElement(ElecCOCPDF, {
      coc: coc as ElecCOC,
      quote: quoteRaw as ElecQuote,
      client: (client ?? null) as ElecClient | null,
      settings: (settings ?? null) as ElecSettings | null,
      companyName,
      logoUrl,
    }) as any)

    // Record send
    await supabaseAdmin
      .from('elec_coc')
      .update({ sent_to_email: email, sent_at: new Date().toISOString() })
      .eq('id', cocId)

    const clientName = (client as ElecClient | null)?.client_name ?? ''
    await resend.emails.send({
      from: `${companyName} via QuotingHub <noreply@quotinghub.co.za>`,
      replyTo: account.email,
      to: email,
      subject: `Certificate of Compliance – ${quoteRaw.project_name}`,
      html: buildCOCEmail({ companyName, companyEmail: account.email, clientName, coc: coc as ElecCOC, quote: quoteRaw as ElecQuote, message }),
      text: `Hi ${clientName},\n\n${message ? message + '\n\n' : ''}Please find your Certificate of Compliance (${coc.coc_number}) attached for ${quoteRaw.project_name}.\n\nIf you have any questions, reply to this email and we'll get back to you.\n\nKind regards,\n${companyName}\n${account.email}`,
      attachments: [{
        filename: `${coc.coc_number}-COC.pdf`,
        content: Buffer.from(buffer).toString('base64'),
      }],
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

function buildCOCEmail({ companyName, companyEmail, clientName, coc, quote, message }: {
  companyName: string; companyEmail: string; clientName: string
  coc: { coc_number: string; issue_date: string }
  quote: { project_name: string; project_address: string | null }
  message?: string
}) {
  const issueDate = new Date(coc.issue_date + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  const bodyText = message
    ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">${message}</p>`
    : `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">Please find your Certificate of Compliance attached for the electrical installation at <strong>${quote.project_name}</strong>.</p>`
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Certificate of Compliance</title></head>
<body style="margin:0;padding:0;background-color:#F0F2F5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F2F5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#1E2A38;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${companyName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:0.08em;text-transform:uppercase;">Certificate of Compliance</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #E4E4E7;border-right:1px solid #E4E4E7;">
            ${clientName ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">Hi ${clientName},</p>` : ''}
            ${bodyText}
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4E4E7;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">COC Number</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#16A34A;">${coc.coc_number}</p>
                </td>
                <td style="padding:16px 20px;border-bottom:1px solid #E4E4E7;border-left:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Issue Date</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${issueDate}</p>
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
            <p style="margin:0 0 24px;font-size:13px;color:#71717A;line-height:1.7;">This COC is issued in terms of the Occupational Health &amp; Safety Act, Act 85 of 1993, and the Electrical Installation Regulations of 2009.</p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.7;color:#71717A;">If you have any questions, reply to this email and we'll get back to you.</p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#18181B;">
              Kind regards,<br>
              <strong>${companyName}</strong><br>
              <a href="mailto:${companyEmail}" style="color:#3A7CA5;text-decoration:none;">${companyEmail}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F0F2F5;border:1px solid #E4E4E7;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#71717A;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;text-decoration:none;">QuotingHub</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
