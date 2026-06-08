import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

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
  footer: { position: 'absolute', bottom: 20, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#E4E4E7', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#94A3B8' },
})

interface Punch { punch_type: string; punched_at: string; job?: { job_number: string; title: string } | null }
interface StaffData { id: string; name: string; color: string; punches: Punch[] }

interface Props {
  companyName: string
  periodLabel: string
  staffData: StaffData[]
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtDur(ms: number) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

export function TimesheetPDF({ companyName, periodLabel, staffData }: Props) {
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

        {staffData.map(member => {
          const ins = member.punches.filter(p => p.punch_type === 'clock_in').sort((a, b) => a.punched_at.localeCompare(b.punched_at))
          const outs = member.punches.filter(p => p.punch_type === 'clock_out').sort((a, b) => a.punched_at.localeCompare(b.punched_at))
          let totalMs = 0
          const sessions = ins.map((inP, idx) => {
            const outP = outs[idx] ?? null
            const durMs = outP ? new Date(outP.punched_at).getTime() - new Date(inP.punched_at).getTime() : null
            if (durMs) totalMs += durMs
            return { in: inP, out: outP, durMs }
          })

          return (
            <View key={member.id} style={s.staffSection} wrap={false}>
              <View style={s.staffHeader}>
                <View style={[s.avatar, { backgroundColor: member.color ?? '#3A7CA5' }]}>
                  <Text style={s.avatarText}>{member.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={s.staffName}>{member.name}</Text>
                  <Text style={s.staffMeta}>
                    Total: {totalMs > 0 ? fmtDur(totalMs) : '—'} · {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <View style={s.table}>
                <View style={s.thead}>
                  <Text style={[s.th, { flex: 1.2 }]}>Date</Text>
                  <Text style={[s.th, { flex: 0.8 }]}>Clock In</Text>
                  <Text style={[s.th, { flex: 0.8 }]}>Clock Out</Text>
                  <Text style={[s.th, { flex: 0.7 }]}>Duration</Text>
                  <Text style={[s.th, { flex: 2 }]}>Job</Text>
                </View>
                {sessions.map((ses, i) => {
                  const job = ses.in.job && !Array.isArray(ses.in.job) ? ses.in.job : null
                  const durMs = ses.durMs
                  return (
                    <View key={i} style={[s.tr, i % 2 !== 0 ? { backgroundColor: '#FAFAFA' } : {}]}>
                      <Text style={[s.td, { flex: 1.2 }]}>{fmtDate(ses.in.punched_at)}</Text>
                      <Text style={[s.td, s.green, { flex: 0.8 }]}>{fmtTime(ses.in.punched_at)}</Text>
                      <Text style={[s.td, { flex: 0.8, color: ses.out ? '#DC2626' : '#16A34A' }]}>
                        {ses.out ? fmtTime(ses.out.punched_at) : 'On site'}
                      </Text>
                      <Text style={[s.td, { flex: 0.7, fontFamily: 'Helvetica-Bold' }]}>
                        {durMs != null ? fmtDur(durMs) : '—'}
                      </Text>
                      <Text style={[s.td, s.tdMuted, { flex: 2 }]}>
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
