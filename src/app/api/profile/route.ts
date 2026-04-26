import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function PATCH(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { full_name, phone, job_title } = await req.json()
  if (!full_name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  // Update full_name in org_members
  const { error: memberError } = await supabaseAdmin
    .from('org_members')
    .update({ full_name: full_name.trim() })
    .eq('user_id', user.id)

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  // Store phone + job_title in user metadata (no schema change needed)
  const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      full_name: full_name.trim(),
      phone: (phone ?? '').trim(),
      job_title: (job_title ?? '').trim(),
    },
  })

  if (metaError) return NextResponse.json({ error: metaError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
