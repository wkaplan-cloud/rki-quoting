import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check caller is an admin (use admin client to bypass RLS, same as admin page)
  const { data: membership } = await supabaseAdmin
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (membership?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, role } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Fetch org settings for business name
  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('business_name')
    .eq('org_id', membership.org_id)
    .maybeSingle()

  const businessName = settings?.business_name ?? 'our team'
  const roleLabel = (role ?? 'designer') === 'admin' ? 'Admin' : 'Designer'

  // If a stale unconfirmed auth user exists for this email (e.g. from a previously cancelled
  // invite), delete them first so generateLink doesn't fail with "already registered"
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const stale = users.find(u => u.email?.toLowerCase() === email.toLowerCase() && !u.email_confirmed_at)
  if (stale) await supabaseAdmin.auth.admin.deleteUser(stale.id)

  // Generate invite link (does not send Supabase's default email)
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: 'https://quotinghub.co.za/auth/callback' },
  })

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })

  // Create pending org_members record — store user_id so we can clean up auth if invite is cancelled
  const { error: memberError } = await supabaseAdmin
    .from('org_members')
    .insert({
      org_id: membership.org_id,
      user_id: linkData.user.id,
      invited_email: email.toLowerCase(),
      role: role ?? 'designer',
      status: 'pending',
    })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  const inviteUrl = linkData.properties.action_link

  // Send branded invite email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: resendError } = await resend.emails.send({
    from: `${businessName} <quotes@quotinghub.co.za>`,
    to: email,
    subject: `You've been invited to join ${businessName} on QuotingHub`,
    text: `You have been invited to join ${businessName} as a ${roleLabel} on quotinghub.co.za.\n\nAccept your invite here: ${inviteUrl}\n\nThis link expires in 24 hours.`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background-color:#4A4A47;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:600;color:#F5F2EC;letter-spacing:0.01em;">${businessName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Team Invitation</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">You have been invited to join <strong>${businessName}</strong> as a <strong>${roleLabel}</strong> on <a href="https://quotinghub.co.za" style="color:#9A7B4F;text-decoration:none;">quotinghub.co.za</a>.</p>
            <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Click the button below to accept your invitation and set up your account.</p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:6px;background-color:#9A7B4F;">
                  <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Accept Invite</a>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 0;font-size:13px;color:#8A877F;line-height:1.6;">This link expires in 24 hours. If you weren't expecting this invitation, you can safely ignore this email.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">${businessName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Sent via <a href="https://quotinghub.co.za" style="color:#C4BFB5;text-decoration:none;">QuotingHub</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })

  if (resendError) return NextResponse.json({ error: resendError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
