import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecQuote, ElecClient, ElecSettings, ElecSnagItem } from '@/lib/elec-types'

const ACCENT  = '#3A7CA5'
const DARK    = '#18181B'
const MUTED   = '#71717A'
const BORDER  = '#E4E4E7'
const SURF    = '#F9FAFB'
const GOLD    = '#D9A441'
const GREEN   = '#16A34A'
const DANGER  = '#DC2626'

const STATUS_COLOR: Record<string, string> = {
  open:        DANGER,
  in_progress: GOLD,
  resolved:    GREEN,
}
const STATUS_LABEL: Record<string, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
}

const s = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 48, paddingBottom: 64 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, alignItems: 'flex-start' },
  company:    { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 3 },
  companyMeta:{ fontSize: 7, color: MUTED, lineHeight: 1.5 },
  docTitle:   { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, textAlign: 'right' },
  docSub:     { fontSize: 8.5, color: MUTED, textAlign: 'right', marginTop: 2 },
  docMeta:    { fontSize: 7.5, color: MUTED, textAlign: 'right', marginTop: 2 },
  infoGrid:   { flexDirection: 'row', gap: 12, marginBottom: 18 },
  infoBox:    { flex: 1, padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  infoBoxHd:  { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 4, marginBottom: 5 },
  infoBold:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 },
  infoRow:    { fontSize: 8, color: MUTED, marginBottom: 2 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  summaryBox: { flex: 1, padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  summaryLbl: { fontSize: 6.5, color: MUTED, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 3 },
  summaryVal: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  tableHead:  { flexDirection: 'row', backgroundColor: ACCENT, paddingVertical: 5, paddingHorizontal: 6 },
  th:         { fontSize: 7.5, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  row:        { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  rowAlt:     { backgroundColor: SURF },
  td:         { fontSize: 8.5, color: DARK },
  tdMuted:    { color: MUTED },
  footer:     { position: 'absolute', bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: MUTED },
})

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  quote: ElecQuote
  client: ElecClient | null
  settings: ElecSettings | null
  snags: ElecSnagItem[]
  companyName: string
  logoUrl?: string | null
}

export function ElecSnagPDF({ quote, client, settings, snags, companyName, logoUrl }: Props) {
  const counts = {
    open:        snags.filter(s => s.status === 'open').length,
    in_progress: snags.filter(s => s.status === 'in_progress').length,
    resolved:    snags.filter(s => s.status === 'resolved').length,
  }

  const metaParts = [
    settings?.vat_registration_number    ? `VAT: ${settings.vat_registration_number}`    : null,
    settings?.company_registration_number ? `Reg: ${settings.company_registration_number}` : null,
  ].filter(Boolean).join('  ·  ')

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl
              ? <Image src={logoUrl} style={{ maxWidth: 180, alignSelf: 'flex-start', marginBottom: metaParts ? 4 : 0 }} />
              : <Text style={s.company}>{companyName}</Text>
            }
            {metaParts ? <Text style={s.companyMeta}>{metaParts}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docTitle}>SNAG LIST</Text>
            <Text style={s.docSub}>{quote.project_name}</Text>
            {quote.project_address && <Text style={s.docMeta}>{quote.project_address}</Text>}
            <Text style={s.docMeta}>Printed: {fmtDate(new Date().toISOString().split('T')[0])}</Text>
          </View>
        </View>

        {/* Info boxes */}
        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>CLIENT</Text>
            {client ? (
              <>
                <Text style={s.infoBold}>{client.client_name}</Text>
                {client.company && <Text style={s.infoRow}>{client.company}</Text>}
                {client.email   && <Text style={s.infoRow}>{client.email}</Text>}
              </>
            ) : <Text style={s.infoRow}>—</Text>}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>PROJECT</Text>
            <Text style={s.infoBold}>{quote.project_name}</Text>
            {quote.quote_number && <Text style={s.infoRow}>Ref: {quote.quote_number}</Text>}
          </View>
        </View>

        {/* Summary stats */}
        <View style={s.summaryRow}>
          {[
            { label: 'OPEN',        val: String(counts.open),        color: DANGER },
            { label: 'IN PROGRESS', val: String(counts.in_progress), color: GOLD },
            { label: 'RESOLVED',    val: String(counts.resolved),    color: GREEN },
            { label: 'TOTAL',       val: String(snags.length),       color: DARK },
          ].map(c => (
            <View key={c.label} style={s.summaryBox}>
              <Text style={s.summaryLbl}>{c.label}</Text>
              <Text style={[s.summaryVal, { color: c.color }]}>{c.val}</Text>
            </View>
          ))}
        </View>

        {/* Table */}
        {snags.length === 0 ? (
          <View style={{ padding: 20, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: MUTED }}>No snag items for this project.</Text>
          </View>
        ) : (
          <>
            <View style={s.tableHead}>
              <Text style={[s.th, { width: 62, textAlign: 'center' }]}>Status</Text>
              <Text style={[s.th, { flex: 1 }]}>Description</Text>
              <Text style={[s.th, { width: 80 }]}>Raised By</Text>
              <Text style={[s.th, { width: 68 }]}>Raised</Text>
              <Text style={[s.th, { width: 68 }]}>Resolved</Text>
            </View>

            {snags.map((snag, i) => (
              <View key={snag.id} style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]} wrap={false}>
                <Text style={[s.td, { width: 62, textAlign: 'center', color: STATUS_COLOR[snag.status] ?? MUTED, fontFamily: 'Helvetica-Bold', fontSize: 7.5 }]}>
                  {STATUS_LABEL[snag.status] ?? snag.status}
                </Text>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <Text style={s.td}>{snag.description}</Text>
                  {snag.notes && <Text style={[s.td, s.tdMuted, { fontSize: 7.5, fontStyle: 'italic', marginTop: 1 }]}>{snag.notes}</Text>}
                </View>
                <Text style={[s.td, s.tdMuted, { width: 80 }]}>{snag.raised_by ?? '—'}</Text>
                <Text style={[s.td, s.tdMuted, { width: 68 }]}>{fmtDate(snag.raised_date)}</Text>
                <Text style={[s.td, s.tdMuted, { width: 68, color: snag.resolved_date ? GREEN : MUTED }]}>
                  {fmtDate(snag.resolved_date)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{companyName}</Text>
          <Text style={s.footerText}>Snag List — {quote.project_name}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
