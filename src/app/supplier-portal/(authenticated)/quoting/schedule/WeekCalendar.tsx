'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Trash2, Check, Calendar, Printer, Share2, Copy, CheckCheck, Image, Camera, MapPin, RefreshCw } from 'lucide-react'
import type { ElecJob, ElecJobStatus, ElecJobPhoto, ElecStaff } from '@/lib/elec-types'
import type { StaffLiveStatus } from '@/app/api/supplier-portal/quoting/staff-live/route'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

// ── Calendar constants ────────────────────────────────────────────────────────
const HOUR_HEIGHT  = 64
const START_HOUR   = 7
const END_HOUR     = 20
const HOURS        = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
const MONTHS       = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_SHORT    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── Date helpers — use LOCAL date components to avoid timezone bugs ────────────
function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toMins(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function fmtTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2,'0')}${ampm}`
}

function jobTop(start: string): number {
  return ((toMins(start) - START_HOUR * 60) / 60) * HOUR_HEIGHT
}

function jobHeight(start: string, end: string): number {
  return Math.max(((toMins(end) - toMins(start)) / 60) * HOUR_HEIGHT, 28)
}

function fmtElapsed(fromIso: string, to: Date): string {
  const ms = to.getTime() - new Date(fromIso).getTime()
  if (ms <= 0) return '0m'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function getLocalMins(isoTimestamp: string): number {
  const d = new Date(isoTimestamp)
  return d.getHours() * 60 + d.getMinutes()
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function fmtRefreshed(d: Date): string {
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

// Compute non-overlapping column layout for jobs in one day
interface ColumnJob { job: ElecJob; col: number; totalCols: number }
function layoutJobs(dayJobs: ElecJob[]): ColumnJob[] {
  if (dayJobs.length === 0) return []
  const sorted = [...dayJobs].sort((a, b) => toMins(a.start_time) - toMins(b.start_time))
  const columns: Array<{ end: number }[]> = []
  const placed: ColumnJob[] = []

  for (const job of sorted) {
    const startM = toMins(job.start_time.slice(0, 5))
    const endM   = toMins(job.end_time.slice(0, 5))
    let col = columns.findIndex(c => c.every(slot => slot.end <= startM))
    if (col === -1) { col = columns.length; columns.push([]) }
    columns[col].push({ end: endM })
    placed.push({ job, col, totalCols: 0 })
  }

  // totalCols = max col+1 of any overlapping group
  for (const p of placed) {
    const start = toMins(p.job.start_time.slice(0, 5))
    const end   = toMins(p.job.end_time.slice(0, 5))
    let maxCol = p.col
    for (const q of placed) {
      const qs = toMins(q.job.start_time.slice(0, 5))
      const qe = toMins(q.job.end_time.slice(0, 5))
      if (qs < end && qe > start) maxCol = Math.max(maxCol, q.col)
    }
    p.totalCols = maxCol + 1
  }

  return placed
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuoteOption {
  id: string
  quote_number: string
  project_name: string
  project_address: string | null
  staff_id: string | null
  additional_staff_ids: string[] | null
}

interface JobCardOption {
  id: string
  job_number: string
  title: string
  location: string | null
  staff_id: string | null
}

type ScheduleSource = 'manual' | 'job_card' | 'project'

interface FormState {
  source: ScheduleSource
  title: string
  scheduled_date: string
  start_time: string
  end_time: string
  staff_id: string
  quote_id: string
  job_card_id: string
  address: string
  notes: string
  status: ElecJobStatus
}

const EMPTY_FORM: FormState = {
  source: 'manual',
  title: '', scheduled_date: '', start_time: '08:00', end_time: '09:00',
  staff_id: '', quote_id: '', job_card_id: '', address: '', notes: '', status: 'scheduled',
}

const JOB_STATUSES: { value: ElecJobStatus; label: string }[] = [
  { value: 'scheduled',   label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
]

// ── Main component ────────────────────────────────────────────────────────────
export function WeekCalendar({
  initialJobs,
  staff,
  quotes,
  jobCards = [],
  companyName,
  initialLiveStatuses = [],
}: {
  initialJobs: ElecJob[]
  staff: ElecStaff[]
  quotes: QuoteOption[]
  jobCards?: JobCardOption[]
  companyName: string
  initialLiveStatuses?: StaffLiveStatus[]
}) {
  const [currentDay, setCurrentDay] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [jobs, setJobs]             = useState<ElecJob[]>(initialJobs)
  const [loading, setLoading]       = useState(false)
  const [modal, setModal]           = useState<{ mode: 'add' | 'edit'; job?: ElecJob } | null>(null)
  const [form, setForm]             = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [photos, setPhotos]         = useState<ElecJobPhoto[]>([])
  const [shareLink, setShareLink]   = useState<string | null>(null)
  const [copied, setCopied]         = useState<'idle' | 'copying' | 'done'>('idle')
  const [lightbox, setLightbox]     = useState<string | null>(null)
  const scrollRef                   = useRef<HTMLDivElement>(null)

  const [liveStatuses, setLiveStatuses]       = useState<StaffLiveStatus[]>(initialLiveStatuses)
  const [liveRefreshing, setLiveRefreshing]   = useState(false)
  const [lastRefreshed, setLastRefreshed]     = useState<Date | null>(null)
  const [now, setNow]                         = useState(new Date())

  const dateStr  = toDateStr(currentDay)
  const todayStr = toDateStr(new Date())
  const isToday  = dateStr === todayStr

  // Tick every minute
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  async function fetchLiveStatus() {
    setLiveRefreshing(true)
    try {
      const res = await fetch('/api/supplier-portal/quoting/staff-live')
      if (res.ok) {
        setLiveStatuses(await res.json() as StaffLiveStatus[])
        setLastRefreshed(new Date())
      }
    } catch {}
    setLiveRefreshing(false)
  }

  useEffect(() => {
    if (!isToday) return
    setLastRefreshed(new Date())
    const t = setInterval(() => { void fetchLiveStatus() }, 60000)
    return () => clearInterval(t)
  }, [isToday]) // eslint-disable-line

  const fetchJobs = useCallback(async (dateStr: string) => {
    setLoading(true)
    // Fetch a range of ±3 days to allow smooth navigation
    const d = new Date(dateStr + 'T12:00:00')
    const start = new Date(d); start.setDate(start.getDate() - 3)
    const end   = new Date(d); end.setDate(end.getDate() + 3)
    const res = await fetch(`/api/supplier-portal/quoting/jobs?start=${toDateStr(start)}&end=${toDateStr(end)}`)
    const data = await res.json() as ElecJob[]
    setJobs(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchJobs(dateStr)
  }, [dateStr]) // eslint-disable-line

  function prevDay() {
    setCurrentDay(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
  }
  function nextDay() {
    setCurrentDay(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
  }
  function goToday() {
    const d = new Date(); d.setHours(0, 0, 0, 0); setCurrentDay(d)
  }

  // Open add modal from clicking on time slot
  function openAdd(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-job]')) return
    const rect  = e.currentTarget.getBoundingClientRect()
    const y     = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0)
    const raw   = START_HOUR * 60 + Math.floor((y / HOUR_HEIGHT) * 60)
    const start = Math.round(raw / 30) * 30
    const clamped = Math.max(START_HOUR * 60, Math.min(start, (END_HOUR - 1) * 60))
    const end   = Math.min(clamped + 60, END_HOUR * 60)
    setForm({ ...EMPTY_FORM, scheduled_date: dateStr, start_time: minsToTime(clamped), end_time: minsToTime(end) })
    setModal({ mode: 'add' })
  }

  function openEdit(job: ElecJob) {
    setForm({
      source: 'manual',
      title:          job.title,
      scheduled_date: job.scheduled_date,
      start_time:     job.start_time.slice(0, 5),
      end_time:       job.end_time.slice(0, 5),
      staff_id:       job.staff_id ?? '',
      quote_id:       job.quote_id ?? '',
      job_card_id:    '',
      address:        job.address ?? '',
      notes:          job.notes ?? '',
      status:         job.status,
    })
    setModal({ mode: 'edit', job })
    setPhotos([])
    setShareLink(null)
    void fetch(`/api/supplier-portal/quoting/jobs/${job.id}/photos`)
      .then(r => r.json()).then((data: ElecJobPhoto[]) => {
        const list = Array.isArray(data) ? data : []
        setPhotos(list)
        setJobs(js => js.map(j => j.id === job.id ? { ...j, photo_count: list.length } : j))
      })
  }

  function closeModal() {
    setModal(null)
    setForm(EMPTY_FORM)
    setPhotos([])
    setShareLink(null)
    setCopied('idle')
  }

  // When a job card is selected, auto-fill title, address, staff
  function handleJobCardChange(jcId: string) {
    const jc = jobCards.find(j => j.id === jcId)
    setForm(f => ({
      ...f,
      job_card_id: jcId,
      title: f.title || (jc?.title ?? ''),
      address: f.address || (jc?.location ?? ''),
      staff_id: jc?.staff_id ?? f.staff_id,
    }))
  }

  // When a project (quote) is selected, auto-fill title, address, staff
  function handleQuoteChange(quoteId: string) {
    const q = quotes.find(q => q.id === quoteId)
    setForm(f => ({
      ...f,
      quote_id: quoteId,
      title: f.title || (q?.project_name ?? ''),
      address: f.address || (q?.project_address ?? ''),
      staff_id: q?.staff_id ?? f.staff_id,
    }))
  }

  async function handleCopyLink(jobId: string) {
    setCopied('copying')
    const res = await fetch(`/api/supplier-portal/quoting/jobs/${jobId}/share`, { method: 'POST' })
    const { token } = await res.json() as { token: string }
    const url = `${window.location.origin}/job/${token}`
    setShareLink(url)
    void navigator.clipboard.writeText(url)
    setCopied('done')
    setTimeout(() => setCopied('idle'), 2500)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.scheduled_date || saving) return
    setSaving(true)
    const payload = {
      title:          form.title.trim(),
      scheduled_date: form.scheduled_date,
      start_time:     form.start_time,
      end_time:       form.end_time,
      staff_id:       form.staff_id || null,
      quote_id:       form.quote_id || null,
      address:        form.address.trim() || null,
      notes:          form.notes.trim() || null,
      status:         form.status,
    }
    if (modal?.mode === 'edit' && modal.job) {
      const res = await fetch(`/api/supplier-portal/quoting/jobs/${modal.job.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const updated = await res.json() as ElecJob
      setJobs(js => js.map(j => j.id === modal.job!.id ? updated : j))
    } else {
      const res = await fetch('/api/supplier-portal/quoting/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const created = await res.json() as ElecJob
      setJobs(js => [...js, created])
    }
    setSaving(false)
    closeModal()
  }

  async function handleDelete() {
    if (!modal?.job || deleting) return
    setDeleting(true)
    await fetch(`/api/supplier-portal/quoting/jobs/${modal.job.id}`, { method: 'DELETE' })
    setJobs(js => js.filter(j => j.id !== modal.job!.id))
    setDeleting(false)
    closeModal()
  }

  // ── Print ─────────────────────────────────────────────────────────────────
  function handlePrint() {
    const dayJobs = jobs
      .filter(j => j.scheduled_date === dateStr && j.status !== 'cancelled')
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

    const jobRows = dayJobs.length === 0
      ? `<tr><td colspan="4" style="padding:12px;color:#94A3B8;font-style:italic;font-size:13px;">No jobs scheduled</td></tr>`
      : dayJobs.map(job => {
          const staffMember = job.staff ?? staff.find(s => s.id === job.staff_id)
          const color = staffMember?.color ?? '#3A7CA5'
          return `<tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 12px;white-space:nowrap;font-size:13px;color:#475569;font-weight:600;">${fmtTime(job.start_time)} – ${fmtTime(job.end_time)}</td>
            <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#18181B;">${job.title}${job.address ? `<div style="font-weight:400;color:#64748B;font-size:12px;margin-top:2px;">${job.address}</div>` : ''}</td>
            <td style="padding:10px 12px;font-size:13px;white-space:nowrap;">${staffMember ? `<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>${staffMember.name}</span>` : '<span style="color:#94A3B8;">Unassigned</span>'}</td>
            <td style="padding:10px 12px;font-size:12px;color:#94A3B8;">${job.status === 'completed' ? '✓ Done' : job.status === 'in_progress' ? '⚡ In Progress' : ''}</td>
          </tr>`
        }).join('')

    const dayLabel = `${DAY_NAMES[currentDay.getDay()]}, ${currentDay.getDate()} ${MONTHS[currentDay.getMonth()]} ${currentDay.getFullYear()}`

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Schedule — ${companyName}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Arial,sans-serif;background:#fff;color:#18181B;padding:32px}@media print{body{padding:16px}@page{margin:16mm;size:A4 portrait}}</style></head>
    <body><div style="display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1E2A38;">
      <div><h1 style="font-size:20px;font-weight:800;color:#1E2A38;">${companyName}</h1><p style="font-size:14px;color:#64748B;margin-top:4px;">${dayLabel}</p></div>
      <p style="font-size:11px;color:#94A3B8;align-self:flex-end;">Printed ${new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'})}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:6px;overflow:hidden;">
      <colgroup><col style="width:130px"><col style="width:auto"><col style="width:140px"><col style="width:90px"></colgroup>
      ${jobRows}
    </table>
    <p style="margin-top:28px;font-size:10px;color:#CBD5E1;text-align:center;">Generated by QuotingHub · quotinghub.co.za</p>
    </body></html>`

    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 400)
  }

  // ── Day jobs ──────────────────────────────────────────────────────────────
  const dayJobs = jobs.filter(j => j.scheduled_date === dateStr)
  const layout  = layoutJobs(dayJobs)
  const dayLabel = `${DAY_SHORT[currentDay.getDay()]}, ${currentDay.getDate()} ${MONTHS[currentDay.getMonth()]} ${currentDay.getFullYear()}`

  // On-site staff for Live Now
  const onSite = liveStatuses.filter(ls => ls.isClockedIn)

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={prevDay}
            className="p-2 rounded-lg transition-colors" style={{ color: S.muted }}
            onMouseEnter={e => e.currentTarget.style.background = S.border}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextDay}
            className="p-2 rounded-lg transition-colors" style={{ color: S.muted }}
            onMouseEnter={e => e.currentTarget.style.background = S.border}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronRight size={16} />
          </button>
        </div>

        <span className="font-semibold text-sm" style={{ color: isToday ? S.accent : S.text }}>
          {dayLabel}
          {isToday && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: S.accent, color: '#fff' }}>Today</span>}
        </span>

        {loading && <Loader2 size={14} className="animate-spin" style={{ color: S.muted }} />}

        {!isToday && (
          <button onClick={goToday}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: S.bg, color: S.muted, border: `1px solid ${S.border}` }}
            onMouseEnter={e => e.currentTarget.style.background = S.border}
            onMouseLeave={e => e.currentTarget.style.background = S.bg}>
            Today
          </button>
        )}

        <button onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: S.bg, color: S.muted, border: `1px solid ${S.border}` }}
          onMouseEnter={e => e.currentTarget.style.background = S.border}
          onMouseLeave={e => e.currentTarget.style.background = S.bg}>
          <Printer size={13} /> Print
        </button>

        <div className="flex-1" />

        {/* Active staff legend */}
        <div className="hidden sm:flex items-center gap-3 flex-wrap">
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-xs" style={{ color: S.muted }}>{s.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => { setForm({ ...EMPTY_FORM, scheduled_date: dateStr }); setModal({ mode: 'add' }) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: S.accent }}>
          <Plus size={14} /> Add Job
        </button>
      </div>

      {/* ── Live Now bar (on-site only) ───────────────────────────────── */}
      {isToday && onSite.length > 0 && (
        <div className="rounded-2xl mb-4 overflow-hidden" style={{ border: `1px solid ${S.border}`, background: S.card }}>
          <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: `1px solid ${S.border}`, background: '#F8FAFB' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: S.green }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: S.green }}>Live Now</span>
            </span>
            <span className="text-[10px]" style={{ color: S.muted }}>{onSite.length} on site</span>
            <div className="flex-1" />
            {lastRefreshed && (
              <span className="text-[10px]" style={{ color: S.muted }}>Updated {fmtRefreshed(lastRefreshed)}</span>
            )}
            <button
              onClick={() => void fetchLiveStatus()}
              disabled={liveRefreshing}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium disabled:opacity-50"
              style={{ color: S.muted, border: `1px solid ${S.border}` }}>
              <RefreshCw size={10} className={liveRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <div className="divide-y">
            {onSite.map(ls => {
              const s = staff.find(m => m.id === ls.staffId)
              if (!s) return null
              const activity = ls.currentJobCardTitle ?? ls.currentProjectName
              return (
                <div key={ls.staffId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: s.color ?? S.accent }}>
                    {initials(s.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: S.text }}>{s.name}</span>
                      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(22,163,74,0.08)', color: S.green }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: S.green }} />
                        On site · {ls.clockedInAt ? fmtElapsed(ls.clockedInAt, now) : '—'}
                      </span>
                    </div>
                    {activity && <p className="text-xs mt-0.5 truncate" style={{ color: S.muted }}>{activity}</p>}
                  </div>
                  {ls.latitude && ls.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${ls.latitude},${ls.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                      style={{ background: 'rgba(58,124,165,0.06)', color: S.accent, border: `1px solid rgba(58,124,165,0.2)` }}>
                      <MapPin size={11} /> Map
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Calendar grid (single day) ────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden flex flex-col flex-1" style={{ background: S.card, border: `1px solid ${S.border}` }}>

        {/* Day header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${S.border}`, background: isToday ? 'rgba(58,124,165,0.04)' : 'transparent' }}>
          <p className="text-sm font-bold" style={{ color: isToday ? S.accent : S.text }}>
            {DAY_NAMES[currentDay.getDay()]}
            {isToday && <span className="ml-2 text-xs font-medium" style={{ color: S.accent }}>(Today)</span>}
          </p>
          <p className="text-sm font-medium" style={{ color: S.muted }}>
            {dayJobs.length === 0 ? 'No jobs' : `${dayJobs.length} job${dayJobs.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <div className="flex" style={{ height: HOURS.length * HOUR_HEIGHT }}>

            {/* Time labels */}
            <div style={{ width: 52, flexShrink: 0 }}>
              {HOURS.map(h => (
                <div key={h} style={{ height: HOUR_HEIGHT, position: 'relative' }}>
                  <span className="absolute top-1 right-2 text-[10px] font-medium" style={{ color: S.muted }}>
                    {h === 12 ? '12pm' : h > 12 ? `${h-12}pm` : `${h}am`}
                  </span>
                </div>
              ))}
            </div>

            {/* Single day column */}
            <div className="flex-1 relative cursor-pointer select-none"
              style={{ borderLeft: `1px solid ${S.border}` }}
              onClick={openAdd}>

              {/* Hour grid lines */}
              {HOURS.map(h => (
                <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: `1px solid ${S.border}` }} />
              ))}

              {/* Half-hour lines */}
              {HOURS.map(h => (
                <div key={`h-${h}`} style={{
                  position: 'absolute',
                  top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                  left: 0, right: 0, height: 1,
                  background: 'rgba(0,0,0,0.04)',
                  pointerEvents: 'none',
                }} />
              ))}

              {/* Current time indicator */}
              {isToday && (() => {
                const nowMins = now.getHours() * 60 + now.getMinutes()
                if (nowMins < START_HOUR * 60 || nowMins > END_HOUR * 60) return null
                const top = ((nowMins - START_HOUR * 60) / 60) * HOUR_HEIGHT
                return (
                  <div style={{ position: 'absolute', top, left: 0, right: 0, zIndex: 20, pointerEvents: 'none' }}>
                    <div style={{ height: 2, background: S.danger }} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.danger, position: 'absolute', top: -3, left: -4 }} />
                  </div>
                )
              })()}

              {/* Live punch blocks */}
              {isToday && (() => {
                const onSiteNow = liveStatuses.filter(ls => ls.isClockedIn && ls.clockedInAt)
                if (onSiteNow.length === 0) return null
                const count = onSiteNow.length
                return onSiteNow.map((ls, idx) => {
                  const s = staff.find(m => m.id === ls.staffId)
                  const color = s?.color ?? S.green
                  const clockInMins = getLocalMins(ls.clockedInAt!)
                  const nowMins = now.getHours() * 60 + now.getMinutes()
                  const blockStart = Math.max(START_HOUR * 60, clockInMins)
                  const blockEnd   = Math.min(END_HOUR * 60, nowMins)
                  if (blockStart >= blockEnd) return null
                  const top    = ((blockStart - START_HOUR * 60) / 60) * HOUR_HEIGHT
                  const height = Math.max(((blockEnd - blockStart) / 60) * HOUR_HEIGHT, 6)
                  const leftPct  = (idx / count) * 100
                  const widthPct = (1 / count) * 100
                  return (
                    <div key={ls.staffId} className="absolute overflow-hidden pointer-events-none"
                      style={{ top, height, zIndex: 5, left: `${leftPct}%`, width: `${widthPct}%`, background: `${color}0D`, borderLeft: `2px solid ${color}` }}>
                      <div className="flex items-center gap-1 px-1 pt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-[9px] font-semibold truncate" style={{ color }}>
                          {s?.name.split(' ')[0]}
                          {(ls.currentJobCardTitle ?? ls.currentProjectName) && ` · ${(ls.currentJobCardTitle ?? ls.currentProjectName)!.slice(0, 18)}`}
                        </span>
                      </div>
                    </div>
                  )
                })
              })()}

              {/* Job blocks with overlap columns */}
              {layout.map(({ job, col, totalCols }) => {
                const staffMember = job.staff ?? staff.find(s => s.id === job.staff_id)
                const color  = staffMember?.color ?? S.accent
                const top    = jobTop(job.start_time)
                const height = jobHeight(job.start_time, job.end_time)
                const isDone = job.status === 'completed' || job.status === 'cancelled'
                const w = totalCols > 1 ? `calc(${100 / totalCols}% - 4px)` : 'calc(100% - 8px)'
                const l = totalCols > 1 ? `calc(${(col / totalCols) * 100}% + 2px)` : '4px'

                return (
                  <div
                    key={job.id}
                    data-job
                    onClick={e => { e.stopPropagation(); openEdit(job) }}
                    className="absolute rounded-lg px-2 py-1 overflow-hidden cursor-pointer"
                    style={{
                      top, height, left: l, width: w,
                      background: `${color}22`,
                      borderLeft: `3px solid ${color}`,
                      opacity: isDone ? 0.5 : 1,
                      zIndex: 10,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${color}33` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${color}22` }}>
                    <p className="text-[11px] font-semibold leading-tight truncate"
                      style={{ color: S.text, textDecoration: job.status === 'cancelled' ? 'line-through' : 'none' }}>
                      {job.title}
                    </p>
                    {height >= 44 && (
                      <p className="text-[10px] leading-tight truncate mt-0.5" style={{ color: S.muted }}>
                        {fmtTime(job.start_time)} – {fmtTime(job.end_time)}
                      </p>
                    )}
                    {height >= 60 && staffMember && (
                      <p className="text-[10px] leading-tight truncate mt-0.5 font-medium" style={{ color }}>
                        {staffMember.name.split(' ')[0]}
                      </p>
                    )}
                    {(job.photo_count ?? 0) > 0 && (
                      <div className="flex items-center gap-0.5 mt-0.5" style={{ color }}>
                        <Camera size={9} />
                        <span className="text-[9px] font-semibold">{job.photo_count}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!loading && dayJobs.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: 200 }}>
          <Calendar size={28} style={{ color: S.border }} />
          <p className="text-sm mt-2" style={{ color: S.muted }}>No jobs today — tap the calendar or click Add Job</p>
        </div>
      )}

      {/* ── Job modal ──────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <h2 className="font-bold text-sm" style={{ color: S.text }}>
                {modal.mode === 'add' ? 'Schedule Job' : 'Edit Job'}
              </h2>
              <div className="flex items-center gap-2">
                {modal.mode === 'edit' && (
                  <button onClick={() => void handleDelete()} disabled={deleting}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: '#FEF2F2', color: S.danger }}>
                    {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Delete
                  </button>
                )}
                <button onClick={closeModal} className="p-1.5 rounded-lg" style={{ color: S.muted }}
                  onMouseEnter={e => e.currentTarget.style.background = S.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-5 space-y-3">

              {/* Source selector (only for new jobs) */}
              {modal.mode === 'add' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>Schedule from</label>
                  <div className="flex gap-2">
                    {([['manual', 'Custom title'], ['job_card', 'Job Card'], ['project', 'Project']] as const).map(([src, label]) => (
                      <button key={src} onClick={() => setForm(f => ({ ...f, source: src, title: '', address: '', staff_id: '', quote_id: '', job_card_id: '' }))}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{
                          background: form.source === src ? S.accent : S.bg,
                          color: form.source === src ? '#fff' : S.muted,
                          border: `1px solid ${form.source === src ? S.accent : S.border}`,
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Job Card selector */}
              {form.source === 'job_card' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Select Job Card *</label>
                  <select value={form.job_card_id} onChange={e => handleJobCardChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: form.job_card_id ? S.text : S.muted }}>
                    <option value="">Choose a job card…</option>
                    {jobCards.map(jc => (
                      <option key={jc.id} value={jc.id}>{jc.job_number} — {jc.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Project selector */}
              {form.source === 'project' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Select Project *</label>
                  <select value={form.quote_id} onChange={e => handleQuoteChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: form.quote_id ? S.text : S.muted }}>
                    <option value="">Choose a project…</option>
                    {quotes.map(q => (
                      <option key={q.id} value={q.id}>{q.quote_number} — {q.project_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Job Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. DB board installation"
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
              </div>

              {/* Date + times */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Date *</label>
                  <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Start</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>End</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
              </div>

              {/* Assign To */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>
                  Assign To {form.staff_id && <span style={{ fontWeight: 400 }}>(auto-filled from selection)</span>}
                </label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: form.staff_id ? S.text : S.muted }}>
                  <option value="">Unassigned</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {form.staff_id && (() => {
                  const s = staff.find(m => m.id === form.staff_id)
                  return s ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="text-xs" style={{ color: S.muted }}>{s.name} · {s.role}</span>
                    </div>
                  ) : null
                })()}
              </div>

              {/* Linked quote (manual/edit mode only) */}
              {(form.source === 'manual' || modal.mode === 'edit') && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Linked Project <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <select value={form.quote_id} onChange={e => handleQuoteChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: form.quote_id ? S.text : S.muted }}>
                    <option value="">No project linked</option>
                    {quotes.map(q => (
                      <option key={q.id} value={q.id}>{q.quote_number} — {q.project_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Address */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Address</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Site address"
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
              </div>

              {/* Status (edit only) */}
              {modal.mode === 'edit' && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {JOB_STATUSES.map(s => (
                      <button key={s.value} onClick={() => setForm(f => ({ ...f, status: s.value }))}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{
                          background: form.status === s.value ? S.accent : S.bg,
                          color: form.status === s.value ? '#fff' : S.muted,
                          border: `1px solid ${form.status === s.value ? S.accent : S.border}`,
                        }}>
                        {form.status === s.value && <Check size={10} />}
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Any notes for this job…"
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
              </div>
            </div>

            {/* Share with worker */}
            {modal.mode === 'edit' && modal.job && (
              <div className="px-5 pt-1 pb-2">
                <div className="rounded-xl p-3" style={{ background: 'rgba(58,124,165,0.05)', border: `1px solid rgba(58,124,165,0.15)` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Share2 size={12} style={{ color: S.accent }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.accent }}>Worker Link</span>
                    </div>
                    <button
                      onClick={() => void handleCopyLink(modal.job!.id)}
                      disabled={copied === 'copying'}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-70"
                      style={{ background: copied === 'done' ? 'rgba(22,163,74,0.1)' : S.accent, color: copied === 'done' ? S.green : '#fff' }}>
                      {copied === 'copying' && <><Loader2 size={11} className="animate-spin" /> Copying…</>}
                      {copied === 'done'    && <><CheckCheck size={11} /> Copied!</>}
                      {copied === 'idle'    && <><Copy size={11} /> Copy Link</>}
                    </button>
                  </div>
                  {shareLink
                    ? <p className="text-[10px] truncate font-mono" style={{ color: S.muted }}>{shareLink}</p>
                    : <p className="text-[10px]" style={{ color: S.muted }}>Share this link with your worker via WhatsApp.</p>
                  }
                </div>
              </div>
            )}

            {/* Photos */}
            {modal.mode === 'edit' && (
              <div className="px-5 pb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Image size={12} style={{ color: S.muted }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.muted }}>
                    Photos {photos.length > 0 && `(${photos.length})`}
                  </span>
                </div>
                {photos.length === 0 ? (
                  <p className="text-xs" style={{ color: S.muted }}>No photos yet.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {photos.map(p => (
                      <button key={p.id} onClick={() => setLightbox(p.public_url)}
                        className="aspect-square rounded-lg overflow-hidden relative"
                        style={{ border: `1px solid ${S.border}` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.public_url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save button */}
            <div className="px-5 pb-5">
              <button onClick={() => void handleSave()}
                disabled={!form.title.trim() || !form.scheduled_date || saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: S.accent, color: '#fff' }}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Schedule Job' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" style={{ maxHeight: '90vh' }} />
          <button className="absolute top-4 right-4 p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }} onClick={() => setLightbox(null)}>
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
