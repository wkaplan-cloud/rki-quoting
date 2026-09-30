import type { User } from '@supabase/supabase-js'
import { FROM_TRANSACTIONAL, DEFAULT_REPLY_TO, sendEmail } from '@/lib/email'
import { supabaseAdmin } from '@/lib/supabase/admin'

const SITE_URL = 'https://quotinghub.co.za'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Sends the branded "Confirm your QuotingHub account" email. */
export function sendSignupConfirmationEmail({ to, fullName, confirmUrl }: { to: string; fullName: string; confirmUrl: string }) {
  const firstName = fullName.trim().split(' ')[0] || 'there'
  const safeFirstName = escapeHtml(firstName)

  return sendEmail({
    from: FROM_TRANSACTIONAL,
    replyTo: DEFAULT_REPLY_TO,
    to,
    subject: 'Confirm your QuotingHub account',
    preheader: 'Confirm your email address to finish setting up your QuotingHub account.',
    text: `Hi ${firstName},\n\nWelcome to QuotingHub! Please confirm your email address to activate your account:\n\n${confirmUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't sign up for QuotingHub, you can safely ignore this email.\n\nThe QuotingHub Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm your QuotingHub account</title></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background-color:#1A1A18;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:600;color:#F5F2EC;letter-spacing:0.01em;">QuotingHub</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Email Confirmation</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Hi ${safeFirstName},</p>
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Welcome to QuotingHub! You're one step away from replacing your old system with a proper quoting platform.</p>
            <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Click the button below to confirm your email address and activate your account.</p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:6px;background-color:#9A7B4F;">
                  <a href="${confirmUrl}" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Confirm my account</a>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 8px;font-size:13px;color:#8A877F;line-height:1.6;">Or copy and paste this link into your browser:</p>
            <p style="margin:0;font-size:12px;color:#C4A46B;word-break:break-all;">${confirmUrl}</p>
            <p style="margin:24px 0 0;font-size:13px;color:#8A877F;line-height:1.6;">This link expires in 24 hours. If you didn't create an account on QuotingHub, you can safely ignore this email.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">QuotingHub &middot; <a href="https://quotinghub.co.za" style="color:#8A877F;text-decoration:none;">quotinghub.co.za</a></p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Built for interior designers</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

/** True for a self-signup designer who has not clicked their confirmation link yet. */
export function isPendingSelfSignup(user: User): boolean {
  return !user.email_confirmed_at && user.app_metadata?.is_self_signup === true
}

/** Finds an auth user by email, paging through the whole list. */
export async function findAuthUserByEmail(email: string): Promise<User | null> {
  const target = email.toLowerCase().trim()
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const match = data.users.find(u => u.email?.toLowerCase() === target)
    if (match) return match
    if (data.users.length < 1000) return null
  }
}

/**
 * Sends a fresh confirmation link to a pending self-signup.
 *
 * The original signup link can't be regenerated without the user's password,
 * so this uses a magic link instead: verifying it confirms the email and signs
 * them in, and /confirming routes any non-invite link to /welcome → onboarding.
 */
export async function resendSignupConfirmation(user: User): Promise<{ error: string | null }> {
  const email = user.email!
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${SITE_URL}/confirming` },
  })
  if (linkError || !linkData) return { error: linkError?.message ?? 'Failed to generate confirmation link' }

  const { error } = await sendSignupConfirmationEmail({
    to: email,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? '',
    confirmUrl: linkData.properties.action_link,
  })
  return { error: error ? 'Failed to send confirmation email' : null }
}
