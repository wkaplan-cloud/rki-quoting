import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import crypto from 'crypto'


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: staffId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id, name, email, portal_account_id')
      .eq('id', staffId)
      .eq('portal_account_id', account.id)
      .single()
    if (!staff) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    if (!staff.email) return NextResponse.json({ error: 'Staff member has no email address' }, { status: 400 })

    const token = crypto.randomBytes(32).toString('hex')
    await supabaseAdmin
      .from('elec_staff')
      .update({ invite_token: token, invite_sent_at: new Date().toISOString() })
      .eq('id', staffId)

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'
    const inviteUrl = `${baseUrl}/supplier-portal/accept-staff-invite?token=${token}`
    const companyName = account.company_name ?? 'Your employer'

    await sendEmail({
      from: `${companyName} via QuotingHub <noreply@quotinghub.co.za>`,
      replyTo: account.email,
      to: staff.email,
      subject: `${companyName} has invited you to QuotingHub`,
      preheader: `Set up your account to log time and job cards for ${companyName}.`,
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;">
      <tr><td style="background:#1E2A38;padding:28px 36px;border-radius:8px 8px 0 0;">
        <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">${companyName}</p>
        <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:.08em;">Staff Invitation</p>
      </td></tr>
      <tr><td style="background:#fff;padding:36px;border-left:1px solid #E4E4E7;border-right:1px solid #E4E4E7;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#18181B;">Hi ${staff.name},</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#18181B;">${companyName} has invited you to manage your job cards and time on QuotingHub.</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#3A7CA5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:14px;">Accept Invitation →</a>
        <p style="margin:20px 0 0;font-size:12px;color:#71717A;">Or copy this link: ${inviteUrl}</p>
        <p style="margin:16px 0 0;font-size:12px;color:#71717A;">This link expires in 7 days.</p>
      </td></tr>
      <tr><td style="background:#F0F2F5;border:1px solid #E4E4E7;border-top:none;border-radius:0 0 8px 8px;padding:16px 36px;">
        <p style="margin:0;font-size:11px;color:#71717A;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;">QuotingHub</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
      text: `Hi ${staff.name},\n\n${companyName} has invited you to QuotingHub.\n\nAccept your invitation: ${inviteUrl}\n\nThis link expires in 7 days.`,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
