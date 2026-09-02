import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { randomUUID } from 'crypto'


async function resolveAccountOrStaff(userId: string): Promise<{ accountId: string; companyName: string; email: string | undefined } | null> {
  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id, company_name, email').eq('auth_user_id', userId).maybeSingle()
  if (own) return { accountId: own.id, companyName: own.company_name ?? '', email: own.email ?? undefined }

  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('portal_account_id')
    .eq('auth_user_id', userId).not('accepted_at', 'is', null).maybeSingle()
  if (mem) {
    const { data: acc } = await supabaseAdmin
      .from('supplier_portal_accounts').select('id, company_name, email').eq('id', mem.portal_account_id).maybeSingle()
    if (acc) return { accountId: acc.id, companyName: acc.company_name ?? '', email: acc.email ?? undefined }
  }

  const { data: staff } = await supabaseAdmin
    .from('elec_staff').select('portal_account_id').eq('auth_user_id', userId).eq('is_active', true).maybeSingle()
  if (staff) {
    const { data: acc } = await supabaseAdmin
      .from('supplier_portal_accounts').select('id, company_name, email').eq('id', staff.portal_account_id).maybeSingle()
    if (acc) return { accountId: acc.id, companyName: acc.company_name ?? '', email: acc.email ?? undefined }
  }
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { email, name } = await req.json() as { email: string; name?: string }
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolveAccountOrStaff(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const { data: card } = await supabaseAdmin
      .from('elec_job_cards')
      .select('id, job_number, title, work_done, work_found, share_token')
      .eq('id', id)
      .eq('portal_account_id', account.accountId)
      .maybeSingle()
    if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const token = card.share_token ?? randomUUID()

    await supabaseAdmin
      .from('elec_job_cards')
      .update({ share_token: token, sent_to_email: email, sent_to_name: name ?? null, sent_at: new Date().toISOString() })
      .eq('id', id)

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'
    const signUrl = `${baseUrl}/job-sign/${token}`
    const greeting = name ? `Hi ${name},` : 'Hi,'
    const companyName = account.companyName || 'Your contractor'

    await sendEmail({
      from: `${companyName} via QuotingHub <noreply@quotinghub.co.za>`,
      replyTo: account.email,
      to: email,
      subject: `Please sign job card ${card.job_number} — ${card.title}`,
      preheader: `Job card ${card.job_number} is complete and ready for your signature.`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;">
      <tr><td style="background:#1E2A38;padding:28px 36px;border-radius:8px 8px 0 0;">
        <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">${companyName}</p>
        <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:.08em;">Signature Request</p>
      </td></tr>
      <tr><td style="background:#fff;padding:36px;border-left:1px solid #E4E4E7;border-right:1px solid #E4E4E7;">
        <p style="margin:0 0 16px;font-size:15px;color:#18181B;">${greeting}</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#71717A;">
          Work has been completed on job <strong style="color:#18181B;">${card.job_number} — ${card.title}</strong>.
          Please sign to acknowledge the completed work.
        </p>
        <a href="${signUrl}"
          style="display:inline-block;padding:14px 28px;background:#3A7CA5;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">
          Sign Now
        </a>
        <p style="margin:20px 0 0;font-size:12px;color:#A1A1AA;">
          Or copy this link: <a href="${signUrl}" style="color:#3A7CA5;">${signUrl}</a>
        </p>
        <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#18181B;">
          Kind regards,<br>
          <strong>${companyName}</strong>
        </p>
      </td></tr>
      <tr><td style="background:#F0F2F5;border:1px solid #E4E4E7;border-top:none;border-radius:0 0 8px 8px;padding:16px 36px;">
        <p style="margin:0;font-size:11px;color:#71717A;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;">QuotingHub</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
      text: `${greeting}\n\nWork has been completed on job ${card.job_number} — ${card.title}.\nPlease sign to acknowledge: ${signUrl}\n\nKind regards,\n${companyName}`,
    })

    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
