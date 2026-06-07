'use client'
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Check, Loader2, UserCircle2, Phone, Power, Clock, MapPin, LogIn, LogOut, Copy, CheckCircle2, KeyRound, Briefcase, Printer } from 'lucide-react'
import type { ElecStaff, ElecStaffRole, ElecTimePunch } from '@/lib/elec-types'
import { reverseGeocode } from '@/lib/reverse-geocode'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

const ROLES: { value: ElecStaffRole; label: string }[] = [
  { value: 'electrician',   label: 'Electrician' },
  { value: 'apprentice',    label: 'Apprentice' },
  { value: 'site_foreman',  label: 'Site Foreman' },
  { value: 'helper',        label: 'Helper' },
  { value: 'admin',         label: 'Admin' },
]

const COLORS = [
  '#3A7CA5', '#16A34A', '#D9A441', '#DC2626',
  '#7C3AED', '#0891B2', '#EA580C', '#64748B',
]

function roleBg(role: ElecStaffRole) {
  const map: Record<ElecStaffRole, string> = {
    electrician:  'rgba(58,124,165,0.12)',
    apprentice:   'rgba(217,164,65,0.12)',
    site_foreman: 'rgba(22,163,74,0.12)',
    helper:       'rgba(100,116,139,0.12)',
    admin:        'rgba(124,58,237,0.12)',
  }
  return map[role] ?? S.bg
}
function roleColor(role: ElecStaffRole) {
  const map: Record<ElecStaffRole, string> = {
    electrician:  '#3A7CA5',
    apprentice:   '#D9A441',
    site_foreman: '#16A34A',
    helper:       '#64748B',
    admin:        '#7C3AED',
  }
  return map[role] ?? S.muted
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

interface FormState {
  name: string
  role: ElecStaffRole
  phone: string
  color: string
  username: string
  pin: string
}

const EMPTY_FORM: FormState = { name: '', role: 'electrician', phone: '', color: '#3A7CA5', username: '', pin: '' }

function printWeek(
  weekStart: string,
  staffWeekPunches: Record<string, ElecTimePunch[]>,
  staffMap: Record<string, ElecStaff>,
) {
  const wkStartDate = new Date(weekStart + 'T12:00:00')
  const wkEndDate   = new Date(weekStart + 'T12:00:00'); wkEndDate.setDate(wkEndDate.getDate() + 6)
  const periodStr   = `${wkStartDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} – ${wkEndDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const staffRows: string[] = []

  for (const [staffId, staffPunches] of Object.entries(staffWeekPunches)) {
    const member = staffMap[staffId]
    if (!member) continue

    const sorted = [...staffPunches].sort((a, b) => a.punched_at.localeCompare(b.punched_at))
    const ins  = sorted.filter(p => p.punch_type === 'clock_in')
    const outs = sorted.filter(p => p.punch_type === 'clock_out')

    let totalMs = 0
    const sessions = ins.map((inP, idx) => {
      const outP = outs[idx] ?? null
      const durMs = outP
        ? new Date(outP.punched_at).getTime() - new Date(inP.punched_at).getTime()
        : Date.now() - new Date(inP.punched_at).getTime()
      totalMs += outP ? durMs : 0
      return { in: inP, out: outP, durMs: outP ? durMs : null }
    })

    const initials = member.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    const totalH = Math.floor(totalMs / 3600000)
    const totalM = Math.floor((totalMs % 3600000) / 60000)
    const totalStr = totalMs > 0 ? `${totalH}h ${totalM}m` : '—'

    const rows = sessions.map(ses => {
      const inDate  = new Date(ses.in.punched_at)
      const outDate = ses.out ? new Date(ses.out.punched_at) : null
      const durStr  = ses.durMs != null ? (() => { const h = Math.floor(ses.durMs / 3600000); const m = Math.floor((ses.durMs % 3600000) / 60000); return `${h}h ${m}m` })() : '<span class="open">On site</span>'
      const job     = ses.in.job && !Array.isArray(ses.in.job) ? ses.in.job : null
      const inGps   = ses.in.latitude  ? `${ses.in.latitude.toFixed(5)}, ${ses.in.longitude?.toFixed(5)}`   : '—'
      const outGps  = ses.out?.latitude ? `${ses.out.latitude.toFixed(5)}, ${ses.out.longitude?.toFixed(5)}` : '—'
      return `<tr>
        <td>${inDate.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
        <td>${inDate.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${outDate ? outDate.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '<span class="open">On site</span>'}</td>
        <td><b>${durStr}</b></td>
        <td>${job ? `<b>${job.job_number}</b> · ${job.title}` : '—'}</td>
        <td class="gps">${inGps}</td>
        <td class="gps">${outGps}</td>
      </tr>`
    }).join('')

    staffRows.push(`<div class="staff-section">
      <div class="staff-header">
        <div class="avatar" style="background:${member.color}">${initials}</div>
        <div>
          <div class="staff-name">${member.name}</div>
          <div class="staff-meta">${member.role} &nbsp;·&nbsp; <b>${totalStr}</b> this week &nbsp;·&nbsp; ${sessions.length} session${sessions.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Duration</th><th>Job</th><th>GPS In</th><th>GPS Out</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`)
  }

  const html = `<!DOCTYPE html><html><head>
  <title>Timesheet ${periodStr}</title><meta charset="utf-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#18181b;padding:32px;background:#fff}
    .print-btn{position:fixed;top:20px;right:20px;background:#3a7ca5;color:#fff;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600}
    @media print{.print-btn{display:none}}
    .doc-header{margin-bottom:24px;padding-bottom:14px;border-bottom:2px solid #1e2a38;display:flex;justify-content:space-between;align-items:flex-end}
    .doc-title{font-size:18px;font-weight:700;color:#1e2a38}
    .doc-period{font-size:12px;color:#71717a;margin-top:3px}
    .staff-section{margin-bottom:28px;page-break-inside:avoid}
    .staff-header{display:flex;align-items:center;gap:10px;margin-bottom:10px}
    .avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:11px;flex-shrink:0}
    .staff-name{font-size:14px;font-weight:700;color:#18181b}
    .staff-meta{font-size:11px;color:#71717a;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#f0f2f5;padding:6px 8px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#71717a;border:1px solid #e4e4e7}
    td{padding:6px 8px;border:1px solid #e4e4e7;vertical-align:top}
    tr:nth-child(even) td{background:#fafafa}
    .open{color:#16a34a;font-weight:600}
    .gps{font-family:monospace;font-size:10px;color:#71717a}
  </style>
  </head><body>
  <button class="print-btn" onclick="window.print()">🖨 Print</button>
  <div class="doc-header">
    <div><div class="doc-title">Weekly Timesheet</div><div class="doc-period">${periodStr}</div></div>
  </div>
  ${staffRows.length > 0 ? staffRows.join('') : '<p style="color:#71717a;text-align:center;padding:40px">No data for this week</p>'}
  </body></html>`

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

type Tab = 'staff' | 'timesheet'

interface Props {
  initialStaff: ElecStaff[]
  punches: ElecTimePunch[]
}

export function StaffManager({ initialStaff, punches }: Props) {
  const [tab, setTab] = useState<Tab>('staff')
  const [staff, setStaff] = useState(initialStaff)
  const [geoAddresses, setGeoAddresses] = useState<Record<string, string>>({})

  useEffect(() => {
    const coords = [...new Set(
      punches.filter(p => p.latitude && p.longitude).map(p => `${p.latitude},${p.longitude}`)
    )]
    if (!coords.length) return
    void (async () => {
      const results: Record<string, string> = {}
      for (const c of coords) {
        const [lat, lng] = c.split(',').map(Number)
        const addr = await reverseGeocode(lat, lng)
        if (addr) results[c] = addr
      }
      setGeoAddresses(prev => ({ ...prev, ...results }))
    })()
  }, [punches]) // eslint-disable-line
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [newCredentials, setNewCredentials] = useState<{ username: string; pin: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Timesheet helpers
  const [timesheetView, setTimesheetView] = useState<'daily' | 'weekly'>('daily')
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s]))
  const dayMap: Record<string, Record<string, ElecTimePunch[]>> = {}
  for (const p of punches) {
    const day = p.punched_at.slice(0, 10)
    if (!dayMap[day]) dayMap[day] = {}
    if (!dayMap[day][p.staff_id]) dayMap[day][p.staff_id] = []
    dayMap[day][p.staff_id].push(p)
  }
  const sortedDays = Object.keys(dayMap).sort((a, b) => b.localeCompare(a))

  // Weekly grouping: Thu–Wed
  function getWeekStart(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00')
    const day = d.getDay() // 0=Sun,1=Mon,...,4=Thu,5=Fri,6=Sat
    const daysToThursday = (day - 4 + 7) % 7 // days since last Thursday
    d.setDate(d.getDate() - daysToThursday)
    return d.toISOString().slice(0, 10)
  }
  const weekMap: Record<string, { staffHours: Record<string, number> }> = {}
  for (const p of punches) {
    const wk = getWeekStart(p.punched_at.slice(0, 10))
    if (!weekMap[wk]) weekMap[wk] = { staffHours: {} }
  }
  // Pair ins/outs per staff per week
  const staffWeekPunches: Record<string, Record<string, ElecTimePunch[]>> = {}
  for (const p of punches) {
    const wk = getWeekStart(p.punched_at.slice(0, 10))
    if (!staffWeekPunches[wk]) staffWeekPunches[wk] = {}
    if (!staffWeekPunches[wk][p.staff_id]) staffWeekPunches[wk][p.staff_id] = []
    staffWeekPunches[wk][p.staff_id].push(p)
  }
  const sortedWeeks = Object.keys(staffWeekPunches).sort((a, b) => b.localeCompare(a))

  const lastPunchPerStaff: Record<string, ElecTimePunch> = {}
  for (const p of punches) {
    if (!lastPunchPerStaff[p.staff_id]) lastPunchPerStaff[p.staff_id] = p
  }
  const onSiteStaff = Object.values(lastPunchPerStaff).filter(p => p.punch_type === 'clock_in')

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(s: ElecStaff) {
    setEditingId(s.id)
    setForm({ name: s.name, role: s.role, phone: s.phone ?? '', color: s.color, username: s.username ?? '', pin: '' })
    setShowForm(true)
    setNewCredentials(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setNewCredentials(null)
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    if (!editingId && (!form.username.trim() || !form.pin)) { alert('Username and PIN are required'); return }
    if (form.pin && !/^\d{4}$/.test(form.pin)) { alert('PIN must be exactly 4 digits'); return }
    setSaving(true)

    const payload: Record<string, unknown> = {
      name: form.name.trim(), role: form.role, phone: form.phone.trim() || null, color: form.color,
    }
    if (form.username.trim()) payload.username = form.username.trim()
    if (form.pin) payload.pin = form.pin

    if (editingId) {
      const res = await fetch(`/api/supplier-portal/quoting/staff/${editingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) { alert(d.error ?? 'Failed to save'); setSaving(false); return }
      setStaff(ss => ss.map(s => s.id === editingId ? d as ElecStaff : s))
      setSaving(false)
      closeForm()
    } else {
      const res = await fetch('/api/supplier-portal/quoting/staff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) { alert(d.error ?? 'Failed to save'); setSaving(false); return }
      setStaff(ss => [...ss, d as ElecStaff])
      setNewCredentials({ username: form.username.trim(), pin: form.pin })
      setSaving(false)
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this team member?')) return
    setDeletingId(id)
    const res = await fetch(`/api/supplier-portal/quoting/staff/${id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Failed to remove member'); setDeletingId(null); return }
    setStaff(ss => ss.filter(s => s.id !== id))
    setDeletingId(null)
  }

  async function handleToggleActive(s: ElecStaff) {
    setTogglingId(s.id)
    const res = await fetch(`/api/supplier-portal/quoting/staff/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !s.is_active }),
    })
    const updated = await res.json() as ElecStaff
    setStaff(ss => ss.map(m => m.id === s.id ? updated : m))
    setTogglingId(null)
  }

  const active = staff.filter(s => s.is_active)
  const inactive = staff.filter(s => !s.is_active)

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'staff',     label: 'Staff',     icon: <UserCircle2 size={14} /> },
    { key: 'timesheet', label: 'Timesheet', icon: <Clock size={14} /> },
  ]

  return (
    <div className="pb-16">

      {/* On-site banner */}
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

      {/* Tab bar + add button */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: S.bg, border: `1px solid ${S.border}`, display: 'inline-flex' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: tab === t.key ? S.card : 'transparent', color: tab === t.key ? S.text : S.muted, boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        {tab === 'staff' && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: S.accent }}>
            <Plus size={14} /> Add Member
          </button>
        )}
      </div>

      {/* ── Staff tab ── */}
      {tab === 'staff' && (
        <>
          {/* Credentials box shown after creating a new staff member */}
          {newCredentials && (
            <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(22,163,74,0.05)', border: `1.5px solid rgba(22,163,74,0.3)` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} style={{ color: S.green }} />
                  <span className="font-semibold text-sm" style={{ color: S.green }}>Staff member added</span>
                </div>
                <button onClick={() => setNewCredentials(null)} className="p-1.5 rounded-lg" style={{ color: S.muted }}
                  onMouseEnter={e => e.currentTarget.style.background = S.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs mb-3" style={{ color: S.muted }}>Share these login credentials with the staff member. The PIN cannot be retrieved again.</p>
              <div className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[10px] font-semibold uppercase tracking-wider w-16" style={{ color: S.muted }}>Username</span>
                    <span className="font-mono font-bold" style={{ color: S.text }}>{newCredentials.username}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[10px] font-semibold uppercase tracking-wider w-16" style={{ color: S.muted }}>PIN</span>
                    <span className="font-mono font-bold" style={{ color: S.text }}>{newCredentials.pin}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(`Username: ${newCredentials.username}\nPIN: ${newCredentials.pin}`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                  style={{ background: S.card, border: `1px solid ${S.border}`, color: copied ? S.green : S.accent }}>
                  {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] mt-2" style={{ color: S.muted }}>
                Staff log in at <span className="font-mono">quotinghub.co.za/supplier-portal/login</span> → Staff tab
              </p>
            </div>
          )}

          {/* Add / Edit form */}
          {showForm && (
            <div className="rounded-2xl p-5 mb-5" style={{ background: S.card, border: `1.5px solid ${S.accent}` }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm" style={{ color: S.text }}>
                  {editingId ? 'Edit Member' : 'New Team Member'}
                </h2>
                <button onClick={closeForm} className="p-1.5 rounded-lg" style={{ color: S.muted }}
                  onMouseEnter={e => e.currentTarget.style.background = S.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Full Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. John Dlamini"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as ElecStaffRole }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="e.g. 082 555 1234"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>
                    Username *
                  </label>
                  <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                    placeholder="e.g. john123"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none font-mono"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>
                    PIN {editingId ? '(leave blank to keep)' : '*'}
                  </label>
                  <div className="relative">
                    <KeyRound size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={form.pin}
                      onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="4 digits"
                      className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl outline-none font-mono tracking-widest"
                      style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: S.muted }}>Calendar Colour</label>
                  <div className="flex items-center gap-2">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-transform"
                        style={{ background: c, transform: form.color === c ? 'scale(1.25)' : 'scale(1)', boxShadow: form.color === c ? `0 0 0 2px #fff, 0 0 0 3.5px ${c}` : 'none' }}>
                        {form.color === c && <Check size={12} color="#fff" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={closeForm} className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: S.bg, color: S.muted }}>
                  Cancel
                </button>
                <button onClick={() => void handleSave()} disabled={!form.name.trim() || saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: S.accent }}>
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Member'}
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {staff.length === 0 && !showForm && (
            <div className="rounded-2xl py-16 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(58,124,165,0.1)' }}>
                <UserCircle2 size={22} style={{ color: S.accent }} />
              </div>
              <p className="font-semibold mb-1" style={{ color: S.text }}>No team members yet</p>
              <p className="text-sm mb-5" style={{ color: S.muted }}>Add your electricians, apprentices, and other staff.</p>
              <button onClick={openAdd}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white mx-auto"
                style={{ background: S.accent }}>
                <Plus size={13} /> Add First Member
              </button>
            </div>
          )}

          {/* Active staff */}
          {active.length > 0 && (
            <div className="space-y-2 mb-6">
              {active.map(s => (
                <StaffCard key={s.id} staff={s}
                  onEdit={() => openEdit(s)}
                  onDelete={() => void handleDelete(s.id)}
                  onToggle={() => void handleToggleActive(s)}
                  deleting={deletingId === s.id}
                  toggling={togglingId === s.id}
                />
              ))}
            </div>
          )}

          {/* Inactive staff */}
          {inactive.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
                Inactive
              </p>
              <div className="space-y-2">
                {inactive.map(s => (
                  <StaffCard key={s.id} staff={s}
                    onEdit={() => openEdit(s)}
                    onDelete={() => void handleDelete(s.id)}
                    onToggle={() => void handleToggleActive(s)}
                    deleting={deletingId === s.id}
                    toggling={togglingId === s.id}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Timesheet tab ── */}
      {tab === 'timesheet' && (
        <div className="space-y-4">
          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-xl p-1 self-start" style={{ background: S.bg, border: `1px solid ${S.border}`, display: 'inline-flex' }}>
            {(['daily', 'weekly'] as const).map(v => (
              <button key={v} onClick={() => setTimesheetView(v)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize"
                style={{ background: timesheetView === v ? S.card : 'transparent', color: timesheetView === v ? S.text : S.muted, boxShadow: timesheetView === v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {v === 'weekly' ? 'Weekly (Thu–Wed)' : 'Daily'}
              </button>
            ))}
          </div>

          {/* Weekly view */}
          {timesheetView === 'weekly' && (
            sortedWeeks.length === 0 ? (
              <div className="rounded-2xl py-12 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <p className="text-sm" style={{ color: S.muted }}>No data yet.</p>
              </div>
            ) : sortedWeeks.map(wk => {
              const wkEnd = new Date(wk + 'T12:00:00'); wkEnd.setDate(wkEnd.getDate() + 6)
              const weekLabel = `${new Date(wk + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} – ${wkEnd.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`
              return (
                <div key={wk} className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: S.bg, borderBottom: `1px solid ${S.border}` }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Week: {weekLabel}</p>
                    <button
                      onClick={() => printWeek(wk, staffWeekPunches[wk], staffMap)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ border: `1px solid ${S.border}`, color: S.muted, background: S.card }}>
                      <Printer size={11} /> Print
                    </button>
                  </div>
                  {Object.entries(staffWeekPunches[wk]).map(([staffId, staffPunches]) => {
                    const member = staffMap[staffId]
                    const ins = staffPunches.filter(p => p.punch_type === 'clock_in').sort((a, b) => a.punched_at.localeCompare(b.punched_at))
                    const outs = staffPunches.filter(p => p.punch_type === 'clock_out').sort((a, b) => a.punched_at.localeCompare(b.punched_at))
                    let totalMs = 0
                    ins.forEach((inP, idx) => {
                      const outP = outs[idx]
                      if (outP) totalMs += new Date(outP.punched_at).getTime() - new Date(inP.punched_at).getTime()
                    })
                    const hours = Math.floor(totalMs / 3600000)
                    const mins = Math.floor((totalMs % 3600000) / 60000)
                    return (
                      <div key={staffId} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${S.border}` }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: member?.color ?? S.accent }}>
                          {member?.name?.slice(0, 2).toUpperCase() ?? '??'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold" style={{ color: S.text }}>{member?.name ?? 'Unknown'}</p>
                          <p className="text-xs" style={{ color: S.muted }}>{ins.length} session{ins.length !== 1 ? 's' : ''}</p>
                        </div>
                        <p className="text-sm font-bold font-mono" style={{ color: totalMs > 0 ? S.accent : S.muted }}>
                          {totalMs > 0 ? `${hours}h ${mins}m` : '—'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}

          {/* Daily view */}
          {timesheetView === 'daily' && sortedDays.length === 0 && (
            <div className="rounded-2xl py-12 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <p className="text-sm" style={{ color: S.muted }}>No clock-in activity in the last 30 days.</p>
              <p className="text-xs mt-1" style={{ color: S.muted }}>Staff members need to log in on their phones to clock in/out.</p>
            </div>
          )}
          {timesheetView === 'daily' && sortedDays.map(day => (
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
                      {staffPunches.sort((a, b) => a.punched_at.localeCompare(b.punched_at)).map(p => {
                        const job = !Array.isArray(p.job) ? p.job : null
                        return (
                        <div key={p.id} className="flex flex-col gap-1 px-2.5 py-1.5 rounded-lg"
                          style={{ background: p.punch_type === 'clock_in' ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${p.punch_type === 'clock_in' ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}` }}>
                          <div className="flex items-center gap-1.5">
                            {p.punch_type === 'clock_in'
                              ? <LogIn size={10} style={{ color: S.green }} />
                              : <LogOut size={10} style={{ color: S.danger }} />}
                            <span className="text-xs font-semibold" style={{ color: p.punch_type === 'clock_in' ? S.green : S.danger }}>
                              {fmtTime(p.punched_at)}
                            </span>
                            {p.latitude && p.longitude && (
                              <a
                                href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                                target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-0.5"
                                style={{ color: S.accent, textDecoration: 'none' }}
                                title={`${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}>
                                <MapPin size={9} />
                                <span className="text-[9px] font-medium">
                                  {geoAddresses[`${p.latitude},${p.longitude}`] ?? 'GPS'}
                                </span>
                              </a>
                            )}
                          </div>
                          {job && (
                            <div className="flex items-center gap-1" style={{ color: S.muted }}>
                              <Briefcase size={9} />
                              <span className="text-[9px] font-medium font-mono">{job.job_number}</span>
                              <span className="text-[9px] truncate max-w-[120px]">{job.title}</span>
                            </div>
                          )}
                        </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StaffCard({ staff: s, onEdit, onDelete, onToggle, deleting, toggling }: {
  staff: ElecStaff
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  deleting: boolean
  toggling: boolean
}) {
  const roleLabel = ROLES.find(r => r.value === s.role)?.label ?? s.role
  const inactive = !s.is_active
  const hasCredentials = !!s.username && !!s.auth_user_id

  return (
    <div className="rounded-2xl p-4 flex items-center gap-4"
      style={{ background: S.card, border: `1px solid ${S.border}`, opacity: inactive ? 0.55 : 1 }}>

      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
        style={{ background: s.color }}>
        {s.name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm" style={{ color: S.text }}>{s.name}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: roleBg(s.role), color: roleColor(s.role) }}>
            {roleLabel}
          </span>
          {hasCredentials && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>
              ✓ Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {s.username && (
            <span className="flex items-center gap-1 text-xs font-mono" style={{ color: S.muted }}>
              <KeyRound size={10} /> {s.username}
            </span>
          )}
          {s.phone && (
            <span className="flex items-center gap-1 text-xs" style={{ color: S.muted }}>
              <Phone size={10} /> {s.phone}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onToggle} disabled={toggling} title={s.is_active ? 'Deactivate' : 'Activate'}
          className="p-2 rounded-lg disabled:opacity-50 transition-colors"
          style={{ color: s.is_active ? S.muted : S.green }}
          onMouseEnter={e => e.currentTarget.style.background = S.bg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {toggling ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
        </button>
        <button onClick={onEdit}
          className="p-2 rounded-lg transition-colors" style={{ color: S.muted }}
          onMouseEnter={e => e.currentTarget.style.background = S.bg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} disabled={deleting}
          className="p-2 rounded-lg disabled:opacity-50 transition-colors" style={{ color: S.muted }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = S.danger }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  )
}
