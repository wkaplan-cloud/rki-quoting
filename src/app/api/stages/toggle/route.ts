import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { statusFromStages } from '@/lib/types'
import type { ProjectStages } from '@/lib/types'

const ALLOWED_FIELDS = new Set([
  'quote_sent', 'quote_sent_at',
  'client_approved', 'client_approved_at',
  'deposit_received', 'deposit_received_at',
  'pos_sent', 'pos_sent_at',
  'fabrics_received', 'fabrics_received_at',
  'fabrics_sent', 'fabrics_sent_at',
  'final_invoice_sent', 'final_invoice_sent_at',
  'final_invoice_paid', 'final_invoice_paid_at',
  'delivered_installed', 'delivered_installed_at',
])

export async function POST(req: NextRequest) {
  try {
    const { projectId, update } = await req.json()
    if (!projectId || !update) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Auth: must be logged in AND able to see the project via RLS
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: project } = await supabase
      .from('projects')
      .select('id, status')
      .eq('id', projectId)
      .single()

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Sanitise: only allow known stage fields
    const safeUpdate = Object.fromEntries(
      Object.entries(update as Record<string, unknown>).filter(([k]) => ALLOWED_FIELDS.has(k))
    )
    if (!Object.keys(safeUpdate).length) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })

    // Write using admin client — bypasses RLS/get_current_org_id issues on client-side sessions
    const { error: upsertError } = await supabaseAdmin
      .from('project_stages')
      .upsert({ project_id: projectId, ...safeUpdate }, { onConflict: 'project_id' })

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

    // Recompute project status from the full updated stages
    const { data: stages } = await supabaseAdmin
      .from('project_stages')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()

    let newStatus = project.status
    if (project.status !== 'Cancelled') {
      newStatus = statusFromStages(stages as ProjectStages | null)
      await supabaseAdmin.from('projects').update({ status: newStatus }).eq('id', projectId)
    }

    return NextResponse.json({ success: true, newStatus, stages })
  } catch (e) {
    console.error('[stages/toggle]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
