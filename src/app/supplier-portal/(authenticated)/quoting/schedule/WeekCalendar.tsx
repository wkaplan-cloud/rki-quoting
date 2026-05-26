'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Trash2, Check, Calendar } from 'lucide-react'
import type { ElecJob, ElecJobStatus, ElecStaff } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

// ── Calendar constants ────────────────────────────────────────────────────────
const HOUR_HEIGHT  = 64   // px per hour
const START_HOUR   = 7    // 7am
const END_HOUR     = 20   // 8pm
const HOURS        = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
const DAY_LABELS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS       = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Date helpers ──────────────────────────────────────────────────────────────
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuoteOption { id: string; quote_number: string; project_name: string; project_address: string | null }

interface FormState {
  title: string
  scheduled_date: string
  start_time: string
  end_time: string
  staff_id: string
  quote_id: string
  address: string
  notes: string
  status: ElecJobStatus
}

const EMPTY_FORM: FormState = {
  title: '', scheduled_date: '', start_time: '08:00', end_time: '09:00',
  staff_id: '', quote_id: '', address: '', notes: '', status: 'scheduled',
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
}: {
  initialJobs: ElecJob[]
  staff: ElecStaff[]
  quotes: QuoteOption[]
}) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [jobs, setJobs]           = useState<ElecJob[]>(initialJobs)
  const [loading, setLoading]     = useState(false)
  const [modal, setModal]         = useState<{ mode: 'add' | 'edit'; job?: ElecJob } | null>(null)
  const [form, setForm]           = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const scrollRef                 = useRef<HTMLDivElement>(null)

  // Scroll to 7:30am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (0.5) * HOUR_HEIGHT
    }
  }, [])

  const weekDays  = getWeekDays(weekStart)
  const weekEnd   = weekDays[6]
  const todayStr  = toDateStr(new Date())

  // Fetch jobs when week changes
  const fetchJobs = useCallback(async (start: Date, end: Date) => {
    setLoading(true)
    const res = await fetch(`/api/supplier-portal/quoting/jobs?start=${toDateStr(start)}&end=${toDateStr(end)}`)
    const data = await res.json() as ElecJob[]
    setJobs(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchJobs(weekStart, weekEnd)
  }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  function prevWeek() {
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  }
  function nextWeek() {
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
  }
  function goToday() { setWeekStart(getWeekStart(new Date())) }

  // ── Open add modal from clicking on time grid ─────────────────────────────
  function openAdd(date: Date, e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-job]')) return
    const rect  = e.currentTarget.getBoundingClientRect()
    const y     = e.clientY - rect.top
    const raw   = START_HOUR * 60 + Math.floor((y / HOUR_HEIGHT) * 60)
    const start = Math.round(raw / 30) * 30
    const clamped = Math.max(START_HOUR * 60, Math.min(start, (END_HOUR - 1) * 60))
    const end   = Math.min(clamped + 60, END_HOUR * 60)
    setForm({ ...EMPTY_FORM, scheduled_date: toDateStr(date), start_time: minsToTime(clamped), end_time: minsToTime(end) })
    setModal({ mode: 'add' })
  }

  function openEdit(job: ElecJob) {
    setForm({
      title:          job.title,
      scheduled_date: job.scheduled_date,
      start_time:     job.start_time.slice(0, 5),
      end_time:       job.end_time.slice(0, 5),
      staff_id:       job.staff_id ?? '',
      quote_id:       job.quote_id ?? '',
      address:        job.address ?? '',
      notes:          job.notes ?? '',
      status:         job.status,
    })
    setModal({ mode: 'edit', job })
  }

  function closeModal() { setModal(null); setForm(EMPTY_FORM) }

  // Auto-fill address when quote is selected
  function handleQuoteChange(quoteId: string) {
    const q = quotes.find(q => q.id === quoteId)
    setForm(f => ({
      ...f,
      quote_id: quoteId,
      title: f.title || (q?.project_name ?? ''),
      address: f.address || (q?.project_address ?? ''),
    }))
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

  // ── Week label ────────────────────────────────────────────────────────────
  const startLabel = `${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]}`
  const endLabel   = `${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={prevWeek}
            className="p-2 rounded-lg transition-colors" style={{ color: S.muted }}
            onMouseEnter={e => e.currentTarget.style.background = S.border}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextWeek}
            className="p-2 rounded-lg transition-colors" style={{ color: S.muted }}
            onMouseEnter={e => e.currentTarget.style.background = S.border}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronRight size={16} />
          </button>
        </div>

        <span className="font-semibold text-sm" style={{ color: S.text }}>
          {startLabel} — {endLabel}
        </span>

        {loading && <Loader2 size={14} className="animate-spin" style={{ color: S.muted }} />}

        <button onClick={goToday}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: S.bg, color: S.muted, border: `1px solid ${S.border}` }}
          onMouseEnter={e => e.currentTarget.style.background = S.border}
          onMouseLeave={e => e.currentTarget.style.background = S.bg}>
          Today
        </button>

        <div className="flex-1" />

        {/* Staff legend */}
        <div className="hidden sm:flex items-center gap-3 flex-wrap">
          {staff.filter(s => s.is_active).map(s => (
            <div key={s.id} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-xs" style={{ color: S.muted }}>{s.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => { setForm({ ...EMPTY_FORM, scheduled_date: todayStr }); setModal({ mode: 'add' }) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: S.accent }}>
          <Plus size={14} /> Add Job
        </button>
      </div>

      {/* ── Calendar grid ───────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden flex flex-col flex-1" style={{ background: S.card, border: `1px solid ${S.border}` }}>

        {/* Day headers */}
        <div className="flex flex-shrink-0" style={{ borderBottom: `1px solid ${S.border}` }}>
          <div style={{ width: 52, flexShrink: 0 }} />
          {weekDays.map((day, i) => {
            const isToday = toDateStr(day) === todayStr
            return (
              <div key={i} className="flex-1 text-center py-3 px-1"
                style={{ borderLeft: `1px solid ${S.border}`, background: isToday ? 'rgba(58,124,165,0.04)' : 'transparent' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted }}>{DAY_LABELS[i]}</p>
                <p className={`text-lg font-bold mt-0.5 w-8 h-8 mx-auto flex items-center justify-center rounded-full`}
                  style={{
                    color:      isToday ? '#fff' : S.text,
                    background: isToday ? S.accent : 'transparent',
                  }}>
                  {day.getDate()}
                </p>
              </div>
            )
          })}
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <div className="flex" style={{ height: HOURS.length * HOUR_HEIGHT }}>

            {/* Time labels */}
            <div style={{ width: 52, flexShrink: 0 }}>
              {HOURS.map(h => (
                <div key={h} style={{ height: HOUR_HEIGHT, position: 'relative' }}>
                  <span className="absolute top-1 right-2 text-[10px] font-medium"
                    style={{ color: S.muted }}>
                    {h === 12 ? '12pm' : h > 12 ? `${h-12}pm` : `${h}am`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, di) => {
              const dateStr  = toDateStr(day)
              const dayJobs  = jobs.filter(j => j.scheduled_date === dateStr)
              const isToday  = dateStr === todayStr

              return (
                <div key={di} className="flex-1 relative cursor-pointer select-none"
                  style={{ borderLeft: `1px solid ${S.border}`, background: isToday ? 'rgba(58,124,165,0.02)' : 'transparent' }}
                  onClick={e => openAdd(day, e)}>

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
                      background: `rgba(0,0,0,0.04)`,
                      pointerEvents: 'none',
                    }} />
                  ))}

                  {/* Job blocks */}
                  {dayJobs.map(job => {
                    const staffMember = job.staff ?? staff.find(s => s.id === job.staff_id)
                    const color  = staffMember?.color ?? S.accent
                    const top    = jobTop(job.start_time)
                    const height = jobHeight(job.start_time, job.end_time)
                    const isDone = job.status === 'completed' || job.status === 'cancelled'

                    return (
                      <div
                        key={job.id}
                        data-job
                        onClick={e => { e.stopPropagation(); openEdit(job) }}
                        className="absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden cursor-pointer transition-opacity"
                        style={{
                          top,
                          height,
                          background: `${color}22`,
                          borderLeft: `3px solid ${color}`,
                          opacity: isDone ? 0.5 : 1,
                          zIndex: 10,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = `${color}33`}
                        onMouseLeave={e => e.currentTarget.style.background = `${color}22`}
                      >
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
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Job modal ───────────────────────────────────────────────────── */}
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

              {/* Assign to */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Assign To</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: form.staff_id ? S.text : S.muted }}>
                  <option value="">Unassigned</option>
                  {staff.filter(s => s.is_active).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {/* Show color swatch for selected staff */}
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

              {/* Linked quote */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Linked Quote <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <select value={form.quote_id} onChange={e => handleQuoteChange(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: form.quote_id ? S.text : S.muted }}>
                  <option value="">No quote linked</option>
                  {quotes.map(q => (
                    <option key={q.id} value={q.id}>{q.quote_number} — {q.project_name}</option>
                  ))}
                </select>
              </div>

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

      {/* Empty state overlay when no jobs */}
      {!loading && jobs.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: 160 }}>
          <Calendar size={28} style={{ color: S.border }} />
          <p className="text-sm mt-2" style={{ color: S.muted }}>No jobs this week — click on the calendar to add one</p>
        </div>
      )}
    </div>
  )
}
