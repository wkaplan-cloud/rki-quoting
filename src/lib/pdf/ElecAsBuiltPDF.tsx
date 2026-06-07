import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecSettings, ElecMaterialRequest } from '@/lib/elec-types'

const ACCENT = '#3A7CA5'
const DARK   = '#18181B'
const MUTED  = '#71717A'
const BORDER = '#E4E4E7'
const SURF   = '#F9FAFB'
const GOLD   = '#D9A441'
const GREEN  = '#16A34A'
const DANGER = '#DC2626'
const AB_BG  = '#EFF6FF'

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
  tableHead:  { flexDirection: 'row', backgroundColor: ACCENT, paddingVertical: 5, paddingHorizontal: 6, marginBottom: 0 },
  th:         { fontSize: 7, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  secRow:     { flexDirection: 'row', backgroundColor: AB_BG, paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: BORDER },
  secLabel:   { fontSize: 8, color: ACCENT, fontFamily: 'Helvetica-Bold' },
  row:        { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  rowAlt:     { backgroundColor: SURF },
  td:         { fontSize: 8, color: DARK },
  tdMuted:    { color: MUTED },
  voTag:      { fontSize: 6.5, color: GOLD, fontFamily: 'Helvetica-Bold', marginTop: 1 },
  footer:     { position: 'absolute', bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: MUTED },
})

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface Props {
  quote: ElecQuote
  client: ElecClient | null
  settings: ElecSettings | null
  sections: ElecQuoteSection[]
  items: ElecQuoteLineItem[]
  materials: ElecMaterialRequest[]
  companyName: string
  logoUrl?: string | null
}

export function ElecAsBuiltPDF({ quote, client, settings, sections, items, materials, companyName, logoUrl }: Props) {
  const quoteItems    = items.filter(i => !i.is_variation)
  const voItems       = items.filter(i => i.is_variation)
  const freeItems     = quoteItems.filter(i => i.section_id === null)

  const quoteContract = quoteItems.reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0)
  const quoteAsBuilt  = quoteItems.reduce((s, i) => {
    const qty  = i.as_built_quantity  ?? i.quoted_quantity
    const rate = i.as_built_unit_rate ?? i.quoted_unit_rate
    return s + qty * rate
  }, 0)
  const voAsBuilt     = voItems.reduce((s, i) => {
    const qty  = i.as_built_quantity  ?? i.quoted_quantity
    const rate = i.as_built_unit_rate ?? i.quoted_unit_rate
    return s + qty * rate
  }, 0)
  const totalAsBuilt  = quoteAsBuilt + voAsBuilt
  const variance      = totalAsBuilt - quoteContract
  const completionPct = quoteContract > 0 ? Math.round((totalAsBuilt / quoteContract) * 100) : 0
  // keep contractTotal for the info box
  const contractTotal = quoteContract

  const metaParts = [
    settings?.vat_registration_number    ? `VAT: ${settings.vat_registration_number}`    : null,
    settings?.company_registration_number ? `Reg: ${settings.company_registration_number}` : null,
  ].filter(Boolean).join('  ·  ')

  const MAT_STATUS_COLOR: Record<string, string> = { pending: GOLD, ordered: ACCENT, received: GREEN }

  function ItemRows({ list, indent = false }: { list: ElecQuoteLineItem[]; indent?: boolean }) {
    return (
      <>
        {list.map((item, i) => {
          const cVal  = item.quoted_quantity * item.quoted_unit_rate
          const abQty  = item.as_built_quantity  ?? item.quoted_quantity
          const abRate = item.as_built_unit_rate ?? item.quoted_unit_rate
          const abVal  = abQty * abRate
          const diff   = abVal - cVal
          return (
            <View key={item.id} style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]} wrap={false}>
              <View style={{ flex: 1, paddingRight: 4, paddingLeft: indent ? 8 : 0 }}>
                <Text style={s.td}>{item.description || '—'}</Text>
                {item.is_variation && <Text style={s.voTag}>VO</Text>}
              </View>
              <Text style={[s.td, s.tdMuted, { width: 30, textAlign: 'center' }]}>{item.unit ?? '—'}</Text>
              <Text style={[s.td, s.tdMuted, { width: 40, textAlign: 'right' }]}>{item.quoted_quantity}</Text>
              <Text style={[s.td, s.tdMuted, { width: 62, textAlign: 'right' }]}>{fmtR(item.quoted_unit_rate)}</Text>
              <Text style={[s.td, s.tdMuted, { width: 68, textAlign: 'right' }]}>{fmtR(cVal)}</Text>
              <Text style={[s.td, { width: 40, textAlign: 'right', color: ACCENT }]}>{abQty}</Text>
              <Text style={[s.td, { width: 62, textAlign: 'right', color: ACCENT }]}>{fmtR(abRate)}</Text>
              <Text style={[s.td, { width: 68, textAlign: 'right', fontFamily: 'Helvetica-Bold',
                color: diff > 0.01 ? GOLD : diff < -0.01 ? DANGER : DARK }]}>
                {fmtR(abVal)}
              </Text>
            </View>
          )
        })}
      </>
    )
  }

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl
              ? <Image src={logoUrl} style={{ width: 180, marginBottom: metaParts ? 4 : 0 }} />
              : <Text style={s.company}>{companyName}</Text>
            }
            {metaParts ? <Text style={s.companyMeta}>{metaParts}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docTitle}>AS-BUILT SCHEDULE</Text>
            <Text style={s.docSub}>{quote.project_name}</Text>
            {quote.project_address && <Text style={s.docMeta}>{quote.project_address}</Text>}
            <Text style={s.docMeta}>Printed: {fmtDate(new Date().toISOString().split('T')[0])}</Text>
          </View>
        </View>

        {/* Info + Summary */}
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
            <Text style={s.infoBoxHd}>CONTRACT</Text>
            <Text style={s.infoBold}>{quote.project_name}</Text>
            {quote.quote_number && <Text style={s.infoRow}>Ref: {quote.quote_number}</Text>}
            <Text style={s.infoRow}>Contract Value: {fmtR(contractTotal)}</Text>
          </View>
        </View>

        {/* Summary stats */}
        <View style={s.summaryRow}>
          {[
            { label: 'QUOTE CONTRACT',  val: fmtR(quoteContract),  color: DARK },
            ...(voItems.length > 0 ? [{ label: 'VO AS-BUILT', val: fmtR(voAsBuilt), color: GOLD }] : []),
            { label: 'TOTAL AS-BUILT',  val: fmtR(totalAsBuilt),   color: ACCENT },
            { label: 'VARIANCE',        val: (variance > 0 ? '+' : '') + fmtR(variance), color: variance > 0.01 ? GOLD : variance < -0.01 ? DANGER : GREEN },
            { label: 'COMPLETION',      val: `${completionPct}%`,  color: completionPct >= 100 ? GREEN : DARK },
          ].map(c => (
            <View key={c.label} style={s.summaryBox}>
              <Text style={s.summaryLbl}>{c.label}</Text>
              <Text style={[s.summaryVal, { color: c.color }]}>{c.val}</Text>
            </View>
          ))}
        </View>

        {/* Table */}
        <View style={s.tableHead}>
          <Text style={[s.th, { flex: 1 }]}>Description</Text>
          <Text style={[s.th, { width: 30, textAlign: 'center' }]}>Unit</Text>
          <Text style={[s.th, { width: 40, textAlign: 'right' }]}>C Qty</Text>
          <Text style={[s.th, { width: 62, textAlign: 'right' }]}>C Rate</Text>
          <Text style={[s.th, { width: 68, textAlign: 'right' }]}>C Value</Text>
          <Text style={[s.th, { width: 40, textAlign: 'right' }]}>AB Qty</Text>
          <Text style={[s.th, { width: 62, textAlign: 'right' }]}>AB Rate</Text>
          <Text style={[s.th, { width: 68, textAlign: 'right' }]}>AB Value</Text>
        </View>

        {/* ── Quote Items ── */}
        <ItemRows list={freeItems} />
        {sections.map(sec => {
          const secItems = quoteItems.filter(i => i.section_id === sec.id)
          if (secItems.length === 0) return null
          const secAB = secItems.reduce((sum, i) => {
            const qty  = i.as_built_quantity  ?? i.quoted_quantity
            const rate = i.as_built_unit_rate ?? i.quoted_unit_rate
            return sum + qty * rate
          }, 0)
          return (
            <View key={sec.id}>
              <View style={s.secRow} wrap={false}>
                <Text style={[s.secLabel, { flex: 1 }]}>{sec.title || 'Untitled Section'}</Text>
                <Text style={[s.secLabel, { width: 68, textAlign: 'right' }]}>{fmtR(secAB)}</Text>
              </View>
              <ItemRows list={secItems} indent />
            </View>
          )
        })}

        {/* ── Variation Orders ── */}
        {voItems.length > 0 && (
          <View>
            <View style={[s.secRow, { backgroundColor: '#FEF9EC' }]} wrap={false}>
              <Text style={[s.secLabel, { flex: 1, color: GOLD }]}>VARIATION ORDERS</Text>
              <Text style={[s.secLabel, { width: 68, textAlign: 'right', color: GOLD }]}>
                {fmtR(voItems.reduce((sum, i) => {
                  const qty  = i.as_built_quantity  ?? i.quoted_quantity
                  const rate = i.as_built_unit_rate ?? i.quoted_unit_rate
                  return sum + qty * rate
                }, 0))}
              </Text>
            </View>
            <ItemRows list={voItems} indent />
          </View>
        )}

        {/* ── Materials ── */}
        {materials.length > 0 && (
          <View>
            <View style={[s.secRow, { backgroundColor: '#F0FDF4' }]} wrap={false}>
              <Text style={[s.secLabel, { flex: 1, color: GREEN }]}>MATERIALS</Text>
            </View>
            {/* Materials header */}
            <View style={[s.row, { backgroundColor: SURF }]} wrap={false}>
              <Text style={[s.td, s.tdMuted, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>Description</Text>
              <Text style={[s.td, s.tdMuted, { width: 40, textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>Unit</Text>
              <Text style={[s.td, s.tdMuted, { width: 40, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>Qty</Text>
              <Text style={[s.td, s.tdMuted, { width: 70, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>Status</Text>
            </View>
            {materials.map((m, i) => (
              <View key={m.id} style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]} wrap={false}>
                <View style={{ flex: 1, paddingRight: 4 }}>
                  <Text style={s.td}>{m.description}</Text>
                  {m.notes ? <Text style={[s.td, s.tdMuted, { fontSize: 7 }]}>{m.notes}</Text> : null}
                </View>
                <Text style={[s.td, s.tdMuted, { width: 40, textAlign: 'center' }]}>{m.unit ?? 'nr'}</Text>
                <Text style={[s.td, s.tdMuted, { width: 40, textAlign: 'right' }]}>{m.qty}</Text>
                <Text style={[s.td, { width: 70, textAlign: 'right', color: MAT_STATUS_COLOR[m.status] ?? MUTED }]}>
                  {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{companyName}</Text>
          <Text style={s.footerText}>As-Built Schedule — {quote.project_name}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
