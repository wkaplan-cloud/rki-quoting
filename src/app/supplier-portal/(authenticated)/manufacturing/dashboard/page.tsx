export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'
import { MfgDashboardClient } from './MfgDashboardClient'

export default async function MfgDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')
  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  // Fetch dashboard data directly via Supabase (avoids HTTP round-trip)
  const { data: invoicesAll } = await supabase
    .from('mfg_invoices')
    .select('id, invoice_number, total, amount_paid, status, due_date, created_at, job:mfg_jobs(job_name, client:mfg_clients(client_name))')
    .eq('portal_account_id', account.id)
    .is('archived_at', null)
    .neq('status', 'draft')

  const { data: quotesOpen } = await supabase
    .from('mfg_quotes')
    .select('id, quote_number, total, status, sent_at, valid_until, job:mfg_jobs(job_name, client:mfg_clients(client_name))')
    .eq('portal_account_id', account.id)
    .is('archived_at', null)
    .in('status', ['draft', 'sent'])
    .order('sent_at', { ascending: true, nullsFirst: false })
    .limit(8)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

  const thisMonth = (invoicesAll ?? []).filter(i => i.created_at >= startOfMonth)
  const lastMonth = (invoicesAll ?? []).filter(i => i.created_at >= startOfLastMonth && i.created_at <= endOfLastMonth)

  const months: { month: string; invoiced: number; received: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = d.toISOString()
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59).toISOString()
    const m = { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, invoiced: 0, received: 0 }
    for (const inv of (invoicesAll ?? [])) {
      if (inv.created_at >= start && inv.created_at <= end) { m.invoiced += inv.total; m.received += inv.amount_paid }
    }
    months.push(m)
  }

  const attention: { type: string; entity_type: string; entity_id: string; entity_number: string; client_name: string; job_name: string; value: number; days: number }[] = []
  for (const inv of (invoicesAll ?? [])) {
    if (inv.due_date && new Date(inv.due_date) < now && inv.status !== 'paid') {
      const d = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000)
      if (d >= 1) attention.push({ type: 'overdue_invoice', entity_type: 'invoice', entity_id: inv.id, entity_number: inv.invoice_number ?? '', client_name: (inv as { job?: { client?: { client_name?: string } | null } | null }).job?.client?.client_name ?? '', job_name: (inv as { job?: { job_name?: string } | null }).job?.job_name ?? '', value: inv.total - inv.amount_paid, days: d })
    }
  }
  for (const q of (quotesOpen ?? [])) {
    if (q.status === 'sent' && q.valid_until) {
      const d = Math.ceil((new Date(q.valid_until).getTime() - now.getTime()) / 86400000)
      if (d <= 7 && d >= 0) attention.push({ type: 'expiring_quote', entity_type: 'quote', entity_id: q.id, entity_number: q.quote_number, client_name: (q as { job?: { client?: { client_name?: string } | null } | null }).job?.client?.client_name ?? '', job_name: (q as { job?: { job_name?: string } | null }).job?.job_name ?? '', value: q.total ?? 0, days: d })
    }
    if (q.status === 'sent' && q.sent_at && new Date(q.sent_at) < new Date(now.getTime() - 14 * 86400000)) {
      const d = Math.floor((now.getTime() - new Date(q.sent_at).getTime()) / 86400000)
      attention.push({ type: 'no_response_quote', entity_type: 'quote', entity_id: q.id, entity_number: q.quote_number, client_name: (q as { job?: { client?: { client_name?: string } | null } | null }).job?.client?.client_name ?? '', job_name: (q as { job?: { job_name?: string } | null }).job?.job_name ?? '', value: q.total ?? 0, days: d })
    }
  }

  const data = {
    kpis: {
      invoicedThisMonth: thisMonth.reduce((s, i) => s + i.total, 0),
      invoicedLastMonth: lastMonth.reduce((s, i) => s + i.total, 0),
      receivedThisMonth: thisMonth.reduce((s, i) => s + i.amount_paid, 0),
      receivedLastMonth: lastMonth.reduce((s, i) => s + i.amount_paid, 0),
      pipelineValue: (quotesOpen ?? []).reduce((s, q) => s + (q.total ?? 0), 0),
      pipelineCount: (quotesOpen ?? []).length,
    },
    attention: attention.slice(0, 10),
    recentInvoices: (invoicesAll ?? []).filter(i => ['sent','partially_paid','overdue'].includes(i.status)).slice(0, 8),
    openQuotes: quotesOpen ?? [],
    monthlyRevenue: months,
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#18181B' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: '#71717A' }}>Your business at a glance.</p>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <MfgDashboardClient data={data as any} companyName={account.company_name ?? ''} />
    </div>
  )
}
