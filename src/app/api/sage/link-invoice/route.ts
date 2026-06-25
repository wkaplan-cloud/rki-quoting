import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sageGet } from '@/lib/sage'

export async function POST(req: NextRequest) {
  try {
    const { projectId, sageInvoiceId } = await req.json()
    if (!projectId || !sageInvoiceId) {
      return NextResponse.json({ error: 'Missing projectId or sageInvoiceId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch the invoice from Sage to verify it exists and get current status
    const invoice = await sageGet(`/TaxInvoice/Get/${sageInvoiceId}`)
    const status: string = String(invoice.Status ?? invoice.status ?? 'UNKNOWN')

    await supabase.from('projects').update({
      sage_invoice_id: String(sageInvoiceId),
      sage_invoice_status: status,
      sage_pushed_at: new Date().toISOString(),
    }).eq('id', projectId)

    // Auto-tick deposit_received if Sage shows a partial payment
    const invTotal: number = Number(invoice.Total ?? invoice.total ?? 0)
    const invOutstanding: number = Number(invoice.TotalOutstanding ?? invoice.Outstanding ?? invTotal)
    let depositReceivedAuto = false
    if (invTotal > 0 && invOutstanding > 0 && invOutstanding < invTotal) {
      const actualPaid = parseFloat((invTotal - invOutstanding).toFixed(2))
      await supabase.from('projects').update({ deposit_amount_received: actualPaid }).eq('id', projectId)
      const { data: stages } = await supabase.from('project_stages').select('deposit_received, client_approved').eq('project_id', projectId).maybeSingle()
      if (!stages?.deposit_received) {
        const now = new Date().toISOString()
        await supabase.from('project_stages').upsert(
          {
            project_id: projectId,
            deposit_received: true,
            deposit_received_at: now,
            ...(!stages?.client_approved ? { client_approved: true, client_approved_at: now } : {}),
          },
          { onConflict: 'project_id' }
        )
        depositReceivedAuto = true
      }
    }

    // Auto-tick final_invoice_paid if already fully paid in Sage
    if (status.toUpperCase() === 'PAID') {
      const { data: stages } = await supabase.from('project_stages').select('final_invoice_paid').eq('project_id', projectId).maybeSingle()
      if (!stages?.final_invoice_paid) {
        await supabase.from('project_stages').upsert(
          { project_id: projectId, final_invoice_paid: true, final_invoice_paid_at: new Date().toISOString() },
          { onConflict: 'project_id' }
        )
      }
    }

    return NextResponse.json({ status, deposit_received_auto: depositReceivedAuto })
  } catch (e: unknown) {
    console.error('[sage/link-invoice]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
