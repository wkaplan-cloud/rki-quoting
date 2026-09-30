import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { findAuthUserByEmail, isPendingSelfSignup, resendSignupConfirmation } from '@/lib/signup-confirmation'

// Public: the "Resend email" button on the signup "Check your inbox" screen.
// Always answers { ok: true } for a well-formed request so it can't be used to
// probe which email addresses have accounts.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'resend-confirmation', 3, 15 * 60 * 1000)
  if (limited) return limited

  const { email } = await req.json().catch(() => ({}))
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const user = await findAuthUserByEmail(email)
  if (user && isPendingSelfSignup(user)) {
    const { error } = await resendSignupConfirmation(user)
    if (error) console.error('[resend-confirmation]', user.id, error)
  }

  return NextResponse.json({ ok: true })
}
