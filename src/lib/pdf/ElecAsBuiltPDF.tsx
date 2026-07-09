import React from 'react'
import { todaySA } from '@/lib/dates'
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

const s = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 40, paddingBottom: 60 },
  // Page header
  header:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'flex-start' },
  company:    { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 3 },
  companyMeta:{ fontSize: 7, color: MUTED, lineHeight: 1.5 },
  docTitle:   { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, textAlign: 'right' },
  docSub:     { fontSize: 8.5, color: MUTED, textAlign: 'right', marginTop: 2 },
  docMeta:    { fontSize: 7.5, color: MUTED, textAlign: 'right', marginTop: 2 },
  // Project info strip
  infoStrip:  { flexDirection: 'row', gap: 0, marginBottom: 14, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  infoCell:   { flex: 1, padding: 8, borderRightWidth: 0.5, borderRightColor: BORDER },
  infoCellLast: { flex: 1, padding: 8 },
  infoLbl:    { fontSize: 6.5, color: MUTED, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4, marginBottom: 3 },
  infoBold:   { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: DARK },
  infoSub:    { fontSize: 7.5, color: MUTED, marginTop: 1 },
  // Financial summary bar
  summaryBar: { flexDirection: 'row', marginBottom: 16, backgroundColor: DARK, borderRadius: 3, overflow: 'hidden' },
  summaryCell:{ flex: 1, padding: 8, borderRightWidth: 0.5, borderRightColor: '#2d2d2d' },
  summaryCellLast: { flex: 1, padding: 8 },
  summaryLbl: { fontSize: 6, color: 'rgba(255,255,255,0.55)', fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 3 },
  summaryVal: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  summaryValAccent: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#7EC8F4' },
  summaryValGold:   { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#F5C842' },
  summaryValGreen:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#4ADE80' },
  summaryValDanger: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#F87171' },
  // Table
  tableHead:  { flexDirection: 'row', backgroundColor: ACCENT, paddingVertical: 5, paddingHorizontal: 6 },
  th:         { fontSize: 7, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  // Section header row
  secRow:     { flexDirection: 'row', backgroundColor: '#EFF6FF', paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: BORDER },
  secLabel:   { fontSize: 8, color: ACCENT, fontFamily: 'Helvetica-Bold' },
  voSecRow:   { flexDirection: 'row', backgroundColor: '#FEFCE8', paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: BORDER },
  voSecLabel: { fontSize: 8, color: GOLD, fontFamily: 'Helvetica-Bold' },
  matSecRow:  { flexDirection: 'row', backgroundColor: '#F0FDF4', paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: BORDER },
  matSecLabel:{ fontSize: 8, color: GREEN, fontFamily: 'Helvetica-Bold' },
  // Data rows
  row:        { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  rowAlt:     { backgroundColor: SURF },
  td:         { fontSize: 8, color: DARK },
  tdMuted:    { color: MUTED },
  voTag:      { fontSize: 6, color: GOLD, fontFamily: 'Helvetica-Bold', marginTop: 1 },
  // Subtotal row
  subtotalRow:{ flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: '#EFF6FF', borderTopWidth: 0.5, borderTopColor: BORDER },
  // Grand total row
  grandTotal: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, backgroundColor: DARK },
  // Footer
  footer:     { position: 'absolute', bottom: 20, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
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

// Column widths — must sum consistently across header + rows
const COL = { unit: 28, cQty: 38, cRate: 56, cVal: 64, labour: 52, abQty: 38, abRate: 56, abVal: 64 }

interface Props {
  quote: ElecQuote
  client: ElecClient | null
  settings: ElecSettings | null
  sections: ElecQuoteSection[]
  items: ElecQuoteLineItem[]
  materials: ElecMaterialRequest[]
  vos: Pick<{ id: string; status: string; value: number }, 'id' | 'status' | 'value'>[]
  companyName: string
  logoUrl?: string | null
}

export function ElecAsBuiltPDF({ quote, client, settings, sections, items, materials, vos, companyName, logoUrl }: Props) {
  const quoteItems = items.filter(i => !i.is_variation)
  const voItems    = items.filter(i => i.is_variation)
  const freeItems  = quoteItems.filter(i => i.section_id === null)

  const itemContractVal = (i: ElecQuoteLineItem) =>
    i.quoted_quantity * i.quoted_unit_rate + i.quoted_quantity * (i.labour_rate ?? 0)
  const itemAsBuiltVal = (i: ElecQuoteLineItem) =>
    (i.as_built_quantity ?? i.quoted_quantity) * (i.as_built_unit_rate ?? i.quoted_unit_rate) + (i.as_built_quantity ?? i.quoted_quantity) * (i.labour_rate ?? 0)

  // Financial totals — use stored VO values to match the QuoteEditor strip exactly
  const originalContract = quoteItems.reduce((s, i) => s + itemContractVal(i), 0)
  const approvedVOValue  = vos.filter(v => v.status === 'approved').reduce((s, v) => s + v.value, 0)
  const revisedContract  = originalContract + approvedVOValue

  const quoteAsBuilt = quoteItems.reduce((s, i) => s + itemAsBuiltVal(i), 0)
  const voAsBuilt    = voItems.reduce((s, i) => s + itemAsBuiltVal(i), 0)
  const totalAsBuilt = quoteAsBuilt + voAsBuilt

  const variance     = totalAsBuilt - revisedContract
  const vatRate      = quote.vat_rate ?? 15
  const totalInclVat = totalAsBuilt * (1 + vatRate / 100)

  const metaParts = [
    settings?.vat_registration_number     ? `VAT Reg: ${settings.vat_registration_number}`    : null,
    settings?.company_registration_number  ? `Reg: ${settings.company_registration_number}`    : null,
  ].filter(Boolean).join('   ·   ')

  const MAT_COLOR: Record<string, string> = { pending: GOLD, ordered: ACCENT, received: GREEN }

  // Reusable line item rows
  function ItemRows({ list, indent = false }: { list: ElecQuoteLineItem[]; indent?: boolean }) {
    return (
      <>
        {list.map((item, i) => {
          const labour = item.labour_rate ?? 0
          const cVal   = itemContractVal(item)
          const abQty  = item.as_built_quantity  ?? item.quoted_quantity
          const abRate = item.as_built_unit_rate ?? item.quoted_unit_rate
          const abVal  = itemAsBuiltVal(item)
          const diff   = abVal - cVal
          return (
            <View key={item.id} style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]} wrap={false}>
              <View style={{ flex: 1, paddingRight: 4, paddingLeft: indent ? 10 : 0 }}>
                <Text style={s.td}>{item.description || '—'}</Text>
              </View>
              <Text style={[s.td, s.tdMuted, { width: COL.unit,   textAlign: 'center' }]}>{item.unit ?? '—'}</Text>
              <Text style={[s.td, s.tdMuted, { width: COL.cQty,   textAlign: 'right'  }]}>{item.quoted_quantity}</Text>
              <Text style={[s.td, s.tdMuted, { width: COL.cRate,  textAlign: 'right'  }]}>{fmtR(item.quoted_unit_rate)}</Text>
              <Text style={[s.td, s.tdMuted, { width: COL.cVal,   textAlign: 'right'  }]}>{fmtR(item.quoted_quantity * item.quoted_unit_rate)}</Text>
              <Text style={[s.td, { width: COL.labour, textAlign: 'right', color: labour > 0 ? GREEN : MUTED }]}>
                {labour > 0 ? fmtR(labour) : '—'}
              </Text>
              <Text style={[s.td, { width: COL.abQty,  textAlign: 'right', color: ACCENT }]}>{abQty}</Text>
              <Text style={[s.td, { width: COL.abRate, textAlign: 'right', color: ACCENT }]}>{fmtR(abRate)}</Text>
              <Text style={[s.td, { width: COL.abVal,  textAlign: 'right', fontFamily: 'Helvetica-Bold',
                color: diff > 0.01 ? GOLD : diff < -0.01 ? DANGER : DARK }]}>
                {fmtR(abVal)}
              </Text>
            </View>
          )
        })}
      </>
    )
  }

  // Section subtotal row
  function SecSubtotal({ contractVal, labourVal, abVal }: { contractVal: number; labourVal: number; abVal: number }) {
    return (
      <View style={s.subtotalRow} wrap={false}>
        <Text style={[s.td, { flex: 1, color: MUTED, fontSize: 7 }]}>Section total</Text>
        <Text style={[s.td, s.tdMuted, { width: COL.unit }]} />
        <Text style={[s.td, s.tdMuted, { width: COL.cQty }]} />
        <Text style={[s.td, s.tdMuted, { width: COL.cRate }]} />
        <Text style={[s.td, { width: COL.cVal,   textAlign: 'right', color: MUTED,  fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>{fmtR(contractVal)}</Text>
        <Text style={[s.td, { width: COL.labour, textAlign: 'right', color: labourVal > 0 ? GREEN : MUTED, fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>{labourVal > 0 ? fmtR(labourVal) : '—'}</Text>
        <Text style={[s.td, { width: COL.abQty }]} />
        <Text style={[s.td, { width: COL.abRate }]} />
        <Text style={[s.td, { width: COL.abVal,  textAlign: 'right', color: ACCENT, fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>{fmtR(abVal)}</Text>
      </View>
    )
  }

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* ── Page Header ── */}
        <View style={s.header} fixed>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl
              ? <Image src={logoUrl} style={{ width: 160, marginBottom: metaParts ? 4 : 0 }} />
              : <Text style={s.company}>{companyName}</Text>}
            {metaParts ? <Text style={s.companyMeta}>{metaParts}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docTitle}>AS-BUILT SCHEDULE</Text>
            <Text style={s.docSub}>{quote.project_name}</Text>
            {quote.project_address && <Text style={s.docMeta}>{quote.project_address}</Text>}
            <Text style={s.docMeta}>Ref: {quote.quote_number}   ·   Printed: {fmtDate(todaySA())}</Text>
          </View>
        </View>

        {/* ── Project Info Strip ── */}
        <View style={s.infoStrip}>
          <View style={s.infoCell}>
            <Text style={s.infoLbl}>CLIENT</Text>
            <Text style={s.infoBold}>{client?.client_name ?? '—'}</Text>
            {client?.email && <Text style={s.infoSub}>{client.email}</Text>}
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLbl}>PROJECT</Text>
            <Text style={s.infoBold}>{quote.project_name}</Text>
            {quote.project_address && <Text style={s.infoSub}>{quote.project_address}</Text>}
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLbl}>CONTRACT TYPE</Text>
            <Text style={s.infoBold}>{quote.contract_type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) ?? 'Lump Sum'}</Text>
          </View>
          <View style={s.infoCellLast}>
            <Text style={s.infoLbl}>DATE</Text>
            <Text style={s.infoBold}>{fmtDate(todaySA())}</Text>
          </View>
        </View>

        {/* ── Financial Summary Bar ── */}
        <View style={s.summaryBar}>
          <View style={s.summaryCell}>
            <Text style={s.summaryLbl}>ORIGINAL CONTRACT (EX VAT)</Text>
            <Text style={s.summaryVal}>{fmtR(originalContract)}</Text>
          </View>
          {voItems.length > 0 && (
            <View style={s.summaryCell}>
              <Text style={s.summaryLbl}>APPROVED VOs</Text>
              <Text style={s.summaryValGold}>{fmtR(approvedVOValue)}</Text>
            </View>
          )}
          {voItems.length > 0 && (
            <View style={s.summaryCell}>
              <Text style={s.summaryLbl}>REVISED CONTRACT (EX VAT)</Text>
              <Text style={s.summaryVal}>{fmtR(revisedContract)}</Text>
            </View>
          )}
          <View style={s.summaryCell}>
            <Text style={s.summaryLbl}>AS-BUILT TOTAL (EX VAT)</Text>
            <Text style={s.summaryValAccent}>{fmtR(totalAsBuilt)}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.summaryLbl}>VARIANCE</Text>
            <Text style={variance > 0.01 ? s.summaryValGold : variance < -0.01 ? s.summaryValDanger : s.summaryValGreen}>
              {(variance > 0 ? '+' : '') + fmtR(variance)}
            </Text>
          </View>
          <View style={s.summaryCellLast}>
            <Text style={s.summaryLbl}>TOTAL INCL. VAT ({vatRate}%)</Text>
            <Text style={s.summaryValAccent}>{fmtR(totalInclVat)}</Text>
          </View>
        </View>

        {/* ── Table Header ── */}
        <View style={s.tableHead}>
          <Text style={[s.th, { flex: 1 }]}>Description</Text>
          <Text style={[s.th, { width: COL.unit,   textAlign: 'center' }]}>Unit</Text>
          <Text style={[s.th, { width: COL.cQty,   textAlign: 'right'  }]}>C Qty</Text>
          <Text style={[s.th, { width: COL.cRate,  textAlign: 'right'  }]}>C Rate</Text>
          <Text style={[s.th, { width: COL.cVal,   textAlign: 'right'  }]}>C Value</Text>
          <Text style={[s.th, { width: COL.labour, textAlign: 'right'  }]}>+ Labour</Text>
          <Text style={[s.th, { width: COL.abQty,  textAlign: 'right'  }]}>AB Qty</Text>
          <Text style={[s.th, { width: COL.abRate, textAlign: 'right'  }]}>AB Rate</Text>
          <Text style={[s.th, { width: COL.abVal,  textAlign: 'right'  }]}>AB Value</Text>
        </View>

        {/* ── Quote Items ── */}
        <ItemRows list={freeItems} />
        {sections.map(sec => {
          const secItems = quoteItems.filter(i => i.section_id === sec.id)
          if (secItems.length === 0) return null
          const secContract = secItems.reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0)
          const secLabour   = secItems.reduce((s, i) => s + i.quoted_quantity * (i.labour_rate ?? 0), 0)
          const secAB       = secItems.reduce((s, i) => s + itemAsBuiltVal(i), 0)
          return (
            <View key={sec.id}>
              <View style={s.secRow} wrap={false}>
                <Text style={[s.secLabel, { flex: 1 }]}>{sec.title || 'Untitled Section'}</Text>
              </View>
              <ItemRows list={secItems} indent />
              <SecSubtotal contractVal={secContract} labourVal={secLabour} abVal={secAB} />
            </View>
          )
        })}

        {/* Quote items subtotal */}
        {quoteItems.length > 0 && (() => {
          const qMatTotal    = quoteItems.reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0)
          const qLabourTotal = quoteItems.reduce((s, i) => s + i.quoted_quantity * (i.labour_rate ?? 0), 0)
          return (
            <View style={[s.subtotalRow, { backgroundColor: '#DBEAFE' }]} wrap={false}>
              <Text style={[s.td, { flex: 1, fontFamily: 'Helvetica-Bold', color: ACCENT }]}>Quote Items Total</Text>
              <Text style={{ width: COL.unit + COL.cQty + COL.cRate }} />
              <Text style={[s.td, { width: COL.cVal,   textAlign: 'right', fontFamily: 'Helvetica-Bold', color: MUTED  }]}>{fmtR(qMatTotal)}</Text>
              <Text style={[s.td, { width: COL.labour, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: qLabourTotal > 0 ? GREEN : MUTED }]}>{qLabourTotal > 0 ? fmtR(qLabourTotal) : '—'}</Text>
              <Text style={{ width: COL.abQty + COL.abRate }} />
              <Text style={[s.td, { width: COL.abVal,  textAlign: 'right', fontFamily: 'Helvetica-Bold', color: ACCENT }]}>{fmtR(quoteAsBuilt)}</Text>
            </View>
          )
        })()}

        {/* ── Variation Orders ── */}
        {voItems.length > 0 && (
          <View>
            <View style={s.voSecRow} wrap={false}>
              <Text style={[s.voSecLabel, { flex: 1 }]}>VARIATION ORDERS</Text>
            </View>
            <ItemRows list={voItems} indent />
            <View style={[s.subtotalRow, { backgroundColor: '#FEFCE8' }]} wrap={false}>
              <Text style={[s.td, { flex: 1, fontFamily: 'Helvetica-Bold', color: GOLD }]}>Variation Orders Total</Text>
              <Text style={{ width: COL.unit + COL.cQty + COL.cRate }} />
              <Text style={[s.td, { width: COL.cVal,   textAlign: 'right', fontFamily: 'Helvetica-Bold', color: MUTED }]}>{fmtR(voItems.reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0))}</Text>
              <Text style={[s.td, { width: COL.labour, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: GREEN }]}>{fmtR(voItems.reduce((s, i) => s + i.quoted_quantity * (i.labour_rate ?? 0), 0))}</Text>
              <Text style={{ width: COL.abQty + COL.abRate }} />
              <Text style={[s.td, { width: COL.abVal,  textAlign: 'right', fontFamily: 'Helvetica-Bold', color: GOLD }]}>{fmtR(voAsBuilt)}</Text>
            </View>
          </View>
        )}

        {/* ── Grand Total Row ── */}
        {(() => {
          const totalMat    = items.reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0)
          const totalLabour = items.reduce((s, i) => s + i.quoted_quantity * (i.labour_rate ?? 0), 0)
          return (
            <View style={s.grandTotal} wrap={false}>
              <Text style={[s.td, { flex: 1, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }]}>GRAND TOTAL (EX VAT)</Text>
              <Text style={{ width: COL.unit + COL.cQty + COL.cRate }} />
              <Text style={[s.td, { width: COL.cVal,   textAlign: 'right', fontFamily: 'Helvetica-Bold', color: 'rgba(255,255,255,0.55)' }]}>{fmtR(totalMat)}</Text>
              <Text style={[s.td, { width: COL.labour, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#4ADE80' }]}>{fmtR(totalLabour)}</Text>
              <Text style={{ width: COL.abQty + COL.abRate }} />
              <Text style={[s.td, { width: COL.abVal,  textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#7EC8F4' }]}>{fmtR(totalAsBuilt)}</Text>
            </View>
          )
        })()}

        {/* ── VAT & Total summary ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, marginBottom: 4 }} wrap={false}>
          <View style={{ width: 240 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER }}>
              <Text style={{ fontSize: 8, color: MUTED }}>Total (ex VAT)</Text>
              <Text style={{ fontSize: 8, color: DARK, fontFamily: 'Helvetica-Bold' }}>{fmtR(totalAsBuilt)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER }}>
              <Text style={{ fontSize: 8, color: MUTED }}>VAT ({vatRate}%)</Text>
              <Text style={{ fontSize: 8, color: DARK }}>{fmtR(totalAsBuilt * vatRate / 100)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: ACCENT, borderRadius: 2 }}>
              <Text style={{ fontSize: 9, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' }}>TOTAL (INCL. VAT)</Text>
              <Text style={{ fontSize: 9, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' }}>{fmtR(totalInclVat)}</Text>
            </View>
          </View>
        </View>


        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{companyName}</Text>
          <Text style={s.footerText}>As-Built Schedule — {quote.project_name}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
