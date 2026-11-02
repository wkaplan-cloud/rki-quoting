import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'
import { statementsEnabled } from '@/lib/statement'
import { renderStatement } from '@/lib/pdf/renderStatement'
import { formatZAR } from '@/lib/quoting'
import { apiError } from '@/lib/api-error'

export const maxDuration = 60

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(req: NextRequest) {
  try {
    const { clientId, to, body, includeSettled } = await req.json() as { clientId?: string; to?: string; body?: string; includeSettled?: boolean }
    if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await statementsEnabled(supabase))) {
      return NextResponse.json({ error: 'Statements are not switched on for this studio' }, { status: 403 })
    }

    const [rendered, { data: settings }] = await Promise.all([
      renderStatement(supabase, clientId, { includeSettled: includeSettled === true }),
      supabase.from('settings').select('business_name, email_from').maybeSingle(),
    ])
    if (!rendered) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const { statement } = rendered
    const recipient = to?.trim() || statement.client.email
    if (!recipient) return NextResponse.json({ error: 'Client email not set' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return NextResponse.json({ error: 'That email address doesn’t look right' }, { status: 400 })

    const studioName = settings?.business_name ?? 'Your Studio'
    const replyTo = settings?.email_from?.trim() || user.email || undefined
    const subject = `Statement - ${statement.client.client_name}`
    const text = body?.trim()
      || `Dear ${statement.client.client_name},\n\nPlease find attached your statement. The balance due is ${formatZAR(statement.balance)}.\n\nKind regards,\n${studioName}`

    const paragraphs = text.split('\n').map(line =>
      line.trim() === ''
        ? '<div style="height:12px;"></div>'
        : `<p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">${escHtml(line)}</p>`,
    ).join('')

    const { error } = await sendEmail({
      from: `${studioName} <noreply@quotinghub.co.za>`,
      ...(replyTo ? { replyTo } : {}),
      to: recipient,
      subject,
      text,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#4A4A47;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:22px;font-weight:600;color:#F5F2EC;">${escHtml(studioName)}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Statement</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            ${paragraphs}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:14px 18px;">
                  <p style="margin:0;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">Balance due</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1A1A18;">${formatZAR(statement.balance)}</p>
                </td>
              </tr>
            </table>
            <p style="margin:28px 0 0;font-size:13px;color:#8A877F;line-height:1.6;">The statement is attached as a PDF.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">${escHtml(studioName)}${replyTo ? ` &middot; <a href="mailto:${escHtml(replyTo)}" style="color:#8A877F;text-decoration:none;">${escHtml(replyTo)}</a>` : ''}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Sent via QuotingHub</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      attachments: [{ filename: rendered.filename, content: Buffer.from(rendered.buffer) }],
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Save a newly typed address to the client, the same as invoice emails do.
    if (to?.trim() && to.trim() !== (statement.client.email ?? '')) {
      await supabase.from('clients').update({ email: to.trim() }).eq('id', clientId)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
