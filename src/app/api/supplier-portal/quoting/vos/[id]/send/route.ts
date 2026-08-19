import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    const body = await req.json() as { email: string; message?: string }
    if (!body.email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    // Fetch VO and verify ownership via quote
    const { data: vo } = await supabaseAdmin
      .from('elec_variation_orders')
      .select('*, quote:elec_quotes(id, project_name, quote_number, portal_account_id, vat_rate)')
      .eq('id', id)
      .single()

    if (!vo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const quote = Array.isArray(vo.quote) ? vo.quote[0] : vo.quote
    if (!quote || quote.portal_account_id !== account.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (vo.status !== 'pending') {
      return NextResponse.json({ error: 'VO is no longer pending' }, { status: 409 })
    }

    // Fetch the VO's line items for the detail table
    const { data: voItems } = await supabaseAdmin
      .from('elec_quote_line_items')
      .select('description, unit, quoted_quantity, quoted_unit_rate, labour_rate')
      .eq('variation_order_id', id)
      .eq('is_variation', true)
      .order('sort_order', { ascending: true })

    const lineItems = (voItems ?? []) as {
      description: string
      unit: string | null
      quoted_quantity: number
      quoted_unit_rate: number
      labour_rate: number | null
    }[]

    // Ensure share_token exists
    let shareToken = vo.share_token as string | null
    if (!shareToken) {
      const { data: updated } = await supabaseAdmin
        .from('elec_variation_orders')
        .update({ share_token: crypto.randomUUID() })
        .eq('id', id)
        .select('share_token')
        .single()
      shareToken = updated?.share_token ?? null
    }
    if (!shareToken) return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'
    const approvalUrl = `${baseUrl}/vo/${shareToken}`
    const vatAmt = vo.value * ((quote.vat_rate ?? 15) / 100)
    const totalIncVat = vo.value + vatAmt
    const companyName = account.company_name ?? 'Your contractor'
    const messageHtml = body.message?.trim()
      ? `<div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin-bottom:16px;"><p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717A;">Message from ${companyName}</p><p style="margin:0;font-size:13px;color:#18181B;">${body.message.trim()}</p></div>`
      : ''

    const fmtR = (n: number) => 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const fmtQty = (n: number) => n.toLocaleString('en-ZA', { maximumFractionDigits: 2 })
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const lineTotal = (li: typeof lineItems[number]) =>
      li.quoted_quantity * (li.quoted_unit_rate + (li.labour_rate ?? 0))

    const itemsHtml = lineItems.length > 0
      ? `<div style="border:1px solid #E4E4E7;border-radius:10px;overflow:hidden;margin-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead>
          <tr style="background:#F4F4F5;">
            <th align="left" style="padding:8px 12px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717A;">Description</th>
            <th align="right" style="padding:8px 6px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717A;white-space:nowrap;">Qty</th>
            <th align="left" style="padding:8px 6px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717A;">Unit</th>
            <th align="right" style="padding:8px 6px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717A;white-space:nowrap;">Rate</th>
            <th align="right" style="padding:8px 12px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717A;white-space:nowrap;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map(li => `<tr style="border-top:1px solid #E4E4E7;">
            <td style="padding:9px 12px;color:#18181B;">${esc(li.description)}</td>
            <td align="right" style="padding:9px 6px;color:#3F3F46;white-space:nowrap;">${fmtQty(li.quoted_quantity)}</td>
            <td style="padding:9px 6px;color:#71717A;">${esc(li.unit ?? '')}</td>
            <td align="right" style="padding:9px 6px;color:#3F3F46;white-space:nowrap;">${fmtR(li.quoted_unit_rate + (li.labour_rate ?? 0))}</td>
            <td align="right" style="padding:9px 12px;font-weight:600;color:#18181B;white-space:nowrap;">${fmtR(lineTotal(li))}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`
      : ''

    const itemsText = lineItems.length > 0
      ? '\n' + lineItems.map(li =>
          `- ${li.description}: ${fmtQty(li.quoted_quantity)}${li.unit ? ' ' + li.unit : ''} @ ${fmtR(li.quoted_unit_rate + (li.labour_rate ?? 0))} = ${fmtR(lineTotal(li))}`
        ).join('\n') + '\n'
      : ''

    await resend.emails.send({
      from: `${companyName} via QuotingHub <noreply@quotinghub.co.za>`,
      replyTo: account.email,
      to: body.email.trim(),
      subject: `Variation Order for approval — ${vo.vo_number} · ${quote.project_name}`,
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Inter,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E4E7;">
  <div style="background:#1E2A38;padding:28px 32px;">
    <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.6);">Variation Order — Action Required</p>
    <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${quote.project_name}</h1>
  </div>
  <div style="padding:28px 32px;">
    <p style="margin:0 0 16px;font-size:14px;color:#3F3F46;">
      <strong>${companyName}</strong> has submitted a Variation Order for <strong>${quote.project_name}</strong> that requires your approval.
    </p>
    ${messageHtml}
    <div style="margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717A;">${vo.vo_number}</p>
      <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#18181B;">${vo.description}</p>
    </div>
    ${itemsHtml}
    <div style="background:#F4F4F5;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;border-top:1px solid #E4E4E7;padding-top:10px;margin-top:4px;">
        <span style="font-size:13px;color:#71717A;">Value (ex VAT)</span>
        <span style="font-size:13px;font-weight:600;color:#18181B;">${fmtR(vo.value)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        <span style="font-size:13px;color:#71717A;">VAT (${quote.vat_rate ?? 15}%)</span>
        <span style="font-size:13px;color:#71717A;">${fmtR(vatAmt)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid #E4E4E7;padding-top:8px;margin-top:8px;">
        <span style="font-size:14px;font-weight:700;color:#18181B;">Total incl. VAT</span>
        <span style="font-size:14px;font-weight:700;color:#3A7CA5;">${fmtR(totalIncVat)}</span>
      </div>
    </div>
    ${vo.notes ? `<p style="margin:0 0 20px;font-size:13px;color:#71717A;font-style:italic;">${vo.notes}</p>` : ''}
    <a href="${approvalUrl}"
      style="display:inline-block;background:#3A7CA5;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:700;">
      Review &amp; Respond →
    </a>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#71717A;">
      If you have any questions, reply to this email and we'll get back to you.
    </p>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#18181B;">
      Kind regards,<br>
      <strong>${companyName}</strong><br>
      <a href="mailto:${account.email}" style="color:#3A7CA5;text-decoration:none;">${account.email}</a>
    </p>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #E4E4E7;">
    <p style="margin:0;font-size:11px;color:#A1A1AA;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;text-decoration:none;">QuotingHub</a></p>
  </div>
</div>
</body></html>`,
      text: `${companyName} has submitted Variation Order ${vo.vo_number} for ${quote.project_name}.\n\n${vo.description}\n${itemsText}\nValue (ex VAT): ${fmtR(vo.value)}\nTotal incl. VAT: ${fmtR(totalIncVat)}\n\nReview and respond: ${approvalUrl}\n\nIf you have any questions, reply to this email and we'll get back to you.\n\nKind regards,\n${companyName}\n${account.email}`,
    })

    await supabaseAdmin
      .from('elec_variation_orders')
      .update({ sent_to_email: body.email.trim(), sent_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
