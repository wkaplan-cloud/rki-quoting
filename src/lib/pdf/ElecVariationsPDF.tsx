import React from 'react'
import { todaySA } from '@/lib/dates'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecQuote, ElecClient, ElecSettings, ElecVariationOrder, ElecQuoteLineItem } from '@/lib/elec-types'

const ACCENT  = '#3A7CA5'
const DARK    = '#18181B'
const MUTED   = '#71717A'
const BORDER  = '#E4E4E7'
const SURF    = '#F9FAFB'
const GOLD    = '#D9A441'
const GREEN   = '#16A34A'
const DANGER  = '#DC2626'

const STATUS_COLOR: Record<string, string> = {
  pending:  GOLD,
  approved: GREEN,
  rejected: DANGER,
}
// Fixed column widths (A4 content width = 499pt; Description takes the remainder)
const COL = { vo: 80, status: 46, value: 74, requested: 66, approved: 54 }
const GAP = 6

const STATUS_LABEL: Record<string, string> = {
  pending:  'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
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
  itemRow:    { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#F1F1F3' },
  itemDesc:   { fontSize: 7.5, color: MUTED, lineHeight: 1.3 },
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  totalsBox:  { width: 240, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, padding: 10 },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLbl:   { fontSize: 8, color: MUTED },
  totalVal:   { fontSize: 8, color: DARK },
  grandRow:   { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 5, marginTop: 3 },
  grandLbl:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK },
  grandVal:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ACCENT },
  footer:     { position: 'absolute', bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: MUTED },
})

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Keeps a short value from breaking across two lines mid-token (e.g. "R 443,70")
function nbsp(v: string) {
  return v.replace(/ /g, '\u00A0')
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  quote: ElecQuote
  client: ElecClient | null
  settings: ElecSettings | null
  variationOrders: ElecVariationOrder[]
  lineItems?: ElecQuoteLineItem[]
  companyName: string
  companyEmail?: string | null
  logoUrl?: string | null
}

export function ElecVariationsPDF({ quote, client, settings, variationOrders, lineItems = [], companyName, companyEmail, logoUrl }: Props) {
  const itemsByVO = lineItems.reduce<Record<string, ElecQuoteLineItem[]>>((acc, li) => {
    if (!li.variation_order_id) return acc
    ;(acc[li.variation_order_id] ??= []).push(li)
    return acc
  }, {})
  const totalApproved = variationOrders.filter(v => v.status === 'approved').reduce((s, v) => s + v.value, 0)
  const totalPending  = variationOrders.filter(v => v.status === 'pending').reduce((s, v) => s + v.value, 0)
  const totalAll      = variationOrders.reduce((s, v) => s + v.value, 0)
  const vatRate       = quote.vat_rate ?? 15
  const vatAmount     = totalAll * (vatRate / 100)
  const totalIncVat   = totalAll + vatAmount

  const metaParts = [
    settings?.vat_registration_number    ? `VAT: ${settings.vat_registration_number}`    : null,
    settings?.company_registration_number ? `Reg: ${settings.company_registration_number}` : null,
    settings?.cidb_registration_number    ? `Lic: ${settings.cidb_registration_number}`    : null,
  ].filter(Boolean).join('  ·  ')

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl && <Image src={logoUrl} style={{ width: 160, marginBottom: 4 }} />}
            <Text style={s.company}>{companyName}</Text>
            {companyEmail ? <Text style={s.companyMeta}>{companyEmail}</Text> : null}
            {metaParts ? <Text style={s.companyMeta}>{metaParts}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docTitle}>VARIATION ORDERS</Text>
            <Text style={s.docSub}>{quote.project_name}</Text>
            {quote.project_address && <Text style={s.docMeta}>{quote.project_address}</Text>}
            <Text style={s.docMeta}>Printed: {fmtDate(todaySA())}</Text>
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
            { label: 'APPROVED VOs', val: fmtR(totalApproved), color: GREEN },
            { label: 'PENDING VOs',  val: fmtR(totalPending),  color: GOLD },
            { label: 'TOTAL COUNT',  val: String(variationOrders.length), color: DARK },
            { label: 'TOTAL VALUE',  val: fmtR(totalAll),       color: ACCENT },
          ].map(c => (
            <View key={c.label} style={s.summaryBox}>
              <Text style={s.summaryLbl}>{c.label}</Text>
              <Text style={[s.summaryVal, { color: c.color }]}>{c.val}</Text>
            </View>
          ))}
        </View>

        {/* Table */}
        {variationOrders.length === 0 ? (
          <View style={{ padding: 20, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: MUTED }}>No variation orders for this project.</Text>
          </View>
        ) : (
          <>
            <View style={s.tableHead}>
              <Text style={[s.th, { width: COL.vo, paddingRight: GAP }]}>VO Number</Text>
              <Text style={[s.th, { flex: 1, paddingRight: GAP }]}>Description</Text>
              <Text style={[s.th, { width: COL.status, textAlign: 'center', paddingRight: GAP }]}>Status</Text>
              <Text style={[s.th, { width: COL.value, textAlign: 'right', paddingRight: GAP }]}>Value</Text>
              <Text style={[s.th, { width: COL.requested, paddingRight: GAP }]}>Requested By</Text>
              <Text style={[s.th, { width: COL.approved }]}>Approved</Text>
            </View>

            {variationOrders.map((vo, i) => (
              <React.Fragment key={vo.id}>
              <View style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]} wrap={false}>
                <Text style={[s.td, { width: COL.vo, paddingRight: GAP, fontSize: 7.5, fontFamily: 'Helvetica-Bold' }]}>{vo.vo_number}</Text>
                <View style={{ flex: 1, paddingRight: GAP }}>
                  <Text style={s.td}>{vo.description}</Text>
                  {vo.notes && <Text style={[s.td, s.tdMuted, { fontSize: 7.5, fontStyle: 'italic', marginTop: 1 }]}>{vo.notes}</Text>}
                </View>
                <Text style={[s.td, { width: COL.status, paddingRight: GAP, textAlign: 'center', color: STATUS_COLOR[vo.status] ?? MUTED, fontFamily: 'Helvetica-Bold', fontSize: 7.5 }]}>
                  {STATUS_LABEL[vo.status] ?? vo.status}
                </Text>
                <Text style={[s.td, { width: COL.value, paddingRight: GAP, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: ACCENT }]}>{nbsp(fmtR(vo.value))}</Text>
                <Text style={[s.td, s.tdMuted, { width: COL.requested, paddingRight: GAP, fontSize: 7.5 }]}>{vo.requested_by ?? '—'}</Text>
                <Text style={[s.td, s.tdMuted, { width: COL.approved, fontSize: 7.5 }]}>{nbsp(fmtDate(vo.approved_date))}</Text>
              </View>
              {(itemsByVO[vo.id] ?? []).map(li => {
                const rate = li.quoted_unit_rate + (li.labour_rate ?? 0)
                const qty  = li.quoted_quantity.toLocaleString('en-ZA', { maximumFractionDigits: 2 })
                return (
                  <View key={li.id} style={[s.itemRow, i % 2 !== 0 ? s.rowAlt : {}]} wrap={false}>
                    <View style={{ width: COL.vo, paddingRight: GAP }} />
                    <Text style={[s.itemDesc, { flex: 1, paddingRight: GAP }]}>
                      {'\u2022  '}{li.description}{'   @ '}{fmtR(rate)}
                    </Text>
                    <Text style={[s.itemDesc, { width: COL.status, paddingRight: GAP, textAlign: 'center' }]}>
                      {nbsp(`${qty}${li.unit ? ` ${li.unit}` : ''}`)}
                    </Text>
                    <Text style={[s.itemDesc, { width: COL.value, paddingRight: GAP, textAlign: 'right' }]}>{nbsp(fmtR(li.quoted_quantity * rate))}</Text>
                    <View style={{ width: COL.requested, paddingRight: GAP }} />
                    <View style={{ width: COL.approved }} />
                  </View>
                )
              })}
              </React.Fragment>
            ))}
          </>
        )}

        {/* Totals */}
        {variationOrders.length > 0 && (
          <View style={s.totalsWrap} wrap={false}>
            <View style={s.totalsBox}>
              <View style={s.totalRow}>
                <Text style={s.totalLbl}>Approved variations (excl VAT)</Text>
                <Text style={[s.totalVal, { color: GREEN }]}>{nbsp(fmtR(totalApproved))}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLbl}>Pending variations (excl VAT)</Text>
                <Text style={[s.totalVal, { color: GOLD }]}>{nbsp(fmtR(totalPending))}</Text>
              </View>
              <View style={[s.totalRow, { borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 5, marginTop: 3 }]}>
                <Text style={s.totalLbl}>Total variations (excl VAT)</Text>
                <Text style={s.totalVal}>{nbsp(fmtR(totalAll))}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLbl}>VAT ({vatRate}%)</Text>
                <Text style={s.totalVal}>{nbsp(fmtR(vatAmount))}</Text>
              </View>
              <View style={s.grandRow}>
                <Text style={s.grandLbl}>Total (incl VAT)</Text>
                <Text style={s.grandVal}>{nbsp(fmtR(totalIncVat))}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{companyName}</Text>
          <Text style={s.footerText}>Variation Orders — {quote.project_name}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
