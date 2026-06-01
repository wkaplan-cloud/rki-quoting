import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { hashStaffPin, staffAuthEmail, staffAuthPassword } from '../../quoting/staff/route'

export async function POST(req: NextRequest) {
  try {
    const { username, pin } = await req.json()

    if (!username?.trim() || !pin) {
      return NextResponse.json({ error: 'Username and PIN are required' }, { status: 400 })
    }
    if (!/^\d{4}$/.test(String(pin))) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
    }

    const usernameClean = username.toLowerCase().trim()

    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id, pin_hash, auth_user_id, is_active, name')
      .eq('username', usernameClean)
      .maybeSingle()

    // Return same error for both not-found and wrong PIN to prevent username enumeration
    if (!staff || hashStaffPin(String(pin)) !== staff.pin_hash) {
      return NextResponse.json({ error: 'Invalid username or PIN' }, { status: 401 })
    }
    if (!staff.is_active) {
      return NextResponse.json({ error: 'This account has been deactivated' }, { status: 401 })
    }

    // Sign in via Supabase using the staff's synthetic credentials
    const supabaseAnon = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: sessionData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: staffAuthEmail(usernameClean),
      password: staffAuthPassword(String(pin)),
    })

    if (signInError || !sessionData.session) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    return NextResponse.json({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    })
  } catch (e) {
    return apiError(e)
  }
}
