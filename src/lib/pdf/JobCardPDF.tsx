import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecJobCard, ElecSettings } from '@/lib/elec-types'

const ACCENT = '#3A7CA5'
const DARK   = '#18181B'
const MUTED  = '#71717A'
const BORDER = '#E4E4E7'
const SURF   = '#F9FAFB'
const GREEN  = '#16A34A'
const GOLD   = '#D9A441'

const STATUS_COLOR: Record<string, string> = {
  pending:     GOLD,
  in_progress: ACCENT,
  completed:   GREEN,
  cancelled:   '#71717A',
}

const TYPE_LABEL: Record<string, string> = {
  maintenance: 'Maintenance',
  repair:      'Repair',
  once_off:    'Once-Off',
  callout:     'Callout',
}

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 44, paddingBottom: 60 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, alignItems: 'flex-start' },
  company:     { fontSize: 13, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 },
  companyMeta: { fontSize: 7, color: MUTED, lineHeight: 1.5 },
  docTitle:    { fontSize: 15, fontFamily: 'Helvetica-Bold', color: ACCENT, textAlign: 'right' },
  docNum:      { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 3 },
  docMeta:     { fontSize: 7.5, color: MUTED, textAlign: 'right', marginTop: 2 },

  divider:     { borderBottomWidth: 0.5, borderBottomColor: BORDER, marginBottom: 14 },

  secLabel:    { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },

  infoGrid:    { flexDirection: 'row', gap: 8, marginBottom: 14 },
  infoBox:     { flex: 1, padding: 9, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  infoHd:      { fontSize: 6, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 3, marginBottom: 5 },
  infoRow:     { fontSize: 7.5, color: MUTED, marginBottom: 2 },
  infoVal:     { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: DARK },

  fieldRow:    { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fieldCell:   { flex: 1 },
  fieldLabel:  { fontSize: 6, color: MUTED, letterSpacing: 0.3, marginBottom: 1.5 },
  fieldVal:    { fontSize: 8.5, color: DARK, fontFamily: 'Helvetica-Bold' },

  textBox:     { padding: 9, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, backgroundColor: SURF, marginBottom: 10 },
  textContent: { fontSize: 8, color: DARK, lineHeight: 1.6 },

  tableHead:   { flexDirection: 'row', backgroundColor: ACCENT, padding: 6, borderRadius: 3, marginBottom: 2 },
  tableHdTxt:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff' },
  tableRow:    { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableCell:   { fontSize: 8, color: DARK },
  totalRow:    { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, backgroundColor: SURF, borderRadius: 3, marginTop: 4 },

  photoGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  photoBox:    { width: '31%' },
  photoImg:    { width: '100%', height: 90, objectFit: 'cover', borderRadius: 3 },
  photoCaption:{ fontSize: 6.5, color: MUTED, marginTop: 2 },

  sigBox:      { borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, padding: 6, alignItems: 'center', marginBottom: 14 },
  sigImg:      { width: 160, height: 60, objectFit: 'contain' },
  sigLabel:    { fontSize: 7, color: MUTED, marginTop: 4 },

  statusBadge: { fontSize: 7, fontFamily: 'Helvetica-Bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, textAlign: 'right' },
  footer:      { position: 'absolute', bottom: 24, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6 },
  footerTxt:   { fontSize: 7, color: MUTED },
})

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}
function fmtCurrency(n: number | null) {
  if (n == null) return '—'
  return `R ${n.toFixed(2)}`
}

interface Props {
  jobCard: ElecJobCard
  companyName: string
  settings: ElecSettings | null
  logoBase64: string | null
  asInvoice?: boolean
}

export function JobCardPDF({ jobCard, companyName, settings, logoBase64, asInvoice = false }: Props) {
  const statusColor = STATUS_COLOR[jobCard.status] ?? MUTED
  const staffName = (jobCard.staff && !Array.isArray(jobCard.staff)) ? jobCard.staff.name : null
  const clientName = jobCard.client_name ?? ((jobCard.client && !Array.isArray(jobCard.client)) ? jobCard.client.client_name : null)
  const clientEmail = jobCard.client_email ?? ((jobCard.client && !Array.isArray(jobCard.client)) ? jobCard.client.email : null)
  const materials = jobCard.materials ?? []
  const photos = (jobCard.photos ?? []).filter(p => p.url !== jobCard.client_signature_url)
  const materialsSubtotal = materials.reduce((acc, m) => acc + m.qty * (m.unit_price ?? 0), 0)
  const labourCharge = (jobCard.labour_hours ?? 0) * (jobCard.labour_rate ?? 0)
  const calloutFee = jobCard.callout_fee ?? 0
  const totalExclVat = calloutFee + labourCharge + materialsSubtotal
  const vatRate = settings?.default_vat_rate ?? 15
  const vatAmt = totalExclVat * vatRate / 100
  const totalInclVat = totalExclVat + vatAmt
  const hasCharges = calloutFee > 0 || labourCharge > 0

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            {logoBase64 ? (
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Image src={logoBase64} style={{ width: 200 }} />
              </View>
            ) : null}
            <Text style={s.company}>{companyName}</Text>
            {settings?.cidb_registration_number && (
              <Text style={s.companyMeta}>CIDB: {settings.cidb_registration_number}</Text>
            )}
            {settings?.vat_registration_number && (
              <Text style={s.companyMeta}>VAT: {settings.vat_registration_number}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docTitle}>{asInvoice ? 'INVOICE' : 'JOB CARD'}</Text>
            <Text style={s.docNum}>{jobCard.job_number}</Text>
            <Text style={[s.statusBadge, { color: statusColor, marginTop: 5 }]}>
              {jobCard.status.replace('_', ' ').toUpperCase()}
            </Text>
            <Text style={s.docMeta}>{TYPE_LABEL[jobCard.job_type] ?? jobCard.job_type}</Text>
            <Text style={s.docMeta}>Issued: {fmtDate(jobCard.created_at)}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Info grid */}
        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoHd}>JOB DETAILS</Text>
            <Text style={s.infoVal}>{jobCard.title}</Text>
            {jobCard.location && <Text style={s.infoRow}>{jobCard.location}</Text>}
            {jobCard.scheduled_at && (
              <Text style={s.infoRow}>Scheduled: {fmtDate(jobCard.scheduled_at)} at {fmtTime(jobCard.scheduled_at)}</Text>
            )}
            {jobCard.started_at && <Text style={s.infoRow}>Started: {fmtDate(jobCard.started_at)}</Text>}
            {jobCard.completed_at && <Text style={s.infoRow}>Completed: {fmtDate(jobCard.completed_at)}</Text>}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoHd}>CLIENT</Text>
            <Text style={s.infoVal}>{clientName ?? '—'}</Text>
            {clientEmail && <Text style={s.infoRow}>{clientEmail}</Text>}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoHd}>ASSIGNED TECHNICIAN</Text>
            <Text style={s.infoVal}>{staffName ?? '—'}</Text>
            {!Array.isArray(jobCard.staff) && jobCard.staff?.role && (
              <Text style={s.infoRow}>{jobCard.staff.role.replace('_', ' ')}</Text>
            )}
            {!Array.isArray(jobCard.staff) && jobCard.staff?.phone && (
              <Text style={s.infoRow}>{jobCard.staff.phone}</Text>
            )}
          </View>
        </View>

        {/* Work description */}
        {jobCard.work_description && (
          <View style={{ marginBottom: 12 }}>
            <Text style={s.secLabel}>Work Description</Text>
            <View style={s.textBox}><Text style={s.textContent}>{jobCard.work_description}</Text></View>
          </View>
        )}

        {/* Findings + Work Done + Resolution */}
        {(jobCard.work_found || jobCard.work_done || jobCard.resolution) && (
          <View>
            <Text style={s.secLabel}>Field Report</Text>
            <View style={s.infoGrid}>
              {jobCard.work_found && (
                <View style={s.infoBox}>
                  <Text style={s.infoHd}>WHAT WAS FOUND</Text>
                  <Text style={s.textContent}>{jobCard.work_found}</Text>
                </View>
              )}
              {jobCard.work_done && (
                <View style={s.infoBox}>
                  <Text style={s.infoHd}>WORK COMPLETED</Text>
                  <Text style={s.textContent}>{jobCard.work_done}</Text>
                </View>
              )}
              {jobCard.resolution && (
                <View style={s.infoBox}>
                  <Text style={s.infoHd}>RESOLUTION</Text>
                  <Text style={s.textContent}>{jobCard.resolution}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        {jobCard.notes && (
          <View style={{ marginBottom: 12 }}>
            <Text style={s.secLabel}>Notes</Text>
            <View style={s.textBox}><Text style={s.textContent}>{jobCard.notes}</Text></View>
          </View>
        )}

        {/* Materials + Charges */}
        {(materials.length > 0 || hasCharges) && (
          <View style={{ marginBottom: 14 }}>
            <Text style={s.secLabel}>{asInvoice ? 'Invoice Items' : 'Materials & Charges'}</Text>
            <View style={s.tableHead}>
              <Text style={[s.tableHdTxt, { flex: 3 }]}>Description</Text>
              <Text style={[s.tableHdTxt, { flex: 1, textAlign: 'right' }]}>Qty</Text>
              <Text style={[s.tableHdTxt, { flex: 1, textAlign: 'right' }]}>Unit Price</Text>
              <Text style={[s.tableHdTxt, { flex: 1, textAlign: 'right' }]}>Amount</Text>
            </View>
            {/* Call-out fee */}
            {calloutFee > 0 && (
              <View style={s.tableRow}>
                <Text style={[s.tableCell, { flex: 3 }]}>Call-out Fee</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>1</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtCurrency(calloutFee)}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtCurrency(calloutFee)}</Text>
              </View>
            )}
            {/* Labour */}
            {labourCharge > 0 && (
              <View style={s.tableRow}>
                <Text style={[s.tableCell, { flex: 3 }]}>
                  Labour{jobCard.labour_hours != null && jobCard.labour_rate != null
                    ? ` (${jobCard.labour_hours}h × R${jobCard.labour_rate}/hr)`
                    : ''}
                </Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>{jobCard.labour_hours ?? 1}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtCurrency(jobCard.labour_rate)}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtCurrency(labourCharge)}</Text>
              </View>
            )}
            {/* Materials */}
            {materials.map(m => (
              <View key={m.id} style={s.tableRow}>
                <Text style={[s.tableCell, { flex: 3 }]}>{m.description}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>{m.qty}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtCurrency(m.unit_price)}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtCurrency(m.unit_price != null ? m.qty * m.unit_price : null)}</Text>
              </View>
            ))}
            <View>
              <View style={[s.totalRow, { marginTop: 2 }]}>
                <Text style={[s.tableCell, { flex: 5, color: MUTED, fontSize: 8 }]}>Subtotal (excl. VAT)</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right', fontSize: 8, color: MUTED }]}>{fmtCurrency(totalExclVat)}</Text>
              </View>
              <View style={[s.totalRow, { marginTop: 1 }]}>
                <Text style={[s.tableCell, { flex: 5, color: MUTED, fontSize: 8 }]}>VAT ({vatRate}%)</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right', fontSize: 8, color: MUTED }]}>{fmtCurrency(vatAmt)}</Text>
              </View>
              <View style={[s.totalRow, { marginTop: 1, backgroundColor: ACCENT }]}>
                <Text style={[s.tableCell, { flex: 5, fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#fff' }]}>TOTAL (incl. VAT)</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#fff' }]}>{fmtCurrency(totalInclVat)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <View style={{ marginBottom: 14 }} wrap={false}>
            <Text style={s.secLabel}>Site Photos</Text>
            <View style={s.photoGrid}>
              {photos.slice(0, 9).map(p => (
                <View key={p.id} style={s.photoBox}>
                  <Image src={p.url} style={s.photoImg} />
                  {p.caption && <Text style={s.photoCaption}>{p.caption}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Client signature */}
        {jobCard.client_signature_url && (
          <View style={{ marginBottom: 14 }} wrap={false}>
            <Text style={s.secLabel}>Client Signature</Text>
            <View style={s.sigBox}>
              <Image src={jobCard.client_signature_url} style={s.sigImg} />
              <Text style={s.sigLabel}>{clientName ?? 'Client'} — {fmtDate(jobCard.completed_at ?? jobCard.created_at)}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>{companyName} · {jobCard.job_number}</Text>
          <Text style={s.footerTxt}>Generated via QuotingHub</Text>
        </View>
      </Page>
    </Document>
  )
}
