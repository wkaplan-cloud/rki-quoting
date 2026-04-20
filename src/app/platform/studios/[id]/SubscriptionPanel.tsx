'use client'
import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const PLAN_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'solo', label: 'Solo — R699/month' },
  { value: 'studio', label: 'Studio — R1,499/month' },
  { value: 'agency', label: 'Agency — R2,499/month' },
]

const STATUS_OPTIONS = [
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function SubscriptionPanel({
  orgId,
  plan,
  status,
  trialEndsAt,
}: {
  orgId: string
  plan: string
  status: string
  trialEndsAt: string | null
}) {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState(plan)
  const [selectedStatus, setSelectedStatus] = useState(status)
  const [saving, setSaving] = useState(false)

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/platform/studios/${orgId}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan, status: selectedStatus }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Subscription updated')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to update')
    }
  }

  return (
    <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white flex items-center gap-2">
          <CreditCard size={14} className="text-[#C4A46B]" /> Subscription
        </h2>
        {status === 'trialing' && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${daysLeft === 0 ? 'bg-red-500/15 text-red-400' : 'bg-[#9A7B4F]/20 text-[#C4A46B]'}`}>
            {daysLeft === 0 ? 'Trial expired' : `${daysLeft} days remaining`}
          </span>
        )}
        {status === 'active' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 capitalize">{plan} — Active</span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Trial ends info */}
        {trialEndsAt && (
          <div className="text-xs text-white/40">
            Trial {daysLeft > 0 ? 'ends' : 'ended'}: {new Date(trialEndsAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Plan</label>
            <select
              value={selectedPlan}
              onChange={e => setSelectedPlan(e.target.value)}
              className="w-full bg-[#0F0F0D] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9A7B4F] cursor-pointer"
            >
              {PLAN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Status</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full bg-[#0F0F0D] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9A7B4F] cursor-pointer"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-[#9A7B4F] text-white text-xs font-medium rounded-lg hover:bg-[#B8956A] transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
