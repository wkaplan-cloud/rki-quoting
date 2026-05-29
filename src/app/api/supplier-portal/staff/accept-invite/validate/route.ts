import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

  const { data: staff } = await supabaseAdmin
    .from('elec_staff')
    .select('id, name, email, invite_token, invite_sent_at, portal_account_id')
    .eq('invite_token', token)
    .single()

  if (!staff) return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 })

  // Check 7-day expiry
  if (staff.invite_sent_at) {
    const sent = new Date(staff.invite_sent_at)
    const now = new Date()
    if ((now.getTime() - sent.getTime()) > 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'This invite link has expired. Ask your admin to resend the invite.' }, { status: 410 })
    }
  }

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('company_name')
    .eq('id', staff.portal_account_id)
    .single()

  return NextResponse.json({ name: staff.name, email: staff.email ?? '', company: account?.company_name ?? '' })
}
