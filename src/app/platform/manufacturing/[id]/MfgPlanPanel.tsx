'use client'
import { useState } from 'react'
import { ShieldCheck, CheckCircle, AlertCircle, Loader2, BadgeCheck, Receipt } from 'lucide-react'

const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  starter:      { label: 'Starter',      color: 'text-[#0F766E]',    bg: 'bg-teal-50'    },
  professional: { label: 'Professional', color: 'text-[#8F5706]',   bg: 'bg-amber-50'   },
  business:     { label: 'Business',     color: 'text-[#047857]', bg: 'bg-emerald-50' },
  quoting:      { label: 'Business',     color: 'text-[#047857]', bg: 'bg-emerald-50' },
  free:         { label: 'Free',         color: 'text-[#6E6B63]',    bg: 'bg-[#EFEBE3]'        },
}
const PLAN_OPTIONS = [
  { id: 'starter',      label: 'Starter',      desc: 'R999/mo'   },
  { id: 'professional', label: 'Professional', desc: 'R1,999/mo' },
  { id: 'business',     label: 'Business',     desc: 'R3,199/mo' },
  { id: 'free',         label: 'Free / Paused', desc: 'No access' },
]
const SUB_OPTIONS = ['active', 'trialing', 'cancelled', 'past_due'] as const
const SUB_LABEL: Record<string, string> = { active: 'Active', trialing: 'Trialing', cancelled: 'Cancelled', past_due: 'Past Due' }
const SUB_COLOR: Record<string, string> = {
  active: 'bg-emerald-50 text-[#047857]', trialing: 'bg-amber-50 text-[#8F5706]',
  cancelled: 'bg-red-50 text-[#B91C1C]', past_due: 'bg-red-50 text-[#B91C1C]',
}

interface Props {
  accountId: string
  initialPlan: string | null
  initialStatus: string | null
  initialTrialEndsAt: string | null
  setupFeePaid: boolean
}

export function MfgPlanPanel({ accountId, initialPlan, initialStatus, initialTrialEndsAt, setupFeePaid: initialFeePaid }: Props) {
  const [plan, setPlan]         = useState(initialPlan ?? 'free')
  const [status, setStatus]     = useState(initialStatus ?? 'free')
  const [trialEndsAt, setTrialEndsAt] = useState(initialTrialEndsAt?.slice(0, 10) ?? '')
  const [feePaid, setFeePaid]   = useState(initialFeePaid)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    const res = await fetch(`/api/platform/mfg-accounts/${accountId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        subscription_status: status,
        trial_ends_at: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
        setup_fee_paid: feePaid,
      }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setSaving(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Failed'); return }
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  const cfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.free

  return (
    <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5 mb-6">
      <div className="flex items-center gap-1.5 mb-4">
        <ShieldCheck size={14} className="text-[#C2410C]" />
        <h2 className="text-sm font-medium text-[#1A1A18]">Plan Management</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Plan */}
        <div>
          <p className="text-[10px] text-[#6E6B63] mb-2 uppercase tracking-wider">Plan Tier</p>
          <div className="space-y-1.5">
            {PLAN_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setPlan(opt.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${plan === opt.id ? 'bg-orange-50 border border-orange-300' : 'bg-[#F3EFE8] border border-[#EAE5DB] hover:bg-[#EFEBE3]'}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${plan === opt.id ? 'bg-[#C2410C]' : 'bg-[#DED8CC]'}`} />
                <div className="flex-1">
                  <p className={`text-xs font-medium ${plan === opt.id ? 'text-[#C2410C]' : 'text-[#3F3D38]'}`}>{opt.label}</p>
                  <p className="text-[10px] text-[#6E6B63]">{opt.desc}</p>
                </div>
                {plan === opt.id && <CheckCircle size={11} className="text-[#C2410C]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="text-[10px] text-[#6E6B63] mb-2 uppercase tracking-wider">Subscription Status</p>
          <div className="space-y-1.5 mb-4">
            {SUB_OPTIONS.map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${status === s ? 'bg-[#E5DFD5] border border-[#DED8CC]' : 'bg-[#F3EFE8] border border-[#EAE5DB] hover:bg-[#EFEBE3]'}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s === 'active' ? 'bg-[#047857]' : s === 'trialing' ? 'bg-[#8F5706]' : 'bg-red-400'}`} />
                <p className={`text-xs font-medium ${status === s ? 'text-[#1A1A18]' : 'text-[#5C5A54]'}`}>{SUB_LABEL[s]}</p>
                {status === s && <CheckCircle size={11} className="text-[#3F3D38] ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* Trial date + setup fee + save */}
        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-[#6E6B63] mb-2 uppercase tracking-wider">Trial End Date</p>
            <input type="date" value={trialEndsAt} onChange={e => setTrialEndsAt(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-[#EFEBE3] border border-[#DED8CC] text-[#1A1A18] outline-none focus:border-orange-500/50" />
          </div>

          <div>
            <p className="text-[10px] text-[#6E6B63] mb-2 uppercase tracking-wider">Setup Fee (R2,500)</p>
            <button onClick={() => setFeePaid(prev => !prev)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer w-full ${feePaid ? 'bg-emerald-50 border-emerald-500/30 text-[#047857]' : 'bg-amber-50 border-amber-200 text-[#8F5706]'}`}>
              {feePaid ? <BadgeCheck size={13} /> : <Receipt size={13} />}
              {feePaid ? 'Paid' : 'Mark as Paid'}
            </button>
          </div>

          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-[#F3EFE8] rounded-lg border border-[#EAE5DB]">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SUB_COLOR[status] ?? ''}`}>{SUB_LABEL[status] ?? status}</span>
            </div>
            {error && <div className="flex items-center gap-1.5 text-xs text-[#B91C1C] mb-2"><AlertCircle size={11} /> {error}</div>}
            <button onClick={() => void handleSave()} disabled={saving}
              className="w-full py-2 text-xs font-semibold rounded-lg bg-orange-500/20 text-[#C2410C] hover:bg-orange-500/30 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : saved ? <><CheckCircle size={12} className="text-[#047857]" /> Saved</> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
