'use client'
import { useState, useEffect } from 'react'
import {
  Zap, Users, Clock, RotateCcw, Trash2,
  CheckCircle, Loader2, Plus, X, AlertCircle, ShieldCheck, Edit2,
  Receipt, AlertTriangle, BadgeCheck, CreditCard, ExternalLink,
} from 'lucide-react'
import { useNow } from '@/lib/useNow'

// ── Plan config ────────────────────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  starter:      { label: 'Starter',      color: 'text-[#0F766E]',    bg: 'bg-teal-50'    },
  professional: { label: 'Professional', color: 'text-[#8F5706]',   bg: 'bg-amber-50'   },
  business:     { label: 'Business',     color: 'text-[#047857]', bg: 'bg-emerald-50' },
  quoting:      { label: 'Business',     color: 'text-[#047857]', bg: 'bg-emerald-50' }, // legacy
  free:         { label: 'Free',         color: 'text-[#6E6B63]',    bg: 'bg-[#EFEBE3]'        },
}

const PLAN_OPTIONS = [
  { id: 'starter',      label: 'Starter — R999/mo',       desc: 'Clocking only' },
  { id: 'professional', label: 'Professional — R1,999/mo', desc: '+ Job Cards'  },
  { id: 'business',     label: 'Business — R3,199/mo',     desc: '+ Projects'   },
  { id: 'free',         label: 'Free',                     desc: 'No access'    },
]

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Active',    color: 'bg-emerald-50 text-[#047857]' },
  trialing:  { label: 'Trial',     color: 'bg-amber-50 text-[#8F5706]'    },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-[#B91C1C]'        },
  past_due:  { label: 'Past Due',  color: 'bg-red-50 text-[#B91C1C]'        },
  free:      { label: 'Free',      color: 'bg-[#EFEBE3] text-[#6E6B63]'          },
}

export interface AdminMember {
  id: string
  email: string
  name: string | null
  invited_at: string
  accepted_at: string | null
}

export interface ContractorRow {
  id: string
  email: string
  company_name: string
  contact_name: string | null
  phone: string | null
  plan: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  setup_fee_paid: boolean
  created_at: string
  quoteCount: number
  jobCardCount: number
  staffCount: number
  adminMembers: AdminMember[]
}

const STAFF_INCLUDED = 20
const EXTRA_STAFF_RATE = 40

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}
function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

// ── Plan Management Panel ───────────────────────────────────────────────────────
function PlanPanel({ accountId, initialPlan, initialStatus }: {
  accountId: string
  initialPlan: string | null
  initialStatus: string | null
}) {
  const [plan, setPlan]     = useState(initialPlan ?? 'free')
  const [status, setStatus] = useState(initialStatus ?? 'free')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const cfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.free

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    const res = await fetch(`/api/platform/elec-accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, subscription_status: status }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setSaving(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Failed to save'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="px-5 py-4 bg-[#F7F4EE] border-t border-[#EAE5DB]">
      <div className="flex items-center gap-1.5 mb-3">
        <ShieldCheck size={11} className="text-[#8F5706]" />
        <p className="text-[10px] font-semibold text-[#6E6B63] uppercase tracking-wider">Plan Management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Plan selector */}
        <div>
          <p className="text-[10px] text-[#6E6B63] mb-1.5 uppercase tracking-wider">Plan Tier</p>
          <div className="space-y-1.5">
            {PLAN_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setPlan(opt.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${plan === opt.id ? 'bg-amber-50 border border-amber-300' : 'bg-[#F3EFE8] border border-[#EAE5DB] hover:bg-[#EFEBE3]'}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${plan === opt.id ? 'bg-[#8F5706]' : 'bg-[#DED8CC]'}`} />
                <div>
                  <p className={`text-xs font-medium ${plan === opt.id ? 'text-[#8F5706]' : 'text-[#3F3D38]'}`}>{opt.label}</p>
                  <p className="text-[10px] text-[#6E6B63]">{opt.desc}</p>
                </div>
                {plan === opt.id && <CheckCircle size={11} className="text-[#8F5706] ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* Status + save */}
        <div>
          <p className="text-[10px] text-[#6E6B63] mb-1.5 uppercase tracking-wider">Subscription Status</p>
          <div className="space-y-1.5 mb-3">
            {['active', 'trialing', 'cancelled', 'past_due'].map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${status === s ? 'bg-[#E5DFD5] border border-[#DED8CC]' : 'bg-[#F3EFE8] border border-[#EAE5DB] hover:bg-[#EFEBE3]'}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  s === 'active' ? 'bg-[#047857]' :
                  s === 'trialing' ? 'bg-[#8F5706]' :
                  'bg-red-400'
                }`} />
                <p className={`text-xs font-medium ${status === s ? 'text-[#1A1A18]' : 'text-[#5C5A54]'}`}>
                  {SUB_STATUS[s]?.label ?? s}
                </p>
                {status === s && <CheckCircle size={11} className="text-[#3F3D38] ml-auto" />}
              </button>
            ))}
          </div>


          {/* Preview */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-[#F3EFE8] rounded-lg border border-[#EAE5DB]">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SUB_STATUS[status]?.color ?? ''}`}>{SUB_STATUS[status]?.label ?? status}</span>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-[#B91C1C] mb-2">
              <AlertCircle size={11} /> {error}
            </div>
          )}

          <button onClick={() => void handleSave()} disabled={saving}
            className="w-full py-2 text-xs font-semibold rounded-lg bg-amber-500/20 text-[#8F5706] hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
            {saving
              ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
              : saved
                ? <><CheckCircle size={12} className="text-[#047857]" /> Saved</>
                : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Admin Users Panel ───────────────────────────────────────────────────────────
function AdminUsersPanel({ accountId, initial }: { accountId: string; initial: AdminMember[] }) {
  const [members, setMembers] = useState(initial)
  const [resending, setResending] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [resentId, setResentId] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteDone, setInviteDone] = useState(false)

  async function handleResend(memberId: string) {
    setResending(memberId)
    const res = await fetch('/api/platform/elec-team', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, accountId }),
    })
    setResending(null)
    if (res.ok) { setResentId(memberId); setTimeout(() => setResentId(null), 3000) }
  }

  async function handleDelete(memberId: string) {
    if (!confirm('Remove this admin user? If they have accepted the invite, their account will be deleted.')) return
    setDeleting(memberId)
    const res = await fetch('/api/platform/elec-team', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    setDeleting(null)
    if (res.ok) setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteError(''); setInviteDone(false)
    const res = await fetch('/api/platform/elec-team', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: '__new__', accountId, newEmail: inviteEmail.trim(), newName: inviteName.trim() || undefined }),
    })
    const data = await res.json() as { ok?: boolean; error?: string; member?: AdminMember }
    setInviting(false)
    if (!res.ok || !data.ok) { setInviteError(data.error ?? 'Failed to send invite'); return }
    setInviteDone(true)
    if (data.member) setMembers(prev => [...prev, data.member!])
    setInviteEmail(''); setInviteName('')
    setTimeout(() => { setInviteDone(false); setShowInvite(false) }, 2000)
  }

  return (
    <div className="px-5 py-4 bg-[#F7F4EE] border-t border-[#EAE5DB]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-[#6E6B63] uppercase tracking-wider flex items-center gap-1.5">
          <Users size={11} /> Admin Users
        </p>
        <button onClick={() => { setShowInvite(true); setInviteError(''); setInviteDone(false) }}
          className="flex items-center gap-1 text-[10px] text-[#8F5706] hover:text-[#8F5706] transition-colors cursor-pointer">
          <Plus size={10} /> Invite Admin
        </button>
      </div>

      {members.length === 0 && !showInvite && (
        <p className="text-xs text-[#8A877F] italic">No additional admins added by owner.</p>
      )}

      <div className="space-y-2">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-3 bg-[#F1EDE5] rounded-lg px-3 py-2.5">
            <div className="w-7 h-7 rounded-full bg-[#E5DFD5] flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[#3F3D38]">
              {(m.name ?? m.email).slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {m.name && <p className="text-xs font-medium text-[#2C2C2A] leading-tight">{m.name}</p>}
              <p className="text-[11px] text-[#6E6B63] truncate">{m.email}</p>
              <p className="text-[10px] text-[#8A877F]">Invited {timeAgo(m.invited_at)}</p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${m.accepted_at ? 'bg-emerald-50 text-[#047857]' : 'bg-amber-50 text-[#8F5706]'}`}>
              {m.accepted_at
                ? <span className="flex items-center gap-1"><CheckCircle size={9} /> Active</span>
                : <span className="flex items-center gap-1"><Clock size={9} /> Pending</span>}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!m.accepted_at && (
                <button onClick={() => void handleResend(m.id)} disabled={resending === m.id} title="Resend invite"
                  className="p-1.5 rounded text-[#6E6B63] hover:text-[#8F5706] hover:bg-amber-50 transition-colors cursor-pointer disabled:opacity-50">
                  {resending === m.id ? <Loader2 size={12} className="animate-spin" /> : resentId === m.id ? <CheckCircle size={12} className="text-[#047857]" /> : <RotateCcw size={12} />}
                </button>
              )}
              <button onClick={() => void handleDelete(m.id)} disabled={deleting === m.id} title="Remove admin"
                className="p-1.5 rounded text-[#6E6B63] hover:text-[#B91C1C] hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50">
                {deleting === m.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showInvite && (
        <div className="mt-3 bg-[#EFEBE3] border border-[#DED8CC] rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-[#5C5A54] uppercase tracking-wider">Invite New Admin</p>
            <button onClick={() => setShowInvite(false)} className="text-[#6E6B63] hover:text-[#1A1A18] cursor-pointer"><X size={12} /></button>
          </div>
          {inviteDone ? (
            <div className="flex items-center gap-2 text-xs text-[#047857] py-1"><CheckCircle size={13} /> Invite sent!</div>
          ) : (
            <>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="admin@example.com"
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#EFEBE3] border border-[#DED8CC] text-[#1A1A18] placeholder-white/20 outline-none focus:border-amber-500/50" />
              <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Name (optional)"
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#EFEBE3] border border-[#DED8CC] text-[#1A1A18] placeholder-white/20 outline-none focus:border-amber-500/50" />
              {inviteError && <div className="flex items-center gap-1.5 text-xs text-[#B91C1C]"><AlertCircle size={11} /> {inviteError}</div>}
              <button onClick={() => void handleInvite()} disabled={inviting || !inviteEmail.trim()}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-amber-500/20 text-[#8F5706] hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50">
                {inviting ? <><Loader2 size={11} className="animate-spin inline mr-1" />Sending…</> : 'Send Invite'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Billing Panel ────────────────────────────────────────────────────────────────
interface BillingData {
  configured: boolean
  email?: string
  subscriptionCode?: string
  status?: string
  amount?: number
  nextPaymentDate?: string | null
  planName?: string | null
  planInterval?: string | null
  card?: { brand: string | null; last4: string | null; expMonth: string | null; expYear: string | null; bank: string | null } | null
  transactions?: { id: number; amount: number; status: string; paid_at: string | null; reference: string }[]
}

const SUB_BADGE: Record<string, string> = {
  active:        'bg-emerald-50 text-[#047857]',
  'non-renewing':'bg-amber-50 text-[#8F5706]',
  cancelled:     'bg-red-50 text-[#B91C1C]',
  attention:     'bg-red-50 text-[#B91C1C]',
  completed:     'bg-[#E5DFD5] text-[#6E6B63]',
}

function fmtRand(cents: number) { return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` }

function BillingPanel({ accountId }: { accountId: string }) {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/platform/elec-accounts/${accountId}/billing`)
      const json = await res.json() as BillingData & { error?: string }
      if (cancelled) return
      if (!res.ok) { setError(json.error ?? 'Failed to load billing'); setLoading(false); return }
      setData(json)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [accountId])

  return (
    <div className="px-5 py-4 bg-[#F7F4EE] border-t border-[#EAE5DB]">
      <div className="flex items-center gap-1.5 mb-3">
        <CreditCard size={11} className="text-[#8F5706]" />
        <p className="text-[10px] font-semibold text-[#6E6B63] uppercase tracking-wider">Billing (Paystack)</p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-[#6E6B63] py-2">
          <Loader2 size={12} className="animate-spin" /> Loading from Paystack…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-1.5 text-xs text-[#B91C1C] py-2">
          <AlertCircle size={11} /> {error}
        </div>
      )}

      {!loading && data && !data.configured && (
        <p className="text-xs text-[#6E6B63] italic py-1">No Paystack subscription on file for this account yet.</p>
      )}

      {!loading && data?.configured && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SUB_BADGE[data.status ?? ''] ?? 'bg-[#E5DFD5] text-[#6E6B63]'}`}>
                {data.status}
              </span>
              {data.planName && <span className="text-xs text-[#5C5A54]">{data.planName}</span>}
            </div>
            <p className="text-xs text-[#3F3D38]">
              <span className="text-[#6E6B63]">Amount:</span> {typeof data.amount === 'number' ? fmtRand(data.amount) : '—'}
              {data.planInterval ? ` / ${data.planInterval}` : ''}
            </p>
            <p className="text-xs text-[#3F3D38]">
              <span className="text-[#6E6B63]">Next payment:</span> {data.nextPaymentDate ? fmtDate(data.nextPaymentDate) : '—'}
            </p>
            {data.card && (
              <p className="text-xs text-[#3F3D38]">
                <span className="text-[#6E6B63]">Card:</span> {data.card.brand ?? 'Card'} •••• {data.card.last4 ?? '????'}
                {data.card.expMonth && data.card.expYear ? ` (exp ${data.card.expMonth}/${data.card.expYear})` : ''}
              </p>
            )}
            <a
              href={`https://dashboard.paystack.com/#/subscriptions/${data.subscriptionCode}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-[#8F5706] hover:text-[#8F5706] transition-colors"
            >
              Open in Paystack <ExternalLink size={9} />
            </a>
          </div>

          <div>
            <p className="text-[10px] text-[#6E6B63] mb-1.5 uppercase tracking-wider">Recent Transactions</p>
            {!data.transactions || data.transactions.length === 0 ? (
              <p className="text-xs text-[#8A877F] italic">No transaction history found.</p>
            ) : (
              <div className="space-y-1.5">
                {data.transactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs bg-[#F1EDE5] rounded-lg px-2.5 py-1.5">
                    <span className="text-[#5C5A54]">{t.paid_at ? fmtDate(t.paid_at) : '—'}</span>
                    <span className="text-[#3F3D38] tabular-nums">{fmtRand(t.amount)}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${t.status === 'success' ? 'bg-emerald-50 text-[#047857]' : 'bg-red-50 text-[#B91C1C]'}`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Table ──────────────────────────────────────────────────────────────────
type ExpandView = 'plan' | 'admins' | 'billing'

export function ContractorsTable({ rows: initialRows }: { rows: ContractorRow[] }) {
  const now = useNow()
  const [rows, setRows] = useState(initialRows)
  const [expanded, setExpanded] = useState<Record<string, ExpandView | null>>({})
  const [activating, setActivating] = useState<string | null>(null)
  const [markingFee, setMarkingFee] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function toggle(id: string, view: ExpandView) {
    setExpanded(prev => ({
      ...prev,
      [id]: prev[id] === view ? null : view,
    }))
  }

  async function setStatus(accountId: string, status: 'active' | 'cancelled') {
    setActivating(accountId)
    const res = await fetch(`/api/platform/elec-accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_status: status }),
    })
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === accountId ? { ...r, subscription_status: status } : r))
    }
    setActivating(null)
  }

  async function markSetupFeePaid(accountId: string, paid: boolean) {
    setMarkingFee(accountId)
    const res = await fetch(`/api/platform/elec-accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup_fee_paid: paid }),
    })
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === accountId ? { ...r, setup_fee_paid: paid } : r))
    }
    setMarkingFee(null)
  }

  async function handleDelete(accountId: string, companyName: string) {
    if (!confirm(`Permanently delete "${companyName}" and all their data? This cannot be undone.`)) return
    setDeleting(accountId)
    const res = await fetch(`/api/platform/elec-accounts/${accountId}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) setRows(prev => prev.filter(r => r.id !== accountId))
  }

  if (rows.length === 0) {
    return (
      <div className="bg-[#EFEBE3] border border-[#DED8CC] rounded-xl px-6 py-16 text-center">
        <Zap size={32} className="mx-auto text-[#8F5706]/40 mb-3" />
        <p className="text-sm font-medium text-[#3F3D38] mb-1">No electrician contractors yet</p>
        <p className="text-xs text-[#6E6B63] max-w-xs mx-auto">
          Trade contractors appear here once they sign up on the Electrician Portal.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#FDFCF9] rounded-xl border border-[#DED8CC] overflow-hidden">
      {/* Column headers */}
      <div className="hidden md:grid px-5 py-2 border-b border-[#DED8CC] text-[10px] font-semibold text-[#6E6B63] uppercase tracking-wider"
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 90px' }}>
        <span>Company</span>
        <span>Plan</span>
        <span>Status</span>
        <span>Quotes</span>
        <span>Jobs</span>
        <span>Staff</span>
        <span>Setup Fee</span>
        <span>Joined</span>
      </div>

      {rows.map(a => {
        const openView  = expanded[a.id] ?? null
        const statusInfo = SUB_STATUS[a.subscription_status ?? 'free'] ?? SUB_STATUS.free
        const planCfg    = PLAN_CONFIG[a.plan ?? 'free'] ?? PLAN_CONFIG.free
        const trialEnds  = a.trial_ends_at ? new Date(a.trial_ends_at) : null
        const trialDaysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - now) / 86400000)) : null
        const isTrialExpired = trialEnds && trialEnds < new Date() && a.subscription_status === 'trialing'
        const pendingAdmins  = a.adminMembers.filter(m => !m.accepted_at).length
        const extraStaff     = Math.max(0, a.staffCount - STAFF_INCLUDED)

        return (
          <div key={a.id} className="border-b border-[#EAE5DB] last:border-0">
            {/* Main row */}
            <div className="grid items-center px-5 py-3 gap-4 hover:bg-[#F7F4EE] transition-colors"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 90px' }}>

              {/* Company */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap size={11} className="text-[#8F5706]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[#1A1A18] font-medium text-xs leading-tight truncate">{a.company_name}</p>
                  <p className="text-[#6E6B63] text-[10px] truncate">{a.email}</p>
                </div>
              </div>

              {/* Plan — click to toggle plan editor */}
              <div>
                <button onClick={() => toggle(a.id, 'plan')}
                  className="flex items-center gap-1.5 cursor-pointer group"
                  title="Click to change plan">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${planCfg.bg} ${planCfg.color}`}>
                    {planCfg.label}
                  </span>
                  <Edit2 size={9} className="text-[#8A877F] group-hover:text-[#5C5A54] transition-colors" />
                </button>
              </div>

              {/* Status — click to view Paystack billing */}
              <div>
                <button onClick={() => toggle(a.id, 'billing')} className="cursor-pointer group" title="Click to view billing">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                    {isTrialExpired ? 'Trial expired' : statusInfo.label}
                    {a.subscription_status === 'trialing' && !isTrialExpired && trialDaysLeft !== null && (
                      <span className="ml-1 opacity-70">· {trialDaysLeft}d</span>
                    )}
                  </span>
                </button>
              </div>

              {/* Quotes */}
              <span className={`text-xs tabular-nums ${a.quoteCount ? 'text-[#3F3D38]' : 'text-[#8A877F]'}`}>{a.quoteCount}</span>

              {/* Job cards */}
              <span className={`text-xs tabular-nums ${a.jobCardCount ? 'text-[#3F3D38]' : 'text-[#8A877F]'}`}>{a.jobCardCount}</span>

              {/* Staff + overage */}
              <button onClick={() => toggle(a.id, 'admins')}
                className="flex flex-col gap-0.5 cursor-pointer group text-left" title="Click to manage admin users">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs tabular-nums ${a.staffCount ? 'text-[#3F3D38]' : 'text-[#8A877F]'}`}>{a.staffCount} staff</span>
                  <span className="text-[10px] text-[#6E6B63] flex items-center gap-1 group-hover:text-[#5C5A54] transition-colors">
                    <Users size={9} /> {a.adminMembers.length}
                    {pendingAdmins > 0 && <span className="px-1 rounded-full bg-amber-500/20 text-[#8F5706] text-[10px]">{pendingAdmins}</span>}
                  </span>
                </div>
                {extraStaff > 0 && (
                  <span className="text-[10px] font-semibold flex items-center gap-1 text-[#8F5706]">
                    <AlertTriangle size={8} /> +{extraStaff} · R{extraStaff * EXTRA_STAFF_RATE}/mo
                  </span>
                )}
              </button>

              {/* Setup fee */}
              <div>
                {a.setup_fee_paid ? (
                  <span className="text-[10px] font-medium flex items-center gap-1 text-[#047857]">
                    <BadgeCheck size={11} /> Paid
                  </span>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); void markSetupFeePaid(a.id, true) }}
                    disabled={markingFee === a.id}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-[#8F5706] hover:bg-amber-500/25 transition-colors cursor-pointer disabled:opacity-50"
                    title="Mark setup fee as paid"
                  >
                    {markingFee === a.id ? <Loader2 size={9} className="animate-spin" /> : <Receipt size={9} />}
                    {markingFee === a.id ? '…' : 'R2,500 owed'}
                  </button>
                )}
              </div>

              {/* Joined + activate/pause + delete */}
              <div className="text-right space-y-1">
                <p className="text-[#6E6B63] text-[10px]">{fmtDate(a.created_at)}</p>
                {activating === a.id ? (
                  <span className="text-[10px] text-[#6E6B63] flex items-center gap-1 justify-end">
                    <Loader2 size={9} className="animate-spin" /> Saving…
                  </span>
                ) : a.subscription_status !== 'active' ? (
                  <button
                    onClick={e => { e.stopPropagation(); void setStatus(a.id, 'active') }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-[#047857] hover:bg-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                  >
                    <CheckCircle size={9} /> Activate
                  </button>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); void setStatus(a.id, 'cancelled') }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFEBE3] text-[#6E6B63] hover:bg-red-500/15 hover:text-[#B91C1C] transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                  >
                    <CheckCircle size={9} /> Pause
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); void handleDelete(a.id, a.company_name) }} disabled={deleting === a.id}
                  className="p-1 rounded text-[#8A877F] hover:text-[#B91C1C] hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50 ml-auto flex items-center justify-end"
                  title="Delete account">
                  {deleting === a.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                </button>
              </div>
            </div>

            {/* Plan panel */}
            {openView === 'plan' && (
              <PlanPanel
                accountId={a.id}
                initialPlan={a.plan}
                initialStatus={a.subscription_status}
              />
            )}

            {/* Admin users panel */}
            {openView === 'admins' && (
              <AdminUsersPanel accountId={a.id} initial={a.adminMembers} />
            )}

            {/* Billing panel */}
            {openView === 'billing' && (
              <BillingPanel accountId={a.id} />
            )}
          </div>
        )
      })}
    </div>
  )
}
