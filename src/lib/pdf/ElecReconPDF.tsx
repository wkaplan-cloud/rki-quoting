import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecSettings } from '@/lib/elec-types'

const ACCENT = '#3A7CA5'
const DARK   = '#18181B'
const MUTED  = '#71717A'
const BORDER = '#E4E4E7'
const SURF   = '#F9FAFB'

const s = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 48, paddingBottom: 64 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'flex-start' },
  company:    { fontSize: 13, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 3 },
  meta:       { fontSize: 7, color: MUTED, lineHeight: 1.5 },
  title:      { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, textAlign: 'right' },
  docNum:     { fontSize: 8, color: MUTED, textAlign: 'right', marginTop: 3 },
  infoGrid:   { flexDirection: 'row', gap: 10, marginBottom: 16 },
  infoBox:    { flex: 1, padding: 9, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  infoHd:     { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 3, marginBottom: 4 },
  infoBold:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 },
  infoRow:    { fontSize: 7.5, color: MUTED, marginBottom: 1.5 },
  secRow:     { flexDirection: 'row', backgroundColor: ACCENT, paddingVertical: 4, paddingHorizontal: 8, marginTop: 8 },
  secLabel:   { fontSize: 8, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  tableHead:  { flexDirection: 'row', backgroundColor: '#EFF6FF', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  th:         { fontSize: 7.5, color: ACCENT, fontFamily: 'Helvetica-Bold' },
  row:        { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  rowAlt:     { backgroundColor: SURF },
  td:         { fontSize: 8.5, color: DARK },
  tdMuted:    { color: MUTED },
  footer:     { position: 'absolute', bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: MUTED },
  signBox:    { marginTop: 24, flexDirection: 'row', gap: 20 },
  signLine:   { flex: 1, borderTopWidth: 0.5, borderTopColor: DARK, paddingTop: 4 },
  signLabel:  { fontSize: 7.5, color: MUTED },
})

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

export interface ElecReconPDFProps {
  quote: ElecQuote
  client: ElecClient | null
  sections: ElecQuoteSection[]
  items: ElecQuoteLineItem[]
  settings: ElecSettings | null
  companyName: string
  companyEmail?: string | null
  logoUrl?: string | null
}

export function ElecReconPDF({ quote, client, sections, items, settings, companyName, companyEmail, logoUrl }: ElecReconPDFProps) {
  const freeItems = items.filter(i => i.section_id === null && !i.is_variation)
  const metaParts = [
    settings?.vat_registration_number  ? `VAT: ${settings.vat_registration_number}` : null,
    settings?.company_registration_number ? `Reg: ${settings.company_registration_number}` : null,
    settings?.cidb_registration_number ? `Lic: ${settings.cidb_registration_number}` : null,
  ].filter(Boolean).join('  ·  ')

  function ItemRows({ list, indent = false }: { list: ElecQuoteLineItem[]; indent?: boolean }) {
    return (
      <>
        {list.map((item, i) => (
          <View key={item.id} style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]} wrap={false}>
            <View style={{ flex: 1, paddingRight: 4, paddingLeft: indent ? 8 : 0 }}>
              <Text style={s.td}>{item.description || '—'}</Text>
            </View>
            <Text style={[s.td, s.tdMuted, { width: 45, textAlign: 'center' }]}>{item.unit ?? '—'}</Text>
            <Text style={[s.td, { width: 55, textAlign: 'right' }]}>{item.quoted_quantity}</Text>
            <View style={{ width: 60, flexDirection: 'row', justifyContent: 'center' }}>
              <View style={{ width: 44, height: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 2 }} />
            </View>
          </View>
        ))}
      </>
    )
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl && <Image src={logoUrl} style={{ width: 160, marginBottom: 4 }} />}
            <Text style={s.company}>{companyName}</Text>
            {companyEmail ? <Text style={s.meta}>{companyEmail}</Text> : null}
            {metaParts ? <Text style={s.meta}>{metaParts}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.title}>INSPECTION / RECON SHEET</Text>
            <Text style={s.docNum}>{quote.quote_number}</Text>
            <Text style={[s.docNum, { marginTop: 2 }]}>Date: {fmtDate(quote.quoted_date ?? new Date().toISOString().split('T')[0])}</Text>
          </View>
        </View>

        {/* Info grid */}
        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoHd}>CLIENT</Text>
            {client ? (
              <>
                <Text style={s.infoBold}>{client.client_name}</Text>
                {client.company && <Text style={s.infoRow}>{client.company}</Text>}
                {client.email && <Text style={s.infoRow}>{client.email}</Text>}
              </>
            ) : <Text style={s.infoRow}>—</Text>}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoHd}>PROJECT</Text>
            <Text style={s.infoBold}>{quote.project_name}</Text>
            {quote.project_address && <Text style={s.infoRow}>{quote.project_address}</Text>}
            {quote.drawing_reference && <Text style={s.infoRow}>Drawing REF: {quote.drawing_reference}</Text>}
          </View>
        </View>

        {/* Table header */}
        <View style={s.tableHead}>
          <Text style={[s.th, { flex: 1 }]}>Description</Text>
          <Text style={[s.th, { width: 45, textAlign: 'center' }]}>Unit</Text>
          <Text style={[s.th, { width: 55, textAlign: 'right' }]}>Qty</Text>
          <Text style={[s.th, { width: 60, textAlign: 'center' }]}>Sign Off</Text>
        </View>

        <ItemRows list={freeItems} />

        {sections.map(sec => {
          const secItems = items.filter(i => i.section_id === sec.id && !i.is_variation)
          if (secItems.length === 0) return null
          return (
            <View key={sec.id}>
              <View style={s.secRow} wrap={false}>
                <Text style={[s.secLabel, { flex: 1 }]}>{sec.title || 'Untitled Section'}</Text>
              </View>
              <ItemRows list={secItems} indent />
            </View>
          )
        })}

        {/* Sign-off boxes */}
        <View style={s.signBox}>
          <View style={s.signLine}>
            <Text style={s.signLabel}>Inspector / Technician signature</Text>
          </View>
          <View style={s.signLine}>
            <Text style={s.signLabel}>Client / Site agent signature</Text>
          </View>
          <View style={s.signLine}>
            <Text style={s.signLabel}>Date</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{companyName}</Text>
          <Text style={s.footerText}>{quote.quote_number} — {quote.project_name}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
