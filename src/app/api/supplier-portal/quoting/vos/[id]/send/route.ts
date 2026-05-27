import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, company_name, email')
      .eq('auth_user_id', user.id)
      .single()
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

    await resend.emails.send({
      from: 'QuotingHub Notifications <noreply@quotinghub.co.za>',
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
      <strong>${companyName}</strong> has submitted a Variation Order requiring your approval.
    </p>
    ${messageHtml}
    <div style="background:#F4F4F5;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717A;">${vo.vo_number}</p>
      <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#18181B;">${vo.description}</p>
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
  </div>
  <div style="padding:16px 32px;border-top:1px solid #E4E4E7;">
    <p style="margin:0;font-size:11px;color:#A1A1AA;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;text-decoration:none;">QuotingHub</a></p>
  </div>
</div>
</body></html>`,
      text: `${companyName} has submitted Variation Order ${vo.vo_number} for ${quote.project_name}.\n\n${vo.description}\n\nValue (ex VAT): ${fmtR(vo.value)}\nTotal incl. VAT: ${fmtR(totalIncVat)}\n\nReview and respond: ${approvalUrl}`,
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
