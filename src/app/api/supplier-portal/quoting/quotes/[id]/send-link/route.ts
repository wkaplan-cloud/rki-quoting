import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const resend = new Resend(process.env.RESEND_API_KEY)

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quoteId } = await params
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

    const { data: quoteRaw } = await supabaseAdmin
      .from('elec_quotes')
      .select('*, client:elec_clients(client_name)')
      .eq('id', quoteId)
      .eq('portal_account_id', account.id)
      .single()
    if (!quoteRaw) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    // Generate or reuse share token
    let token = quoteRaw.share_token as string | null
    if (!token) {
      token = crypto.randomUUID()
      await supabaseAdmin
        .from('elec_quotes')
        .update({ share_token: token, share_token_created_at: new Date().toISOString() })
        .eq('id', quoteId)
    }

    // Transition to quoted if still draft
    if (quoteRaw.status === 'draft') {
      await supabaseAdmin
        .from('elec_quotes')
        .update({ status: 'quoted', quoted_date: new Date().toISOString().split('T')[0] })
        .eq('id', quoteId)
    }

    const { data: items } = await supabaseAdmin
      .from('elec_quote_line_items')
      .select('quoted_quantity, quoted_unit_rate')
      .eq('quote_id', quoteId)

    const subtotal = (items ?? []).reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0)
    const vatAmt = subtotal * (quoteRaw.vat_rate / 100)
    const total = subtotal + vatAmt

    const client = Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client
    const companyName = account.company_name ?? account.email ?? 'Your contractor'
    const clientName = client?.client_name ?? ''
    const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'}/q/${token}`

    const subject = `Quote ${quoteRaw.quote_number} – ${quoteRaw.project_name}`

    await resend.emails.send({
      from: `${companyName} via QuotingHub <notifications@quotinghub.co.za>`,
      replyTo: account.email,
      to: email,
      subject,
      html: buildLinkEmail({ companyName, clientName, quote: quoteRaw, total, approvalUrl, message }),
      text: `Hi ${clientName},\n\n${message ? message + '\n\n' : ''}Please review and approve your quote for ${quoteRaw.project_name}.\n\nQuote: ${quoteRaw.quote_number}\nTotal (incl. VAT): ${fmtR(total)}\n\nApprove here: ${approvalUrl}\n\n${companyName}`,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

function buildLinkEmail({ companyName, clientName, quote, total, approvalUrl, message }: {
  companyName: string
  clientName: string
  quote: { quote_number: string; project_name: string; project_address: string | null; quoted_date: string | null; payment_terms_days: number }
  total: number
  approvalUrl: string
  message?: string
}) {
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
            ${message ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">${message}</p>` : `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">Please find your quote ready for review.</p>`}

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

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background-color:#3A7CA5;">
                  <a href="${approvalUrl}" target="_blank"
                    style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                    Review &amp; Approve Quote →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:12px;color:#71717A;">
              Or copy this link: <a href="${approvalUrl}" style="color:#3A7CA5;word-break:break-all;">${approvalUrl}</a>
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
