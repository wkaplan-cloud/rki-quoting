import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { isSAPublicHoliday } from '@/lib/sa-overtime'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 8, color: '#18181B', padding: 28, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#1E2A38', paddingBottom: 10, marginBottom: 16 },
  company: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1E2A38' },
  sub: { fontSize: 9, color: '#71717A', marginTop: 3 },
  staffSection: { marginBottom: 16 },
  staffHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#3A7CA5', marginRight: 6, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  staffName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#18181B' },
  staffMeta: { fontSize: 7, color: '#71717A', marginTop: 1 },
  table: { borderWidth: 0.5, borderColor: '#E4E4E7' },
  thead: { flexDirection: 'row', backgroundColor: '#F0F2F5', borderBottomWidth: 0.5, borderBottomColor: '#E4E4E7' },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#71717A', padding: '4 6', textTransform: 'uppercase', letterSpacing: 0.3 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E4E4E7' },
  td: { fontSize: 7.5, color: '#18181B', padding: '4 6' },
  tdMuted: { color: '#71717A' },
  green: { color: '#16A34A', fontFamily: 'Helvetica-Bold' },
  gold: { color: '#D9A441', fontFamily: 'Helvetica-Bold' },
  summary: { borderWidth: 0.5, borderColor: '#E4E4E7', marginBottom: 16 },
  summaryTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#71717A', backgroundColor: '#F0F2F5', padding: '4 6', textTransform: 'uppercase', letterSpacing: 0.3, borderBottomWidth: 0.5, borderBottomColor: '#E4E4E7' },
  summaryRow: { flexDirection: 'row' },
  summaryCell: { flex: 1, padding: '7 8', borderRightWidth: 0.5, borderRightColor: '#E4E4E7' },
  summaryLabel: { fontSize: 7, color: '#71717A', marginBottom: 2 },
  summaryValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1E2A38' },
  footer: { position: 'absolute', bottom: 20, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#E4E4E7', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#94A3B8' },
})

interface Punch { punch_type: string; punched_at: string; job_id?: string | null; job?: { job_number: string; title: string } | null }
interface StaffData { id: string; name: string; color: string; punches: Punch[] }

interface Props {
  companyName: string
  periodLabel: string
  staffData: StaffData[]
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtDur(ms: number) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

interface Session { in: Punch; out: Punch | null; normalMs: number; overtimeMs: number; totalMs: number }

const NORMAL_DAILY_MS = 9 * 3_600_000

/**
 * A technician has two clocks running at once: the working day (no job_id) and
 * whichever job they are on. Pairing every clock_in against the next clock_out
 * regardless of job took a job's start and matched it to the day's end, then
 * counted the same hours again — a nine-hour day could print as thirteen.
 *
 * Sessions are paired within their own timeline, then time already covered by
 * an earlier session that day is not counted twice. The nine-hour normal
 * allowance is spent across the day in order, not granted afresh per session,
 * so the rows add up to the day and the day adds up to the week.
 */
function buildSessions(punches: Punch[]) {
  const pByDay: Record<string, Punch[]> = {}
  for (const p of punches) {
    const d = p.punched_at.slice(0, 10)
    if (!pByDay[d]) pByDay[d] = []
    pByDay[d].push(p)
  }

  let totalNormalMs = 0, totalOtMs = 0, totalMs = 0
  const sessions: Session[] = []

  for (const dayKey of Object.keys(pByDay).sort()) {
    const daySorted = [...pByDay[dayKey]].sort((a, b) => a.punched_at.localeCompare(b.punched_at))

    // Pair inside each timeline: the working day and each job separately.
    const byJob = new Map<string, Punch[]>()
    for (const p of daySorted) {
      const k = p.job_id ?? ''
      const list = byJob.get(k)
      if (list) list.push(p); else byJob.set(k, [p])
    }
    const daySessions: Session[] = []
    for (const list of byJob.values()) {
      let openP: Punch | null = null
      for (const p of list) {
        if (p.punch_type === 'clock_in') { if (!openP) openP = p }
        else if (openP) {
          daySessions.push({ in: openP, out: p, normalMs: 0, overtimeMs: 0, totalMs: 0 })
          openP = null
        }
      }
      if (openP) daySessions.push({ in: openP, out: null, normalMs: 0, overtimeMs: 0, totalMs: 0 })
    }
    daySessions.sort((a, b) => a.in.punched_at.localeCompare(b.in.punched_at))

    // Count each session only for the time not already covered that day.
    const covered: [number, number][] = []
    const isOvertimeDay = (() => {
      const d = new Date(daySorted[0].punched_at)
      const sa = new Date(d.getTime() + 2 * 3_600_000)
      const dow = sa.getUTCDay()
      return dow === 0 || dow === 6 || isSAPublicHoliday(d)
    })()
    let spentNormal = 0

    for (const ses of daySessions) {
      if (!ses.out) continue
      const a = new Date(ses.in.punched_at).getTime()
      const b = new Date(ses.out.punched_at).getTime()
      let counted = Math.max(0, b - a)
      for (const [ca, cb] of covered) {
        const overlap = Math.min(b, cb) - Math.max(a, ca)
        if (overlap > 0) counted -= overlap
      }
      counted = Math.max(0, counted)
      covered.push([a, b])
      covered.sort((x, y) => x[0] - y[0])

      ses.totalMs = counted
      if (isOvertimeDay) { ses.normalMs = 0; ses.overtimeMs = counted }
      else {
        const normal = Math.max(0, Math.min(counted, NORMAL_DAILY_MS - spentNormal))
        ses.normalMs = normal
        ses.overtimeMs = counted - normal
        spentNormal += normal
      }
      totalNormalMs += ses.normalMs; totalOtMs += ses.overtimeMs; totalMs += ses.totalMs
    }
    sessions.push(...daySessions)
  }
  return { sessions, totalNormalMs, totalOtMs, totalMs }
}

export function TimesheetPDF({ companyName, periodLabel, staffData }: Props) {
  const computed = staffData.map(member => ({ member, ...buildSessions(member.punches) }))
  const weekNormalMs = computed.reduce((sum, c) => sum + c.totalNormalMs, 0)
  const weekOtMs     = computed.reduce((sum, c) => sum + c.totalOtMs, 0)
  const weekTotalMs  = computed.reduce((sum, c) => sum + c.totalMs, 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.company}>{companyName}</Text>
            <Text style={s.sub}>Weekly Timesheet — {periodLabel}</Text>
          </View>
          <Text style={[s.sub, { textAlign: 'right' }]}>
            Printed {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {staffData.length === 0 && (
          <Text style={{ color: '#71717A', textAlign: 'center', marginTop: 40 }}>No time records for this week.</Text>
        )}

        {computed.length > 0 && (
          <View style={s.summary}>
            <Text style={s.summaryTitle}>Week Totals — All Staff</Text>
            <View style={s.summaryRow}>
              <View style={s.summaryCell}>
                <Text style={s.summaryLabel}>Total Hours Worked</Text>
                <Text style={s.summaryValue}>{fmtDur(weekTotalMs)}</Text>
              </View>
              <View style={s.summaryCell}>
                <Text style={s.summaryLabel}>Normal Hours</Text>
                <Text style={[s.summaryValue, { color: '#16A34A' }]}>{weekNormalMs > 0 ? fmtDur(weekNormalMs) : '—'}</Text>
              </View>
              <View style={[s.summaryCell, { borderRightWidth: 0 }]}>
                <Text style={s.summaryLabel}>After-Hours (OT)</Text>
                <Text style={[s.summaryValue, { color: '#D9A441' }]}>{weekOtMs > 0 ? fmtDur(weekOtMs) : '—'}</Text>
              </View>
            </View>
          </View>
        )}

        {computed.map(({ member, sessions, totalNormalMs, totalOtMs, totalMs }) => {
          return (
            <View key={member.id} style={s.staffSection} wrap={false}>
              <View style={s.staffHeader}>
                <View style={[s.avatar, { backgroundColor: member.color ?? '#3A7CA5' }]}>
                  <Text style={s.avatarText}>{member.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={s.staffName}>{member.name}</Text>
                  <Text style={s.staffMeta}>
                    {totalMs > 0
                      ? `Normal: ${fmtDur(totalNormalMs)}  ·  OT: ${totalOtMs > 0 ? fmtDur(totalOtMs) : '—'}  ·  Total: ${fmtDur(totalMs)}  ·  ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`
                      : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} — no completed sessions`}
                  </Text>
                </View>
              </View>
              <View style={s.table}>
                <View style={s.thead}>
                  <Text style={[s.th, { flex: 1.2 }]}>Date</Text>
                  <Text style={[s.th, { flex: 0.7 }]}>Clock In</Text>
                  <Text style={[s.th, { flex: 0.7 }]}>Clock Out</Text>
                  <Text style={[s.th, { flex: 0.6 }]}>Normal</Text>
                  <Text style={[s.th, { flex: 0.5 }]}>OT</Text>
                  <Text style={[s.th, { flex: 0.6 }]}>Total</Text>
                  <Text style={[s.th, { flex: 1.7 }]}>Job</Text>
                </View>
                {sessions.map((ses, i) => {
                  const job = ses.in.job && !Array.isArray(ses.in.job) ? ses.in.job : null
                  return (
                    <View key={i} style={[s.tr, i % 2 !== 0 ? { backgroundColor: '#FAFAFA' } : {}]}>
                      <Text style={[s.td, { flex: 1.2 }]}>{fmtDate(ses.in.punched_at)}</Text>
                      <Text style={[s.td, s.green, { flex: 0.7 }]}>{fmtTime(ses.in.punched_at)}</Text>
                      <Text style={[s.td, { flex: 0.7, color: ses.out ? '#DC2626' : '#16A34A' }]}>
                        {ses.out ? fmtTime(ses.out.punched_at) : 'On site'}
                      </Text>
                      <Text style={[s.td, s.green, { flex: 0.6 }]}>
                        {ses.totalMs > 0 ? fmtDur(ses.normalMs) : '—'}
                      </Text>
                      <Text style={[s.td, ses.overtimeMs > 0 ? s.gold : s.tdMuted, { flex: 0.5 }]}>
                        {ses.overtimeMs > 0 ? fmtDur(ses.overtimeMs) : '—'}
                      </Text>
                      <Text style={[s.td, { flex: 0.6, fontFamily: 'Helvetica-Bold' }]}>
                        {ses.totalMs > 0 ? fmtDur(ses.totalMs) : '—'}
                      </Text>
                      <Text style={[s.td, s.tdMuted, { flex: 1.7 }]}>
                        {job ? `${job.job_number} · ${job.title}` : '—'}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>
          )
        })}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{companyName} · Weekly Timesheet</Text>
          <Text style={s.footerText}>{periodLabel}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
