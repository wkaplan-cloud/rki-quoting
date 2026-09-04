export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'
import { MfgDashboardClient } from './MfgDashboardClient'
import { monthKeySA, monthKeyOffsetSA } from '@/lib/dates'

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

  const now = new Date()

  // Cash received has to come from the payments themselves. Summing each
  // invoice's amount_paid into the month the invoice was raised credits the
  // money to the wrong month — an invoice raised in July and settled in
  // September showed nothing in September and inflated July.
  const invoiceIds = (invoicesAll ?? []).map(i => i.id)
  const { data: payments } = invoiceIds.length
    ? await supabase
        .from('mfg_invoice_payments')
        .select('amount, payment_date, invoice_id')
        .in('invoice_id', invoiceIds)
    : { data: [] as { amount: number; payment_date: string; invoice_id: string }[] }

  // Month buckets are keyed in South African time — server-local (UTC on
  // Vercel) boundaries push anything invoiced between midnight and 02:00 SAST
  // on the 1st into the previous month.
  const monthKeys = Array.from({ length: 6 }, (_, i) => monthKeyOffsetSA(5 - i))
  const thisMonthKey = monthKeys[5]
  const lastMonthKey = monthKeys[4]

  const months: { month: string; invoiced: number; received: number }[] = monthKeys.map(month => ({ month, invoiced: 0, received: 0 }))
  const monthIndex = new Map(monthKeys.map((k, i) => [k, i]))

  for (const inv of (invoicesAll ?? [])) {
    const i = monthIndex.get(monthKeySA(inv.created_at))
    if (i !== undefined) months[i].invoiced += inv.total
  }
  for (const p of (payments ?? [])) {
    const i = monthIndex.get((p.payment_date ?? '').slice(0, 7))
    if (i !== undefined) months[i].received += p.amount
  }

  const invoicedIn = (key: string) => (invoicesAll ?? []).reduce((s, i) => s + (monthKeySA(i.created_at) === key ? i.total : 0), 0)
  const receivedIn = (key: string) => (payments ?? []).reduce((s, p) => s + ((p.payment_date ?? '').slice(0, 7) === key ? p.amount : 0), 0)

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
      invoicedThisMonth: invoicedIn(thisMonthKey),
      invoicedLastMonth: invoicedIn(lastMonthKey),
      receivedThisMonth: receivedIn(thisMonthKey),
      receivedLastMonth: receivedIn(lastMonthKey),
      pipelineValue: (quotesOpen ?? []).reduce((s, q) => s + (q.total ?? 0), 0),
      pipelineCount: (quotesOpen ?? []).length,
    },
    attention: attention.slice(0, 10),
    // The panel this feeds is "Outstanding Invoices" and shows the balance, so
    // fully paid invoices belong out of it. Everything still owing is here.
    recentInvoices: (invoicesAll ?? [])
      .filter(i => ['sent', 'partially_paid', 'overdue'].includes(i.status) && i.total - i.amount_paid > 0)
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
      .slice(0, 8),
    // The panel shows the eight most stale; the pipeline KPI above counts them all.
    openQuotes: (quotesOpen ?? []).slice(0, 8),
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
