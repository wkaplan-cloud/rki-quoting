export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Hammer, Users, FileText, Receipt, Building2, Phone, Mail } from 'lucide-react'
import type { MfgSettings } from '@/lib/mfg-types'
import { MfgPlanPanel } from './MfgPlanPanel'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtR(n: number) {
  const [int, dec] = n.toFixed(2).split('.')
  return `R ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${dec}`
}

const QUOTE_STATUS_COLOR: Record<string, string> = {
  draft:    'bg-white/5 text-white/40',
  sent:     'bg-blue-500/15 text-blue-400',
  accepted: 'bg-emerald-500/15 text-emerald-400',
  declined: 'bg-red-500/15 text-red-400',
  expired:  'bg-white/5 text-white/30',
  invoiced: 'bg-purple-500/15 text-purple-400',
}
const INV_STATUS_COLOR: Record<string, string> = {
  draft:          'bg-white/5 text-white/40',
  sent:           'bg-blue-500/15 text-blue-400',
  partially_paid: 'bg-amber-500/15 text-amber-400',
  paid:           'bg-emerald-500/15 text-emerald-400',
  overdue:        'bg-red-500/15 text-red-400',
}

export default async function MfgAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, company_name, contact_name, phone, plan, subscription_status, trial_ends_at, setup_fee_paid, created_at')
    .eq('id', id)
    .eq('supplier_category', 'manufacturer')
    .maybeSingle()

  if (!account) notFound()

  const [
    { data: settings },
    { data: recentQuotes },
    { data: recentInvoices },
    { count: clientCount },
    { data: orgMembers },
  ] = await Promise.all([
    supabaseAdmin.from('mfg_settings').select('*').eq('portal_account_id', id).maybeSingle(),
    supabaseAdmin.from('mfg_quotes')
      .select('id, quote_number, status, total, created_at')
      .eq('portal_account_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
    supabaseAdmin.from('mfg_invoices')
      .select('id, invoice_number, invoice_type, status, total, amount_paid, due_date, created_at')
      .eq('portal_account_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
    supabaseAdmin.from('mfg_clients')
      .select('id', { count: 'exact', head: true })
      .eq('portal_account_id', id)
      .is('archived_at', null),
    supabaseAdmin.from('portal_org_members')
      .select('id, email, name, invited_at, accepted_at')
      .eq('portal_account_id', id)
      .order('invited_at'),
  ])

  const s = settings as MfgSettings | null
  const totalInvoiced = (recentInvoices ?? []).reduce((sum, inv) => sum + (inv.total ?? 0), 0)
  const totalPaid     = (recentInvoices ?? []).reduce((sum, inv) => sum + (inv.amount_paid ?? 0), 0)

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/platform/manufacturing" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-6">
        <ArrowLeft size={14} /> All manufacturers
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <Hammer size={18} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">{s?.business_name || account.company_name}</h1>
            <p className="text-sm text-white/40">Joined {fmtDate(account.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Quotes',    value: recentQuotes?.length ?? 0,  icon: FileText,  color: 'text-orange-400'  },
          { label: 'Invoices',  value: recentInvoices?.length ?? 0, icon: Receipt,  color: 'text-blue-400'    },
          { label: 'Clients',   value: clientCount ?? 0,            icon: Users,    color: 'text-emerald-400' },
          { label: 'Invoiced',  value: fmtR(totalInvoiced),         icon: Receipt,  color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/5 rounded-xl px-4 py-4 border border-white/8">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon size={12} className={color} />
              <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
            </div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Account details */}
        <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
          <h2 className="text-xs text-white/40 uppercase tracking-wider mb-4">Account</h2>
          <dl className="space-y-2.5">
            {[
              { icon: Mail,     label: 'Login email',   value: account.email },
              { icon: Phone,    label: 'Phone',          value: account.phone },
              { icon: Building2, label: 'Contact',       value: account.contact_name },
            ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <Icon size={12} className="text-white/20 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30">{label}</p>
                  <p className="text-xs text-white/70">{value}</p>
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/* Business identity from mfg_settings */}
        <div className="lg:col-span-2 bg-[#1A1A18] border border-white/10 rounded-xl p-5">
          <h2 className="text-xs text-white/40 uppercase tracking-wider mb-4">Business Settings</h2>
          {!s ? (
            <p className="text-xs text-white/30 italic">No settings saved yet — manufacturer hasn&apos;t completed setup.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {[
                { label: 'Business name',   value: s.business_name },
                { label: 'Email',           value: s.email },
                { label: 'Phone',           value: s.phone },
                { label: 'Address',         value: s.address },
                { label: 'Company reg',     value: s.company_registration_number },
                { label: 'VAT reg',         value: s.vat_registration_number },
                { label: 'VAT rate',        value: s.vat_registered ? `${s.default_vat_rate}%` : 'Not registered' },
                { label: 'Bank',            value: s.bank_name },
                { label: 'Account holder',  value: s.bank_account_holder },
                { label: 'Account number',  value: s.bank_account_number },
                { label: 'Branch code',     value: s.bank_branch_code },
                { label: 'Quote prefix',    value: `${s.quote_prefix}-xxx` },
                { label: 'Invoice prefix',  value: `${s.invoice_prefix}-xxx` },
                { label: 'Default markup',  value: `${s.default_markup_percentage}%` },
                { label: 'Deposit default', value: `${s.default_deposit_percentage}%` },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} className="flex gap-2">
                  <dt className="text-[10px] text-white/30 w-28 flex-shrink-0 pt-0.5">{label}</dt>
                  <dd className="text-xs text-white/70">{value}</dd>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Plan management */}
      <MfgPlanPanel
        accountId={id}
        initialPlan={account.plan ?? null}
        initialStatus={account.subscription_status ?? null}
        initialTrialEndsAt={account.trial_ends_at ?? null}
        setupFeePaid={(account as Record<string, unknown>).setup_fee_paid === true}
      />

      {/* Admin users */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white flex items-center gap-2"><Users size={14} className="text-orange-400" /> Admin Users</h2>
        </div>
        {!orgMembers?.length ? (
          <p className="px-5 py-6 text-sm text-white/30 text-center">No additional admins</p>
        ) : (
          <div className="divide-y divide-white/5">
            {orgMembers.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60 flex-shrink-0">
                  {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  {m.name && <p className="text-xs font-medium text-white/80">{m.name}</p>}
                  <p className="text-[11px] text-white/40">{m.email}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${m.accepted_at ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {m.accepted_at ? 'Active' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent quotes */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white flex items-center gap-2"><FileText size={14} className="text-orange-400" /> Recent Quotes</h2>
        </div>
        {!recentQuotes?.length ? (
          <p className="px-5 py-8 text-sm text-white/30 text-center">No quotes yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Number</th>
                <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Status</th>
                <th className="text-right px-5 py-2.5 text-xs text-white/30 font-medium">Total</th>
                <th className="text-right px-5 py-2.5 text-xs text-white/30 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentQuotes.map(q => (
                <tr key={q.id}>
                  <td className="px-5 py-3 text-white/70 font-mono text-xs">{q.quote_number}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${QUOTE_STATUS_COLOR[q.status] ?? 'bg-white/5 text-white/40'}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-white/70 text-xs tabular-nums">{fmtR(q.total ?? 0)}</td>
                  <td className="px-5 py-3 text-right text-white/40 text-xs">{fmtDate(q.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent invoices */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white flex items-center gap-2"><Receipt size={14} className="text-orange-400" /> Recent Invoices</h2>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span>Invoiced {fmtR(totalInvoiced)}</span>
            <span className="text-emerald-400">Paid {fmtR(totalPaid)}</span>
          </div>
        </div>
        {!recentInvoices?.length ? (
          <p className="px-5 py-8 text-sm text-white/30 text-center">No invoices yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Number</th>
                <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Type</th>
                <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Status</th>
                <th className="text-right px-5 py-2.5 text-xs text-white/30 font-medium">Total</th>
                <th className="text-right px-5 py-2.5 text-xs text-white/30 font-medium">Paid</th>
                <th className="text-right px-5 py-2.5 text-xs text-white/30 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentInvoices.map(inv => (
                <tr key={inv.id}>
                  <td className="px-5 py-3 text-white/70 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-white/40 text-xs capitalize">{inv.invoice_type?.replace('_', ' ')}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${INV_STATUS_COLOR[inv.status] ?? 'bg-white/5 text-white/40'}`}>
                      {inv.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-white/70 text-xs tabular-nums">{fmtR(inv.total ?? 0)}</td>
                  <td className="px-5 py-3 text-right text-emerald-400 text-xs tabular-nums">{fmtR(inv.amount_paid ?? 0)}</td>
                  <td className="px-5 py-3 text-right text-white/40 text-xs">{fmtDate(inv.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
