export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Zap, CheckCircle, Clock, TrendingUp, Users, Receipt } from 'lucide-react'
import { ContractorsTable } from './ContractorsTable'
import type { ContractorRow } from './ContractorsTable'

export default async function ElectriciansPage() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  // All trades-category portal accounts
  const { data: accounts } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, company_name, contact_name, phone, plan, subscription_status, trial_ends_at, setup_fee_paid, created_at')
    .eq('supplier_category', 'trades')
    .order('created_at', { ascending: false })

  const raw = accounts ?? []
  const accountIds = raw.map(a => a.id)

  // Activity counts + admin team members per account
  const [{ data: quoteCounts }, { data: jobCardCounts }, { data: staffCounts }, { data: teamMembers }] = await Promise.all([
    accountIds.length > 0
      ? supabaseAdmin.from('elec_quotes').select('portal_account_id').in('portal_account_id', accountIds)
      : { data: [] },
    accountIds.length > 0
      ? supabaseAdmin.from('elec_job_cards').select('portal_account_id').in('portal_account_id', accountIds)
      : { data: [] },
    accountIds.length > 0
      ? supabaseAdmin.from('elec_staff').select('portal_account_id').in('portal_account_id', accountIds).eq('is_active', true)
      : { data: [] },
    accountIds.length > 0
      ? supabaseAdmin.from('portal_org_members').select('id, portal_account_id, email, name, invited_at, accepted_at').in('portal_account_id', accountIds).order('invited_at')
      : { data: [] },
  ])

  const quotesByAccount: Record<string, number> = {}
  for (const q of quoteCounts ?? []) quotesByAccount[q.portal_account_id] = (quotesByAccount[q.portal_account_id] ?? 0) + 1

  const jobCardsByAccount: Record<string, number> = {}
  for (const j of jobCardCounts ?? []) jobCardsByAccount[j.portal_account_id] = (jobCardsByAccount[j.portal_account_id] ?? 0) + 1

  const staffByAccount: Record<string, number> = {}
  for (const s of staffCounts ?? []) staffByAccount[s.portal_account_id] = (staffByAccount[s.portal_account_id] ?? 0) + 1

  const membersByAccount: Record<string, { id: string; email: string; name: string | null; invited_at: string; accepted_at: string | null }[]> = {}
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
    setup_fee_paid: (a as Record<string, unknown>).setup_fee_paid === true,
    created_at: a.created_at,
    quoteCount: quotesByAccount[a.id] ?? 0,
    jobCardCount: jobCardsByAccount[a.id] ?? 0,
    staffCount: staffByAccount[a.id] ?? 0,
    adminMembers: membersByAccount[a.id] ?? [],
  }))

  // Summary stats
  const totalContractors  = rows.length
  const activeContractors = rows.filter(a => a.subscription_status === 'active').length
  const trialContractors  = rows.filter(a => a.subscription_status === 'trialing').length
  const newThisMonth      = rows.filter(a => a.created_at >= thirtyDaysAgo).length
  const totalQuotes       = rows.reduce((s, a) => s + a.quoteCount, 0)
  const totalJobCards     = rows.reduce((s, a) => s + a.jobCardCount, 0)
  const totalStaff        = rows.reduce((s, a) => s + a.staffCount, 0)
  const starterCount      = rows.filter(a => a.plan === 'starter').length
  const professionalCount = rows.filter(a => a.plan === 'professional').length
  const businessCount     = rows.filter(a => ['business', 'quoting'].includes(a.plan ?? '')).length
  const setupFeeOwed      = rows.filter(a => !a.setup_fee_paid && a.subscription_status === 'active').length
  const extraStaffAccounts = rows.filter(a => a.staffCount > 20)
  const totalExtraStaff   = extraStaffAccounts.reduce((s, a) => s + Math.max(0, a.staffCount - 20), 0)

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-[#8F5706]" />
          <h1 className="text-xl font-semibold text-[#1A1A18]">Electrician Portal</h1>
        </div>
        <p className="text-sm text-[#6E6B63]">Trade contractors registered on the Electrician Portal · click a row to manage admin users</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total',         value: totalContractors,  icon: Zap,         color: 'text-[#8F5706]'   },
          { label: 'Active',        value: activeContractors, icon: CheckCircle, color: 'text-[#047857]' },
          { label: 'In Trial',      value: trialContractors,  icon: Clock,       color: 'text-[#8F5706]'   },
          { label: 'New this month',value: newThisMonth,      icon: TrendingUp,  color: 'text-[#0F766E]'    },
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

      {/* Plan breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Starter',       value: starterCount,      sub: 'R999/mo',    color: 'text-[#0F766E]',    bg: 'bg-teal-50'    },
          { label: 'Professional',  value: professionalCount, sub: 'R1,999/mo',  color: 'text-[#8F5706]',   bg: 'bg-amber-50'   },
          { label: 'Business',      value: businessCount,     sub: 'R3,199/mo',  color: 'text-[#047857]', bg: 'bg-emerald-50' },
          { label: 'Total Staff',   value: totalStaff,        sub: 'across all', color: 'text-[#3F3D38]',    bg: 'bg-[#EFEBE3]'        },
        ].map(({ label, value, sub, color, bg }) => (
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
      <ContractorsTable rows={rows} />

      {/* Feature guide */}
      <div className="bg-amber-500/8 border border-amber-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} className="text-[#8F5706]" />
          <h3 className="text-xs font-semibold text-[#8F5706] uppercase tracking-wider">Electrician Portal Capabilities</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
          {[
            ['Quotes & Contracts', 'Create, send, and track electrical quotes'],
            ['Job Cards', 'Manage and assign field jobs to staff'],
            ['Certificate of Completion', 'Generate and send COC documents'],
            ['Variations & Claims', 'Track contract variations and payment claims'],
            ['Snag Lists', 'Record and resolve outstanding snag items'],
            ['Staff & Schedule', 'Manage team members and weekly calendar'],
          ].map(([title, desc]) => (
            <div key={title} className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-[#8F5706] mt-1.5 flex-shrink-0" />
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
