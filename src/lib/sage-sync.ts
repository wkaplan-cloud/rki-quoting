import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sageGet } from '@/lib/sage'
import { statusFromStages } from '@/lib/types'

export interface SageSyncResult {
  status: string
  deposit_received_auto: boolean
  deposit_amount_received: number | null
}

const toNum = (v: unknown): number | null => {
  if (v == null) return null
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return isNaN(n) ? null : n
}

const sumAmounts = (rows: unknown[], ...keys: string[]) =>
  rows.reduce((acc: number, r) => {
    const rec = r as Record<string, unknown>
    const value = keys.map(k => rec[k]).find(v => v != null)
    return acc + (toNum(value) ?? 0)
  }, 0)

/**
 * Pulls one project's Sage invoice and brings its payment status, deposit
 * amount and stages in line. Used by the Sync button (db = the user's client)
 * and by the nightly cron (db = admin client, cron = true so Sage auth is
 * looked up by orgId instead of the signed-in user).
 * Returns null when the project has no Sage invoice linked.
 */
export async function syncProjectFromSage({ db, projectId, orgId, cron = false }: {
  db: SupabaseClient
  projectId: string
  orgId: string | null
  cron?: boolean
}): Promise<SageSyncResult | null> {
  if (cron && !orgId) throw new Error('Cron Sage sync needs an orgId')
  const sage = (path: string) => sageGet(path, undefined, cron ? orgId! : undefined)

  // The admin client skips RLS, so the cron proves the project is this org's
  // before touching it (project_stages has no org_id of its own).
  let projectQuery = db.from('projects').select('sage_invoice_id, project_name, project_number').eq('id', projectId)
  if (cron) projectQuery = projectQuery.eq('org_id', orgId!)
  const { data: project } = await projectQuery.maybeSingle()
  if (!project?.sage_invoice_id) return null
  const { data: stages } = await db.from('project_stages').select('*').eq('project_id', projectId).maybeSingle()

  const invoice = await sage(`/TaxInvoice/Get/${project.sage_invoice_id}`)
  // SA API status field
  const status: string = invoice.Status ?? invoice.status ?? 'UNKNOWN'

  await db.from('projects').update({ sage_invoice_status: status }).eq('id', projectId)

  const notify = async (type: string, title: string, body: string, metadata: Record<string, unknown>) => {
    if (!orgId) return
    await supabaseAdmin.from('org_notifications').insert({ org_id: orgId, type, title, body, metadata })
  }

  const markDepositReceived = async () => {
    const now = new Date().toISOString()
    await db.from('project_stages').upsert(
      {
        project_id: projectId,
        deposit_received: true,
        deposit_received_at: now,
        ...(!stages?.client_approved ? { client_approved: true, client_approved_at: now } : {}),
      },
      { onConflict: 'project_id' }
    )
  }

  const invTotal = toNum(invoice.Total ?? invoice.total) ?? 0
  // Sage One SA may return the outstanding balance under various field names
  const invOutstanding = toNum(
    invoice.TotalOutstanding ?? invoice.Outstanding ?? invoice.Balance ??
    invoice.BalanceDue ?? invoice.AmountDue ?? invoice.AmountOutstanding ?? null
  )

  const isPartialStatus = /partial/i.test(status)
  let depositReceivedAuto = false
  let depositAmountReceived: number | null = null

  if (invTotal > 0 && invOutstanding !== null && invOutstanding > 0 && invOutstanding < invTotal) {
    // Amount-based detection — most accurate
    const actualPaid = parseFloat((invTotal - invOutstanding).toFixed(2))
    depositAmountReceived = actualPaid
    await db.from('projects').update({ deposit_amount_received: actualPaid }).eq('id', projectId)
    if (!stages?.deposit_received) {
      await markDepositReceived()
      depositReceivedAuto = true
      await notify('payment_deposit', 'Deposit payment received',
        `R${actualPaid.toFixed(2)} deposit detected on the Sage invoice`,
        { project_id: projectId, amount: actualPaid })
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
        const sum = sumAmounts(receipts, 'Amount', 'AllocatedAmount', 'PaidAmount')
        if (sum > 0) actualPaid = parseFloat(sum.toFixed(2))
      }

      // Last resort: fetch the customer receipts endpoint for this invoice
      if (actualPaid === null) {
        const receiptsData = await sage(`/CustomerReceipt/GetByInvoiceId/${project.sage_invoice_id}`).catch(() => null)
        if (receiptsData) {
          const arr: unknown[] = Array.isArray(receiptsData) ? receiptsData : (receiptsData?.Results ?? [])
          const sum = sumAmounts(arr, 'Amount', 'AllocatedAmount')
          if (sum > 0) actualPaid = parseFloat(sum.toFixed(2))
        }
      }
    } catch {
      // receipt lookup is best-effort — continue without amount
    }

    if (actualPaid !== null) {
      depositAmountReceived = actualPaid
      await db.from('projects').update({ deposit_amount_received: actualPaid }).eq('id', projectId)
    }

    if (!stages?.deposit_received) {
      await markDepositReceived()
      depositReceivedAuto = true
      const amountStr = actualPaid != null ? `R${actualPaid.toFixed(2)} partial` : 'Partial'
      await notify('payment_deposit', 'Partial payment received',
        `${amountStr} payment detected on Sage invoice (status: ${status})`,
        { project_id: projectId, amount: actualPaid })
    }
  }

  // If fully paid → mark paid in full in project_stages and update project status
  // Guard: a R0 invoice is voided/cancelled, not genuinely paid — skip it
  if ((status === 'Paid' || status === 'PAID') && invTotal > 0) {
    if (stages && !stages.final_invoice_paid) {
      await db.from('project_stages').update({
        final_invoice_paid: true,
        final_invoice_paid_at: new Date().toISOString(),
      }).eq('project_id', projectId)

      await notify('payment_paid', 'Invoice paid in full',
        `${project.project_name} (${project.project_number}) has been marked as fully paid`,
        { project_id: projectId, sage_status: status })
    }

    // Derive and write new project status so the badge reflects payment
    const updatedStages = { ...(stages ?? {}), final_invoice_paid: true }
    const newStatus = statusFromStages(updatedStages as Parameters<typeof statusFromStages>[0])
    await db.from('projects').update({ status: newStatus }).eq('id', projectId)
  }

  return { status, deposit_received_auto: depositReceivedAuto, deposit_amount_received: depositAmountReceived }
}
