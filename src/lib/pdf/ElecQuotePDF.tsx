import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecSettings } from '@/lib/elec-types'

const ACCENT = '#3A7CA5'
const DARK   = '#18181B'
const MUTED  = '#71717A'
const BORDER = '#E4E4E7'
const SURF   = '#F9FAFB'
const AB     = '#EFF6FF'

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 48, paddingBottom: 64 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, alignItems: 'flex-start' },
  company:     { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 3 },
  companyMeta: { fontSize: 7, color: MUTED, lineHeight: 1.5 },
  docTitle:    { fontSize: 20, fontFamily: 'Helvetica-Bold', color: ACCENT, textAlign: 'right' },
  docNum:      { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 4 },
  docMeta:     { fontSize: 7.5, color: MUTED, textAlign: 'right', marginTop: 2 },
  infoGrid:    { flexDirection: 'row', gap: 12, marginBottom: 18 },
  infoBox:     { flex: 1, padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  infoBoxHd:   { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 4, marginBottom: 5 },
  infoBold:    { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 },
  infoRow:     { fontSize: 8, color: MUTED, marginBottom: 2 },
  tableHead:   { flexDirection: 'row', backgroundColor: ACCENT, paddingVertical: 5, paddingHorizontal: 8, marginTop: 2 },
  th:          { fontSize: 7.5, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  secRow:      { flexDirection: 'row', backgroundColor: AB, paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: BORDER },
  secLabel:    { fontSize: 8, color: ACCENT, fontFamily: 'Helvetica-Bold' },
  row:         { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  rowAlt:      { backgroundColor: SURF },
  td:          { fontSize: 8.5, color: DARK },
  tdMuted:     { color: MUTED },
  totalsWrap:  { marginTop: 14, alignItems: 'flex-end' },
  totalsBox:   { width: 230, padding: 12, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  tRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tLabel:      { fontSize: 8, color: MUTED },
  tVal:        { fontSize: 8, color: DARK },
  tDivider:    { borderTopWidth: 0.5, borderTopColor: BORDER, marginVertical: 5 },
  tBig:        { flexDirection: 'row', justifyContent: 'space-between' },
  tBigLabel:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ACCENT },
  tBigVal:     { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ACCENT },
  section:     { marginTop: 16 },
  secTitle:    { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 3, marginBottom: 6 },
  secBody:     { fontSize: 8, color: DARK, lineHeight: 1.5 },
  bankRow:     { flexDirection: 'row', gap: 20, marginTop: 4 },
  bankKey:     { fontSize: 6.5, color: MUTED, marginBottom: 1 },
  bankVal:     { fontSize: 8.5, color: DARK, fontFamily: 'Helvetica-Bold' },
  footer:      { position: 'absolute', bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:  { fontSize: 7, color: MUTED },
})

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

export interface ElecQuotePDFProps {
  quote: ElecQuote
  client: ElecClient | null
  sections: ElecQuoteSection[]
  items: ElecQuoteLineItem[]
  settings: ElecSettings | null
  companyName: string
}

export function ElecQuotePDF({ quote, client, sections, items, settings, companyName }: ElecQuotePDFProps) {
  const freeItems    = items.filter(i => i.section_id === null)
  const contractTotal = items.reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0)
  const vatRate       = quote.vat_rate ?? settings?.default_vat_rate ?? 15
  const vatAmount     = contractTotal * (vatRate / 100)
  const grandTotal    = contractTotal + vatAmount

  const CONTRACT_TYPE: Record<string, string> = {
    lump_sum: 'Lump Sum', re_measurement: 'Re-Measurement', cost_plus: 'Cost Plus',
  }

  function ItemRows({ list, indent = false }: { list: ElecQuoteLineItem[]; indent?: boolean }) {
    return (
      <>
        {list.map((item, i) => (
          <View key={item.id} style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]} wrap={false}>
            <View style={{ flex: 1, paddingRight: 4, paddingLeft: indent ? 8 : 0 }}>
              <Text style={s.td}>{item.description || '—'}</Text>
              {item.is_variation && (
                <Text style={{ fontSize: 6.5, color: '#D9A441', marginTop: 1 }}>VARIATION ORDER</Text>
              )}
            </View>
            <Text style={[s.td, s.tdMuted, { width: 40, textAlign: 'center' }]}>{item.unit ?? '—'}</Text>
            <Text style={[s.td, { width: 50, textAlign: 'right' }]}>{item.quoted_quantity}</Text>
            <Text style={[s.td, { width: 80, textAlign: 'right' }]}>{fmtR(item.quoted_unit_rate)}</Text>
            <Text style={[s.td, { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
              {fmtR(item.quoted_quantity * item.quoted_unit_rate)}
            </Text>
          </View>
        ))}
      </>
    )
  }

  const metaParts = [
    settings?.vat_registration_number  ? `VAT: ${settings.vat_registration_number}`   : null,
    settings?.company_registration_number ? `Reg: ${settings.company_registration_number}` : null,
    settings?.cidb_registration_number ? `CIDB: ${settings.cidb_registration_number}` : null,
  ].filter(Boolean).join('  ·  ')

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.company}>{companyName}</Text>
            {metaParts ? <Text style={s.companyMeta}>{metaParts}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docTitle}>QUOTATION</Text>
            <Text style={s.docNum}>{quote.quote_number}</Text>
            <Text style={s.docMeta}>Date: {fmtDate(quote.quoted_date ?? new Date().toISOString().split('T')[0])}</Text>
            {quote.payment_terms_days > 0 && (
              <Text style={s.docMeta}>Payment terms: {quote.payment_terms_days} days</Text>
            )}
          </View>
        </View>

        {/* Bill To / Project */}
        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>BILL TO</Text>
            {client ? (
              <>
                <Text style={s.infoBold}>{client.client_name}</Text>
                {client.company       && <Text style={s.infoRow}>{client.company}</Text>}
                {client.email         && <Text style={s.infoRow}>{client.email}</Text>}
                {client.contact_number && <Text style={s.infoRow}>{client.contact_number}</Text>}
                {client.address       && <Text style={s.infoRow}>{client.address}</Text>}
              </>
            ) : (
              <Text style={s.infoRow}>—</Text>
            )}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>PROJECT</Text>
            <Text style={s.infoBold}>{quote.project_name}</Text>
            {quote.project_address && <Text style={s.infoRow}>{quote.project_address}</Text>}
            <Text style={s.infoRow}>{CONTRACT_TYPE[quote.contract_type] ?? quote.contract_type}</Text>
            {quote.expected_completion_date && (
              <Text style={s.infoRow}>Est. completion: {fmtDate(quote.expected_completion_date)}</Text>
            )}
          </View>
        </View>

        {/* Table */}
        <View style={s.tableHead}>
          <Text style={[s.th, { flex: 1 }]}>Description</Text>
          <Text style={[s.th, { width: 40, textAlign: 'center' }]}>Unit</Text>
          <Text style={[s.th, { width: 50, textAlign: 'right' }]}>Qty</Text>
          <Text style={[s.th, { width: 80, textAlign: 'right' }]}>Unit Rate</Text>
          <Text style={[s.th, { width: 80, textAlign: 'right' }]}>Amount</Text>
        </View>

        <ItemRows list={freeItems} />

        {sections.map(sec => {
          const secItems = items.filter(i => i.section_id === sec.id)
          if (secItems.length === 0) return null
          const secTotal = secItems.reduce((sum, i) => sum + i.quoted_quantity * i.quoted_unit_rate, 0)
          return (
            <View key={sec.id}>
              <View style={s.secRow} wrap={false}>
                <Text style={[s.secLabel, { flex: 1 }]}>{sec.title || 'Untitled Section'}</Text>
                <Text style={[s.secLabel, { width: 80, textAlign: 'right' }]}>{fmtR(secTotal)}</Text>
              </View>
              <ItemRows list={secItems} indent />
            </View>
          )
        })}

        {/* Totals */}
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.tRow}>
              <Text style={s.tLabel}>Subtotal (excl. VAT)</Text>
              <Text style={s.tVal}>{fmtR(contractTotal)}</Text>
            </View>
            <View style={s.tRow}>
              <Text style={s.tLabel}>VAT ({vatRate}%)</Text>
              <Text style={s.tVal}>{fmtR(vatAmount)}</Text>
            </View>
            <View style={s.tDivider} />
            <View style={s.tBig}>
              <Text style={s.tBigLabel}>TOTAL</Text>
              <Text style={s.tBigVal}>{fmtR(grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Bank details */}
        {(settings?.bank_name || settings?.bank_account_number) && (
          <View style={s.section}>
            <Text style={s.secTitle}>BANKING DETAILS</Text>
            <View style={s.bankRow}>
              {settings?.bank_name           && <View><Text style={s.bankKey}>Bank</Text><Text style={s.bankVal}>{settings.bank_name}</Text></View>}
              {settings?.bank_account_number && <View><Text style={s.bankKey}>Account</Text><Text style={s.bankVal}>{settings.bank_account_number}</Text></View>}
              {settings?.bank_branch_code    && <View><Text style={s.bankKey}>Branch Code</Text><Text style={s.bankVal}>{settings.bank_branch_code}</Text></View>}
              {settings?.bank_account_type   && <View><Text style={s.bankKey}>Account Type</Text><Text style={s.bankVal}>{settings.bank_account_type}</Text></View>}
            </View>
          </View>
        )}

        {/* Notes */}
        {quote.notes && (
          <View style={s.section}>
            <Text style={s.secTitle}>NOTES</Text>
            <Text style={s.secBody}>{quote.notes}</Text>
          </View>
        )}

        {settings?.email_footer_text && (
          <View style={s.section}>
            <Text style={s.secBody}>{settings.email_footer_text}</Text>
          </View>
        )}

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
