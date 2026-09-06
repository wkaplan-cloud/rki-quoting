'use client'
import { useState } from 'react'
import { CreditCard, FlaskConical } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useNow } from '@/lib/useNow'

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
  isInternal,
}: {
  orgId: string
  plan: string
  status: string
  trialEndsAt: string | null
  isInternal: boolean
}) {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState(plan)
  const [selectedStatus, setSelectedStatus] = useState(status)
  const [internal, setInternal] = useState(isInternal)
  const [saving, setSaving] = useState(false)

  const now = useNow()
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / 86400000))
    : 0

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/platform/studios/${orgId}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan, status: selectedStatus, is_internal: internal }),
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
    <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[#DED8CC] flex items-center justify-between">
        <h2 className="text-sm font-medium text-[#1A1A18] flex items-center gap-2">
          <CreditCard size={14} className="text-[#7E6036]" /> Subscription
        </h2>
        {status === 'trialing' && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${daysLeft === 0 ? 'bg-red-50 text-[#B91C1C]' : 'bg-[#7E6036]/12 text-[#7E6036]'}`}>
            {daysLeft === 0 ? 'Trial expired' : `${daysLeft} days remaining`}
          </span>
        )}
        {status === 'active' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-[#047857] capitalize">{plan} — Active</span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Trial ends info */}
        {trialEndsAt && (
          <div className="text-xs text-[#6E6B63]">
            Trial {daysLeft > 0 ? 'ends' : 'ended'}: {new Date(trialEndsAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#6E6B63] mb-1.5">Plan</label>
            <select
              value={selectedPlan}
              onChange={e => setSelectedPlan(e.target.value)}
              className="w-full bg-[#F5F2EC] border border-[#DED8CC] rounded-lg px-3 py-2 text-sm text-[#1A1A18] focus:outline-none focus:border-[#7E6036] cursor-pointer"
            >
              {PLAN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#6E6B63] mb-1.5">Status</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full bg-[#F5F2EC] border border-[#DED8CC] rounded-lg px-3 py-2 text-sm text-[#1A1A18] focus:outline-none focus:border-[#7E6036] cursor-pointer"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Internal account toggle */}
        <div className="flex items-center justify-between pt-1 pb-1 border-t border-[#EAE5DB]">
          <div className="flex items-center gap-2">
            <FlaskConical size={13} className={internal ? 'text-[#6D28D9]' : 'text-[#6E6B63]'} />
            <div>
              <p className="text-xs text-[#3F3D38] font-medium">Internal / test account</p>
              <p className="text-xs text-[#6E6B63]">Excluded from MRR, churn risk, and conversion metrics</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInternal(v => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer focus:outline-none ${internal ? 'bg-violet-500' : 'bg-[#E5DFD5]'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${internal ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-[#7E6036] text-white text-xs font-medium rounded-lg hover:bg-[#5F4726] transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
