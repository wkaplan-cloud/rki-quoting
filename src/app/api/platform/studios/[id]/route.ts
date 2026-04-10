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

  // Fetch all auth user IDs that belong to this org so we can delete them from auth
  const { data: members } = await supabaseAdmin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .not('user_id', 'is', null)

  // Delete the organization — CASCADE should clean up org_members, settings, etc.
  const { error: orgError } = await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('id', orgId)

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  // Delete auth users that were in this org (best-effort — skip if they belong to other orgs)
  const userIds = (members ?? []).map(m => m.user_id).filter(Boolean) as string[]
  for (const uid of userIds) {
    // Check if the user still belongs to any org before deleting
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
