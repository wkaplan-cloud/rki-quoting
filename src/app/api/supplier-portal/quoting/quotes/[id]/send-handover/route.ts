import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { buildHandoverPack } from '@/lib/handover'
import { activeServicePlan } from '@/lib/service-contracts'

export const maxDuration = 60

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quoteId } = await params
    const { email, message, include_credentials } = await req.json() as { email?: string; message?: string; include_credentials?: boolean }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const pack = await buildHandoverPack({
      accountId: account.id, quoteId, includeCredentials: include_credentials === true,
      servicePlan: await activeServicePlan(account.id, quoteId),
    })
    if (!pack) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const { quote, client, companyName, companyEmail } = pack
    const greeting = client?.client_name ? `Hi ${esc(client.client_name)},` : 'Hi,'
    const intro = message?.trim()
      ? esc(message.trim()).replace(/\n/g, '<br>')
      : `Thank you for choosing us. Attached is the handover pack for <strong>${esc(quote.project_name)}</strong>: every device we installed, where it is, its serial and network details, and its warranty date. Keep it somewhere safe — it's what we'll ask for if you ever need support.`

    await sendEmail({
      from: `${companyName} via QuotingHub <noreply@quotinghub.co.za>`,
      replyTo: companyEmail,
      to: email.trim(),
      subject: `Your system handover pack – ${quote.project_name}`,
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F2F5;padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
  <tr><td style="background:#1F5C45;padding:30px 40px;border-radius:8px 8px 0 0;">
    <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">${esc(companyName)}</p>
    <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.08em;text-transform:uppercase;">System Handover</p>
  </td></tr>
  <tr><td style="background:#fff;padding:36px 40px;border-left:1px solid #E4E4E7;border-right:1px solid #E4E4E7;">
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#18181B;">${greeting}</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#18181B;">${intro}</p>
    ${include_credentials ? `<p style="margin:0 0 22px;font-size:13px;line-height:1.6;color:#9A3412;">This pack includes device passwords. Please store it securely.</p>` : ''}
    <p style="margin:0;font-size:14px;line-height:1.7;color:#18181B;">Kind regards,<br><strong>${esc(companyName)}</strong><br>
      <a href="mailto:${esc(companyEmail)}" style="color:#1F5C45;text-decoration:none;">${esc(companyEmail)}</a></p>
  </td></tr>
  <tr><td style="background:#F0F2F5;border:1px solid #E4E4E7;border-top:none;border-radius:0 0 8px 8px;padding:18px 40px;">
    <p style="margin:0;font-size:12px;color:#71717A;">Sent via <a href="https://quotinghub.co.za" style="color:#1F5C45;text-decoration:none;">QuotingHub</a></p>
  </td></tr>
</table></td></tr></table></body></html>`,
      text: `${client?.client_name ? `Hi ${client.client_name},` : 'Hi,'}\n\n${message?.trim() || `Attached is the handover pack for ${quote.project_name}: every device we installed, its serial and network details, and its warranty date.`}\n\nKind regards,\n${companyName}\n${companyEmail}`,
      attachments: [{ filename: `${quote.quote_number}-handover.pdf`, content: Buffer.from(pack.buffer).toString('base64') }],
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
