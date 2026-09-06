export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Hammer, CheckCircle, Clock, TrendingUp, Receipt, FileText } from 'lucide-react'
import { ManufacturersTable } from './ManufacturersTable'
import type { ManufacturerRow } from './ManufacturersTable'

function fmtR(n: number) {
  const [int, dec] = n.toFixed(2).split('.')
  return `R ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${dec}`
}

export default async function ManufacturingPage() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  const { data: accounts } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, company_name, contact_name, phone, plan, subscription_status, trial_ends_at, setup_fee_paid, created_at')
    .eq('supplier_category', 'manufacturer')
    .order('created_at', { ascending: false })

  const raw = accounts ?? []
  const accountIds = raw.map(a => a.id)

  const [{ data: quoteCounts }, { data: invoiceData }, { data: clientCounts }, { data: teamMembers }] = await Promise.all([
    accountIds.length > 0
      ? supabaseAdmin.from('mfg_quotes').select('portal_account_id').in('portal_account_id', accountIds)
      : { data: [] },
    accountIds.length > 0
      ? supabaseAdmin.from('mfg_invoices').select('portal_account_id, total').in('portal_account_id', accountIds)
      : { data: [] },
    accountIds.length > 0
      ? supabaseAdmin.from('mfg_clients').select('portal_account_id').in('portal_account_id', accountIds).is('archived_at', null)
      : { data: [] },
    accountIds.length > 0
      ? supabaseAdmin.from('portal_org_members').select('id, portal_account_id, email, name, invited_at, accepted_at').in('portal_account_id', accountIds).order('invited_at')
      : { data: [] },
  ])

  const quotesByAccount: Record<string, number> = {}
  for (const q of quoteCounts ?? []) quotesByAccount[q.portal_account_id] = (quotesByAccount[q.portal_account_id] ?? 0) + 1

  const invoicesByAccount: Record<string, { count: number; total: number }> = {}
  for (const inv of invoiceData ?? []) {
    const cur = invoicesByAccount[inv.portal_account_id] ?? { count: 0, total: 0 }
    invoicesByAccount[inv.portal_account_id] = { count: cur.count + 1, total: cur.total + (inv.total ?? 0) }
  }

  const clientsByAccount: Record<string, number> = {}
  for (const c of clientCounts ?? []) clientsByAccount[c.portal_account_id] = (clientsByAccount[c.portal_account_id] ?? 0) + 1

  const membersByAccount: Record<string, ManufacturerRow['adminMembers']> = {}
  for (const m of teamMembers ?? []) {
    if (!membersByAccount[m.portal_account_id]) membersByAccount[m.portal_account_id] = []
    membersByAccount[m.portal_account_id].push({ id: m.id, email: m.email, name: m.name, invited_at: m.invited_at, accepted_at: m.accepted_at })
  }

  const rows: ManufacturerRow[] = raw.map(a => ({
    id: a.id,
    email: a.email,
    company_name: a.company_name,
    contact_name: a.contact_name,
    phone: a.phone,
    plan: a.plan,
    subscription_status: a.subscription_status,
    trial_ends_at: a.trial_ends_at,
    setup_fee_paid: (a as Record<string, unknown>).setup_fee_paid === true,
    created_at: a.created_at,
    quoteCount: quotesByAccount[a.id] ?? 0,
    invoiceCount: invoicesByAccount[a.id]?.count ?? 0,
    invoicedTotal: invoicesByAccount[a.id]?.total ?? 0,
    clientCount: clientsByAccount[a.id] ?? 0,
    adminMembers: membersByAccount[a.id] ?? [],
  }))

  // Summary stats
  const total          = rows.length
  const active         = rows.filter(r => r.subscription_status === 'active').length
  const trialing       = rows.filter(r => r.subscription_status === 'trialing').length
  const newThisMonth   = rows.filter(r => r.created_at >= thirtyDaysAgo).length
  const totalQuotes    = rows.reduce((s, r) => s + r.quoteCount, 0)
  const totalInvoiced  = rows.reduce((s, r) => s + r.invoicedTotal, 0)
  const setupFeeOwed   = rows.filter(r => !r.setup_fee_paid && r.subscription_status === 'active').length

  return (
    <div className="p-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Hammer size={18} className="text-[#C2410C]" />
          <h1 className="text-xl font-semibold text-[#1A1A18]">Manufacturing Portal</h1>
        </div>
        <p className="text-sm text-[#6E6B63]">Manufacturer accounts · click a row to edit plan or manage admins · click ↗ to view full detail</p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total',          value: total,        icon: Hammer,      color: 'text-[#C2410C]'  },
          { label: 'Active',         value: active,       icon: CheckCircle, color: 'text-[#047857]' },
          { label: 'In Trial',       value: trialing,     icon: Clock,       color: 'text-[#8F5706]'   },
          { label: 'New this month', value: newThisMonth, icon: TrendingUp,  color: 'text-[#0F766E]'    },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#EFEBE3] rounded-xl px-4 py-4 border border-[#E2DCD1]">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon size={12} className={color} />
              <p className="text-[10px] text-[#6E6B63] uppercase tracking-wider">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Activity + billing flags */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl px-5 py-4 border border-[#E2DCD1] bg-[#F3EFE8] flex items-center gap-4">
          <FileText size={20} className="text-[#C2410C]/60" />
          <div>
            <p className="text-2xl font-bold text-[#2C2C2A]">{totalQuotes}</p>
            <p className="text-xs font-medium text-[#6E6B63]">Total quotes created</p>
          </div>
        </div>
        <div className="rounded-xl px-5 py-4 border border-[#E2DCD1] bg-emerald-500/5 flex items-center gap-4">
          <Receipt size={20} className="text-[#047857]/60" />
          <div>
            <p className="text-xl font-bold text-[#047857]">{fmtR(totalInvoiced)}</p>
            <p className="text-xs font-medium text-[#6E6B63]">Total invoiced (all time)</p>
          </div>
        </div>
        <div className={`rounded-xl px-5 py-4 border flex items-center gap-4 ${setupFeeOwed > 0 ? 'bg-amber-500/8 border-amber-200' : 'bg-[#F3EFE8] border-[#E2DCD1]'}`}>
          <Receipt size={20} className={setupFeeOwed > 0 ? 'text-[#8F5706]' : 'text-[#8A877F]'} />
          <div>
            <p className={`text-2xl font-bold ${setupFeeOwed > 0 ? 'text-[#8F5706]' : 'text-[#6E6B63]'}`}>{setupFeeOwed}</p>
            <p className="text-xs font-medium text-[#3F3D38]">Setup fees outstanding</p>
            {setupFeeOwed > 0 && <p className="text-[10px] text-[#6E6B63]">R2,500 each · R{(setupFeeOwed * 2500).toLocaleString()} total</p>}
          </div>
        </div>
      </div>

      <ManufacturersTable rows={rows} />
    </div>
  )
}
