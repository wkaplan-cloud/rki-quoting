import { StyleSheet } from '@react-pdf/renderer'

export const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#2C2C2A', padding: 48 },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  brandName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1A1A18', letterSpacing: 0.5 },
  brandSub: { fontSize: 7, color: '#9A7B4F', marginTop: 2 },
  docTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1A1A18', textAlign: 'right' },
  docMeta: { fontSize: 8, color: '#8A877F', textAlign: 'right', marginTop: 4 },
  // Section
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 7, color: '#9A7B4F', marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', paddingBottom: 4 },
  // Client/supplier info
  infoGrid: { flexDirection: 'row', gap: 24 },
  infoBlock: { flex: 1 },
  infoKey: { fontSize: 7, color: '#8A877F', marginBottom: 2 },
  infoVal: { fontSize: 9, color: '#2C2C2A' },
  // Table
  table: { marginTop: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F5F2EC', paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#D8D3C8' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#EDE9E1' },
  tableRowAlt: { backgroundColor: '#FDFCF9' },
  th: { fontSize: 10, color: '#2C2C2A', fontFamily: 'Helvetica-Bold' },
  tableSectionRow: { flexDirection: 'row', backgroundColor: '#F5F2EC', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8' },
  tableSectionLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#9A7B4F' },
  td: { fontSize: 8.5, color: '#2C2C2A' },
  tdRight: { textAlign: 'right' },
  tdMuted: { color: '#8A877F' },
  // Totals
  totalsContainer: { marginTop: 16, alignItems: 'flex-end' },
  totalsBox: { width: 220, borderWidth: 1, borderColor: '#D8D3C8', borderRadius: 4, padding: 12 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalsLabel: { fontSize: 8, color: '#8A877F' },
  totalsVal: { fontSize: 8, color: '#2C2C2A' },
  totalsDivider: { borderTopWidth: 0.5, borderTopColor: '#D8D3C8', marginVertical: 6 },
  totalsBig: { flexDirection: 'row', justifyContent: 'space-between' },
  totalsBigLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  totalsBigVal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  totalsDeposit: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  totalsDepositLabel: { fontSize: 8, color: '#9A7B4F' },
  totalsDepositVal: { fontSize: 8, color: '#9A7B4F', fontFamily: 'Helvetica-Bold' },
  // Footer
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: '#D8D3C8', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#8A877F', flex: 1 },
  footerSig: { width: 140, textAlign: 'right' },
  sigLine: { borderTopWidth: 0.5, borderTopColor: '#2C2C2A', marginTop: 24, paddingTop: 4, fontSize: 7, color: '#8A877F' },
})
