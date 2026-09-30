import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendSignupConfirmationEmail } from '@/lib/signup-confirmation'

const SITE_URL = 'https://quotinghub.co.za'

export async function POST(req: NextRequest) {
  const { email, password, full_name, cf_token } = await req.json()

  if (!email || !password || !full_name?.trim()) {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!/[A-Z]/.test(password)) {
    return NextResponse.json({ error: 'Password must contain at least one uppercase letter' }, { status: 400 })
  }
  if (!/[0-9]/.test(password)) {
    return NextResponse.json({ error: 'Password must contain at least one number' }, { status: 400 })
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
  if (turnstileSecret) {
    if (!cf_token) {
      return NextResponse.json({ error: 'Security check required' }, { status: 400 })
    }
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: turnstileSecret, response: cf_token }),
    })
    const verifyData = await verify.json()
    if (!verifyData.success) {
      return NextResponse.json({ error: 'Security check failed. Please try again.' }, { status: 400 })
    }
  }

  // Create user without auto-confirming — we send our own branded email.
  // app_metadata.is_self_signup is an admin-only flag used in /auth/callback to
  // reliably distinguish self-signup (→ /welcome) from invited users (→ /set-password).
  // URL params are not reliable because Supabase may not preserve them through its redirect chain.
  const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: false,
    user_metadata: { full_name: full_name.trim() },
    app_metadata: { is_self_signup: true },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  // Generate a signup confirmation link (includes token, redirects via Supabase then to our callback)
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'signup',
    email: email.toLowerCase().trim(),
    password, // required by Supabase SDK for signup type
    options: { redirectTo: `${SITE_URL}/confirming` },
  })

  if (linkError || !linkData) {
    await supabaseAdmin.auth.admin.deleteUser(user!.id)
    return NextResponse.json({ error: 'Failed to generate confirmation link' }, { status: 500 })
  }

  // Send branded confirmation email via Resend
  const { error: emailError } = await sendSignupConfirmationEmail({
    to: email.toLowerCase().trim(),
    fullName: full_name,
    confirmUrl: linkData.properties.action_link,
  })

  if (emailError) {
    // Roll back — don't leave an unconfirmed orphan user
    await supabaseAdmin.auth.admin.deleteUser(user!.id)
    return NextResponse.json({ error: 'Failed to send confirmation email. Please try again.' }, { status: 500 })
  }

  // Admin notification — fire and forget, never block signup
  sendEmail({
    from: 'QuotingHub <noreply@quotinghub.co.za>',
    to: 'hello@quotinghub.co.za',
    subject: `New designer signup: ${full_name.trim()}`,
    text: `New designer registered on QuotingHub.\n\nName: ${full_name.trim()}\nEmail: ${email.toLowerCase().trim()}\nTime: ${new Date().toISOString()}`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
