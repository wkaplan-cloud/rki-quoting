import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sageGet } from '@/lib/sage'

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: project } = await supabase
      .from('projects')
      .select('sage_invoice_id')
      .eq('id', projectId)
      .single()

    if (!project?.sage_invoice_id) {
      return NextResponse.json({ error: 'No Sage invoice linked to this project' }, { status: 400 })
    }

    const invoice = await sageGet(`/TaxInvoice/Get/${project.sage_invoice_id}`)
    // SA API status field
    const status: string = invoice.Status ?? invoice.status ?? 'UNKNOWN'

    await supabase.from('projects').update({ sage_invoice_status: status }).eq('id', projectId)

    // If fully paid → mark paid in full in project_stages and update project status
    if (status === 'Paid' || status === 'PAID') {
      const { data: stages } = await supabase
        .from('project_stages')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle()

      if (stages && !stages.final_invoice_paid) {
        await supabase.from('project_stages').update({
          final_invoice_paid: true,
          final_invoice_paid_at: new Date().toISOString(),
        }).eq('project_id', projectId)
      }

      // Derive and write new project status so the badge reflects payment
      const { statusFromStages } = await import('@/lib/types')
      const updatedStages = { ...(stages ?? {}), final_invoice_paid: true }
      const newStatus = statusFromStages(updatedStages as Parameters<typeof statusFromStages>[0])
      await supabase.from('projects').update({ status: newStatus }).eq('id', projectId)
    }

    return NextResponse.json({ status })
  } catch (e: unknown) {
    console.error('[sage/sync-status]', e)
    return NextResponse.json({ error: 'Failed to sync invoice status from Sage. Please try again.' }, { status: 500 })
  }
}
