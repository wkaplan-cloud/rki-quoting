import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sageGet, sagePost } from '@/lib/sage'
import { computeLineItems } from '@/lib/quoting'
import { sendAccountingNotification } from '@/lib/accounting-notification'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { projectId, sageContactId, sageCustomerName = '' } = await req.json()
    if (!projectId || !sageContactId) {
      return NextResponse.json({ error: 'Missing projectId or sageContactId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: project }, { data: lineItems }, { data: settings }, { data: stages }] = await Promise.all([
      supabase.from('projects').select('*, client:clients(client_name)').eq('id', projectId).single(),
      supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('settings').select('sage_item_id, deposit_percentage, vat_rate, accounts_email, business_name, sage_invoice_message').maybeSingle(),
      supabase.from('project_stages').select('*').eq('project_id', projectId).maybeSingle(),
    ])

    // RLS already scopes to the user's org — if the project exists it's accessible
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (!settings?.sage_item_id) return NextResponse.json({ error: 'Sage Item ID not configured — set it in Admin → Settings' }, { status: 400 })

    // Block update if invoice has any payment against it
    const existingStatus = (project.sage_invoice_status ?? '').toUpperCase()
    if (project.sage_invoice_id && (existingStatus === 'PAID')) {
      return NextResponse.json({
        error: 'This invoice has already been paid in Sage and cannot be updated.',
      }, { status: 400 })
    }
    if (project.sage_invoice_id && stages?.deposit_received) {
      return NextResponse.json({
        error: 'A deposit has been received against this invoice. It cannot be overwritten.',
      }, { status: 400 })
    }

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

    const trunc = (s: string) => s.length > 100 ? s.slice(0, 97) + '…' : s

    // Build invoice lines — items only, skip section rows
    const lines = (lineItems ?? [])
      .filter(item => item.row_type === 'item')
      .map(item => {
        const c = computed.find(ci => ci.id === item.id)
        return {
          SelectionId: selectionId,
          LineType: 0,
          Description: trunc(item.item_name),
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

    // Add deposit line if deposit has been received — uses actual paid amount from Sage when available
    let depositDeductionExclVat = 0
    if (stages?.deposit_received) {
      let depositExclVat: number

      if (project.sage_invoice_id) {
        try {
          const existingInv = await sageGet(`/TaxInvoice/Get/${project.sage_invoice_id}`)
          const invTotal: number = existingInv.Total ?? existingInv.total ?? 0
          const invOutstanding: number = existingInv.TotalOutstanding ?? existingInv.Outstanding ?? invTotal
          const actualPaidInclVat = Math.max(0, invTotal - invOutstanding)
          const vatRate = (project as any).vat_rate ?? settings?.vat_rate ?? 15
          depositExclVat = parseFloat((actualPaidInclVat / (1 + vatRate / 100)).toFixed(2))
        } catch {
          // Fallback to configured percentage if Sage call fails
          const subtotal = computed.reduce((sum, c) => sum + c.total_price, 0)
          const dfAmt = project.design_fee > 0 ? (subtotal * project.design_fee) / 100 : 0
          const depositPct = project.deposit_percentage ?? settings?.deposit_percentage ?? 50
          depositExclVat = parseFloat(((subtotal + dfAmt) * (depositPct / 100)).toFixed(2))
        }
      } else {
        // No existing invoice yet — use configured deposit percentage
        const subtotal = computed.reduce((sum, c) => sum + c.total_price, 0)
        const dfAmt = project.design_fee > 0 ? (subtotal * project.design_fee) / 100 : 0
        const depositPct = project.deposit_percentage ?? settings?.deposit_percentage ?? 50
        depositExclVat = parseFloat(((subtotal + dfAmt) * (depositPct / 100)).toFixed(2))
      }

      if (depositExclVat > 0) {
        depositDeductionExclVat = depositExclVat
        lines.push({
          SelectionId: selectionId,
          LineType: 0,
          Description: 'Deposit Received',
          Quantity: 1,
          UnitPriceExclusive: -depositExclVat,
          TaxTypeId: taxTypeId,
        })
      }
    }

    // Sage SBCA uses OData .NET date format: /Date(ms)/
    const toSageDate = (d: Date) => `/Date(${d.getTime()})/`
    const now = new Date()
    const docDate = toSageDate(now)
    const dueDate = toSageDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))

    const basePayload: Record<string, unknown> = {
      CustomerID: Number(sageContactId),
      Date: docDate,
      DueDate: dueDate,
      Inclusive: false,
      Reference: project.project_number,
      Description: trunc(project.project_name),
      Lines: lines,
      ...(settings?.sage_invoice_message ? { Message: settings.sage_invoice_message } : {}),
    }

    let invoice: Record<string, unknown>

    if (project.sage_invoice_id) {
      // Try to update the existing invoice — if Sage rejects the ID (e.g. stale sandbox ID),
      // fall back to creating a fresh invoice
      try {
        invoice = await sagePost('/TaxInvoice/Save', { ...basePayload, ID: Number(project.sage_invoice_id) })
      } catch {
        invoice = await sagePost('/TaxInvoice/Save', basePayload)
      }
    } else {
      invoice = await sagePost('/TaxInvoice/Save', basePayload)
    }

    // SA API returns the saved invoice — grab ID
    const sageId = invoice.ID ?? invoice.id
    const sageStatus = invoice.Status ?? invoice.status ?? 'DRAFT'

    const pushedAt = new Date().toISOString()
    const { statusFromStages } = await import('@/lib/types')
    const mergedStages = { ...(stages ?? { project_id: projectId }), final_invoice_sent: true }
    const newProjectStatus = statusFromStages(mergedStages as Parameters<typeof statusFromStages>[0])
    await Promise.all([
      supabase.from('projects').update({
        sage_invoice_id: String(sageId),
        sage_invoice_status: String(sageStatus),
        sage_pushed_at: pushedAt,
        sage_customer_id: String(sageContactId),
        sage_customer_name: sageCustomerName,
        status: newProjectStatus,
      }).eq('id', projectId),
      // Auto-advance project to "Invoice" status when invoice is pushed to Sage
      supabase.from('project_stages').upsert(
        { project_id: projectId, final_invoice_sent: true, final_invoice_sent_at: pushedAt },
        { onConflict: 'project_id' }
      ),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientName = (project.client as any)?.client_name ?? null
    await sendAccountingNotification({
      platform: 'sage',
      userId: user.id,
      project: { id: projectId, project_name: project.project_name, project_number: project.project_number, design_fee: project.design_fee },
      clientName,
      lineItems: lineItems ?? [],
      vatRate: settings?.vat_rate ?? 15,
      depositDeductionExclVat,
      invoiceId: String(sageId),
      isUpdate: !!project.sage_invoice_id,
      pushedByEmail: user.email ?? '',
      studioName: settings?.business_name ?? 'Your Studio',
      accountsEmail: settings?.accounts_email ?? null,
    })

    return NextResponse.json({ success: true, sage_invoice_id: sageId, status: sageStatus })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[sage/push-invoice]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
