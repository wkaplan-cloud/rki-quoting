import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { hashStaffPin, staffAuthEmail } from '@/lib/staff-auth'

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
      .select('id, pin_hash, auth_user_id, is_active')
      .eq('username', usernameClean)
      .maybeSingle()

    if (!staff || hashStaffPin(String(pin)) !== staff.pin_hash) {
      return NextResponse.json({ error: 'Invalid username or PIN' }, { status: 401 })
    }
    if (!staff.is_active) {
      return NextResponse.json({ error: 'This account has been deactivated' }, { status: 401 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: staffAuthEmail(usernameClean),
      options: { redirectTo: `${baseUrl}/auth/staff-callback` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: 'Failed to generate session' }, { status: 500 })
    }

    return NextResponse.json({ signInUrl: linkData.properties.action_link })
  } catch (e) {
    return apiError(e)
  }
}
