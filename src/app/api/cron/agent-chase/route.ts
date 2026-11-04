import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { loadChaseList } from '@/lib/agent/chase'
import { chaseSummary } from '@/lib/agent/chase-list'

export const maxDuration = 60

// Runs on weekdays (vercel.json, 05:00 UTC = 07:00 SAST). Tells each studio with
// the assistant switched on what is on its "To chase" list; nothing when it's empty.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: studios, error } = await supabaseAdmin.from('settings').select('org_id').eq('agent_enabled', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let notified = 0
  const failed: string[] = []
  for (const { org_id: orgId } of studios ?? []) {
    try {
      const { data: mailbox } = await supabaseAdmin.from('agent_mailboxes').select('agent_name').eq('org_id', orgId).maybeSingle()
      if (!mailbox) continue
      const summary = chaseSummary(await loadChaseList(orgId))
      if (!summary) continue
      const { error: insertError } = await supabaseAdmin.from('org_notifications').insert({
        org_id: orgId,
        type: 'agent_chase',
        title: `${mailbox.agent_name}: to chase today`,
        body: `${summary}. See the list on her page.`,
        metadata: {},
      })
      if (insertError) throw new Error(insertError.message)
      notified++
    } catch (e) {
      failed.push(`${orgId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return NextResponse.json({ ok: failed.length === 0, notified, failed }, { status: failed.length ? 500 : 200 })
}
