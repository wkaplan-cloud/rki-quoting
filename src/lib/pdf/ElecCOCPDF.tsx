import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecCOC, ElecQuote, ElecClient, ElecSettings } from '@/lib/elec-types'

const ACCENT  = '#3A7CA5'
const DARK    = '#18181B'
const MUTED   = '#71717A'
const BORDER  = '#E4E4E7'
const SURF    = '#F9FAFB'
const GREEN   = '#16A34A'
const DANGER  = '#DC2626'
const GOLD    = '#D9A441'

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 44, paddingBottom: 64 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, alignItems: 'flex-start' },
  company:     { fontSize: 13, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 },
  companyMeta: { fontSize: 7, color: MUTED, lineHeight: 1.5 },
  docTitle:    { fontSize: 16, fontFamily: 'Helvetica-Bold', color: GREEN, textAlign: 'right' },
  docNum:      { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 3 },
  docMeta:     { fontSize: 7.5, color: MUTED, textAlign: 'right', marginTop: 2 },
  actNote:     { fontSize: 6.5, color: MUTED, textAlign: 'right', marginTop: 5, fontStyle: 'italic' },

  secWrap:     { marginBottom: 12 },
  secTitle:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  secLetter:   { width: 16, height: 16, backgroundColor: ACCENT, borderRadius: 2, marginRight: 6, justifyContent: 'center', alignItems: 'center' },
  secLetterTx: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
  secLabel:    { fontSize: 8, fontFamily: 'Helvetica-Bold', color: DARK, letterSpacing: 0.5, textTransform: 'uppercase' },

  infoGrid:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  infoBox:     { flex: 1, padding: 9, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  infoBoxHd:   { fontSize: 6, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 3, marginBottom: 4 },
  infoBold:    { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 1.5 },
  infoRow:     { fontSize: 7.5, color: MUTED, marginBottom: 1.5 },

  row2:        { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fieldCell:   { flex: 1 },
  fieldLabel:  { fontSize: 6, color: MUTED, letterSpacing: 0.3, marginBottom: 1.5 },
  fieldVal:    { fontSize: 8.5, color: DARK, fontFamily: 'Helvetica-Bold' },

  descBox:     { padding: 9, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, backgroundColor: SURF, marginBottom: 10 },
  descText:    { fontSize: 8, color: DARK, lineHeight: 1.6 },

  testGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  testCell:    { width: '48%', padding: 7, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, backgroundColor: SURF, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  testLabel:   { fontSize: 7.5, color: DARK, flex: 1, marginRight: 8 },
  testBadge:   { fontSize: 7, fontFamily: 'Helvetica-Bold', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10 },

  certBox:     { padding: 10, borderWidth: 1, borderColor: GREEN, borderRadius: 4, backgroundColor: '#F0FDF4', marginBottom: 10 },
  certTitle:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GREEN, marginBottom: 4 },
  certText:    { fontSize: 7.5, color: '#166534', lineHeight: 1.6 },

  sigRow:      { flexDirection: 'row', gap: 16, marginTop: 14 },
  sigBox:      { flex: 1, borderTopWidth: 0.5, borderTopColor: DARK, paddingTop: 4 },
  sigLabel:    { fontSize: 7, color: MUTED },

  notesBox:    { padding: 9, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, backgroundColor: SURF },
  notesText:   { fontSize: 7.5, color: MUTED, lineHeight: 1.5 },

  footer:      { position: 'absolute', bottom: 22, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:  { fontSize: 6.5, color: MUTED },
})

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function SecHead({ letter, title }: { letter: string; title: string }) {
  return (
    <View style={s.secTitle}>
      <View style={s.secLetter}><Text style={s.secLetterTx}>{letter}</Text></View>
      <Text style={s.secLabel}>{title}</Text>
    </View>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fieldCell}>
      <Text style={s.fieldLabel}>{label.toUpperCase()}</Text>
      <Text style={s.fieldVal}>{value || '—'}</Text>
    </View>
  )
}

function TestBadge({ result }: { result: string | null | undefined }) {
  const v = result ?? 'pass'
  const color   = v === 'pass' ? GREEN : v === 'fail' ? DANGER : MUTED
  const bgColor = v === 'pass' ? '#F0FDF4' : v === 'fail' ? '#FEF2F2' : '#F4F4F5'
  return (
    <Text style={[s.testBadge, { color, backgroundColor: bgColor }]}>
      {v === 'pass' ? 'PASS' : v === 'fail' ? 'FAIL' : 'N/A'}
    </Text>
  )
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
  const workTypeLabel: Record<string, string> = {
    new: 'New Installation', addition: 'Addition to Existing', alteration: 'Alteration / Rewire',
  }
  const instTypeLabel: Record<string, string> = {
    residential: 'Residential', commercial: 'Commercial', industrial: 'Industrial', agricultural: 'Agricultural',
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl
              ? <Image src={logoUrl} style={{ maxWidth: 160, alignSelf: 'flex-start', marginBottom: 4 }} />
              : <Text style={s.company}>{companyName}</Text>
            }
            {settings?.vat_registration_number && <Text style={s.companyMeta}>VAT Reg: {settings.vat_registration_number}</Text>}
            {settings?.company_registration_number && <Text style={s.companyMeta}>Reg No: {settings.company_registration_number}</Text>}
            {settings?.cidb_registration_number && <Text style={s.companyMeta}>CIDB: {settings.cidb_registration_number}</Text>}
          </View>
          <View>
            <Text style={s.docTitle}>CERTIFICATE OF{'\n'}COMPLIANCE</Text>
            <Text style={s.docNum}>{coc.coc_number}</Text>
            <Text style={s.docMeta}>Issue Date: {fmtDate(coc.issue_date)}</Text>
            {coc.valid_until && <Text style={s.docMeta}>Valid Until: {fmtDate(coc.valid_until)}</Text>}
            <Text style={s.actNote}>SANS 10142-1 · OHS Act 85 of 1993 · EIR 2009</Text>
          </View>
        </View>

        {/* Info grid */}
        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>ELECTRICAL CONTRACTOR</Text>
            <Text style={s.infoBold}>{companyName}</Text>
            {settings?.cidb_registration_number && <Text style={s.infoRow}>CIDB: {settings.cidb_registration_number}</Text>}
            {settings?.vat_registration_number && <Text style={s.infoRow}>VAT: {settings.vat_registration_number}</Text>}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>OWNER / OCCUPIER</Text>
            {coc.owner_name
              ? <Text style={s.infoBold}>{coc.owner_name}</Text>
              : client
              ? <Text style={s.infoBold}>{client.client_name}</Text>
              : <Text style={s.infoRow}>—</Text>
            }
            {client?.company && <Text style={s.infoRow}>{client.company}</Text>}
            {client?.email && <Text style={s.infoRow}>{client.email}</Text>}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>PROJECT</Text>
            <Text style={s.infoBold}>{quote.project_name}</Text>
            {(coc.installation_address ?? quote.project_address) && (
              <Text style={s.infoRow}>{coc.installation_address ?? quote.project_address}</Text>
            )}
            {quote.quote_number && <Text style={s.infoRow}>Ref: {quote.quote_number}</Text>}
          </View>
        </View>

        {/* Section A — Installation Details */}
        <View style={s.secWrap}>
          <SecHead letter="A" title="Installation Details" />
          <View style={s.row2}>
            <Field label="Work Type" value={workTypeLabel[coc.work_type ?? 'new'] ?? coc.work_type ?? '—'} />
            <Field label="Installation Type" value={instTypeLabel[coc.installation_type ?? 'residential'] ?? coc.installation_type ?? '—'} />
          </View>
          <View style={s.descBox}>
            <Text style={s.descText}>{coc.installation_description || 'No description provided.'}</Text>
          </View>
        </View>

        {/* Section B — Supply Details */}
        <View style={s.secWrap}>
          <SecHead letter="B" title="Supply Details" />
          <View style={s.row2}>
            <Field label="Supply Authority" value={coc.supply_authority ?? '—'} />
            <Field label="Nominal Voltage" value={coc.supply_voltage ?? '230/400V'} />
            <Field label="Phases" value={coc.supply_phases === 'single' ? 'Single Phase' : 'Three Phase'} />
            <Field label="Earthing System" value={coc.supply_earthing ?? 'TN-C-S'} />
            {coc.main_breaker_amps && <Field label="Main Breaker" value={`${coc.main_breaker_amps}A`} />}
          </View>
        </View>

        {/* Section C — Test Results */}
        <View style={s.secWrap}>
          <SecHead letter="C" title="Test Results (SANS 10142-1)" />
          <View style={s.testGrid}>
            {[
              { key: 'earth_continuity',       label: 'Earth Continuity' },
              { key: 'insulation_resistance',  label: 'Insulation Resistance (500V DC)' },
              { key: 'polarity',               label: 'Polarity Correct' },
              { key: 'earth_leakage',          label: 'Earth Leakage Protection' },
              { key: 'overcurrent_protection', label: 'Overcurrent Protection' },
              { key: 'phase_rotation',         label: 'Phase Rotation (3-phase)' },
            ].map(({ key, label }) => (
              <View key={key} style={s.testCell}>
                <Text style={s.testLabel}>{label}</Text>
                <TestBadge result={(coc as unknown as Record<string, unknown>)[key] as string | null} />
              </View>
            ))}
          </View>
        </View>

        {/* Section D — Tester Details */}
        <View style={s.secWrap}>
          <SecHead letter="D" title="Tester / Inspector Details" />
          <View style={s.row2}>
            <Field label="Tester Name" value={coc.tester_name || '—'} />
            <Field label="Registration Number" value={coc.tester_registration_number ?? '—'} />
            <Field label="Issue Date" value={fmtDate(coc.issue_date)} />
            <Field label="Valid Until" value={coc.valid_until ? fmtDate(coc.valid_until) : 'No expiry'} />
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
          <View style={[s.secWrap, { marginBottom: 8 }]}>
            <SecHead letter="N" title="Notes / Restrictions" />
            <View style={s.notesBox}>
              <Text style={s.notesText}>{coc.notes}</Text>
            </View>
          </View>
        )}

        {/* Signature row */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Tester Signature &amp; Date</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Client / Owner Signature &amp; Date</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Witness Signature &amp; Date</Text>
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
