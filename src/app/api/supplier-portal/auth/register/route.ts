import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/supplier-portal/auth/register — creates Supabase auth account + portal account row
export async function POST(req: NextRequest) {
  const body = await req.json() as { email: string; password: string; company_name: string; cf_token?: string }
  const { email, password, company_name, cf_token } = body

  if (!email?.trim() || !password || !company_name?.trim()) {
    return NextResponse.json({ error: 'Email, password, and company name are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
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

  // Check if portal account already exists for this email
  const { data: existing } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  // Create Supabase auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    if (authError?.message?.includes('already been registered') || authError?.message?.includes('already exists')) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: authError?.message ?? 'Failed to create account' }, { status: 500 })
  }

  // Create portal account row
  const { error: insertError } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .insert({
      auth_user_id: authData.user.id,
      email: email.toLowerCase().trim(),
      company_name: company_name.trim(),
    })

  if (insertError) {
    // Clean up auth user if portal row fails
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {})
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
