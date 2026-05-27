import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export const maxDuration = 30

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

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, company_name, email')
      .eq('auth_user_id', user.id)
      .single()
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: claim } = await supabaseAdmin
      .from('elec_claims')
      .select('*, quote:elec_quotes(project_name, project_address)')
      .eq('id', claimId)
      .eq('portal_account_id', account.id)
      .single()
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    // Generate or reuse share token
    let token = claim.share_token as string | null
    if (!token) {
      token = crypto.randomUUID()
      await supabaseAdmin
        .from('elec_claims')
        .update({ share_token: token, share_token_created_at: new Date().toISOString() })
        .eq('id', claimId)
    }

    // Advance to submitted if draft
    if (claim.status === 'draft') {
      await supabaseAdmin
        .from('elec_claims')
        .update({ status: 'submitted', sent_at: new Date().toISOString() })
        .eq('id', claimId)
    }

    const companyName = account.company_name ?? account.email ?? 'Your contractor'
    const clientName = claim.sent_to_name ?? ''
    const quote = Array.isArray(claim.quote) ? claim.quote[0] : claim.quote
    const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'}/c/${token}`
    const titleWord = claim.claim_type === 'retention' ? 'Retention Release' : ['invoiced', 'paid'].includes(claim.status) ? 'Tax Invoice' : 'Progress Claim'
    const subject = `${titleWord} ${claim.claim_number}${quote?.project_name ? ` – ${quote.project_name}` : ''}`

    await resend.emails.send({
      from: `${companyName} via QuotingHub <notifications@quotinghub.co.za>`,
      replyTo: account.email,
      to: email,
      subject,
      html: buildLinkEmail({ companyName, clientName, claim, quote, viewUrl, titleWord, message }),
      text: `Hi ${clientName},\n\n${message ? message + '\n\n' : ''}Please find your ${titleWord.toLowerCase()} ${claim.claim_number} for ${fmtMonth(claim.period_month)}.\n\nAmount: ${fmtR(claim.total_claimed)}\n\nView here: ${viewUrl}\n\n${companyName}`,
    })

    return NextResponse.json({ ok: true, status: claim.status === 'draft' ? 'submitted' : claim.status })
  } catch (e) {
    return apiError(e)
  }
}

function buildLinkEmail({ companyName, clientName, claim, quote, viewUrl, titleWord, message }: {
  companyName: string
  clientName: string
  claim: { claim_number: string; total_claimed: number; period_month: string; claim_type: string; status: string }
  quote: { project_name: string; project_address: string | null } | null
  viewUrl: string
  titleWord: string
  message?: string
}) {
  const periodLabel = fmtMonth(claim.period_month)
  const amount = fmtR(claim.total_claimed)

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
            ${message ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">${message}</p>` : `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">Please find your ${titleWord.toLowerCase()} for ${periodLabel} attached for your records.</p>`}

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4E4E7;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Claim / Invoice Number</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#3A7CA5;">${claim.claim_number}</p>
                </td>
                <td style="padding:16px 20px;border-bottom:1px solid #E4E4E7;border-left:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Amount Claimed</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#18181B;">${amount}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Billing Period</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${periodLabel}</p>
                </td>
                <td style="padding:16px 20px;border-bottom:1px solid #E4E4E7;border-left:1px solid #E4E4E7;">
                  <p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Project</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${quote?.project_name ?? '—'}</p>
                  ${quote?.project_address ? `<p style="margin:2px 0 0;font-size:12px;color:#71717A;">${quote.project_address}</p>` : ''}
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background-color:#3A7CA5;">
                  <a href="${viewUrl}" target="_blank"
                    style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                    View ${titleWord} Online →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:12px;color:#71717A;">
              Or copy this link: <a href="${viewUrl}" style="color:#3A7CA5;word-break:break-all;">${viewUrl}</a>
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
