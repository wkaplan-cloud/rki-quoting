'use client'
import { useState } from 'react'
import { Zap, ChevronDown, ChevronUp, Users, Clock, RotateCcw, Trash2, CheckCircle, Loader2, Plus, X, AlertCircle } from 'lucide-react'

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  trades: 'Trades',
  trades_pro: 'Trades Pro',
}

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Active',    color: 'bg-emerald-500/15 text-emerald-400' },
  trialing:  { label: 'Trial',     color: 'bg-amber-500/15 text-amber-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/15 text-red-400' },
  free:      { label: 'Free',      color: 'bg-white/5 text-white/40' },
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
  created_at: string
  quoteCount: number
  jobCardCount: number
  staffCount: number
  adminMembers: AdminMember[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}
function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, accountId }),
    })
    setResending(null)
    if (res.ok) {
      setResentId(memberId)
      setTimeout(() => setResentId(null), 3000)
    }
  }

  async function handleDelete(memberId: string) {
    if (!confirm('Remove this admin user? If they have accepted the invite, their account will be deleted.')) return
    setDeleting(memberId)
    const res = await fetch('/api/platform/elec-team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    setDeleting(null)
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.id !== memberId))
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteError(''); setInviteDone(false)

    // Use the existing team invite endpoint on behalf of this account
    // Platform admin sends invite via the same resend mechanism — first create the member row
    const res = await fetch('/api/platform/elec-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send a special "new" action by passing a fake memberId we'll create server-side
      // Instead, we POST to a different endpoint. For now use the direct create flow.
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
    <div className="px-5 py-4 bg-white/2 border-t border-white/5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
          <Users size={11} /> Admin Users
        </p>
        <button
          onClick={() => { setShowInvite(true); setInviteError(''); setInviteDone(false) }}
          className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <Plus size={10} /> Invite Admin
        </button>
      </div>

      {members.length === 0 && !showInvite && (
        <p className="text-xs text-white/20 italic">No additional admins added by owner.</p>
      )}

      <div className="space-y-2">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-3 bg-white/4 rounded-lg px-3 py-2.5">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white/60">
              {(m.name ?? m.email).slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {m.name && <p className="text-xs font-medium text-white/80 leading-tight">{m.name}</p>}
              <p className="text-[11px] text-white/40 truncate">{m.email}</p>
              <p className="text-[10px] text-white/20">Invited {timeAgo(m.invited_at)}</p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${m.accepted_at ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {m.accepted_at ? <span className="flex items-center gap-1"><CheckCircle size={9} /> Active</span> : <span className="flex items-center gap-1"><Clock size={9} /> Pending</span>}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!m.accepted_at && (
                <button
                  onClick={() => void handleResend(m.id)}
                  disabled={resending === m.id}
                  title="Resend invite"
                  className="p-1.5 rounded text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {resending === m.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : resentId === m.id
                      ? <CheckCircle size={12} className="text-emerald-400" />
                      : <RotateCcw size={12} />}
                </button>
              )}
              <button
                onClick={() => void handleDelete(m.id)}
                disabled={deleting === m.id}
                title="Remove admin"
                className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting === m.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Inline invite form */}
      {showInvite && (
        <div className="mt-3 bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Invite New Admin</p>
            <button onClick={() => setShowInvite(false)} className="text-white/30 hover:text-white/60 cursor-pointer"><X size={12} /></button>
          </div>
          {inviteDone ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 py-1">
              <CheckCircle size={13} /> Invite sent!
            </div>
          ) : (
            <>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-3 py-2 text-xs rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-amber-500/50"
              />
              <input
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Name (optional)"
                className="w-full px-3 py-2 text-xs rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-amber-500/50"
              />
              {inviteError && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle size={11} /> {inviteError}
                </div>
              )}
              <button
                onClick={() => void handleInvite()}
                disabled={inviting || !inviteEmail.trim()}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                {inviting ? <><Loader2 size={11} className="animate-spin inline mr-1" />Sending…</> : 'Send Invite'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function ContractorsTable({ rows }: { rows: ContractorRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-16 text-center">
        <Zap size={32} className="mx-auto text-amber-400/40 mb-3" />
        <p className="text-sm font-medium text-white/60 mb-1">No electrician contractors yet</p>
        <p className="text-xs text-white/30 max-w-xs mx-auto">
          Trade contractors appear here once they sign up on the Electrician Portal and select <strong className="text-white/50">Trades</strong> as their category.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#1A1A18] rounded-xl border border-white/10 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">All Contractors</h2>
        <span className="text-xs text-white/30">{rows.length} total</span>
      </div>

      {rows.map(a => {
        const isOpen = expanded.has(a.id)
        const statusInfo = SUB_STATUS[a.subscription_status ?? 'free'] ?? SUB_STATUS.free
        const trialEnds = a.trial_ends_at ? new Date(a.trial_ends_at) : null
        const trialDaysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000)) : null
        const isTrialExpired = trialEnds && trialEnds < new Date() && a.subscription_status === 'trialing'
        const pendingAdmins = a.adminMembers.filter(m => !m.accepted_at).length

        return (
          <div key={a.id} className="border-b border-white/5 last:border-0">
            {/* Main row */}
            <button
              onClick={() => toggle(a.id)}
              className="w-full text-left hover:bg-white/3 transition-colors cursor-pointer"
            >
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto_auto_auto_32px] items-center px-5 py-3 gap-4">
                {/* Company */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap size={11} className="text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium text-xs leading-tight truncate">{a.company_name}</p>
                    <p className="text-white/30 text-[10px] truncate">{a.email}</p>
                  </div>
                </div>
                {/* Status */}
                <div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                    {isTrialExpired ? 'Trial expired' : statusInfo.label}
                    {a.subscription_status === 'trialing' && !isTrialExpired && trialDaysLeft !== null && (
                      <span className="ml-1 opacity-70">· {trialDaysLeft}d</span>
                    )}
                  </span>
                </div>
                {/* Quotes */}
                <span className={`text-xs tabular-nums ${a.quoteCount ? 'text-white/70' : 'text-white/20'}`}>{a.quoteCount} quotes</span>
                {/* Job cards */}
                <span className={`text-xs tabular-nums ${a.jobCardCount ? 'text-white/70' : 'text-white/20'}`}>{a.jobCardCount} jobs</span>
                {/* Staff */}
                <span className={`text-xs tabular-nums ${a.staffCount ? 'text-white/70' : 'text-white/20'}`}>{a.staffCount} staff</span>
                {/* Admins pill */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/40 flex items-center gap-1">
                    <Users size={10} />
                    {a.adminMembers.length}
                    {pendingAdmins > 0 && (
                      <span className="ml-0.5 px-1.5 py-0 rounded-full bg-amber-500/20 text-amber-400 text-[9px]">{pendingAdmins} pending</span>
                    )}
                  </span>
                </div>
                {/* Joined */}
                <div className="text-right">
                  <p className="text-white/40 text-[10px]">{fmtDate(a.created_at)}</p>
                </div>
                {/* Chevron */}
                <div className="text-white/30">
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
            </button>

            {/* Expanded admin panel */}
            {isOpen && (
              <AdminUsersPanel accountId={a.id} initial={a.adminMembers} />
            )}
          </div>
        )
      })}
    </div>
  )
}
