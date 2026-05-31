export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Zap, CheckCircle, Clock, AlertTriangle, FileText, Briefcase, Users, TrendingUp } from 'lucide-react'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  trades: 'Trades',
  trades_pro: 'Trades Pro',
}

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  active:   { label: 'Active',        color: 'bg-emerald-500/15 text-emerald-400' },
  trialing: { label: 'Trial',         color: 'bg-amber-500/15 text-amber-400' },
  cancelled:{ label: 'Cancelled',     color: 'bg-red-500/15 text-red-400' },
  free:     { label: 'Free',          color: 'bg-white/5 text-white/40' },
}

export default async function ElectriciansPage() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  // All trades-category portal accounts
  const { data: accounts } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, company_name, contact_name, phone, supplier_category, plan, subscription_status, trial_ends_at, created_at')
    .eq('supplier_category', 'trades')
    .order('created_at', { ascending: false })

  const rows = accounts ?? []
  const accountIds = rows.map(a => a.id)

  // Quote + job card counts per account
  const [{ data: quoteCounts }, { data: jobCardCounts }, { data: staffCounts }] = await Promise.all([
    accountIds.length > 0
      ? supabaseAdmin.from('elec_quotes').select('portal_account_id').in('portal_account_id', accountIds)
      : { data: [] },
    accountIds.length > 0
      ? supabaseAdmin.from('elec_job_cards').select('portal_account_id').in('portal_account_id', accountIds)
      : { data: [] },
    accountIds.length > 0
      ? supabaseAdmin.from('elec_staff').select('portal_account_id').in('portal_account_id', accountIds).eq('is_active', true)
      : { data: [] },
  ])

  const quotesByAccount: Record<string, number> = {}
  for (const q of quoteCounts ?? []) {
    quotesByAccount[q.portal_account_id] = (quotesByAccount[q.portal_account_id] ?? 0) + 1
  }
  const jobCardsByAccount: Record<string, number> = {}
  for (const j of jobCardCounts ?? []) {
    jobCardsByAccount[j.portal_account_id] = (jobCardsByAccount[j.portal_account_id] ?? 0) + 1
  }
  const staffByAccount: Record<string, number> = {}
  for (const s of staffCounts ?? []) {
    staffByAccount[s.portal_account_id] = (staffByAccount[s.portal_account_id] ?? 0) + 1
  }

  // Summary stats
  const totalContractors = rows.length
  const activeContractors = rows.filter(a => a.subscription_status === 'active').length
  const trialContractors = rows.filter(a => a.subscription_status === 'trialing').length
  const newThisMonth = rows.filter(a => a.created_at >= thirtyDaysAgo).length
  const totalQuotes = Object.values(quotesByAccount).reduce((s, n) => s + n, 0)
  const totalJobCards = Object.values(jobCardsByAccount).reduce((s, n) => s + n, 0)

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-amber-400" />
          <h1 className="text-xl font-semibold text-white">Electrician Portal</h1>
        </div>
        <p className="text-sm text-white/40">Trade contractors registered on the Electrician Portal</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Contractors', value: totalContractors, icon: Zap,       color: 'text-amber-400' },
          { label: 'Active',            value: activeContractors, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'In Trial',          value: trialContractors,  icon: Clock,     color: 'text-amber-400' },
          { label: 'New This Month',    value: newThisMonth,      icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Total Quotes',      value: totalQuotes,       icon: FileText,  color: 'text-white/60' },
          { label: 'Total Job Cards',   value: totalJobCards,     icon: Briefcase, color: 'text-white/60' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/5 rounded-xl px-4 py-4 border border-white/8">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon size={12} className={color} />
              <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Contractors Table */}
      {rows.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-16 text-center">
          <Zap size={32} className="mx-auto text-amber-400/40 mb-3" />
          <p className="text-sm font-medium text-white/60 mb-1">No electrician contractors yet</p>
          <p className="text-xs text-white/30 max-w-xs mx-auto">
            Trade contractors appear here once they sign up on the Electrician Portal and select <strong className="text-white/50">Trades</strong> as their category.
          </p>
        </div>
      ) : (
        <div className="bg-[#1A1A18] rounded-xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">All Contractors</h2>
            <span className="text-xs text-white/30">{rows.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] text-white/30 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Company</th>
                  <th className="text-left px-5 py-3">Contact</th>
                  <th className="text-left px-5 py-3">Plan</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Quotes</th>
                  <th className="text-left px-5 py-3">Job Cards</th>
                  <th className="text-left px-5 py-3">Staff</th>
                  <th className="text-left px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(a => {
                  const statusInfo = SUB_STATUS[a.subscription_status ?? 'free'] ?? SUB_STATUS.free
                  const trialEnds = a.trial_ends_at ? new Date(a.trial_ends_at) : null
                  const trialDaysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000)) : null
                  const isTrialExpired = trialEnds && trialEnds < new Date() && a.subscription_status === 'trialing'

                  return (
                    <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <Zap size={11} className="text-amber-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-xs leading-tight">{a.company_name}</p>
                            <p className="text-white/30 text-[10px]">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-white/60 text-xs">{a.contact_name ?? '—'}</p>
                        {a.phone && <p className="text-white/30 text-[10px]">{a.phone}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-white/50 capitalize">{a.plan ? (PLAN_LABEL[a.plan] ?? a.plan) : '—'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                          {isTrialExpired ? 'Trial expired' : statusInfo.label}
                          {a.subscription_status === 'trialing' && !isTrialExpired && trialDaysLeft !== null && (
                            <span className="ml-1 opacity-70">· {trialDaysLeft}d left</span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs tabular-nums ${quotesByAccount[a.id] ? 'text-white/70' : 'text-white/20'}`}>
                          {quotesByAccount[a.id] ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs tabular-nums ${jobCardsByAccount[a.id] ? 'text-white/70' : 'text-white/20'}`}>
                          {jobCardsByAccount[a.id] ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs tabular-nums ${staffByAccount[a.id] ? 'text-white/70' : 'text-white/20'}`}>
                          {staffByAccount[a.id] ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-white/40 text-xs">{fmtDate(a.created_at)}</p>
                        <p className="text-white/20 text-[10px]">{timeAgo(a.created_at)}</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feature Guide */}
      <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} className="text-amber-400" />
          <h3 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Electrician Portal Capabilities</h3>
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
              <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-white/70">{title}</p>
                <p className="text-[10px] text-white/30">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
