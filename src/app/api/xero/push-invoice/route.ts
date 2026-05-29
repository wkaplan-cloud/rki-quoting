import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { xeroGet, xeroPost } from '@/lib/xero'
import { computeLineItems } from '@/lib/quoting'
import { apiError } from '@/lib/api-error'
import { sendAccountingNotification } from '@/lib/accounting-notification'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: project }, { data: lineItems }, { data: settings }, { data: stages }] = await Promise.all([
      supabase.from('projects').select('*, client:clients(client_name)').eq('id', projectId).single(),
      supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('settings').select('vat_rate, accounts_email, business_name').maybeSingle(),
      supabase.from('project_stages').select('*').eq('project_id', projectId).maybeSingle(),
    ])

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Find or create Xero contact for the client
    let contactId: string | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientName = (project.client as any)?.client_name as string | undefined
    if (clientName) {
      try {
        const contactsData = await xeroGet(`/Contacts?where=Name%3D%22${encodeURIComponent(clientName)}%22&summaryOnly=true`)
        const contacts = contactsData.Contacts ?? []
        if (contacts.length > 0) {
          contactId = contacts[0].ContactID
        } else {
          const created = await xeroPost('/Contacts', { Contacts: [{ Name: clientName }] })
          contactId = created.Contacts?.[0]?.ContactID ?? null
        }
      } catch (e) {
        console.warn('[xero/push-invoice] contact lookup/create failed — creating invoice without contact:', e)
      }
    }

    const computed = computeLineItems(lineItems ?? [])

    const xeroLines = (lineItems ?? [])
      .filter(item => item.row_type === 'item')
      .map(item => {
        const c = computed.find(ci => ci.id === item.id)
        return {
          Description: (!item.description || item.item_name === 'Fabric') ? item.item_name : `${item.item_name} — ${item.description}`,
          Quantity: item.quantity,
          UnitAmount: c?.sale_price ?? 0,
          AccountCode: '200',
        }
      })

    if (project.design_fee > 0) {
      const subtotal = computed.reduce((sum, c) => sum + c.total_price, 0)
      xeroLines.push({
        Description: `Design Fee (${project.design_fee}%)`,
        Quantity: 1,
        UnitAmount: parseFloat(((subtotal * project.design_fee) / 100).toFixed(2)),
        AccountCode: '200',
      })
    }

    const invoiceDate = new Date().toISOString().split('T')[0]
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const invoicePayload: Record<string, unknown> = {
      Type: 'ACCREC',
      LineAmountTypes: 'Exclusive',
      Reference: project.project_number,
      Date: invoiceDate,
      DueDate: dueDate,
      LineItems: xeroLines,
      Status: 'DRAFT',
    }

    if (contactId) invoicePayload.Contact = { ContactID: contactId }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingXeroId = (project as any).xero_invoice_id
    if (existingXeroId) invoicePayload.InvoiceID = existingXeroId

    const result = await xeroPost('/Invoices', { Invoices: [invoicePayload] })
    const saved = result.Invoices?.[0]
    const xeroInvoiceId = saved?.InvoiceID

    const pushedAt = new Date().toISOString()
    const { statusFromStages } = await import('@/lib/types')
    const mergedStages = { ...(stages ?? { project_id: projectId }), final_invoice_sent: true }
    const newProjectStatus = statusFromStages(mergedStages as Parameters<typeof statusFromStages>[0])

    await Promise.all([
      supabase.from('projects').update({
        xero_invoice_id: xeroInvoiceId,
        xero_pushed_at: pushedAt,
        status: newProjectStatus,
      }).eq('id', projectId),
      supabase.from('project_stages').upsert(
        { project_id: projectId, final_invoice_sent: true, final_invoice_sent_at: pushedAt },
        { onConflict: 'project_id' }
      ),
    ])

    await sendAccountingNotification({
      platform: 'xero',
      userId: user.id,
      project: { id: projectId, project_name: project.project_name, project_number: project.project_number, design_fee: project.design_fee },
      clientName: clientName ?? null,
      lineItems: lineItems ?? [],
      vatRate: settings?.vat_rate ?? 15,
      depositDeductionExclVat: 0,
      invoiceId: xeroInvoiceId ?? '',
      isUpdate: !!existingXeroId,
      pushedByEmail: user.email ?? '',
      studioName: settings?.business_name ?? 'Your Studio',
      accountsEmail: settings?.accounts_email ?? null,
    })

    return NextResponse.json({
      success: true,
      xero_invoice_id: xeroInvoiceId,
      xero_url: `https://go.xero.com/AccountsReceivable/View.aspx?invoiceID=${xeroInvoiceId}`,
    })
  } catch (e) {
    return apiError(e)
  }
}
