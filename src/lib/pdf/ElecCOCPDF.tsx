import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecCOC, ElecQuote, ElecClient, ElecSettings } from '@/lib/elec-types'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

const B = '#000000'
const G = '#C8C8C8'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 8, color: '#000', padding: 28, paddingBottom: 50 },

  // Header box
  headerBox: { borderWidth: 1.5, borderColor: B, flexDirection: 'row', alignItems: 'flex-start', padding: 10 },
  headerLeft: { flex: 1, paddingRight: 14 },
  logoImg: { maxWidth: 150, maxHeight: 40, objectFit: 'contain' },
  logoWrap: { alignItems: 'flex-start', marginBottom: 3 },
  coName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  coMeta: { fontSize: 6, color: '#555', lineHeight: 1.5 },
  headerRight: { alignItems: 'flex-end' },
  docTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'right', letterSpacing: 0.4 },
  docAct: { fontSize: 5.5, color: '#555', textAlign: 'right', marginTop: 3, lineHeight: 1.6 },
  cocNumBox: { marginTop: 6, borderTopWidth: 0.75, borderColor: '#000', paddingTop: 4, alignItems: 'flex-end' },
  cocNum: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  cocDate: { fontSize: 7, textAlign: 'right', marginTop: 1.5 },

  // Section wrapper — full border, sections separated by marginTop
  sec: { borderWidth: 0.75, borderColor: B, marginTop: 5 },

  // Gray header strip inside a section
  strip: {
    backgroundColor: G,
    padding: '3.5 7',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    letterSpacing: 0.5,
  },

  // Row inside a section (top border separates from strip above or previous row)
  row: { flexDirection: 'row', borderTopWidth: 0.75, borderColor: B },

  // Standard cells
  cell: { flex: 1, padding: '4 7', borderRightWidth: 0.75, borderColor: B },
  cellL: { flex: 1, padding: '4 7' },  // last in row — no right border
  cell2: { flex: 2, padding: '4 7', borderRightWidth: 0.75, borderColor: B },
  cell3: { flex: 3, padding: '4 7', borderRightWidth: 0.75, borderColor: B },
  cellFull: { flex: 1, padding: '5 7', minHeight: 30 },

  // Field label / value
  fl: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: '#666', letterSpacing: 0.3, marginBottom: 1.5 },
  fv: { fontSize: 8.5 },

  // Test results table
  testHRow: { flexDirection: 'row', backgroundColor: G, borderTopWidth: 0.75, borderColor: B },
  testRow: { flexDirection: 'row', borderTopWidth: 0.75, borderColor: B },
  testName: { flex: 5, padding: '4 7', borderRightWidth: 0.75, borderColor: B },
  testNameH: { flex: 5, padding: '3 7', fontFamily: 'Helvetica-Bold', fontSize: 6.5, borderRightWidth: 0.75, borderColor: B },
  testC: { flex: 1, padding: '4 4', alignItems: 'center', justifyContent: 'center', borderRightWidth: 0.75, borderColor: B },
  testCL: { flex: 1, padding: '4 4', alignItems: 'center', justifyContent: 'center' },
  testCH: { flex: 1, padding: '3 4', alignItems: 'center', fontFamily: 'Helvetica-Bold', fontSize: 6.5, borderRightWidth: 0.75, borderColor: B },
  testCHL: { flex: 1, padding: '3 4', alignItems: 'center', fontFamily: 'Helvetica-Bold', fontSize: 6.5 },

  // Checkbox
  cbOut: { width: 11, height: 11, borderWidth: 1, borderColor: B },
  cbIn: { flex: 1, margin: 1.5, backgroundColor: B },

  // Declaration
  declPad: { padding: '6 8' },
  declTitle: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, letterSpacing: 0.5, marginBottom: 3 },
  declText: { fontSize: 7.5, lineHeight: 1.65 },

  // Signatures
  sigRow: { flexDirection: 'row', borderTopWidth: 0.75, borderColor: B },
  sigCell: { flex: 1, padding: '6 8', minHeight: 54, borderRightWidth: 0.75, borderColor: B },
  sigCellL: { flex: 1, padding: '6 8', minHeight: 54 },
  sigHd: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, letterSpacing: 0.3, marginBottom: 2 },
  sigLine: { borderBottomWidth: 0.5, borderColor: B, marginTop: 22, marginBottom: 3 },
  sigFld: { fontSize: 6.5, color: '#222', marginTop: 2 },

  // Notes
  notesPad: { padding: '5 8' },
  notesTx: { fontSize: 7.5, lineHeight: 1.5 },

  // Footer
  footer: {
    position: 'absolute', bottom: 16, left: 28, right: 28,
    borderTopWidth: 0.5, borderColor: '#aaa',
    paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between',
  },
  footerTx: { fontSize: 6, color: '#888' },
})

function CB({ val, match }: { val: string | null | undefined; match: 'pass' | 'fail' | 'n/a' }) {
  const checked = (val ?? 'pass') === match
  return (
    <View style={s.cbOut}>
      {checked && <View style={s.cbIn} />}
    </View>
  )
}

const WORK_LABEL: Record<string, string> = {
  new: 'New Installation',
  addition: 'Addition to Existing',
  alteration: 'Alteration / Rewire',
}
const INST_LABEL: Record<string, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  agricultural: 'Agricultural',
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
  const tests = [
    { key: 'earth_continuity',       label: 'Earth Continuity' },
    { key: 'insulation_resistance',  label: 'Insulation Resistance (500 V d.c.)' },
    { key: 'polarity',               label: 'Polarity Correct' },
    { key: 'earth_leakage',          label: 'Earth Leakage Protection (RCD)' },
    { key: 'overcurrent_protection', label: 'Overcurrent Protection (Breakers / Fuses)' },
    { key: 'phase_rotation',         label: 'Phase Rotation (three-phase installations only)' },
  ]

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ────────────────────────────────────────────── */}
        <View style={s.headerBox}>
          <View style={s.headerLeft}>
            {logoUrl
              ? <View style={s.logoWrap}><Image src={logoUrl} style={s.logoImg} /></View>
              : null
            }
            <Text style={s.coName}>{companyName}</Text>
            {settings?.vat_registration_number && (
              <Text style={s.coMeta}>VAT Reg No: {settings.vat_registration_number}</Text>
            )}
            {settings?.company_registration_number && (
              <Text style={s.coMeta}>Company Reg No: {settings.company_registration_number}</Text>
            )}
            {settings?.cidb_registration_number && (
              <Text style={s.coMeta}>CIDB Reg No: {settings.cidb_registration_number}</Text>
            )}
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>CERTIFICATE OF{'\n'}COMPLIANCE</Text>
            <Text style={s.docAct}>
              In terms of the Electrical Installation Regulations, 2009{'\n'}
              Promulgated under the Occupational Health and Safety Act, 1993 (Act 85 of 1993){'\n'}
              Read in conjunction with SANS 10142-1
            </Text>
            <View style={s.cocNumBox}>
              <Text style={s.cocNum}>COC No: {coc.coc_number || '—'}</Text>
              <Text style={s.cocDate}>Issue Date: {fmtDate(coc.issue_date)}</Text>
              {coc.valid_until && (
                <Text style={s.cocDate}>Valid Until: {fmtDate(coc.valid_until)}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── 1. Installation Details ────────────────────────────── */}
        <View style={s.sec}>
          <Text style={s.strip}>1.  DETAILS OF THE ELECTRICAL INSTALLATION</Text>
          <View style={s.row}>
            <View style={s.cell2}>
              <Text style={s.fl}>INSTALLATION ADDRESS</Text>
              <Text style={s.fv}>{coc.installation_address ?? quote.project_address ?? '—'}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.fl}>TYPE OF WORK</Text>
              <Text style={s.fv}>{WORK_LABEL[coc.work_type ?? 'new'] ?? coc.work_type ?? '—'}</Text>
            </View>
            <View style={s.cellL}>
              <Text style={s.fl}>INSTALLATION CATEGORY</Text>
              <Text style={s.fv}>{INST_LABEL[coc.installation_type ?? 'residential'] ?? coc.installation_type ?? '—'}</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={s.cellFull}>
              <Text style={s.fl}>DESCRIPTION OF INSTALLATION / WORK DONE</Text>
              <Text style={s.fv}>{coc.installation_description || '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── 2. Registered Person (Contractor) ─────────────────── */}
        <View style={s.sec}>
          <Text style={s.strip}>2.  DETAILS OF REGISTERED PERSON / ELECTRICAL CONTRACTOR</Text>
          <View style={s.row}>
            <View style={s.cell2}>
              <Text style={s.fl}>NAME OF REGISTERED PERSON</Text>
              <Text style={s.fv}>{coc.tester_name || '—'}</Text>
            </View>
            <View style={s.cellL}>
              <Text style={s.fl}>REGISTRATION NUMBER</Text>
              <Text style={s.fv}>{coc.tester_registration_number ?? '—'}</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={s.cellFull}>
              <Text style={s.fl}>NAME OF ELECTRICAL CONTRACTOR / COMPANY</Text>
              <Text style={s.fv}>{companyName}</Text>
            </View>
          </View>
        </View>

        {/* ── 3. Owner / Occupier ────────────────────────────────── */}
        <View style={s.sec}>
          <Text style={s.strip}>3.  DETAILS OF OWNER / OCCUPIER</Text>
          <View style={s.row}>
            <View style={s.cell2}>
              <Text style={s.fl}>NAME OF OWNER / OCCUPIER</Text>
              <Text style={s.fv}>{coc.owner_name ?? client?.client_name ?? '—'}</Text>
            </View>
            <View style={s.cellL}>
              <Text style={s.fl}>PROJECT REFERENCE</Text>
              <Text style={s.fv}>{quote.project_name}{quote.quote_number ? ` (${quote.quote_number})` : ''}</Text>
            </View>
          </View>
        </View>

        {/* ── 4. Supply Details ──────────────────────────────────── */}
        <View style={s.sec}>
          <Text style={s.strip}>4.  SUPPLY DETAILS</Text>
          <View style={s.row}>
            <View style={s.cell}>
              <Text style={s.fl}>SUPPLY AUTHORITY</Text>
              <Text style={s.fv}>{coc.supply_authority ?? '—'}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.fl}>NOMINAL VOLTAGE</Text>
              <Text style={s.fv}>{coc.supply_voltage ?? '230/400V'}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.fl}>NO. OF PHASES</Text>
              <Text style={s.fv}>{coc.supply_phases === 'single' ? 'Single Phase' : 'Three Phase'}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.fl}>EARTHING SYSTEM</Text>
              <Text style={s.fv}>{coc.supply_earthing ?? 'TN-C-S'}</Text>
            </View>
            <View style={s.cellL}>
              <Text style={s.fl}>MAIN BREAKER / FUSE</Text>
              <Text style={s.fv}>{coc.main_breaker_amps ? `${coc.main_breaker_amps} A` : '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── 5. Test Results ────────────────────────────────────── */}
        <View style={s.sec}>
          <Text style={s.strip}>5.  TEST RESULTS — IN ACCORDANCE WITH SANS 10142-1</Text>
          <View style={s.testHRow}>
            <View style={s.testNameH}><Text>TEST</Text></View>
            <View style={s.testCH}><Text>PASS</Text></View>
            <View style={s.testCH}><Text>FAIL</Text></View>
            <View style={s.testCHL}><Text>N/A</Text></View>
          </View>
          {tests.map(({ key, label }) => (
            <View key={key} style={s.testRow}>
              <View style={s.testName}><Text>{label}</Text></View>
              <View style={s.testC}>
                <CB val={(coc as unknown as Record<string, unknown>)[key] as string} match="pass" />
              </View>
              <View style={s.testC}>
                <CB val={(coc as unknown as Record<string, unknown>)[key] as string} match="fail" />
              </View>
              <View style={s.testCL}>
                <CB val={(coc as unknown as Record<string, unknown>)[key] as string} match="n/a" />
              </View>
            </View>
          ))}
        </View>

        {/* ── Notes (conditional) ────────────────────────────────── */}
        {coc.notes && (
          <View style={s.sec}>
            <Text style={s.strip}>NOTES / RESTRICTIONS / EXCLUSIONS</Text>
            <View style={[s.row, s.notesPad]}>
              <Text style={s.notesTx}>{coc.notes}</Text>
            </View>
          </View>
        )}

        {/* ── Declaration ───────────────────────────────────────── */}
        <View style={s.sec}>
          <Text style={s.strip}>DECLARATION</Text>
          <View style={s.declPad}>
            <Text style={s.declTitle}>CERTIFICATE OF COMPLIANCE DECLARATION</Text>
            <Text style={s.declText}>
              {'I/We, '}
              {coc.tester_name || '______________________________'}
              {coc.tester_registration_number ? ` (Reg. No. ${coc.tester_registration_number})` : ''}
              {', hereby certify that the electrical installation described above has been inspected and tested in accordance with SANS 10142-1 and, subject to the test results recorded herein, complies with the requirements of the National Building Regulations and Building Standards Act, 1977 (Act 103 of 1977), the Occupational Health and Safety Act, 1993 (Act 85 of 1993), and the Electrical Installation Regulations, 2009, at the date of issue of this certificate.'}
            </Text>
          </View>
        </View>

        {/* ── Signatures ────────────────────────────────────────── */}
        <View style={s.sec}>
          <Text style={s.strip}>SIGNATURES</Text>
          <View style={s.sigRow}>
            <View style={s.sigCell}>
              <Text style={s.sigHd}>REGISTERED PERSON / ELECTRICAL CONTRACTOR</Text>
              <View style={s.sigLine} />
              <Text style={s.sigFld}>Signature &amp; Company Stamp</Text>
              <Text style={s.sigFld}>{'Name: '}{coc.tester_name || '________________________________'}</Text>
              <Text style={s.sigFld}>{'Reg No: '}{coc.tester_registration_number ?? '________________________________'}</Text>
              <Text style={s.sigFld}>{'Date: '}{fmtDate(coc.issue_date)}</Text>
            </View>
            <View style={s.sigCell}>
              <Text style={s.sigHd}>OWNER / OCCUPIER</Text>
              <View style={s.sigLine} />
              <Text style={s.sigFld}>Signature</Text>
              <Text style={s.sigFld}>{'Name: '}{coc.owner_name ?? client?.client_name ?? '________________________________'}</Text>
              <Text style={s.sigFld}>Date: ________________________________</Text>
            </View>
            <View style={s.sigCellL}>
              <Text style={s.sigHd}>WITNESS</Text>
              <View style={s.sigLine} />
              <Text style={s.sigFld}>Signature</Text>
              <Text style={s.sigFld}>Name: ________________________________</Text>
              <Text style={s.sigFld}>Date: ________________________________</Text>
            </View>
          </View>
        </View>

        {/* ── Footer ───────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerTx}>{companyName} — Electrical Installation Certificate of Compliance — EIR 2009 / SANS 10142-1</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
