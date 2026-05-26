import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecCOC, ElecQuote, ElecClient, ElecSettings } from '@/lib/elec-types'

const ACCENT = '#3A7CA5'
const DARK   = '#18181B'
const MUTED  = '#71717A'
const BORDER = '#E4E4E7'
const SURF   = '#F9FAFB'
const GREEN  = '#16A34A'

const s = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 48, paddingBottom: 64 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, alignItems: 'flex-start' },
  company:    { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 3 },
  companyMeta:{ fontSize: 7, color: MUTED, lineHeight: 1.5 },
  docTitle:   { fontSize: 18, fontFamily: 'Helvetica-Bold', color: GREEN, textAlign: 'right' },
  docNum:     { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 4 },
  docMeta:    { fontSize: 7.5, color: MUTED, textAlign: 'right', marginTop: 2 },
  actNote:    { fontSize: 7, color: MUTED, textAlign: 'right', marginTop: 6, fontStyle: 'italic' },
  infoGrid:   { flexDirection: 'row', gap: 12, marginBottom: 16 },
  infoBox:    { flex: 1, padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  infoBoxHd:  { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 4, marginBottom: 5 },
  infoBold:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 },
  infoRow:    { fontSize: 8, color: MUTED, marginBottom: 2 },
  section:    { marginBottom: 14 },
  secTitle:   { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 3, marginBottom: 6 },
  fieldGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  fieldCell:  { width: '50%', paddingRight: 12, marginBottom: 10 },
  fieldLabel: { fontSize: 6.5, color: MUTED, marginBottom: 2 },
  fieldVal:   { fontSize: 9, color: DARK, fontFamily: 'Helvetica-Bold' },
  descBox:    { padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, backgroundColor: SURF, marginBottom: 14 },
  descText:   { fontSize: 8.5, color: DARK, lineHeight: 1.6 },
  certBox:    { padding: 12, borderWidth: 1, borderColor: GREEN, borderRadius: 4, backgroundColor: '#F0FDF4', marginBottom: 14 },
  certTitle:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: GREEN, marginBottom: 6 },
  certText:   { fontSize: 8, color: '#166534', lineHeight: 1.6 },
  sigRow:     { flexDirection: 'row', gap: 20, marginTop: 6 },
  sigBox:     { flex: 1, borderTopWidth: 0.5, borderTopColor: DARK, paddingTop: 4 },
  sigLabel:   { fontSize: 7, color: MUTED },
  notesBox:   { padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, backgroundColor: SURF },
  notesText:  { fontSize: 8, color: MUTED, lineHeight: 1.5 },
  footer:     { position: 'absolute', bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: MUTED },
})

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface Props {
  coc: ElecCOC
  quote: ElecQuote
  client: ElecClient | null
  settings: ElecSettings | null
  companyName: string
  logoUrl?: string | null
}

export function ElecCOCPDF({ coc, quote, client, settings, companyName, logoUrl }: Props) {
  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl
              ? <Image src={logoUrl} style={{ maxWidth: 180, maxHeight: 52, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 4 }} />
              : <Text style={s.company}>{companyName}</Text>
            }
            {settings?.vat_registration_number && <Text style={s.companyMeta}>VAT Reg: {settings.vat_registration_number}</Text>}
            {settings?.company_registration_number && <Text style={s.companyMeta}>Reg: {settings.company_registration_number}</Text>}
          </View>
          <View>
            <Text style={s.docTitle}>CERTIFICATE OF{'\n'}COMPLIANCE</Text>
            <Text style={s.docNum}>{coc.coc_number}</Text>
            <Text style={s.docMeta}>Issue Date: {fmtDate(coc.issue_date)}</Text>
            {coc.valid_until && <Text style={s.docMeta}>Valid Until: {fmtDate(coc.valid_until)}</Text>}
            <Text style={s.actNote}>Issued in terms of the OHS Act 85 of 1993</Text>
          </View>
        </View>

        {/* Info grid — FROM + TO */}
        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>FROM — ELECTRICAL CONTRACTOR</Text>
            <Text style={s.infoBold}>{companyName}</Text>
            {settings?.cidb_registration_number && <Text style={s.infoRow}>CIDB: {settings.cidb_registration_number}</Text>}
            {settings?.vat_registration_number && <Text style={s.infoRow}>VAT: {settings.vat_registration_number}</Text>}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>CLIENT / PROPERTY OWNER</Text>
            {client ? (
              <>
                <Text style={s.infoBold}>{client.client_name}</Text>
                {client.company && <Text style={s.infoRow}>{client.company}</Text>}
                {client.email && <Text style={s.infoRow}>{client.email}</Text>}
              </>
            ) : (
              <Text style={s.infoRow}>—</Text>
            )}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>PROJECT</Text>
            <Text style={s.infoBold}>{quote.project_name}</Text>
            {quote.quote_number && <Text style={s.infoRow}>Quote ref: {quote.quote_number}</Text>}
          </View>
        </View>

        {/* Installation description */}
        <View style={s.section}>
          <Text style={s.secTitle}>INSTALLATION DESCRIPTION</Text>
          <View style={s.descBox}>
            <Text style={s.descText}>
              {coc.installation_description || 'No description provided.'}
            </Text>
          </View>
        </View>

        {/* Tester details */}
        <View style={s.section}>
          <Text style={s.secTitle}>TESTER DETAILS</Text>
          <View style={s.fieldGrid}>
            <View style={s.fieldCell}>
              <Text style={s.fieldLabel}>TESTER NAME</Text>
              <Text style={s.fieldVal}>{coc.tester_name || '—'}</Text>
            </View>
            <View style={s.fieldCell}>
              <Text style={s.fieldLabel}>REGISTRATION NUMBER</Text>
              <Text style={s.fieldVal}>{coc.tester_registration_number || '—'}</Text>
            </View>
            <View style={s.fieldCell}>
              <Text style={s.fieldLabel}>ISSUE DATE</Text>
              <Text style={s.fieldVal}>{fmtDate(coc.issue_date)}</Text>
            </View>
            <View style={s.fieldCell}>
              <Text style={s.fieldLabel}>VALID UNTIL</Text>
              <Text style={s.fieldVal}>{coc.valid_until ? fmtDate(coc.valid_until) : 'No expiry specified'}</Text>
            </View>
          </View>
        </View>

        {/* Declaration */}
        <View style={s.certBox}>
          <Text style={s.certTitle}>DECLARATION</Text>
          <Text style={s.certText}>
            I, {coc.tester_name || '[Tester Name]'}{coc.tester_registration_number ? ` (Reg. No. ${coc.tester_registration_number})` : ''}, hereby certify that the electrical installation described above has been inspected and tested in accordance with SANS 10142-1 and complies with the requirements of the Occupational Health and Safety Act, Act 85 of 1993, and the Electrical Installation Regulations of 2009.
          </Text>
        </View>

        {/* Notes */}
        {coc.notes && (
          <View style={s.section}>
            <Text style={s.secTitle}>NOTES</Text>
            <View style={s.notesBox}>
              <Text style={s.notesText}>{coc.notes}</Text>
            </View>
          </View>
        )}

        {/* Signature row */}
        <View style={[s.sigRow, { marginTop: 24 }]}>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Tester Signature</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Date</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Client / Owner Signature</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          {settings?.email_footer_text
            ? <Text style={s.footerText}>{settings.email_footer_text}</Text>
            : <Text style={s.footerText}>{companyName}</Text>
          }
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
