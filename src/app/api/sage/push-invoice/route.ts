import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sageGet, sagePost } from '@/lib/sage'
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

    const [{ data: project }, { data: lineItems }, { data: settings }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('settings').select('sage_item_id').maybeSingle(),
    ])

    // RLS already scopes to the user's org — if the project exists it's accessible
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (!settings?.sage_item_id) return NextResponse.json({ error: 'Sage Item ID not configured — set it in Admin → Settings' }, { status: 400 })

    const computed = computeLineItems(lineItems ?? [])

    // Fetch the default tax type from Sage
    const taxTypesResp = await sageGet('/TaxType/Get')

    // SelectionId is a Sage Item ID — stored in settings by the studio admin
    const selectionId: number = settings.sage_item_id

    // Pick the company-specific default tax type (IsDefault: true and CompanyId > 0)
    const defaultTaxType = (taxTypesResp.Results ?? []).find(
      (t: { IsDefault?: boolean; CompanyId?: number }) => t.IsDefault && (t.CompanyId ?? 0) > 0
    )
    const taxTypeId: number = defaultTaxType?.ID ?? 146922 // fallback to known Standard Rate

    // Build invoice lines — items only, skip section rows
    const lines = (lineItems ?? [])
      .filter(item => item.row_type === 'item')
      .map(item => {
        const c = computed.find(ci => ci.id === item.id)
        return {
          SelectionId: selectionId,
          LineType: 0,
          Description: item.description ? `${item.item_name} — ${item.description}` : item.item_name,
          Quantity: item.quantity,
          UnitPriceExclusive: c?.sale_price ?? 0,
          TaxTypeId: taxTypeId,
        }
      })

    // Add design fee line if applicable
    if (project.design_fee > 0) {
      const subtotal = computed.reduce((sum, c) => sum + c.total_price, 0)
      const designFeeAmount = (subtotal * project.design_fee) / 100
      lines.push({
        SelectionId: selectionId,
        LineType: 0,
        Description: `Design Fee (${project.design_fee}%)`,
        Quantity: 1,
        UnitPriceExclusive: parseFloat(designFeeAmount.toFixed(2)),
        TaxTypeId: taxTypeId,
      })
    }

    // Sage SBCA uses OData .NET date format: /Date(ms)/
    const toSageDate = (dateStr: string) => `/Date(${new Date(dateStr).getTime()})/`
    const docDate = toSageDate(project.date)
    const dueDate = `/Date(${new Date(project.date).getTime() + 30 * 24 * 60 * 60 * 1000})/`

    const invoice = await sagePost('/TaxInvoice/Save', {
      CustomerID: Number(sageContactId),
      Date: docDate,
      DueDate: dueDate,
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
