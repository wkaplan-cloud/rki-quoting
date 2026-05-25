import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { statusFromStages } from '@/lib/types'
import type { ProjectStages } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only org admins may unlink
    const { data: member } = await supabase
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!member || member.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Clear Sage invoice link + cached status from the project row
    await supabase.from('projects').update({
      sage_invoice_id: null,
      sage_invoice_status: null,
      sage_pushed_at: null,
    }).eq('id', projectId)

    // Unmark final_invoice_paid so the project is no longer locked
    await supabase.from('project_stages').update({
      final_invoice_paid: false,
      final_invoice_paid_at: null,
    }).eq('project_id', projectId)

    // Recalculate and persist the derived project status
    const { data: stages } = await supabase
      .from('project_stages')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()

    const newStatus = statusFromStages(stages as ProjectStages | null)
    await supabase.from('projects').update({ status: newStatus }).eq('id', projectId)

    return NextResponse.json({ ok: true, status: newStatus })
  } catch (e: unknown) {
    console.error('[sage/unlink-invoice]', e)
    return NextResponse.json({ error: 'Failed to unlink Sage invoice' }, { status: 500 })
  }
}
