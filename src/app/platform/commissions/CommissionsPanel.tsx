'use client'
import { useState } from 'react'
import { CheckCircle2, Circle, TrendingUp } from 'lucide-react'

const RATES: Record<string, { upfront: number; monthly: number }> = {
  solo:   { upfront: 650,  monthly: 70  },
  studio: { upfront: 1450, monthly: 150 },
  agency: { upfront: 2450, monthly: 250 },
}

const REPS = ['Lerato', 'Monalisa']

function monthsSince(dateStr: string) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
}

function isPaidThisMonth(dateStr: string | null) {
  if (!dateStr) return false
  const paid = new Date(dateStr)
  const now = new Date()
  return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear()
}

export interface OrgRow {
  id: string
  businessName: string
  plan: string | null
  subscription_status: string | null
  created_at: string
  assigned_rep: string | null
  rep_upfront_paid: boolean | null
  rep_monthly_last_paid_at: string | null
}

const fmt = (n: number) => `R ${n.toLocaleString('en-ZA')}`

export function CommissionsPanel({ orgs }: { orgs: OrgRow[] }) {
  const [rows, setRows] = useState(orgs)

  async function patch(id: string, updates: Record<string, unknown>) {
    await fetch(`/api/platform/studios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  // Platform-wide totals
  const allActiveClients = rows.filter(r => r.subscription_status === 'active' && RATES[r.plan ?? ''])
  const totalMonthlyOwed = allActiveClients.reduce((sum, c) => {
    const rate = RATES[c.plan ?? '']
    if (!rate || monthsSince(c.created_at) >= 12) return sum
    return sum + rate.monthly
  }, 0)
  const totalUpfrontUnpaid = allActiveClients
    .filter(c => !c.rep_upfront_paid)
    .reduce((sum, c) => sum + (RATES[c.plan ?? '']?.upfront ?? 0), 0)
  const totalUpfrontPaid = allActiveClients
    .filter(c => c.rep_upfront_paid)
    .reduce((sum, c) => sum + (RATES[c.plan ?? '']?.upfront ?? 0), 0)

  return (
    <div className="p-8 space-y-10">
      <div>
        <h1 className="font-serif text-3xl text-white mb-1">Commissions</h1>
        <p className="text-sm text-white/40">Track rep payouts — upfront on signup, monthly while subscribed (max 12 months)</p>
      </div>

      {/* Platform totals */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-[#C4A46B]" />
          <h2 className="text-sm font-medium text-white">All reps combined</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active commissioned clients', value: allActiveClients.length.toString(), color: 'text-white' },
            { label: 'Monthly owed this month', value: fmt(totalMonthlyOwed), color: 'text-[#C4A46B]' },
            { label: 'Upfront still unpaid', value: fmt(totalUpfrontUnpaid), color: totalUpfrontUnpaid > 0 ? 'text-amber-400' : 'text-white/30' },
            { label: 'Upfront paid to date', value: fmt(totalUpfrontPaid), color: 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/5 rounded-lg px-4 py-3">
              <p className={`text-xl font-semibold ${color}`}>{value}</p>
              <p className="text-xs text-white/30 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {REPS.map(rep => {
        const clients = rows.filter(r => r.assigned_rep === rep && r.subscription_status === 'active')
        const monthlyOwed = clients.reduce((sum, c) => {
          const rate = RATES[c.plan ?? '']
          if (!rate) return sum
          if (monthsSince(c.created_at) >= 12) return sum
          return sum + rate.monthly
        }, 0)
        const upfrontUnpaid = clients.filter(c => !c.rep_upfront_paid && RATES[c.plan ?? ''])
        const upfrontOwed = upfrontUnpaid.reduce((sum, c) => sum + (RATES[c.plan ?? '']?.upfront ?? 0), 0)

        return (
          <div key={rep} className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
            {/* Rep header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-white">{rep}</h2>
                <p className="text-xs text-white/40 mt-0.5">{clients.length} active client{clients.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex gap-6 text-right">
                {upfrontOwed > 0 && (
                  <div>
                    <p className="text-xs text-white/40 mb-0.5">Upfront owed</p>
                    <p className="text-sm font-semibold text-amber-400">{fmt(upfrontOwed)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Monthly this month</p>
                  <p className="text-sm font-semibold text-[#C4A46B]">{fmt(monthlyOwed)}</p>
                </div>
              </div>
            </div>

            {/* Clients table */}
            {clients.length === 0 ? (
              <p className="px-6 py-8 text-sm text-white/30 text-center">No active clients assigned yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
                    <th className="text-left px-6 py-3">Studio</th>
                    <th className="text-left px-6 py-3">Plan</th>
                    <th className="text-left px-6 py-3">Signed Up</th>
                    <th className="text-left px-6 py-3">Months Active</th>
                    <th className="text-left px-6 py-3">Upfront</th>
                    <th className="text-left px-6 py-3">Monthly</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {clients.map(c => {
                    const rate = RATES[c.plan ?? '']
                    const months = monthsSince(c.created_at)
                    const recurringActive = !!rate && months < 12
                    const paidThisMonth = isPaidThisMonth(c.rep_monthly_last_paid_at)

                    return (
                      <tr key={c.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-3.5 text-white font-medium">{c.businessName}</td>
                        <td className="px-6 py-3.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 capitalize">{c.plan ?? '—'}</span>
                        </td>
                        <td className="px-6 py-3.5 text-white/50 text-xs">
                          {new Date(c.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-3.5 text-white/50 text-xs">
                          {Math.floor(months)} / 12
                        </td>

                        {/* Upfront */}
                        <td className="px-6 py-3.5">
                          {!rate ? (
                            <span className="text-white/20 text-xs">—</span>
                          ) : c.rep_upfront_paid ? (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                              <CheckCircle2 size={13} /> {fmt(rate.upfront)} paid
                            </span>
                          ) : (
                            <button
                              onClick={() => patch(c.id, { rep_upfront_paid: true })}
                              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                            >
                              <Circle size={13} /> Pay {fmt(rate.upfront)}
                            </button>
                          )}
                        </td>

                        {/* Monthly */}
                        <td className="px-6 py-3.5">
                          {!recurringActive ? (
                            <span className="text-white/20 text-xs">{months >= 12 ? 'Completed' : '—'}</span>
                          ) : paidThisMonth ? (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                              <CheckCircle2 size={13} /> {fmt(rate.monthly)} paid
                            </span>
                          ) : (
                            <button
                              onClick={() => patch(c.id, { rep_monthly_last_paid_at: new Date().toISOString() })}
                              className="flex items-center gap-1.5 text-xs text-[#C4A46B] hover:text-white transition-colors cursor-pointer"
                            >
                              <Circle size={13} /> Pay {fmt(rate.monthly)}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}
