import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// DELETE /api/platform/studios/[id] — permanently deletes an organisation and all its users
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params

  // Only platform admin may delete studios
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.PLATFORM_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!orgId) return NextResponse.json({ error: 'Missing org id' }, { status: 400 })

  // Fetch all auth user IDs that belong to this org before we delete anything
  const { data: members } = await supabaseAdmin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .not('user_id', 'is', null)

  const userIds = (members ?? []).map(m => m.user_id).filter(Boolean) as string[]

  // Step 1: Delete child rows that have FK → organizations (no CASCADE set)
  // settings has org_id FK
  await supabaseAdmin.from('settings').delete().eq('org_id', orgId)
  // org_members has org_id FK
  const { error: membersError } = await supabaseAdmin
    .from('org_members')
    .delete()
    .eq('org_id', orgId)

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 })
  }

  // Step 2: Delete the organization row itself
  const { error: orgError } = await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('id', orgId)

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  // Step 3: Delete auth users that are no longer in any org
  // (deleting auth users cascades their projects, clients, suppliers, settings, etc.)
  for (const uid of userIds) {
    const { count } = await supabaseAdmin
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)

    if ((count ?? 0) === 0) {
      await supabaseAdmin.auth.admin.deleteUser(uid)
    }
  }

  return NextResponse.json({ ok: true })
}
