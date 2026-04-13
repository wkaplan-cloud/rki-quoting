import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// DELETE /api/platform/studios/[id]/purge — permanently destroys a studio and all its data.
// The org MUST be in 'archived' status first — this is enforced server-side.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.PLATFORM_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!orgId) return NextResponse.json({ error: 'Missing org id' }, { status: 400 })

  // Safety: only allow purge of archived orgs
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, status')
    .eq('id', orgId)
    .maybeSingle()

  if (!org) return NextResponse.json({ error: 'Studio not found' }, { status: 404 })
  if (org.status !== 'archived') {
    return NextResponse.json({ error: 'Studio must be archived before it can be permanently deleted' }, { status: 409 })
  }

  // Collect all user_ids in this org so we can clean up their data and auth accounts
  const { data: members } = await supabaseAdmin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)

  const userIds = (members ?? []).map(m => m.user_id).filter(Boolean) as string[]

  // Delete in dependency order to avoid FK violations
  if (userIds.length > 0) {
    // line_items belong to projects which belong to users
    const { data: projectIds } = await supabaseAdmin
      .from('projects')
      .select('id')
      .in('user_id', userIds)

    if (projectIds?.length) {
      const pids = projectIds.map(p => p.id)
      await supabaseAdmin.from('line_items').delete().in('project_id', pids)
      await supabaseAdmin.from('project_stages').delete().in('project_id', pids)
      await supabaseAdmin.from('email_logs').delete().in('project_id', pids)
      await supabaseAdmin.from('audit_logs').delete().in('project_id', pids)
    }

    await supabaseAdmin.from('projects').delete().in('user_id', userIds)
    await supabaseAdmin.from('clients').delete().in('user_id', userIds)
    await supabaseAdmin.from('items').delete().in('user_id', userIds)
    await supabaseAdmin.from('settings').delete().in('user_id', userIds)
    await supabaseAdmin.from('branding').delete().in('user_id', userIds)

    // Price lists owned by this org's users
    const { data: priceLists } = await supabaseAdmin
      .from('price_lists')
      .select('id')
      .in('user_id', userIds)

    if (priceLists?.length) {
      const plids = priceLists.map(pl => pl.id)
      await supabaseAdmin.from('price_list_items').delete().in('price_list_id', plids)
      await supabaseAdmin.from('price_list_access').delete().in('price_list_id', plids)
    }

    await supabaseAdmin.from('price_lists').delete().in('user_id', userIds)

    // Suppliers owned by this org's users
    const { data: supplierIds } = await supabaseAdmin
      .from('suppliers')
      .select('id')
      .in('user_id', userIds)

    if (supplierIds?.length) {
      const sids = supplierIds.map(s => s.id)
      await supabaseAdmin.from('platform_supplier_contacts').delete().in('supplier_id', sids)
    }

    await supabaseAdmin.from('suppliers').delete().in('user_id', userIds)
  }

  // Remove org membership records
  await supabaseAdmin.from('org_members').delete().eq('org_id', orgId)

  // Delete the org itself
  const { error: orgDeleteErr } = await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('id', orgId)

  if (orgDeleteErr) {
    console.error('Failed to delete organization:', orgDeleteErr)
    return NextResponse.json({ error: orgDeleteErr.message }, { status: 500 })
  }

  // Delete auth accounts for users who have no remaining org memberships
  for (const uid of userIds) {
    const { data: remainingMemberships } = await supabaseAdmin
      .from('org_members')
      .select('id')
      .eq('user_id', uid)
      .limit(1)

    if (!remainingMemberships?.length) {
      await supabaseAdmin.auth.admin.deleteUser(uid)
    }
  }

  return NextResponse.json({ ok: true })
}
