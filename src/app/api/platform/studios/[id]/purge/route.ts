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
  if (!user || user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
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

  // Delete in dependency order to avoid FK violations — use org_id throughout
  const { data: projectIds } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('org_id', orgId)

  if (projectIds?.length) {
    const pids = projectIds.map(p => p.id)
    await supabaseAdmin.from('line_items').delete().in('project_id', pids)
    await supabaseAdmin.from('project_stages').delete().in('project_id', pids)
    await supabaseAdmin.from('email_logs').delete().in('project_id', pids)
    await supabaseAdmin.from('audit_logs').delete().in('project_id', pids)
  }

  await supabaseAdmin.from('projects').delete().eq('org_id', orgId)
  await supabaseAdmin.from('clients').delete().eq('org_id', orgId)
  await supabaseAdmin.from('items').delete().eq('org_id', orgId)
  await supabaseAdmin.from('settings').delete().eq('org_id', orgId)

  // Price lists owned by this org
  const { data: priceLists } = await supabaseAdmin
    .from('price_lists')
    .select('id')
    .eq('org_id', orgId)

  if (priceLists?.length) {
    const plids = priceLists.map(pl => pl.id)
    await supabaseAdmin.from('price_list_items').delete().in('price_list_id', plids)
    await supabaseAdmin.from('price_list_access').delete().in('price_list_id', plids)
  }

  await supabaseAdmin.from('price_lists').delete().eq('org_id', orgId)

  // Suppliers owned by this org
  const { data: supplierIds } = await supabaseAdmin
    .from('suppliers')
    .select('id')
    .eq('org_id', orgId)

  if (supplierIds?.length) {
    const sids = supplierIds.map(s => s.id)
    await supabaseAdmin.from('platform_supplier_contacts').delete().in('supplier_id', sids)
  }

  await supabaseAdmin.from('suppliers').delete().eq('org_id', orgId)

  // Remove any price list access grants this org received from other orgs
  await supabaseAdmin.from('price_list_access').delete().eq('org_id', orgId)

  // Delete any audit_logs tied directly to the org (org_id FK)
  await supabaseAdmin.from('audit_logs').delete().eq('org_id', orgId)

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
