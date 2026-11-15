import { NextResponse } from 'next/server'
import { getCurrentOrgId, getCurrentUser } from '@/lib/auth-context'
import { supabaseAdmin } from '@/lib/supabase/admin'

/** Shared gate for the assistant's API routes: signed in, in an org, switch on. */
export async function agentGate(): Promise<{ ok: true; orgId: string; userId: string } | { ok: false; res: NextResponse }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const orgId = await getCurrentOrgId()
  if (!orgId) return { ok: false, res: NextResponse.json({ error: 'No studio' }, { status: 403 }) }
  if (!(await agentEnabled(orgId))) {
    return { ok: false, res: NextResponse.json({ error: 'The assistant is not switched on for this studio' }, { status: 403 }) }
  }
  return { ok: true, orgId, userId: user.id }
}

/** The studio's platform switch (settings.agent_enabled). */
export async function agentEnabled(orgId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('settings').select('agent_enabled').eq('org_id', orgId).maybeSingle()
  return data?.agent_enabled === true
}

/** "Ask Mia" (settings.ask_mia_enabled) on top of the assistant switch, for studio admins only. */
export async function askMiaAllowed(orgId: string, userId: string): Promise<boolean> {
  const [{ data: settings }, { data: member }] = await Promise.all([
    supabaseAdmin.from('settings').select('agent_enabled, ask_mia_enabled').eq('org_id', orgId).maybeSingle(),
    supabaseAdmin.from('org_members').select('role').eq('org_id', orgId).eq('user_id', userId).eq('status', 'active').maybeSingle(),
  ])
  return settings?.agent_enabled === true && settings?.ask_mia_enabled === true && member?.role === 'admin'
}
