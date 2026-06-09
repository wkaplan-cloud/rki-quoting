import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecCOC, ElecQuote, ElecClient, ElecSettings, COCTestReport } from '@/lib/elec-types'

const ECA_LOGO_URL   = 'https://ecasa.co.za/wpc/wp-content/uploads/2025/01/cropped-eca_icon-85x85.png'
const COAT_ARMS_URL  = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Coat_of_arms_of_South_Africa_%28heraldic%29.svg/500px-Coat_of_arms_of_South_Africa_%28heraldic%29.svg.png'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

const B = '#000000'
const LG = '#D8D8D8'

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 7.5, color: '#000', padding: 20, paddingBottom: 30 },

  // Outer border around whole page content
  outer: { borderWidth: 1, borderColor: B, flex: 1 },

  // ── Page 1 header ──
  p1Header: { flexDirection: 'row', borderBottomWidth: 0.75, borderColor: B },
  p1HeaderLeft: { width: 68, borderRightWidth: 0.75, borderColor: B, alignItems: 'center', justifyContent: 'center', padding: 5 },
  p1HeaderMid: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: '6 8', borderRightWidth: 0.75, borderColor: B },
  p1HeaderRight: { width: 90, padding: '4 5' },
  p1Title: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, textAlign: 'center', marginBottom: 2, letterSpacing: 0.2 },
  p1Sub: { fontSize: 7, textAlign: 'center', color: '#222' },
  p1RightBorder: { borderWidth: 0.75, borderColor: B, padding: '2 4', marginBottom: 4, alignItems: 'center' },
  p1RightBold: { fontFamily: 'Helvetica-Bold', fontSize: 7, textAlign: 'center' },
  p1RightTop: { fontSize: 6, textAlign: 'center', marginBottom: 1 },

  // ECA logo
  ecaLogo: { width: 50, height: 50 },
  ecaSubText: { fontSize: 5, textAlign: 'center', color: '#333', marginTop: 2, lineHeight: 1.3 },

  // ECA contact bar
  ecaContactBar: { flexDirection: 'row', justifyContent: 'center', padding: '2 6', borderBottomWidth: 0.75, borderColor: B, backgroundColor: '#FAFAFA' },
  ecaContactText: { fontSize: 5.5, textAlign: 'center', color: '#333' },

  // DB/Supply row
  dbRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B, padding: '3 6', alignItems: 'center', flexWrap: 'wrap' },
  dbLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7, marginRight: 3 },
  dbVal: { fontSize: 7, flex: 1, borderBottomWidth: 0.5, borderColor: '#555', marginRight: 8 },
  dbSmall: { fontSize: 6.5, marginRight: 4 },
  dbSmallBold: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, marginRight: 2 },

  // Notes block
  notesBlock: { padding: '3 6', borderBottomWidth: 1, borderColor: B },
  noteRow: { flexDirection: 'row', marginBottom: 1.5 },
  noteBold: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, marginRight: 3 },
  noteText: { fontSize: 6.5, flex: 1, lineHeight: 1.4 },

  // Section header strip
  secStrip: { backgroundColor: LG, borderBottomWidth: 0.75, borderColor: B, padding: '3 6' },
  secStripText: { fontFamily: 'Helvetica-Bold', fontSize: 7 },
  secBlock: { borderBottomWidth: 1, borderColor: B },

  // Generic row
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: B },
  rowLast: { flexDirection: 'row' },
  pad: { padding: '3 6' },

  // Field label + value
  fl: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: '#444', letterSpacing: 0.2, marginBottom: 1 },
  fv: { fontSize: 7.5 },
  fvDotted: { fontSize: 7.5, borderBottomWidth: 0.5, borderColor: '#888', minWidth: 60, marginRight: 6 },
  fLine: { flex: 1, borderBottomWidth: 0.5, borderColor: '#888', marginLeft: 2 },

  // Checkbox
  cbBox: { width: 8, height: 8, borderWidth: 0.75, borderColor: B, marginRight: 3 },
  cbFill: { flex: 1, margin: 1, backgroundColor: B },

  // Inline checkbox + label pair
  ckRow: { flexDirection: 'row', alignItems: 'center', marginRight: 10, marginBottom: 2 },
  ckLabel: { fontSize: 7 },

  // Section 2 supply rows
  s2Row: { flexDirection: 'row', alignItems: 'flex-start', padding: '2 6', flexWrap: 'wrap' },
  s2Label: { fontFamily: 'Helvetica-Bold', fontSize: 7, width: 80 },
  s2Opts: { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },

  // Section 3 table
  s3Header: { flexDirection: 'row', backgroundColor: LG },
  s3Cell: { flex: 1, padding: '2 4', borderRightWidth: 0.5, borderColor: B, fontSize: 6.5, fontFamily: 'Helvetica-Bold' },
  s3CellL: { flex: 1, padding: '2 4', fontSize: 6.5, fontFamily: 'Helvetica-Bold' },
  s3NameCell: { flex: 3, padding: '2 4', borderRightWidth: 0.5, borderColor: B, fontSize: 7 },
  s3ValCell: { flex: 1, padding: '2 4', borderRightWidth: 0.5, borderColor: B, fontSize: 7, textAlign: 'center' },
  s3ValCellL: { flex: 1, padding: '2 4', fontSize: 7, textAlign: 'center' },
  s3Sec: { flexDirection: 'row', flexWrap: 'wrap' },

  // Section 4 tests table
  t4HRow: { flexDirection: 'row', backgroundColor: LG, borderBottomWidth: 0.5, borderColor: B },
  t4Row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: B },
  t4Num: { width: 14, padding: '2 2 2 4', borderRightWidth: 0.5, borderColor: B, fontSize: 7 },
  t4Name: { flex: 5, padding: '2 4', borderRightWidth: 0.5, borderColor: B, fontSize: 7, lineHeight: 1.3 },
  t4Unit: { width: 20, padding: '2 2', borderRightWidth: 0.5, borderColor: B, fontSize: 7, textAlign: 'center' },
  t4Result: { flex: 3, padding: '2 4', borderRightWidth: 0.5, borderColor: B, fontSize: 7 },
  t4Na: { width: 20, padding: '2 4', alignItems: 'center', justifyContent: 'center', fontSize: 7 },
  t4H: { fontFamily: 'Helvetica-Bold', fontSize: 6.5 },

  // Section 5
  s5Pad: { padding: '4 6' },
  s5Text: { fontSize: 7, lineHeight: 1.5 },
  s5Line: { borderBottomWidth: 0.5, borderColor: '#888', flex: 1, marginLeft: 2, marginRight: 8 },
  s5Row: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4, flexWrap: 'wrap' },
  s5Label: { fontFamily: 'Helvetica-Bold', fontSize: 6.5, marginRight: 2 },

  // ── Page 2 ──
  p2HeaderTop: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B, alignItems: 'center' },
  p2HeaderTopText: { flex: 1, alignItems: 'center', padding: '4 6' },
  p2HeaderTopLogo: { width: 52, alignItems: 'center', justifyContent: 'center', padding: 4 },
  p2CoatArms: { width: 44, height: 44 },
  p2TopBold: { fontFamily: 'Helvetica-Bold', fontSize: 8, textAlign: 'center', marginBottom: 1 },
  p2TopNorm: { fontSize: 7, textAlign: 'center', marginBottom: 1 },

  p2TitleBar: { borderBottomWidth: 1, borderColor: B, padding: '3 6', alignItems: 'center' },
  p2TitleText: { fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'center', marginBottom: 1 },

  p2CertRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: B },
  p2CertLeft: { flex: 2, padding: '4 6', borderRightWidth: 1, borderColor: B },
  p2CertMid: { flex: 3, padding: '4 6', borderRightWidth: 1, borderColor: B, alignItems: 'center' },
  p2CertRight: { flex: 2, padding: '4 6' },

  p2CertNo: { fontFamily: 'Helvetica-Bold', fontSize: 7, marginBottom: 2 },
  p2CertNum: { fontFamily: 'Helvetica-Bold', fontSize: 18, letterSpacing: 2 },
  p2CertNumPre: { fontSize: 10, marginRight: 4 },
  p2CertType: { fontSize: 7, fontFamily: 'Helvetica-Bold', marginBottom: 4 },

  p2SupRow: { flexDirection: 'row', borderBottomWidth: 0.75, borderColor: B, padding: '3 6', alignItems: 'center' },

  p2SecStrip: { backgroundColor: LG, borderBottomWidth: 0.75, borderColor: B, padding: '3 6' },
  p2SecText: { fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  p2SecSub: { fontSize: 6.5, color: '#555', marginTop: 1 },

  p2FieldRow: { flexDirection: 'row', padding: '2 6', flexWrap: 'wrap', alignItems: 'flex-end' },
  p2FieldLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', marginRight: 3, minWidth: 70 },
  p2FieldLine: { flex: 1, borderBottomWidth: 0.5, borderColor: '#888', marginRight: 10 },

  declPad: { padding: '4 6' },
  declText: { fontSize: 7, lineHeight: 1.55 },
  declName: { flex: 1, borderBottomWidth: 0.5, borderColor: '#888', marginLeft: 2, marginRight: 4, fontSize: 7.5 },
  declIdBox: { flexDirection: 'row', alignItems: 'flex-end' },
  declIdLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', marginLeft: 8, marginRight: 2 },
  declIdLine: { width: 60, borderBottomWidth: 0.5, borderColor: '#888' },

  regRow: { flexDirection: 'row', padding: '2 6', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 2 },
  regLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', marginRight: 2 },
  regLine: { flex: 1, borderBottomWidth: 0.5, borderColor: '#888', marginRight: 10 },
  regVal: { fontSize: 7.5 },

  noteBlock: { backgroundColor: '#F5F5F5', padding: '3 6', borderTopWidth: 0.5, borderColor: B, borderBottomWidth: 0.5 },
  noteSmall: { fontSize: 6.5, lineHeight: 1.4 },

  recipRow: { flexDirection: 'row', padding: '4 6', alignItems: 'flex-end' },
  recipLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7, marginRight: 3 },
  recipLine: { flex: 1, borderBottomWidth: 0.5, borderColor: '#888', marginRight: 10 },

  footer: {
    position: 'absolute', bottom: 8, left: 20, right: 20,
    borderTopWidth: 0.5, borderColor: '#aaa', paddingTop: 3,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerTx: { fontSize: 5.5, color: '#888' },
})

// ── Reusable components ───────────────────────────────────────────────────────

function CB({ checked }: { checked: boolean }) {
  return (
    <View style={s.cbBox}>
      {checked && <View style={s.cbFill} />}
    </View>
  )
}

function CkItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={s.ckRow}>
      <CB checked={checked} />
      <Text style={s.ckLabel}>{label}</Text>
    </View>
  )
}

function DotLine({ val, flex = 1 }: { val?: string | null; flex?: number }) {
  return (
    <View style={{ flex, borderBottomWidth: 0.5, borderColor: '#888', marginRight: 6, minWidth: 20 }}>
      <Text style={{ fontSize: 7.5 }}>{val ?? ''}</Text>
    </View>
  )
}

function YNA({ val, match }: { val: string; match: string }) {
  return <CB checked={val === match} />
}

// Inspection row: Yes / No / N/A checkboxes
function InspRow({ num, label, val }: { num: string; label: string; val: string }) {
  return (
    <View style={s.t4Row}>
      <View style={s.t4Num}><Text>{num}.</Text></View>
      <View style={s.t4Name}><Text>{label}</Text></View>
      <View style={s.t4Unit}><YNA val={val} match="yes" /></View>
      <View style={s.t4Unit}><YNA val={val} match="no" /></View>
      <View style={s.t4Na}><YNA val={val} match="na" /></View>
    </View>
  )
}

// Test row
function TestRow({ num, label, unit, result, naChecked, extra }: {
  num: string; label: string; unit: string
  result?: string | null; naChecked?: boolean; extra?: React.ReactNode
}) {
  return (
    <View style={s.t4Row}>
      <View style={s.t4Num}><Text>{num}.</Text></View>
      <View style={s.t4Name}><Text>{label}</Text>{extra}</View>
      <View style={s.t4Unit}><Text style={{ fontSize: 7 }}>{unit}</Text></View>
      <View style={s.t4Result}><Text>{result ?? ''}</Text></View>
      <View style={s.t4Na}>{naChecked !== undefined && <CB checked={naChecked} />}</View>
    </View>
  )
}

// Section 3 — circuit row
function S3Row({ label, nv, ex, last = false }: { label: string; nv: string; ex: string; last?: boolean }) {
  const Row = last ? s.rowLast : s.row
  return (
    <View style={Row}>
      <View style={s.s3NameCell}><Text>{label}</Text></View>
      <View style={s.s3ValCell}><Text>{nv}</Text></View>
      <View style={s.s3ValCellL}><Text>{ex}</Text></View>
    </View>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  coc: ElecCOC
  quote: ElecQuote
  client: ElecClient | null
  settings: ElecSettings | null
  companyName: string
  logoUrl?: string | null
}

// Default test report so we never crash on null
const D: COCTestReport = {
  installation_permanent: true, supply_system: 'TN-C-S', voltage: '230V', voltage_other: '',
  phases: 'three', phase_rotation: 'clockwise', frequency: '50Hz', frequency_other: '',
  main_switch_type: 'circuit_breaker', main_switch_poles: '', main_switch_current_rating: '',
  main_switch_sc_rating: '', earth_leakage_current: '30mA', earth_leakage_current_other: '',
  surge_protection: false, lightning_protection: false, alt_power_supply: false,
  specialised_installation: false, above_1kv: false,
  lighting_circuits_new: '', lighting_circuits_existing: '',
  lighting_points_new: '', lighting_points_existing: '',
  socket_outlet_circuits_new: '', socket_outlet_circuits_existing: '',
  socket_outlets_new: '', socket_outlets_existing: '',
  ac_circuits_new: '', ac_circuits_existing: '',
  transformer_lighting_new: '', transformer_lighting_existing: '',
  transformer_bell_new: '', transformer_bell_existing: '',
  transformer_other_new: '', transformer_other_existing: '',
  heating_new: '', heating_existing: '',
  alt_power_new: '', alt_power_existing: '',
  fan_circuits_new: '', fan_circuits_existing: '',
  cooking_new: '', cooking_existing: '',
  geyser_new: '', geyser_existing: '',
  pool_pump_new: '', pool_pump_existing: '',
  borehole_pump_new: '', borehole_pump_existing: '',
  fixed_other_new: '', fixed_other_existing: '',
  earth_leakage_complete: true, earth_leakage_partial: false,
  inspect_conductors: 'yes', inspect_components: 'yes',
  inspect_disconnecting: 'yes', inspect_labelled: 'yes',
  test_continuity_bonding: 'compliant', test_earth_resistance: 'compliant',
  test_ring_circuits: '', test_earth_loop: '', test_neutral_loop: '',
  test_pscc_value: '', test_pscc_method: 'measured',
  test_elevated_voltage: '', test_insulation: '',
  test_voltage_no_load_a: '', test_voltage_no_load_b: '', test_voltage_no_load_c: '',
  test_voltage_load_a: '', test_voltage_load_b: '', test_voltage_load_c: '',
  test_earth_leakage_value: '',
  test_earth_leakage_button: 'correct', test_polarity: 'correct',
  test_phase_rotation: 'correct', test_switching: 'correct',
  comments: '', comments_not_covered: '', section5_date: '', section5_tel: '',
}

// ── Main component ────────────────────────────────────────────────────────────

export function ElecCOCPDF({ coc, quote, client, settings, companyName }: Props) {
  const tr: COCTestReport = { ...D, ...(coc.test_report ?? {}) }
  const addr = coc.installation_address ?? quote.project_address ?? ''
  const ownerName = coc.owner_name ?? client?.client_name ?? ''

  const mainSwitchLabel: Record<string, string> = {
    switch_disconnector: 'Switch disconnector (on-load isolator)',
    fuse_switch: 'Fuse switch',
    circuit_breaker: 'Circuit-breaker',
    elcb: 'Earth leakage circuit-breaker',
    elsd: 'Earth leakage switch disconnector',
  }

  return (
    <Document>

      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 1 — TEST REPORT (To SANS 10142-1)
      ══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.outer}>

          {/* Header */}
          <View style={s.p1Header}>
            <View style={s.p1HeaderLeft}>
              <Image src={ECA_LOGO_URL} style={s.ecaLogo} />
              <Text style={s.ecaSubText}>ELECTRICAL CONTRACTORS&apos;{'\n'}ASSOCIATION (S.A.){'\n'}YOUR TRUSTED ELECTRICAL{'\n'}CONTRACTORS</Text>
            </View>
            <View style={s.p1HeaderMid}>
              <Text style={s.p1Title}>TEST REPORT{'\n'}for ELECTRICAL INSTALLATIONS</Text>
              <Text style={s.p1Sub}>(To SANS 10142-1)</Text>
            </View>
            <View style={s.p1HeaderRight}>
              <View style={s.p1RightBorder}>
                <Text style={s.p1RightTop}>FOR USE BY</Text>
                <Text style={s.p1RightBold}>ECA MEMBERS ONLY</Text>
              </View>
              <Text style={{ fontSize: 5.5, marginBottom: 1 }}>Certificate of Compliance (CoC) No:</Text>
              <View style={{ borderBottomWidth: 0.75, borderColor: B, marginBottom: 3, minHeight: 10 }}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>{coc.coc_number || ''}</Text>
              </View>
              <Text style={{ fontSize: 5.5, marginBottom: 1 }}>Date of issue:</Text>
              <View style={{ borderBottomWidth: 0.75, borderColor: B, minHeight: 9 }}>
                <Text style={{ fontSize: 7 }}>{fmtDate(coc.issue_date)}</Text>
              </View>
            </View>
          </View>

          {/* ECA contact bar */}
          <View style={s.ecaContactBar}>
            <Text style={s.ecaContactText}>
              EMAIL: info@ecasa.co.za  ·  011 392 0000  ·  010 271 0686  ·  012 342 3242  ·  031 312 6313  ·  051 447 0859  ·  043 726 6359  ·  041 363 1990  ·  021 462 2690
            </Text>
          </View>

          {/* Test Report for DB/Supply row */}
          <View style={s.dbRow}>
            <Text style={s.dbSmallBold}>Test Report for DB/ Supply:</Text>
            <DotLine val={coc.db_supply} flex={2} />
            <Text style={s.dbSmall}>Additional pages added:</Text>
            <CB checked={!!coc.additional_pages} />
            <Text style={[s.dbSmall, { marginLeft: 4 }]}>Yes</Text>
            <Text style={[s.dbSmall, { marginLeft: 8 }]}>Number added:</Text>
            <DotLine val="" flex={1} />
            <CB checked={!coc.additional_pages} />
            <Text style={[s.dbSmall, { marginLeft: 4 }]}>No</Text>
          </View>

          {/* Notes */}
          <View style={s.notesBlock}>
            {[
              ['NOTE 1', 'In terms of South African legislation, the user or lessor is responsible for the safety of the electrical installation.'],
              ['NOTE 2', 'This report covers only the part of the installation described in section 3.'],
              ['NOTE 3', 'This report covers the circuits for fixed appliances, but does not cover the actual appliances, for example stoves, geysers, air conditioning and refrigeration plant and lights.'],
              ['NOTE 4', 'Medical and hazardous locations require additional test reports (see 8.7).'],
              ['NOTE 5', 'Enter the required information or tick the appropriate block.'],
            ].map(([label, text]) => (
              <View key={label} style={s.noteRow}>
                <Text style={s.noteBold}>{label}</Text>
                <Text style={s.noteText}>{text}</Text>
              </View>
            ))}
          </View>

          {/* SECTION 1 — LOCATION */}
          <View style={s.secBlock}>
            <View style={s.secStrip}><Text style={s.secStripText}>SECTION 1 — LOCATION (Only required if not provided on Certificate of Compliance)</Text></View>
            <View style={[s.row, s.pad]}>
              <Text style={[s.fl, { marginRight: 4 }]}>Physical address:</Text>
              <DotLine val={addr} flex={1} />
            </View>
            <View style={[s.rowLast, s.pad]}>
              <Text style={[s.fl, { marginRight: 4 }]}>Name of building:</Text>
              <DotLine val={coc.name_of_building} flex={1} />
            </View>
          </View>

          {/* SECTION 2 — INSTALLATION */}
          <View style={s.secBlock}>
            <View style={s.secStrip}><Text style={s.secStripText}>SECTION 2 — INSTALLATION</Text></View>

            {/* Permanent / Temporary */}
            <View style={s.s2Row}>
              <CkItem checked={tr.installation_permanent !== false} label="Permanent installation" />
              <CkItem checked={tr.installation_permanent === false} label="Temporary installation" />
            </View>

            {/* Supply system */}
            <View style={[s.s2Row, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={s.s2Label}>Type of electricity supply system:</Text>
              <View style={s.s2Opts}>
                {(['TN-S', 'TN-C-S', 'TN-C', 'TT', 'IT'] as const).map(v => (
                  <CkItem key={v} checked={tr.supply_system === v} label={v} />
                ))}
              </View>
            </View>

            {/* Characteristics */}
            <View style={[s.pad, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, marginBottom: 3 }}>Characteristics of supply:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 }}>
                <Text style={[s.s2Label, { width: 60 }]}>Voltage:</Text>
                <CkItem checked={tr.voltage === '230V'} label="230 V" />
                <CkItem checked={tr.voltage === '400V'} label="400 V" />
                <CkItem checked={tr.voltage === '525V'} label="525 V" />
                <CkItem checked={tr.voltage === 'other'} label={`Other ${tr.voltage_other || '________'}`} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 }}>
                <Text style={[s.s2Label, { width: 80 }]}>Number of phases:</Text>
                <CkItem checked={tr.phases === 'one'} label="One" />
                <CkItem checked={tr.phases === 'two'} label="Two" />
                <CkItem checked={tr.phases === 'three'} label="Three" />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 }}>
                <Text style={[s.s2Label, { width: 80 }]}>Phase rotation:</Text>
                <CkItem checked={tr.phase_rotation === 'clockwise'} label="Clockwise" />
                <CkItem checked={tr.phase_rotation === 'anticlockwise'} label="Anticlockwise" />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Text style={[s.s2Label, { width: 60 }]}>Frequency:</Text>
                <CkItem checked={tr.frequency === '50Hz'} label="50 Hz" />
                <CkItem checked={tr.frequency === 'other'} label={`Other ${tr.frequency_other || '________'}`} />
                <CkItem checked={tr.frequency === 'dc'} label="d.c." />
              </View>
            </View>

            {/* Main switch */}
            <View style={[s.pad, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, marginBottom: 3 }}>Main switch type:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 }}>
                <CkItem checked={tr.main_switch_type === 'switch_disconnector'} label="Switch disconnector (on-load isolator)" />
                <CkItem checked={tr.main_switch_type === 'fuse_switch'} label="Fuse switch" />
                <CkItem checked={tr.main_switch_type === 'circuit_breaker'} label="Circuit-breaker" />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 }}>
                <CkItem checked={tr.main_switch_type === 'elcb'} label="Earth leakage circuit-breaker" />
                <CkItem checked={tr.main_switch_type === 'elsd'} label="Earth leakage switch disconnector" />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 7, marginRight: 3 }}>Number of poles:</Text>
                <DotLine val={tr.main_switch_poles} flex={0} />
                <Text style={{ fontSize: 7, marginLeft: 8, marginRight: 3 }}>Current rating:</Text>
                <DotLine val={tr.main_switch_current_rating} flex={0} />
                <Text style={{ fontSize: 7 }}> A</Text>
                <Text style={{ fontSize: 7, marginLeft: 8, marginRight: 3 }}>Short-circuit/withstand rating:</Text>
                <DotLine val={tr.main_switch_sc_rating} flex={0} />
                <Text style={{ fontSize: 7 }}> kA</Text>
              </View>
            </View>

            {/* Earth leakage + flags */}
            <View style={[s.pad, { borderTopWidth: 0.5, borderColor: B }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3 }}>
                <Text style={{ fontSize: 7, marginRight: 4 }}>Rated earth leakage tripping current IΔn:</Text>
                <CkItem checked={tr.earth_leakage_current === '30mA'} label="30 mA" />
                <CkItem checked={tr.earth_leakage_current === 'other'} label={`Other ${tr.earth_leakage_current_other || '______'} mA`} />
              </View>
              {[
                ['surge_protection', 'Is surge protection installed (see 6.7.6 and annex I):'],
                ['lightning_protection', 'Is external lightning protection installed (see 6.7.6 and annex I):'],
                ['alt_power_supply', 'Is alternative power supply installed? (See 7.12.)'],
                ['specialised_installation', 'Is any part of the installation a specialized electrical installation?'],
                ['above_1kv', 'Is any part of the installation at a voltage above 1 kV?'],
              ].map(([key, label]) => (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontSize: 7, flex: 1 }}>{label}</Text>
                  <CkItem checked={(tr as unknown as Record<string,boolean>)[key] === true} label="Yes" />
                  <CkItem checked={(tr as unknown as Record<string,boolean>)[key] !== true} label="No" />
                </View>
              ))}
            </View>
          </View>

          {/* SECTION 3 — DESCRIPTION */}
          <View style={s.secBlock}>
            <View style={s.secStrip}>
              <Text style={s.secStripText}>SECTION 3 — DESCRIPTION OF INSTALLATION COVERED BY THIS REPORT</Text>
            </View>
            {/* Header row */}
            <View style={s.s3Header}>
              <View style={[s.s3NameCell, { borderTopWidth: 0 }]}><Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5 }}>Number of circuits or points</Text></View>
              <View style={[s.s3ValCell, { borderTopWidth: 0 }]}><Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5 }}>New</Text></View>
              <View style={[s.s3ValCellL, { borderTopWidth: 0 }]}><Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.5 }}>Existing</Text></View>
            </View>
            <S3Row label="Lighting circuits" nv={tr.lighting_circuits_new} ex={tr.lighting_circuits_existing} />
            <S3Row label="Lighting points" nv={tr.lighting_points_new} ex={tr.lighting_points_existing} />
            <S3Row label="Socket-outlet circuits" nv={tr.socket_outlet_circuits_new} ex={tr.socket_outlet_circuits_existing} />
            <S3Row label="Socket-outlets" nv={tr.socket_outlets_new} ex={tr.socket_outlets_existing} />
            <S3Row label="Air-conditioning circuits" nv={tr.ac_circuits_new} ex={tr.ac_circuits_existing} />
            <S3Row label="Transformer circuits — Lighting" nv={tr.transformer_lighting_new} ex={tr.transformer_lighting_existing} />
            <S3Row label="Transformer circuits — Bell" nv={tr.transformer_bell_new} ex={tr.transformer_bell_existing} />
            <S3Row label="Transformer circuits — Other" nv={tr.transformer_other_new} ex={tr.transformer_other_existing} />
            <S3Row label="Heating circuits" nv={tr.heating_new} ex={tr.heating_existing} />
            <S3Row label="Alternative power supply connections" nv={tr.alt_power_new} ex={tr.alt_power_existing} />
            <S3Row label="Fan circuits" nv={tr.fan_circuits_new} ex={tr.fan_circuits_existing} />
            <S3Row label="Fixed appliance circuits — Cooking" nv={tr.cooking_new} ex={tr.cooking_existing} />
            <S3Row label="Fixed appliance circuits — Geyser" nv={tr.geyser_new} ex={tr.geyser_existing} />
            <S3Row label="Fixed appliance circuits — Pool pump" nv={tr.pool_pump_new} ex={tr.pool_pump_existing} />
            <S3Row label="Fixed appliance circuits — Borehole pump" nv={tr.borehole_pump_new} ex={tr.borehole_pump_existing} />
            <S3Row label="Fixed appliance circuits — Other" nv={tr.fixed_other_new} ex={tr.fixed_other_existing} />
            <View style={s.rowLast}>
              <View style={[s.s3NameCell, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, marginRight: 6 }}>Earth leakage protects:</Text>
                  <CkItem checked={tr.earth_leakage_complete} label="Complete installation" />
                  <CkItem checked={tr.earth_leakage_partial} label="Only part of installation" />
                </View>
              </View>
            </View>
          </View>

          {/* SECTION 4 — INSPECTION AND TESTS */}
          <View style={s.secBlock}>
            <View style={s.secStrip}><Text style={s.secStripText}>SECTION 4 — INSPECTION AND TESTS (new and existing installations)</Text></View>

            {/* Inspection header */}
            <View style={s.t4HRow}>
              <View style={s.t4Num} />
              <View style={s.t4Name}><Text style={s.t4H}>Mark as appropriate</Text></View>
              <View style={s.t4Unit}><Text style={s.t4H}>Yes</Text></View>
              <View style={s.t4Unit}><Text style={s.t4H}>No</Text></View>
              <View style={s.t4Na}><Text style={s.t4H}>N/A</Text></View>
            </View>
            <InspRow num="1" label="Conductors are of the correct rating and current-carrying capacity for the protective devices and connected load" val={tr.inspect_conductors} />
            <InspRow num="2" label="Components have been correctly selected and installed" val={tr.inspect_components} />
            <InspRow num="3" label="Disconnecting devices are correctly located and all switchgear switches the phase conductors" val={tr.inspect_disconnecting} />
            <InspRow num="4" label="Circuits, fuses, switches, terminals, earth leakage units, circuit-breakers, distribution boards are correctly and permanently marked or labelled" val={tr.inspect_labelled} />

            {/* Tests header */}
            <View style={s.t4HRow}>
              <View style={s.t4Num} />
              <View style={s.t4Name}><Text style={s.t4H}>Tests</Text></View>
              <View style={s.t4Unit}><Text style={s.t4H}>Units</Text></View>
              <View style={s.t4Result}><Text style={s.t4H}>Reading / result</Text></View>
              <View style={s.t4Na}><Text style={s.t4H}>N/A</Text></View>
            </View>
            <TestRow num="1" label="Continuity of bonding" unit="—" result={tr.test_continuity_bonding === 'compliant' ? 'Compliant' : tr.test_continuity_bonding === 'non_compliant' ? 'Non-compliant' : ''} naChecked={tr.test_continuity_bonding === 'na'} />
            <TestRow num="2" label="Resistance of earth continuity conductor at all points of consumption" unit="—" result={tr.test_earth_resistance === 'compliant' ? 'Compliant' : tr.test_earth_resistance === 'non_compliant' ? 'Non-compliant' : ''} naChecked={tr.test_earth_resistance === 'na'} />
            <TestRow num="3" label="Continuity of ring circuits (if applicable)" unit="—" result={tr.test_ring_circuits} />
            <TestRow num="4" label="Earth loop impedance test: at main or local switch" unit="Ω" result={tr.test_earth_loop} />
            <TestRow num="5" label="Neutral loop impedance test: at main or local switch" unit="Ω" result={tr.test_neutral_loop} />
            <TestRow
              num="6"
              label="Prospective short-circuit current at main or local switch (PSCC)"
              unit="kA"
              result={tr.test_pscc_value}
              extra={
                <View style={{ flexDirection: 'row', marginTop: 2 }}>
                  <CkItem checked={tr.test_pscc_method === 'calculated'} label="Calculated" />
                  <CkItem checked={tr.test_pscc_method === 'measured'} label="Measured" />
                </View>
              }
            />
            <TestRow num="7" label="Elevated voltage between incoming neutral and external earth (ground)" unit="V" result={tr.test_elevated_voltage} />
            <TestRow num="8" label="Insulation resistance" unit="MΩ" result={tr.test_insulation} />
            <TestRow num="9" label="Voltage at distribution board with no load for each phase to neutral" unit="V"
              result={[tr.test_voltage_no_load_a, tr.test_voltage_no_load_b, tr.test_voltage_no_load_c].filter(Boolean).join(' / ') || ''} />
            <TestRow num="10" label="Voltage at distribution board with load (as calculated for full load) for each phase to neutral" unit="V"
              result={[tr.test_voltage_load_a, tr.test_voltage_load_b, tr.test_voltage_load_c].filter(Boolean).join(' / ') || ''} />
            <TestRow num="11" label="Value of operation of earth leakage units" unit="mA" result={tr.test_earth_leakage_value} />
            <TestRow num="12" label="Operation of earth leakage test button" unit="—" result={tr.test_earth_leakage_button === 'correct' ? 'Correct' : ''} naChecked={tr.test_earth_leakage_button === 'na'} />
            <TestRow num="13" label="Polarity of points of consumption" unit="—" result={tr.test_polarity === 'correct' ? 'Correct' : ''} naChecked={tr.test_polarity === 'na'} />
            <TestRow num="14" label="Phase rotation is consistent at all points of consumption for three-phase systems" unit="—" result={tr.test_phase_rotation === 'correct' ? 'Correct' : ''} naChecked={tr.test_phase_rotation === 'na'} />
            <TestRow num="15" label="All switching devices, make-and-break circuits" unit="—" result={tr.test_switching === 'correct' ? 'Correct' : ''} naChecked={tr.test_switching === 'na'} />

            {/* Comments */}
            {(tr.comments || tr.comments_not_covered) && (
              <View style={[s.pad, { borderTopWidth: 0.5, borderColor: B }]}>
                {tr.comments ? <Text style={{ fontSize: 7 }}>Comments: {tr.comments}</Text> : null}
                {tr.comments_not_covered ? <Text style={{ fontSize: 7, marginTop: 2 }}>Comments on parts not covered: {tr.comments_not_covered}</Text> : null}
              </View>
            )}
          </View>

          {/* SECTION 5 — RESPONSIBILITY */}
          <View>
            <View style={s.secStrip}><Text style={s.secStripText}>SECTION 5 — RESPONSIBILITY — INSPECTION AND TESTS</Text></View>
            <View style={s.s5Pad}>
              <Text style={s.s5Text}>
                {'I, being the person responsible for the INSPECTION AND TESTING of the electrical installation, particulars of which are described in section 3 of this form, CERTIFY that the inspection and testing were done in accordance with this part of SANS 10142, that the results obtained and reflected on this report are correct, and indicate The extent of liability of the signatory is limited to the installation described in section 3 of this form.'}
              </Text>
              <View style={[s.s5Row, { marginTop: 6 }]}>
                <Text style={s.s5Label}>Name of registered person:</Text>
                <DotLine val={coc.tester_name} flex={2} />
                <Text style={s.s5Label}>Registration certificate No.:</Text>
                <DotLine val={coc.tester_registration_number} flex={1} />
              </View>
              <View style={s.s5Row}>
                <Text style={[s.s5Label, { marginRight: 4 }]}>Type of registration:</Text>
                <CkItem checked={coc.reg_person_type === 'master'} label="Master installation electrician" />
                <CkItem checked={coc.reg_person_type === 'installation'} label="Installation electrician" />
                <CkItem checked={coc.reg_person_type === 'single_phase'} label="Single-phase tester" />
              </View>
              <View style={s.s5Row}>
                <Text style={s.s5Label}>Signature:</Text>
                <View style={s.s5Line} />
                <Text style={s.s5Label}>Date:</Text>
                <DotLine val={tr.section5_date || fmtDate(coc.issue_date)} flex={1} />
                <Text style={s.s5Label}>Tel no.:</Text>
                <DotLine val={tr.section5_tel || coc.reg_person_tel} flex={1} />
              </View>
            </View>
          </View>

        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerTx}>Test Report for Electrical Installations — SANS 10142-1</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 2 — CERTIFICATE OF COMPLIANCE (Annexure 1)
      ══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.outer}>

          {/* Page 2 header */}
          <View style={s.p2HeaderTop}>
            <View style={s.p2HeaderTopText}>
              <Text style={s.p2TopBold}>Annexure 1</Text>
              <Text style={s.p2TopBold}>DEPARTMENT OF LABOUR</Text>
              <Text style={s.p2TopBold}>OCCUPATIONAL HEALTH AND SAFETY ACT, 1993</Text>
              <Text style={s.p2TopBold}>CERTIFICATE OF COMPLIANCE</Text>
            </View>
            <View style={s.p2HeaderTopLogo}>
              <Image src={COAT_ARMS_URL} style={s.p2CoatArms} />
            </View>
          </View>

          <View style={s.p2TitleBar}>
            <Text style={s.p2TitleText}>GENERAL ELECTRICAL INSTALLATION{'\n'}CERTIFICATE OF COMPLIANCE</Text>
          </View>

          {/* Certificate number row */}
          <View style={s.p2CertRow}>
            <View style={s.p2CertLeft}>
              <Text style={{ fontSize: 6.5, lineHeight: 1.4 }}>
                Certificate of compliance in accordance{'\n'}with regulation 7(1) of the Electrical{'\n'}Installation Regulations, 2009.
              </Text>
            </View>
            <View style={s.p2CertMid}>
              <Text style={s.p2CertNo}>CERTIFICATE NO.</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={s.p2CertNumPre}>ECA</Text>
                <Text style={s.p2CertNum}>{coc.coc_number || '___________'}</Text>
              </View>
            </View>
            <View style={s.p2CertRight}>
              <Text style={s.p2CertType}>Certificate type (tick appropriate block)</Text>
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                <CkItem checked={!coc.certificate_type || coc.certificate_type === 'initial'} label="Initial Certificate" />
              </View>
              <View style={{ flexDirection: 'row', marginTop: 2 }}>
                <CkItem checked={coc.certificate_type === 'supplementary'} label="Supplementary Certificate" />
              </View>
            </View>
          </View>

          {/* Supplement row */}
          <View style={s.p2SupRow}>
            <Text style={{ fontSize: 7, marginRight: 4 }}>Supplement No.:</Text>
            <DotLine val={coc.supplement_no} flex={1} />
            <Text style={{ fontSize: 7, marginRight: 4, marginLeft: 6 }}>to Initial Certificate No.:</Text>
            <DotLine val={coc.to_initial_cert_no} flex={1} />
            <Text style={{ fontSize: 7, marginRight: 4, marginLeft: 6 }}>as issued on:</Text>
            <DotLine val={coc.initial_cert_date} flex={1} />
          </View>

          {/* Installation identification */}
          <View style={{ borderBottomWidth: 1, borderColor: B }}>
            <View style={s.p2SecStrip}>
              <Text style={s.p2SecText}>Identification of the relevant electrical installation</Text>
              <Text style={s.p2SecSub}>(Address or other unique reference, where applicable)</Text>
            </View>
            <View style={s.p2FieldRow}>
              <Text style={s.p2FieldLabel}>Physical address:</Text>
              <DotLine val={addr} flex={1} />
            </View>
            <View style={[s.p2FieldRow, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={s.p2FieldLabel}>Name of building:</Text>
              <DotLine val={coc.name_of_building} flex={1} />
              <Text style={[s.p2FieldLabel, { marginLeft: 6 }]}>GPS Coordinates:</Text>
              <DotLine val={coc.gps_coordinates} flex={1} />
            </View>
            <View style={[s.p2FieldRow, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={s.p2FieldLabel}>Suburb / Township</Text>
              <DotLine val={coc.suburb_township} flex={1} />
              <Text style={[s.p2FieldLabel, { marginLeft: 6 }]}>Pole number:</Text>
              <DotLine val={coc.pole_number} flex={1} />
            </View>
            <View style={[s.p2FieldRow, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={s.p2FieldLabel}>District / Town / City</Text>
              <DotLine val={coc.district_town_city} flex={1} />
              <Text style={[s.p2FieldLabel, { marginLeft: 6 }]}>Erf / Lot No:</Text>
              <DotLine val={coc.erf_lot_no} flex={1} />
            </View>
          </View>

          {/* Declaration by registered person */}
          <View style={{ borderBottomWidth: 1, borderColor: B }}>
            <View style={s.p2SecStrip}><Text style={s.p2SecText}>Declaration by registered person</Text></View>
            <View style={s.declPad}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 }}>
                <Text style={{ fontSize: 7 }}>I, </Text>
                <DotLine val={coc.tester_name} flex={2} />
                <Text style={{ fontSize: 7, marginLeft: 6 }}>(ID No.: </Text>
                <DotLine val={coc.reg_person_id_no} flex={1} />
                <Text style={{ fontSize: 7 }}>)</Text>
              </View>
              <Text style={s.declText}>
                {'a registered person, declare that I have personally carried out the inspection and testing of the electrical installation described in the attached test report as per the requirements of:'}
              </Text>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', marginTop: 3, marginBottom: 2 }}>(Tick appropriate box)</Text>
              <CkItem checked={coc.regulation_type === 'a'} label="a) electrical installation regulations 9(2) (a) (new electrical installation); or" />
              <CkItem checked={coc.regulation_type === 'b'} label="b) electrical installation regulations 9(2) (b) (existing electrical installation); or" />
              <CkItem checked={coc.regulation_type === 'c'} label="c) electrical installation regulations 9(2) (c) (new part to existing installation)" />
              <Text style={[s.declText, { marginTop: 3 }]}>{'and deem the installation to be reasonably safe when properly used.'}</Text>
              <Text style={[s.declText, { marginTop: 2 }]}>{'I have entered the number of this Certificate on the attached test report(s).'}</Text>
              <Text style={[s.declText, { marginTop: 2 }]}>{'I declare that the persons responsible for the design, specification, procurement, construction commissioning and inspection and test have completed the relevant sections of the test report.'}</Text>
            </View>
            <View style={[s.regRow, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={s.regLabel}>Registered person registration number:</Text>
              <DotLine val={coc.tester_registration_number} flex={1} />
              <Text style={[s.regLabel, { marginLeft: 8 }]}>Date of registration:</Text>
              <DotLine val={coc.reg_person_reg_date} flex={1} />
            </View>
            <View style={[s.regRow, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={[s.regLabel, { marginRight: 6 }]}>Type of registration: (Tick appropriate box)</Text>
              <CkItem checked={coc.reg_person_type === 'single_phase'} label="Electrical tester for single phase" />
              <CkItem checked={coc.reg_person_type === 'installation'} label="Installation electrician" />
              <CkItem checked={!coc.reg_person_type || coc.reg_person_type === 'master'} label="Master installation electrician" />
            </View>
            <View style={[s.regRow, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={s.regLabel}>Signature:</Text>
              <DotLine val="" flex={2} />
              <Text style={[s.regLabel, { marginLeft: 8 }]}>Date:</Text>
              <DotLine val={fmtDate(coc.issue_date)} flex={1} />
            </View>
            <View style={[s.regRow, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={s.regLabel}>Contact details of registered person:</Text>
            </View>
            <View style={[s.regRow]}>
              <Text style={s.regLabel}>Address:</Text>
              <DotLine val={coc.reg_person_address} flex={1} />
            </View>
            <View style={s.regRow}>
              <Text style={s.regLabel}>Tel. No.:</Text>
              <DotLine val={coc.reg_person_tel} flex={1} />
              <Text style={[s.regLabel, { marginLeft: 8 }]}>Fax No.:</Text>
              <DotLine val={coc.reg_person_fax} flex={1} />
            </View>
            <View style={s.regRow}>
              <Text style={s.regLabel}>Cell No.:</Text>
              <DotLine val={coc.reg_person_cell} flex={1} />
              <Text style={[s.regLabel, { marginLeft: 8 }]}>Email:</Text>
              <DotLine val={coc.reg_person_email} flex={1} />
            </View>

            {/* Note boxes */}
            <View style={s.noteBlock}>
              <View style={s.noteRow}>
                <Text style={s.noteBold}>NOTE 1.</Text>
                <Text style={s.noteSmall}>This certificate is not valid unless all the sections have been completed correctly and the test report in the format approved by the chief inspector is attached.</Text>
              </View>
              <View style={s.noteRow}>
                <Text style={s.noteBold}>2.</Text>
                <Text style={s.noteSmall}>This certificate will be invalid if any corrections have been made.</Text>
              </View>
            </View>
          </View>

          {/* Declaration by electrical contractor */}
          <View style={{ borderBottomWidth: 1, borderColor: B }}>
            <View style={s.p2SecStrip}><Text style={s.p2SecText}>Declaration by electrical contractor</Text></View>
            <View style={s.declPad}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 }}>
                <Text style={{ fontSize: 7 }}>I, </Text>
                <DotLine val={coc.contractor_name} flex={2} />
                <Text style={{ fontSize: 7, marginLeft: 6 }}>(ID No.: </Text>
                <DotLine val={coc.contractor_id_no} flex={1} />
                <Text style={{ fontSize: 7 }}>)</Text>
              </View>
              <Text style={s.declText}>
                {'declare that the electrical installation has been carried out in accordance with the requirements of the Occupational Health and Safety Act, 1993, and regulations made thereunder.'}
              </Text>
            </View>
            <View style={[s.regRow, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={s.regLabel}>Electrical contractor registration number:</Text>
              <DotLine val={coc.contractor_reg_no} flex={1} />
              <Text style={[s.regLabel, { marginLeft: 8 }]}>Date of registration:</Text>
              <DotLine val={coc.contractor_reg_date} flex={1} />
            </View>
            <View style={[s.regRow, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={s.regLabel}>Signature:</Text>
              <DotLine val="" flex={2} />
              <Text style={[s.regLabel, { marginLeft: 8 }]}>Date:</Text>
              <DotLine val={fmtDate(coc.issue_date)} flex={1} />
            </View>
            <View style={[s.regRow, { borderTopWidth: 0.5, borderColor: B }]}>
              <Text style={s.regLabel}>Contact details of electrical contractor:</Text>
              <Text style={[s.regLabel, { marginLeft: 4 }]}>Name:</Text>
              <DotLine val={coc.contractor_name} flex={1} />
            </View>
            <View style={s.regRow}>
              <Text style={s.regLabel}>Address:</Text>
              <DotLine val={coc.contractor_address} flex={1} />
            </View>
            <View style={s.regRow}>
              <Text style={s.regLabel}>Tel. No.:</Text>
              <DotLine val={coc.contractor_tel} flex={1} />
              <Text style={[s.regLabel, { marginLeft: 8 }]}>Fax No.:</Text>
              <DotLine val={coc.contractor_fax} flex={1} />
            </View>
            <View style={s.regRow}>
              <Text style={s.regLabel}>Cell No.:</Text>
              <DotLine val={coc.contractor_cell} flex={1} />
              <Text style={[s.regLabel, { marginLeft: 8 }]}>Email:</Text>
              <DotLine val={coc.contractor_email} flex={1} />
            </View>
          </View>

          {/* Recipient */}
          <View style={s.recipRow}>
            <Text style={s.recipLabel}>Recipient name:</Text>
            <DotLine val={coc.recipient_name ?? ownerName} flex={1} />
            <Text style={[s.recipLabel, { marginLeft: 8 }]}>Signature:</Text>
            <DotLine val="" flex={1} />
            <Text style={[s.recipLabel, { marginLeft: 8 }]}>Date:</Text>
            <DotLine val={coc.recipient_date} flex={1} />
          </View>

        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerTx}>Certificate of Compliance — Annexure 1 — Occupational Health and Safety Act, 1993</Text>
          <Text style={s.footerTx} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

    </Document>
  )
}
