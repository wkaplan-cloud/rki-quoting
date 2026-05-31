'use client'
import { useState } from 'react'
import { Plus, X, AlertCircle, CheckCircle2, Loader2, MapPin, LogIn, LogOut, Users, Clock } from 'lucide-react'
import type { PortalOrgMember, ElecStaff, ElecTimePunch } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(ms: number) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

type Tab = 'admins' | 'timesheet'

interface Props {
  orgMembers: PortalOrgMember[]
  staff: ElecStaff[]
  punches: ElecTimePunch[]
  ownerEmail: string
}

export function TeamClient({ orgMembers: initMembers, staff, punches, ownerEmail }: Props) {
  const [tab, setTab] = useState<Tab>('timesheet')
  const [members, setMembers] = useState(initMembers)
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteDone, setInviteDone] = useState(false)

  // Timesheet — group punches by staff and date
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s]))
  const dayMap: Record<string, Record<string, ElecTimePunch[]>> = {}
  for (const p of punches) {
    const day = p.punched_at.slice(0, 10)
    if (!dayMap[day]) dayMap[day] = {}
    if (!dayMap[day][p.staff_id]) dayMap[day][p.staff_id] = []
    dayMap[day][p.staff_id].push(p)
  }
  const sortedDays = Object.keys(dayMap).sort((a, b) => b.localeCompare(a))

  // Staff on-site now: last punch per staff is clock_in
  const lastPunchPerStaff: Record<string, ElecTimePunch> = {}
  for (const p of [...punches].reverse()) {
    if (!lastPunchPerStaff[p.staff_id]) lastPunchPerStaff[p.staff_id] = p
  }
  const onSiteStaff = Object.values(lastPunchPerStaff).filter(p => p.punch_type === 'clock_in')

  async function handleInvite() {
    if (!email.trim()) return
    setInviting(true); setInviteError(''); setInviteDone(false)
    const res = await fetch('/api/supplier-portal/quoting/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setInviting(false)
    if (!res.ok || !data.ok) { setInviteError(data.error ?? 'Failed'); return }
    setInviteDone(true)
    setMembers(prev => [...prev, {
      id: crypto.randomUUID(),
      portal_account_id: '',
      auth_user_id: null,
      email: email.trim(),
      name: name.trim() || null,
      role: 'admin',
      invited_by: null,
      invite_token: null,
      invited_at: new Date().toISOString(),
      accepted_at: null,
      created_at: new Date().toISOString(),
    }])
    setEmail(''); setName('')
    setTimeout(() => { setInviteDone(false); setShowInvite(false) }, 2000)
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'timesheet', label: 'Timesheet', icon: <Clock size={14} /> },
    { key: 'admins',    label: 'Admin Users', icon: <Users size={14} /> },
  ]

  return (
    <div>
      {/* On-site status */}
      {onSiteStaff.length > 0 && (
        <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap"
          style={{ background: 'rgba(22,163,74,0.06)', border: `1px solid rgba(22,163,74,0.2)` }}>
          <div className="w-2 h-2 rounded-full" style={{ background: S.green }} />
          <span className="text-xs font-semibold" style={{ color: S.green }}>
            {onSiteStaff.length} staff currently on-site
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {onSiteStaff.map(p => {
              const s = staffMap[p.staff_id]
              return s ? (
                <span key={p.staff_id} className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ background: s.color ?? S.accent }}>
                  {s.name} · {fmtTime(p.punched_at)}
                </span>
              ) : null
            })}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 rounded-xl p-1" style={{ background: S.bg, border: `1px solid ${S.border}`, display: 'inline-flex' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: tab === t.key ? S.card : 'transparent', color: tab === t.key ? S.text : S.muted, boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Timesheet */}
      {tab === 'timesheet' && (
        <div className="space-y-4">
          {sortedDays.length === 0 && (
            <div className="rounded-2xl py-12 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <p className="text-sm" style={{ color: S.muted }}>No clock-in activity in the last 30 days.</p>
              <p className="text-xs mt-1" style={{ color: S.muted }}>Staff members need to log in on their phones to clock in/out.</p>
            </div>
          )}
          {sortedDays.map(day => (
            <div key={day} className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="px-4 py-2.5" style={{ background: S.bg, borderBottom: `1px solid ${S.border}` }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>{fmtDate(day + 'T12:00:00')}</p>
              </div>
              {Object.entries(dayMap[day]).map(([staffId, staffPunches]) => {
                const member = staffMap[staffId]
                const ins = staffPunches.filter(p => p.punch_type === 'clock_in').sort((a, b) => a.punched_at.localeCompare(b.punched_at))
                const outs = staffPunches.filter(p => p.punch_type === 'clock_out').sort((a, b) => a.punched_at.localeCompare(b.punched_at))
                const firstIn = ins[0]
                const lastOut = outs[outs.length - 1]
                const duration = firstIn && lastOut
                  ? fmtDuration(new Date(lastOut.punched_at).getTime() - new Date(firstIn.punched_at).getTime())
                  : null
                return (
                  <div key={staffId} className="px-4 py-3" style={{ borderBottom: `1px solid ${S.border}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: member?.color ?? S.accent }}>
                          {member?.name?.slice(0, 2).toUpperCase() ?? '??'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: S.text }}>{member?.name ?? 'Unknown'}</p>
                          {duration && <p className="text-xs" style={{ color: S.muted }}>{duration} total</p>}
                        </div>
                      </div>
                      {!lastOut && firstIn && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>On site</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {staffPunches.sort((a, b) => a.punched_at.localeCompare(b.punched_at)).map(p => (
                        <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                          style={{ background: p.punch_type === 'clock_in' ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${p.punch_type === 'clock_in' ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}` }}>
                          {p.punch_type === 'clock_in'
                            ? <LogIn size={10} style={{ color: S.green }} />
                            : <LogOut size={10} style={{ color: S.danger }} />}
                          <span className="text-xs font-semibold" style={{ color: p.punch_type === 'clock_in' ? S.green : S.danger }}>
                            {fmtTime(p.punched_at)}
                          </span>
                          {p.latitude && <MapPin size={9} style={{ color: S.muted }} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Admin users */}
      {tab === 'admins' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: S.muted }}>Admin Users</h2>
            <button onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ color: S.accent, background: 'rgba(58,124,165,0.08)' }}>
              <Plus size={12} /> Invite Admin
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {/* Account owner — always shown first */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ background: S.accent }}>
                {ownerEmail.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs" style={{ color: S.muted }}>{ownerEmail}</p>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>Active</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(58,124,165,0.1)', color: S.accent }}>Owner</span>
            </div>

            {/* Invited admins */}
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderTop: `1px solid ${S.border}` }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: m.accepted_at ? S.accent : S.muted }}>
                  {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  {m.name && <p className="text-sm font-semibold" style={{ color: S.text }}>{m.name}</p>}
                  <p className="text-xs" style={{ color: S.muted }}>{m.email}</p>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: m.accepted_at ? 'rgba(22,163,74,0.1)' : 'rgba(217,164,65,0.1)', color: m.accepted_at ? S.green : S.gold }}>
                  {m.accepted_at ? 'Active' : 'Pending'}
                </span>
              </div>
            ))}

            {members.length === 0 && (
              <div className="px-4 py-3.5 border-t" style={{ borderColor: S.border }}>
                <p className="text-xs text-center" style={{ color: S.muted }}>No additional admins invited yet</p>
              </div>
            )}
          </div>

          {/* Invite modal */}
          {showInvite && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
              onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}>
              <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
                  <h2 className="font-bold text-sm" style={{ color: S.text }}>Invite Admin</h2>
                  <button onClick={() => setShowInvite(false)} style={{ color: S.muted }}><X size={15} /></button>
                </div>
                {inviteDone ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <CheckCircle2 size={36} style={{ color: S.green }} />
                    <p className="text-sm font-semibold" style={{ color: S.text }}>Invite sent!</p>
                  </div>
                ) : (
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Email *</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com"
                        className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                        style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Name (optional)</label>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                        className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                        style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                    </div>
                    {inviteError && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEF2F2', color: S.danger }}>
                        <AlertCircle size={12} />{inviteError}
                      </div>
                    )}
                    <button onClick={() => void handleInvite()} disabled={inviting || !email.trim()}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: S.accent }}>
                      {inviting ? <><Loader2 size={14} className="animate-spin inline mr-2" />Sending…</> : 'Send Invite'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
