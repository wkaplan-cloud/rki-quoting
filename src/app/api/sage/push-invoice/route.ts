import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sagePost } from '@/lib/sage'
import { computeLineItems } from '@/lib/quoting'

export async function POST(req: NextRequest) {
  try {
    const { projectId, sageContactId } = await req.json()
    if (!projectId || !sageContactId) {
      return NextResponse.json({ error: 'Missing projectId or sageContactId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: project }, { data: lineItems }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    ])

    // RLS already scopes to the user's org — if the project exists it's accessible
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const computed = computeLineItems(lineItems ?? [])

    // Build invoice lines — items only, skip section rows
    const lines = (lineItems ?? [])
      .filter(item => item.row_type === 'item')
      .map(item => {
        const c = computed.find(ci => ci.id === item.id)
        return {
          Description: item.description ? `${item.item_name} — ${item.description}` : item.item_name,
          Quantity: item.quantity,
          UnitPrice: c?.sale_price ?? 0,
          TaxType: { ID: 1 }, // Standard rate (15% VAT)
        }
      })

    // Add design fee line if applicable
    if (project.design_fee > 0) {
      const subtotal = computed.reduce((sum, c) => sum + c.total_price, 0)
      const designFeeAmount = (subtotal * project.design_fee) / 100
      lines.push({
        Description: `Design Fee (${project.design_fee}%)`,
        Quantity: 1,
        UnitPrice: parseFloat(designFeeAmount.toFixed(2)),
        TaxType: { ID: 1 },
      })
    }

    const invoice = await sagePost('/TaxInvoice/Save', {
      Customer: { ID: Number(sageContactId) },
      DocumentDate: project.date,
      Reference: project.project_number,
      Description: project.project_name,
      Lines: lines,
    })

    // SA API returns the saved invoice — grab ID
    const sageId = invoice.ID ?? invoice.id
    const sageStatus = invoice.Status ?? invoice.status ?? 'DRAFT'

    await supabase.from('projects').update({
      sage_invoice_id: String(sageId),
      sage_invoice_status: String(sageStatus),
      sage_pushed_at: new Date().toISOString(),
    }).eq('id', projectId)

    return NextResponse.json({ success: true, sage_invoice_id: sageId, status: sageStatus })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[sage/push-invoice]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
