import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { syncProjectFromSage } from '@/lib/sage-sync'

export const maxDuration = 300

// Runs nightly (vercel.json, 01:40 UTC = 03:40 SAST). For every studio with Sage
// connected, re-checks each linked invoice that isn't Paid yet — the same work
// the Sync button on a project does, so payments show up without anyone clicking.

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Deliberately across all orgs: only to find which studios have Sage connected.
  const { data: connected, error } = await supabaseAdmin
    .from('settings').select('org_id').not('sage_company_id', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const summary = { orgs: 0, checked: 0, changed: 0, failures: [] as string[] }

  for (const { org_id: orgId } of connected ?? []) {
    if (!orgId) continue
    summary.orgs++

    const { data: projects, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('id, project_number, sage_invoice_status')
      .eq('org_id', orgId)
      .not('sage_invoice_id', 'is', null)
      .or('sage_invoice_status.is.null,sage_invoice_status.neq.Paid')
    if (projErr) { summary.failures.push(`org ${orgId}: ${projErr.message}`); continue }

    for (const p of projects ?? []) {
      try {
        const result = await syncProjectFromSage({ db: supabaseAdmin, projectId: p.id, orgId, cron: true })
        summary.checked++
        if (result && (result.status !== p.sage_invoice_status || result.deposit_received_auto)) summary.changed++
      } catch (e) {
        summary.failures.push(`${p.project_number ?? p.id}: ${e instanceof Error ? e.message : String(e)}`)
        // A broken connection fails every invoice the same way — stop on this org.
        if (e instanceof Error && /not connected|reconnect Sage|Sage API error 401/.test(e.message)) break
      }
    }
  }

  console.log('[cron/sage-sync]', JSON.stringify(summary))
  return NextResponse.json(summary)
}
