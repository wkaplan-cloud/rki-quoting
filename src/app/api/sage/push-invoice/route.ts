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

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const computed = computeLineItems(lineItems ?? [])

    // Build invoice lines — items only, skip section rows
    const invoiceLines = (lineItems ?? [])
      .filter(item => item.row_type === 'item')
      .map(item => {
        const c = computed.find(ci => ci.id === item.id)
        const description = item.description
          ? `${item.item_name} — ${item.description}`
          : item.item_name
        return {
          description,
          quantity: String(item.quantity),
          unit_price: String(c?.sale_price ?? 0),
        }
      })

    // Add design fee line if applicable
    if (project.design_fee > 0) {
      const subtotal = computed.reduce((sum, c) => sum + c.total_price, 0)
      const designFeeAmount = (subtotal * project.design_fee) / 100
      invoiceLines.push({
        description: `Design Fee (${project.design_fee}%)`,
        quantity: '1',
        unit_price: String(designFeeAmount.toFixed(2)),
      })
    }

    const invoice = await sagePost('/sales_invoices', {
      sales_invoice: {
        contact_id: sageContactId,
        date: project.date,
        reference: project.project_number,
        notes: project.project_name,
        invoice_lines: invoiceLines,
      },
    })

    // Save Sage invoice ID back to project
    await supabase.from('projects').update({
      sage_invoice_id: invoice.id,
      sage_invoice_status: invoice.status?.id ?? 'DRAFT',
      sage_pushed_at: new Date().toISOString(),
    }).eq('id', projectId)

    return NextResponse.json({ success: true, sage_invoice_id: invoice.id, status: invoice.status?.id })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
