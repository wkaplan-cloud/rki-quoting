import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

export async function GET() {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const now = new Date()
  const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
  const in7days          = new Date(now.getTime() + 7 * 86400000).toISOString()
  const days14ago        = new Date(now.getTime() - 14 * 86400000).toISOString()
  const days30ago        = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [
    { data: invoicesAll },
    { data: quotesOpen },
    { data: invoicesThisMonth },
    { data: invoicesLastMonth },
    { data: recentInvoices },
    { data: openQuotes },
  ] = await Promise.all([
    // All non-paid invoices for outstanding calc
    supabase.from('mfg_invoices')
      .select('id, total, amount_paid, status, due_date, created_at, job:mfg_jobs(job_name, client:mfg_clients(client_name))')
      .eq('portal_account_id', auth.portalAccountId)
      .is('archived_at', null)
      .neq('status', 'draft'),
    // Open quotes for pipeline
    supabase.from('mfg_quotes')
      .select('id, quote_number, total, status, sent_at, valid_until, job:mfg_jobs(job_name, client:mfg_clients(client_name))')
      .eq('portal_account_id', auth.portalAccountId)
      .is('archived_at', null)
      .in('status', ['draft', 'sent']),
    // Invoices this month
    supabase.from('mfg_invoices')
      .select('total, amount_paid')
      .eq('portal_account_id', auth.portalAccountId)
      .gte('created_at', startOfMonth)
      .neq('status', 'draft'),
    // Invoices last month
    supabase.from('mfg_invoices')
      .select('total, amount_paid')
      .eq('portal_account_id', auth.portalAccountId)
      .gte('created_at', startOfLastMonth)
      .lte('created_at', endOfLastMonth)
      .neq('status', 'draft'),
    // Recent invoices for tracker
    supabase.from('mfg_invoices')
      .select('id, invoice_number, total, amount_paid, status, due_date, job:mfg_jobs(job_name, client:mfg_clients(client_name))')
      .eq('portal_account_id', auth.portalAccountId)
      .is('archived_at', null)
      .in('status', ['sent','partially_paid','overdue'])
      .order('due_date', { ascending: true })
      .limit(8),
    // Open quotes for pipeline
    supabase.from('mfg_quotes')
      .select('id, quote_number, total, status, sent_at, valid_until, job:mfg_jobs(job_name, client:mfg_clients(client_name))')
      .eq('portal_account_id', auth.portalAccountId)
      .is('archived_at', null)
      .in('status', ['draft', 'sent'])
      .order('sent_at', { ascending: true, nullsFirst: false })
      .limit(8),
  ])

  // KPIs
  const invoicedThisMonth  = (invoicesThisMonth ?? []).reduce((s, i) => s + i.total, 0)
  const invoicedLastMonth  = (invoicesLastMonth ?? []).reduce((s, i) => s + i.total, 0)
  const receivedThisMonth  = (invoicesThisMonth ?? []).reduce((s, i) => s + i.amount_paid, 0)
  const receivedLastMonth  = (invoicesLastMonth ?? []).reduce((s, i) => s + i.amount_paid, 0)
  const pipelineValue      = (quotesOpen ?? []).reduce((s, q) => s + (q.total ?? 0), 0)
  const pipelineCount      = (quotesOpen ?? []).length

  // Attention items
  const attention: {
    type: string; entity_type: string; entity_id: string; entity_number: string
    client_name: string; job_name: string; value: number; days: number
  }[] = []

  // Overdue invoices (30+ days past due)
  for (const inv of (invoicesAll ?? [])) {
    if (inv.status === 'overdue' || (inv.due_date && new Date(inv.due_date) < now && inv.status !== 'paid')) {
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.due_date ?? inv.created_at).getTime()) / 86400000)
      if (daysOverdue >= 1) {
        attention.push({
          type: 'overdue_invoice', entity_type: 'invoice', entity_id: inv.id,
          entity_number: (inv as unknown as { invoice_number: string }).invoice_number ?? '',
          client_name: (inv as unknown as { job?: { client?: { client_name?: string } | null } | null }).job?.client?.client_name ?? '',
          job_name: (inv as unknown as { job?: { job_name?: string } | null }).job?.job_name ?? '',
          value: inv.total - inv.amount_paid,
          days: daysOverdue,
        })
      }
    }
  }

  // Quotes expiring within 7 days
  for (const q of (quotesOpen ?? [])) {
    if (q.status === 'sent' && q.valid_until) {
      const daysLeft = Math.ceil((new Date(q.valid_until).getTime() - now.getTime()) / 86400000)
      if (daysLeft <= 7 && daysLeft >= 0) {
        attention.push({
          type: 'expiring_quote', entity_type: 'quote', entity_id: q.id,
          entity_number: q.quote_number,
          client_name: (q as unknown as { job?: { client?: { client_name?: string } | null } | null }).job?.client?.client_name ?? '',
          job_name: (q as unknown as { job?: { job_name?: string } | null }).job?.job_name ?? '',
          value: q.total ?? 0,
          days: daysLeft,
        })
      }
    }
    // No response in 14+ days
    if (q.status === 'sent' && q.sent_at && new Date(q.sent_at) < new Date(days14ago)) {
      const daysSince = Math.floor((now.getTime() - new Date(q.sent_at).getTime()) / 86400000)
      attention.push({
        type: 'no_response_quote', entity_type: 'quote', entity_id: q.id,
        entity_number: q.quote_number,
        client_name: (q as unknown as { job?: { client?: { client_name?: string } | null } | null }).job?.client?.client_name ?? '',
        job_name: (q as unknown as { job?: { job_name?: string } | null }).job?.job_name ?? '',
        value: q.total ?? 0,
        days: daysSince,
      })
    }
  }

  // Monthly revenue (last 6 months)
  const months: { month: string; invoiced: number; received: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = d.toISOString()
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59).toISOString()
    months.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, invoiced: 0, received: 0 })
    // We'll compute these from invoicesAll — filter by created_at range
    for (const inv of (invoicesAll ?? [])) {
      const created = (inv as unknown as { created_at: string }).created_at
      if (created >= start && created <= end) {
        months[months.length - 1].invoiced  += inv.total
        months[months.length - 1].received  += inv.amount_paid
      }
    }
  }

  return NextResponse.json({
    kpis: { invoicedThisMonth, invoicedLastMonth, receivedThisMonth, receivedLastMonth, pipelineValue, pipelineCount },
    attention: attention.slice(0, 10),
    recentInvoices: recentInvoices ?? [],
    openQuotes: openQuotes ?? [],
    monthlyRevenue: months,
  })
}
