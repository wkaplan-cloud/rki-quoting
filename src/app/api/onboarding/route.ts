import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // If they already have an org, return it
  const { data: existingOrgId } = await supabase.rpc('get_current_org_id')
  if (existingOrgId) return NextResponse.json({ orgId: existingOrgId })

  const { business_name } = await req.json()
  if (!business_name?.trim()) return NextResponse.json({ error: 'Business name required' }, { status: 400 })

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({ name: business_name.trim() })
    .select()
    .single()

  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 })

  // Pull full_name from user metadata set at signup, fall back to email prefix
  const fullName: string =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    ''

  const { error: memberError } = await supabaseAdmin
    .from('org_members')
    .insert({
      org_id: org.id,
      user_id: user.id,
      invited_email: user.email!,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString(),
      full_name: fullName || null,
    })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  return NextResponse.json({ orgId: org.id })
}
