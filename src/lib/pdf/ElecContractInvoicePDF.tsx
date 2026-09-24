import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecContractInvoice, ElecServiceContract, ElecClient, ElecSettings } from '@/lib/elec-types'
import { planSummary } from '@/lib/contract-format'

/** Tax invoice for one billing period of a support plan. */

const ACCENT = '#1F5C45'
const DARK   = '#18181B'
const MUTED  = '#71717A'
const BORDER = '#E4E4E7'

const s = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 48, paddingBottom: 64 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, alignItems: 'flex-start' },
  company:    { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  meta:       { fontSize: 7.5, color: MUTED, lineHeight: 1.5 },
  title:      { fontSize: 20, fontFamily: 'Helvetica-Bold', color: ACCENT, textAlign: 'right' },
  docMeta:    { fontSize: 8.5, color: MUTED, textAlign: 'right', marginTop: 3 },
  box:        { padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, marginBottom: 18, width: '55%' },
  boxHd:      { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 4, marginBottom: 5 },
  bold:       { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  row:        { fontSize: 8, color: MUTED, marginBottom: 1.5 },
  tableHead:  { flexDirection: 'row', backgroundColor: ACCENT, paddingVertical: 5, paddingHorizontal: 8 },
  th:         { fontSize: 7.5, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  line:       { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  totalsWrap: { marginTop: 14, alignItems: 'flex-end' },
  totalsBox:  { width: 220, padding: 12, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  tRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tBig:       { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 5, marginTop: 2 },
  section:    { marginTop: 20 },
  secTitle:   { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 3, marginBottom: 6 },
  bankRow:    { flexDirection: 'row', gap: 20 },
  bankKey:    { fontSize: 6.5, color: MUTED, marginBottom: 1 },
  bankVal:    { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  footer:     { position: 'absolute', bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: MUTED },
})

const fmtR = (n: number) => 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (iso: string | null) => iso
  ? new Date(iso + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  : '—'

export interface ElecContractInvoicePDFProps {
  invoice: ElecContractInvoice
  contract: ElecServiceContract
  client: ElecClient | null
  settings: ElecSettings | null
  companyName: string
  companyEmail?: string | null
  logoUrl?: string | null
}

export function ElecContractInvoicePDF({ invoice, contract, client, settings, companyName, companyEmail, logoUrl }: ElecContractInvoicePDFProps) {
  const vat = invoice.amount * invoice.vat_rate / 100
  const total = invoice.amount + vat
  const metaParts = [
    settings?.vat_registration_number ? `VAT: ${settings.vat_registration_number}` : null,
    settings?.company_registration_number ? `Reg: ${settings.company_registration_number}` : null,
  ].filter(Boolean).join('  ·  ')

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl && <Image src={logoUrl} style={{ maxWidth: 180, maxHeight: 52, objectFit: 'contain', marginBottom: 4 }} />}
            <Text style={s.company}>{companyName}</Text>
            {companyEmail && <Text style={s.meta}>{companyEmail}</Text>}
            {metaParts ? <Text style={s.meta}>{metaParts}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.title}>TAX INVOICE</Text>
            <Text style={s.docMeta}>{invoice.invoice_number}</Text>
            <Text style={s.docMeta}>Date: {fmtDate(invoice.invoice_date)}</Text>
            {invoice.due_date && <Text style={s.docMeta}>Due: {fmtDate(invoice.due_date)}</Text>}
          </View>
        </View>

        <View style={s.box}>
          <Text style={s.boxHd}>BILL TO</Text>
          <Text style={s.bold}>{client?.client_name ?? '—'}</Text>
          {client?.company && <Text style={s.row}>{client.company}</Text>}
          {client?.vat_number && <Text style={s.row}>VAT: {client.vat_number}</Text>}
          {client?.address && <Text style={s.row}>{client.address}</Text>}
          {client?.email && <Text style={s.row}>{client.email}</Text>}
        </View>

        <View style={s.tableHead}>
          <Text style={[s.th, { flex: 1 }]}>Description</Text>
          <Text style={[s.th, { width: 90, textAlign: 'right' }]}>Amount</Text>
        </View>
        <View style={s.line}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text>{contract.name} — support plan</Text>
            <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 2 }}>
              Period {fmtDate(invoice.period_start)} to {fmtDate(invoice.period_end)}
            </Text>
            <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 2 }}>{planSummary(contract)}</Text>
          </View>
          <Text style={{ width: 90, textAlign: 'right' }}>{fmtR(invoice.amount)}</Text>
        </View>

        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.tRow}><Text style={{ color: MUTED }}>Subtotal (excl. VAT)</Text><Text>{fmtR(invoice.amount)}</Text></View>
            <View style={s.tRow}><Text style={{ color: MUTED }}>VAT ({invoice.vat_rate}%)</Text><Text>{fmtR(vat)}</Text></View>
            <View style={s.tBig}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: ACCENT }}>TOTAL</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: ACCENT }}>{fmtR(total)}</Text>
            </View>
          </View>
        </View>

        {(settings?.bank_name || settings?.bank_account_number) && (
          <View style={s.section}>
            <Text style={s.secTitle}>BANKING DETAILS — please use {invoice.invoice_number} as the reference</Text>
            <View style={s.bankRow}>
              {settings?.bank_name           && <View><Text style={s.bankKey}>Bank</Text><Text style={s.bankVal}>{settings.bank_name}</Text></View>}
              {settings?.bank_account_number && <View><Text style={s.bankKey}>Account</Text><Text style={s.bankVal}>{settings.bank_account_number}</Text></View>}
              {settings?.bank_branch_code    && <View><Text style={s.bankKey}>Branch Code</Text><Text style={s.bankVal}>{settings.bank_branch_code}</Text></View>}
              {settings?.bank_account_type   && <View><Text style={s.bankKey}>Account Type</Text><Text style={s.bankVal}>{settings.bank_account_type}</Text></View>}
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{companyName}</Text>
          <Text style={s.footerText}>{invoice.invoice_number}</Text>
        </View>
      </Page>
    </Document>
  )
}
