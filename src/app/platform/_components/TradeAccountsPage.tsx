import { supabaseAdmin } from '@/lib/supabase/admin'
import { Zap, HousePlug, CheckCircle, Clock, TrendingUp, Users, Receipt } from 'lucide-react'
import { ContractorsTable } from '../electricians/ContractorsTable'
import type { ContractorRow, TradeKind } from '../electricians/ContractorsTable'

/**
 * The trades accounts page, one per trade. Electricians and installers share
 * the portal and the tables; trade_type decides which page an account is on.
 */

interface Tile { label: string; value: number; sub: string; color: string; bg: string }

const COPY: Record<TradeKind, {
  title: string
  subtitle: string
  icon: typeof Zap
  accent: string
  capabilitiesTitle: string
  capabilities: [string, string][]
}> = {
  electrician: {
    title: 'Electrician Portal',
    subtitle: 'Electrical contractors on the trades portal · click a row to manage admin users',
    icon: Zap,
    accent: '#8F5706',
    capabilitiesTitle: 'Electrician Portal Capabilities',
    capabilities: [
      ['Quotes & Contracts', 'Create, send, and track electrical quotes'],
      ['Job Cards', 'Manage and assign field jobs to staff'],
      ['Certificate of Completion', 'Generate and send COC documents'],
      ['Variations & Claims', 'Track contract variations and payment claims'],
      ['Snag Lists', 'Record and resolve outstanding snag items'],
      ['Staff & Schedule', 'Manage team members and weekly calendar'],
    ],
  },
  installer: {
    title: 'Installer Portal',
    subtitle: 'Home automation, AV and CCTV installers · click a row to manage admin users',
    icon: HousePlug,
    accent: '#1F5C45',
    capabilitiesTitle: 'Installer Portal Capabilities',
    capabilities: [
      ['Room-by-room quotes', 'Kits, catalogue import, good/better/best options'],
      ['Deposits & Claims', 'Deposit raised on acceptance, progress claims to Sage'],
      ['Device Register', 'Serials, MACs, IPs and logins per site'],
      ['Handover Packs', 'Branded device and warranty pack for the client'],
      ['Programming Hours', 'Clock programming time separately from install'],
      ['Support Contracts', 'Recurring invoices, covered callouts, renewals (Pro)'],
    ],
  },
}

export async function TradeAccountsPage({ trade }: { trade: TradeKind }) {
  const copy = COPY[trade]
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  const { data: accounts } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, company_name, contact_name, phone, plan, subscription_status, trial_ends_at, trial_nudge_sent_at, setup_fee_paid, created_at')
    .eq('supplier_category', 'trades')
    .eq('trade_type', trade)
    .order('created_at', { ascending: false })

  const raw = accounts ?? []
  const accountIds = raw.map(a => a.id)
  const none = { data: [] as { portal_account_id: string }[] }

  // Activity counts + admin team members per account. Contracts and devices
  // only exist for installers.
  const [
    { data: quoteCounts }, { data: jobCardCounts }, { data: staffCounts }, { data: teamMembers },
    { data: contracts }, { data: devices },
  ] = await Promise.all([
    accountIds.length > 0
      ? supabaseAdmin.from('elec_quotes').select('portal_account_id').in('portal_account_id', accountIds)
      : none,
    accountIds.length > 0
      ? supabaseAdmin.from('elec_job_cards').select('portal_account_id').in('portal_account_id', accountIds)
      : none,
    accountIds.length > 0
      ? supabaseAdmin.from('elec_staff').select('portal_account_id').in('portal_account_id', accountIds).eq('is_active', true)
      : none,
    accountIds.length > 0
      ? supabaseAdmin.from('portal_org_members').select('id, portal_account_id, email, name, invited_at, accepted_at').in('portal_account_id', accountIds).order('invited_at')
      : { data: [] as { id: string; portal_account_id: string; email: string; name: string | null; invited_at: string; accepted_at: string | null }[] },
    trade === 'installer' && accountIds.length > 0
      ? supabaseAdmin.from('elec_service_contracts').select('portal_account_id, fee, billing_period').in('portal_account_id', accountIds).eq('status', 'active')
      : { data: [] as { portal_account_id: string; fee: number; billing_period: string }[] },
    trade === 'installer' && accountIds.length > 0
      ? supabaseAdmin.from('elec_devices').select('portal_account_id').in('portal_account_id', accountIds)
      : none,
  ])

  const countBy = (list: { portal_account_id: string }[] | null) => {
    const out: Record<string, number> = {}
    for (const r of list ?? []) out[r.portal_account_id] = (out[r.portal_account_id] ?? 0) + 1
    return out
  }
  const quotesByAccount = countBy(quoteCounts)
  const jobCardsByAccount = countBy(jobCardCounts)
  const staffByAccount = countBy(staffCounts)

  const membersByAccount: Record<string, ContractorRow['adminMembers']> = {}
  for (const m of teamMembers ?? []) {
    if (!membersByAccount[m.portal_account_id]) membersByAccount[m.portal_account_id] = []
    membersByAccount[m.portal_account_id].push({
      id: m.id,
      email: m.email,
      name: m.name,
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
    })
  }

  const rows: ContractorRow[] = raw.map(a => ({
    id: a.id,
    email: a.email,
    company_name: a.company_name,
    contact_name: a.contact_name,
    phone: a.phone,
    plan: a.plan,
    subscription_status: a.subscription_status,
    trial_ends_at: a.trial_ends_at,
    trial_nudge_sent_at: a.trial_nudge_sent_at,
    setup_fee_paid: (a as Record<string, unknown>).setup_fee_paid === true,
    created_at: a.created_at,
    quoteCount: quotesByAccount[a.id] ?? 0,
    jobCardCount: jobCardsByAccount[a.id] ?? 0,
    staffCount: staffByAccount[a.id] ?? 0,
    adminMembers: membersByAccount[a.id] ?? [],
  }))

  // Summary stats
  const activeCount   = rows.filter(a => a.subscription_status === 'active').length
  const trialCount    = rows.filter(a => a.subscription_status === 'trialing').length
  const newThisMonth  = rows.filter(a => a.created_at >= thirtyDaysAgo).length
  const totalStaff    = rows.reduce((s, a) => s + a.staffCount, 0)
  const planCount     = (...plans: string[]) => rows.filter(a => plans.includes(a.plan ?? '')).length
  const setupFeeOwed  = rows.filter(a => !a.setup_fee_paid && a.subscription_status === 'active').length
  const extraStaffAccounts = rows.filter(a => a.staffCount > 20)
  const totalExtraStaff = extraStaffAccounts.reduce((s, a) => s + Math.max(0, a.staffCount - 20), 0)

  // What the installers' own support plans bill their clients, per month.
  const contractMonthly = (contracts ?? []).reduce(
    (s, c) => s + (c.billing_period === 'annual' ? Number(c.fee) / 12 : Number(c.fee)), 0,
  )

  const tiles: Tile[] = trade === 'installer'
    ? [
        { label: 'Installer',       value: planCount('installer'),     sub: 'R2,999/mo',  color: 'text-[#1F5C45]', bg: 'bg-emerald-50' },
        { label: 'Installer Pro',   value: planCount('installer_pro'), sub: 'R4,499/mo',  color: 'text-[#10261D]', bg: 'bg-emerald-50' },
        { label: 'Support plans',   value: (contracts ?? []).length,   sub: `R${Math.round(contractMonthly).toLocaleString('en-ZA')}/mo billed by installers`, color: 'text-[#1F5C45]', bg: 'bg-[#EFEBE3]' },
        { label: 'Devices logged',  value: (devices ?? []).length,     sub: 'across all sites', color: 'text-[#3F3D38]', bg: 'bg-[#EFEBE3]' },
        { label: 'Total Staff',     value: totalStaff,                 sub: 'across all', color: 'text-[#3F3D38]', bg: 'bg-[#EFEBE3]' },
      ]
    : [
        { label: 'Starter',         value: planCount('starter'),              sub: 'R999/mo',    color: 'text-[#0F766E]', bg: 'bg-teal-50'    },
        { label: 'Professional',    value: planCount('professional'),         sub: 'R1,999/mo',  color: 'text-[#8F5706]', bg: 'bg-amber-50'   },
        { label: 'Business',        value: planCount('business', 'quoting'),  sub: 'R3,199/mo',  color: 'text-[#047857]', bg: 'bg-emerald-50' },
        { label: 'Total Staff',     value: totalStaff,                        sub: 'across all', color: 'text-[#3F3D38]', bg: 'bg-[#EFEBE3]'  },
      ]

  const Icon = copy.icon

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Icon size={18} style={{ color: copy.accent }} />
          <h1 className="text-xl font-semibold text-[#1A1A18]">{copy.title}</h1>
        </div>
        <p className="text-sm text-[#6E6B63]">{copy.subtitle}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total',          value: rows.length,  icon: Icon,        color: copy.accent },
          { label: 'Active',         value: activeCount,  icon: CheckCircle, color: '#047857' },
          { label: 'In Trial',       value: trialCount,   icon: Clock,       color: '#8F5706' },
          { label: 'New this month', value: newThisMonth, icon: TrendingUp,  color: '#0F766E' },
        ].map(({ label, value, icon: StatIcon, color }) => (
          <div key={label} className="bg-[#EFEBE3] rounded-xl px-4 py-4 border border-[#E2DCD1]">
            <div className="flex items-center gap-1.5 mb-2">
              <StatIcon size={12} style={{ color }} />
              <p className="text-[10px] text-[#6E6B63] uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      <div className={`grid grid-cols-2 gap-3 ${tiles.length === 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        {tiles.map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`rounded-xl px-4 py-4 border border-[#E2DCD1] ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs font-medium text-[#3F3D38] mt-0.5">{label}</p>
            <p className="text-[10px] text-[#6E6B63]">{sub}</p>
          </div>
        ))}
      </div>

      {/* Billing flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`rounded-xl px-5 py-4 border flex items-center gap-4 ${setupFeeOwed > 0 ? 'bg-amber-500/8 border-amber-200' : 'bg-[#F3EFE8] border-[#E2DCD1]'}`}>
          <Receipt size={20} className={setupFeeOwed > 0 ? 'text-[#8F5706]' : 'text-[#8A877F]'} />
          <div>
            <p className={`text-xl font-bold ${setupFeeOwed > 0 ? 'text-[#8F5706]' : 'text-[#6E6B63]'}`}>{setupFeeOwed}</p>
            <p className="text-xs font-medium text-[#3F3D38]">Setup fees outstanding</p>
            <p className="text-[10px] text-[#6E6B63]">R2,500 once-off each · total R{(setupFeeOwed * 2500).toLocaleString()}</p>
          </div>
        </div>
        <div className={`rounded-xl px-5 py-4 border flex items-center gap-4 ${totalExtraStaff > 0 ? 'bg-amber-500/8 border-amber-200' : 'bg-[#F3EFE8] border-[#E2DCD1]'}`}>
          <Users size={20} className={totalExtraStaff > 0 ? 'text-[#8F5706]' : 'text-[#8A877F]'} />
          <div>
            <p className={`text-xl font-bold ${totalExtraStaff > 0 ? 'text-[#8F5706]' : 'text-[#6E6B63]'}`}>{totalExtraStaff}</p>
            <p className="text-xs font-medium text-[#3F3D38]">Extra staff across {extraStaffAccounts.length} account{extraStaffAccounts.length !== 1 ? 's' : ''}</p>
            <p className="text-[10px] text-[#6E6B63]">R40/staff/mo · R{(totalExtraStaff * 40).toLocaleString()}/mo to collect</p>
          </div>
        </div>
      </div>

      {/* Contractors table (client — handles expand/team management) */}
      <ContractorsTable rows={rows} trade={trade} />

      {/* Feature guide */}
      <div className="rounded-xl p-5 border" style={{ backgroundColor: `${copy.accent}0D`, borderColor: `${copy.accent}33` }}>
        <div className="flex items-center gap-2 mb-3">
          <Icon size={13} style={{ color: copy.accent }} />
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: copy.accent }}>{copy.capabilitiesTitle}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
          {copy.capabilities.map(([title, desc]) => (
            <div key={title} className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: copy.accent }} />
              <div>
                <p className="text-xs font-medium text-[#3F3D38]">{title}</p>
                <p className="text-[10px] text-[#6E6B63]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
