import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecQuote, ElecClient, ElecSettings } from '@/lib/elec-types'

/**
 * System handover pack: every device left on site, grouped by room, with its
 * serial, MAC, IP and warranty — and, only when asked for, its login. Ends
 * with the support details and a sign-off block for the client.
 */

const ACCENT = '#1F5C45'
const DARK   = '#18181B'
const MUTED  = '#71717A'
const BORDER = '#E4E4E7'
const SURF   = '#F7F9F8'
const TINT   = '#EAF2EE'

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 44, paddingBottom: 64 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  company:     { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  meta:        { fontSize: 7.5, color: MUTED, lineHeight: 1.5 },
  docTitle:    { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, textAlign: 'right' },
  docSub:      { fontSize: 8.5, color: MUTED, textAlign: 'right', marginTop: 3 },
  infoGrid:    { flexDirection: 'row', gap: 10, marginBottom: 16 },
  infoBox:     { flex: 1, padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  infoHd:      { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 4, marginBottom: 5 },
  infoBold:    { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  infoRow:     { fontSize: 8, color: MUTED, marginBottom: 1.5 },
  summary:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat:        { flex: 1, padding: 9, backgroundColor: TINT, borderRadius: 3 },
  statNum:     { fontSize: 13, fontFamily: 'Helvetica-Bold', color: ACCENT },
  statLabel:   { fontSize: 7, color: MUTED, marginTop: 2 },
  tableHead:   { flexDirection: 'row', backgroundColor: ACCENT, paddingVertical: 5, paddingHorizontal: 8 },
  th:          { fontSize: 7, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  roomRow:     { backgroundColor: TINT, paddingVertical: 4, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: BORDER },
  roomLabel:   { fontSize: 8, color: ACCENT, fontFamily: 'Helvetica-Bold' },
  row:         { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  rowAlt:      { backgroundColor: SURF },
  td:          { fontSize: 7.8 },
  tdMono:      { fontSize: 7.3, fontFamily: 'Courier' },
  tdSub:       { fontSize: 6.8, color: MUTED, marginTop: 1 },
  section:     { marginTop: 18 },
  secTitle:    { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 3, marginBottom: 6 },
  body:        { fontSize: 8.5, lineHeight: 1.5 },
  warn:        { fontSize: 7.5, color: '#9A3412', marginTop: 4 },
  signGrid:    { flexDirection: 'row', gap: 24, marginTop: 8 },
  signBox:     { flex: 1 },
  signLine:    { borderBottomWidth: 0.5, borderBottomColor: DARK, height: 26, marginBottom: 3 },
  signLabel:   { fontSize: 7, color: MUTED, marginBottom: 8 },
  footer:      { position: 'absolute', bottom: 24, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:  { fontSize: 7, color: MUTED },
})

export interface HandoverDevice {
  room: string | null
  category: string | null
  brand: string | null
  model: string | null
  description: string | null
  serial_number: string | null
  mac_address: string | null
  ip_address: string | null
  warranty_until: string | null
  username: string | null
  /** Decrypted — only present when the pack was generated with credentials. */
  password: string | null
}

export interface HandoverServicePlan {
  name: string
  summary: string
}

export interface ElecHandoverPDFProps {
  quote: ElecQuote
  client: ElecClient | null
  settings: ElecSettings | null
  devices: HandoverDevice[]
  includeCredentials: boolean
  servicePlan?: HandoverServicePlan | null
  companyName: string
  companyEmail?: string | null
  companyPhone?: string | null
  logoUrl?: string | null
  handoverDate: string
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ElecHandoverPDF({ quote, client, devices, includeCredentials, servicePlan, companyName, companyEmail, companyPhone, logoUrl, handoverDate }: ElecHandoverPDFProps) {
  const rooms = new Map<string, HandoverDevice[]>()
  for (const d of devices) {
    const key = d.room || 'General'
    rooms.set(key, [...(rooms.get(key) ?? []), d])
  }
  const warranties = devices.map(d => d.warranty_until).filter((w): w is string => !!w).sort()
  const withLogin = devices.filter(d => d.username || d.password).length

  const cols = includeCredentials
    ? { device: 2.3, serial: 1.4, mac: 1.3, ip: 0.9, warranty: 0.8, login: 1.3 }
    : { device: 2.8, serial: 1.6, mac: 1.4, ip: 1, warranty: 0.9, login: 0 }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl && <Image src={logoUrl} style={{ maxWidth: 180, maxHeight: 52, objectFit: 'contain', marginBottom: 4 }} />}
            <Text style={s.company}>{companyName}</Text>
            {companyEmail && <Text style={s.meta}>{companyEmail}</Text>}
            {companyPhone && <Text style={s.meta}>{companyPhone}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docTitle}>SYSTEM HANDOVER</Text>
            <Text style={s.docSub}>{quote.quote_number}</Text>
            <Text style={s.docSub}>Handed over {fmtDate(handoverDate)}</Text>
          </View>
        </View>

        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoHd}>CLIENT</Text>
            <Text style={s.infoBold}>{client?.client_name ?? '—'}</Text>
            {client?.company && <Text style={s.infoRow}>{client.company}</Text>}
            {client?.contact_number && <Text style={s.infoRow}>{client.contact_number}</Text>}
            {client?.email && <Text style={s.infoRow}>{client.email}</Text>}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoHd}>INSTALLATION</Text>
            <Text style={s.infoBold}>{quote.project_name}</Text>
            {quote.project_address && <Text style={s.infoRow}>{quote.project_address}</Text>}
            {quote.practical_completion_date && <Text style={s.infoRow}>Completed {fmtDate(quote.practical_completion_date)}</Text>}
          </View>
        </View>

        <View style={s.summary}>
          <View style={s.stat}><Text style={s.statNum}>{devices.length}</Text><Text style={s.statLabel}>devices installed</Text></View>
          <View style={s.stat}><Text style={s.statNum}>{rooms.size}</Text><Text style={s.statLabel}>rooms / areas</Text></View>
          <View style={s.stat}>
            <Text style={s.statNum}>{warranties.length ? fmtDate(warranties[0]) : '—'}</Text>
            <Text style={s.statLabel}>first warranty to expire</Text>
          </View>
        </View>

        {/* Device schedule */}
        <Text style={s.secTitle}>DEVICE SCHEDULE</Text>
        {devices.length === 0 ? (
          <Text style={s.body}>No devices have been recorded for this installation.</Text>
        ) : (
          <>
            <View style={s.tableHead} fixed>
              <Text style={[s.th, { flex: cols.device }]}>Device</Text>
              <Text style={[s.th, { flex: cols.serial }]}>Serial</Text>
              <Text style={[s.th, { flex: cols.mac }]}>MAC</Text>
              <Text style={[s.th, { flex: cols.ip }]}>IP</Text>
              <Text style={[s.th, { flex: cols.warranty }]}>Warranty to</Text>
              {includeCredentials && <Text style={[s.th, { flex: cols.login }]}>Login</Text>}
            </View>
            {[...rooms.entries()].map(([room, list]) => (
              <View key={room}>
                <View style={s.roomRow} wrap={false}><Text style={s.roomLabel}>{room}</Text></View>
                {list.map((d, i) => (
                  <View key={`${room}-${i}`} style={[s.row, i % 2 ? s.rowAlt : {}]} wrap={false}>
                    <View style={{ flex: cols.device, paddingRight: 4 }}>
                      <Text style={s.td}>{[d.brand, d.model].filter(Boolean).join(' ') || d.description || 'Device'}</Text>
                      {(d.category || (d.description && (d.brand || d.model))) && (
                        <Text style={s.tdSub}>{[d.category, d.brand || d.model ? d.description : null].filter(Boolean).join(' · ')}</Text>
                      )}
                    </View>
                    <Text style={[s.tdMono, { flex: cols.serial, paddingRight: 4 }]}>{d.serial_number ?? '—'}</Text>
                    <Text style={[s.tdMono, { flex: cols.mac, paddingRight: 4 }]}>{d.mac_address ?? '—'}</Text>
                    <Text style={[s.tdMono, { flex: cols.ip, paddingRight: 4 }]}>{d.ip_address ?? '—'}</Text>
                    <Text style={[s.td, { flex: cols.warranty }]}>{fmtDate(d.warranty_until)}</Text>
                    {includeCredentials && (
                      <View style={{ flex: cols.login }}>
                        <Text style={s.tdMono}>{d.username ?? '—'}</Text>
                        {d.password && <Text style={s.tdMono}>{d.password}</Text>}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
            {includeCredentials && withLogin > 0 && (
              <Text style={s.warn}>This pack contains device passwords. Store it somewhere safe and change the passwords if it is ever shared.</Text>
            )}
          </>
        )}

        {/* Support */}
        <View style={s.section} wrap={false}>
          <Text style={s.secTitle}>SUPPORT</Text>
          <Text style={s.body}>
            For help with any part of this system, contact {companyName}
            {companyPhone ? ` on ${companyPhone}` : ''}{companyEmail ? `${companyPhone ? ' or' : ' at'} ${companyEmail}` : ''}.
            Quote the reference {quote.quote_number} and, where you can, the serial number of the device concerned.
          </Text>
          {servicePlan && (
            <Text style={[s.body, { marginTop: 6 }]}>
              Service plan: {servicePlan.name} — {servicePlan.summary}
            </Text>
          )}
          <Text style={[s.body, { marginTop: 6, color: MUTED }]}>
            Manufacturer warranties run from the installation date shown for each device. Damage from power surges, water, or changes made by others is not covered.
          </Text>
        </View>

        {/* Sign-off */}
        <View style={s.section} wrap={false}>
          <Text style={s.secTitle}>HANDOVER SIGN-OFF</Text>
          <Text style={s.body}>The system above has been demonstrated, is working, and has been handed over to the client.</Text>
          <View style={s.signGrid}>
            <View style={s.signBox}>
              <View style={s.signLine} /><Text style={s.signLabel}>Handed over by ({companyName})</Text>
              <View style={s.signLine} /><Text style={s.signLabel}>Date</Text>
            </View>
            <View style={s.signBox}>
              <View style={s.signLine} /><Text style={s.signLabel}>Accepted by (client)</Text>
              <View style={s.signLine} /><Text style={s.signLabel}>Signature</Text>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{companyName}</Text>
          <Text style={s.footerText}>{quote.quote_number} — {quote.project_name}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
