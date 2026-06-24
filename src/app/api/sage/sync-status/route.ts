import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sageGet } from '@/lib/sage'

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')

    const [{ data: project }, { data: stages }] = await Promise.all([
      supabase.from('projects').select('sage_invoice_id, project_name, project_number').eq('id', projectId).single(),
      supabase.from('project_stages').select('*').eq('project_id', projectId).maybeSingle(),
    ])

    if (!project?.sage_invoice_id) {
      return NextResponse.json({ error: 'No Sage invoice linked to this project' }, { status: 400 })
    }

    const invoice = await sageGet(`/TaxInvoice/Get/${project.sage_invoice_id}`)
    // SA API status field
    const status: string = invoice.Status ?? invoice.status ?? 'UNKNOWN'

    await supabase.from('projects').update({ sage_invoice_status: status }).eq('id', projectId)

    // Detect partial payment → auto-tick deposit_received
    const toNum = (v: unknown): number | null => {
      if (v == null) return null
      const n = typeof v === 'string' ? parseFloat(v) : Number(v)
      return isNaN(n) ? null : n
    }
    const invTotal = toNum(invoice.Total ?? invoice.total) ?? 0
    // Sage One SA may return the outstanding balance under various field names
    const invOutstandingRaw =
      invoice.TotalOutstanding ?? invoice.Outstanding ?? invoice.Balance ??
      invoice.BalanceDue ?? invoice.AmountDue ?? invoice.AmountOutstanding ?? null
    const invOutstanding = toNum(invOutstandingRaw)

    const isPartialStatus = /partial/i.test(status)
    let depositReceivedAuto = false
    let depositAmountReceived: number | null = null

    if (invTotal > 0 && invOutstanding !== null && invOutstanding > 0 && invOutstanding < invTotal) {
      // Amount-based detection — most accurate
      const actualPaid = parseFloat((invTotal - invOutstanding).toFixed(2))
      depositAmountReceived = actualPaid
      await supabase.from('projects').update({ deposit_amount_received: actualPaid }).eq('id', projectId)
      if (!stages?.deposit_received) {
        await supabase.from('project_stages').upsert(
          { project_id: projectId, deposit_received: true, deposit_received_at: new Date().toISOString() },
          { onConflict: 'project_id' }
        )
        depositReceivedAuto = true

        if (orgId) {
          await supabaseAdmin.from('org_notifications').insert({
            org_id: orgId,
            type: 'payment_deposit',
            title: 'Deposit payment received',
            body: `R${actualPaid.toFixed(2)} deposit detected on the Sage invoice`,
            metadata: { project_id: projectId, amount: actualPaid },
          })
        }
      }
    } else if (isPartialStatus && invTotal > 0) {
      // Status-name fallback — outstanding field absent. Try to derive paid amount from receipt allocations.
      let actualPaid: number | null = null
      try {
        // Sage One SA: receipts array may live inside the invoice or at a separate endpoint
        const receipts: unknown[] =
          (Array.isArray(invoice.Receipts) ? invoice.Receipts : null) ??
          (Array.isArray(invoice.Payments) ? invoice.Payments : null) ??
          (Array.isArray(invoice.Allocations) ? invoice.Allocations : null) ?? []

        if (receipts.length > 0) {
          const sum = receipts.reduce((acc: number, r) => {
            const rec = r as Record<string, unknown>
            return acc + (toNum(rec.Amount ?? rec.AllocatedAmount ?? rec.PaidAmount) ?? 0)
          }, 0)
          if (sum > 0) actualPaid = parseFloat(sum.toFixed(2))
        }

        // Last resort: fetch the customer receipts endpoint for this invoice
        if (actualPaid === null) {
          const receiptsData = await sageGet(`/CustomerReceipt/GetByInvoiceId/${project.sage_invoice_id}`).catch(() => null)
          if (receiptsData) {
            const arr: unknown[] = Array.isArray(receiptsData) ? receiptsData : (receiptsData?.Results ?? [])
            const sum = arr.reduce((acc: number, r) => {
              const rec = r as Record<string, unknown>
              return acc + (toNum(rec.Amount ?? rec.AllocatedAmount) ?? 0)
            }, 0)
            if (sum > 0) actualPaid = parseFloat(sum.toFixed(2))
          }
        }
      } catch {
        // receipt lookup is best-effort — continue without amount
      }

      if (actualPaid !== null) {
        depositAmountReceived = actualPaid
        await supabase.from('projects').update({ deposit_amount_received: actualPaid }).eq('id', projectId)
      }

      if (!stages?.deposit_received) {
        await supabase.from('project_stages').upsert(
          { project_id: projectId, deposit_received: true, deposit_received_at: new Date().toISOString() },
          { onConflict: 'project_id' }
        )
        depositReceivedAuto = true

        if (orgId) {
          const amountStr = actualPaid != null ? `R${actualPaid.toFixed(2)} partial` : 'Partial'
          await supabaseAdmin.from('org_notifications').insert({
            org_id: orgId,
            type: 'payment_deposit',
            title: 'Partial payment received',
            body: `${amountStr} payment detected on Sage invoice (status: ${status})`,
            metadata: { project_id: projectId, amount: actualPaid },
          })
        }
      }
    }

    // If fully paid → mark paid in full in project_stages and update project status
    // Guard: a R0 invoice is voided/cancelled, not genuinely paid — skip it
    if ((status === 'Paid' || status === 'PAID') && invTotal > 0) {
      if (stages && !stages.final_invoice_paid) {
        await supabase.from('project_stages').update({
          final_invoice_paid: true,
          final_invoice_paid_at: new Date().toISOString(),
        }).eq('project_id', projectId)

        if (orgId) {
          await supabaseAdmin.from('org_notifications').insert({
            org_id: orgId,
            type: 'payment_paid',
            title: 'Invoice paid in full',
            body: `${project.project_name} (${project.project_number}) has been marked as fully paid`,
            metadata: { project_id: projectId, sage_status: status },
          })
        }
      }

      // Derive and write new project status so the badge reflects payment
      const { statusFromStages } = await import('@/lib/types')
      const updatedStages = { ...(stages ?? {}), final_invoice_paid: true }
      const newStatus = statusFromStages(updatedStages as Parameters<typeof statusFromStages>[0])
      await supabase.from('projects').update({ status: newStatus }).eq('id', projectId)
    }

    return NextResponse.json({ status, deposit_received_auto: depositReceivedAuto, deposit_amount_received: depositAmountReceived })
  } catch (e: unknown) {
    console.error('[sage/sync-status]', e)
    return NextResponse.json({ error: 'Failed to sync invoice status from Sage. Please try again.' }, { status: 500 })
  }
}
