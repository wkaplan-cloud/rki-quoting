'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Check, ChevronDown, ChevronRight, Loader2, AlertCircle, ThumbsUp, MessageSquare, Printer } from 'lucide-react'

const ACC    = '#3A7CA5'
const DARK   = '#18181B'
const MUTED  = '#71717A'
const BORDER = '#E4E4E7'
const GOLD   = '#D9A441'
const GREEN  = '#16A34A'
const DANGER = '#DC2626'
const SURF   = '#F8FAFC'
const SEC_BG = '#EFF6FF'
const PAGE   = '#F0F2F5'

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmt(date: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

const CONTRACT_LABELS: Record<string, string> = {
  lump_sum: 'Lump Sum',
  re_measurement: 'Re-measurement',
  cost_plus: 'Cost Plus',
}

interface QuoteData {
  quote: {
    id: string; quote_number: string; project_name: string; project_address: string | null
    project_type: string | null; contract_type: string; status: string; vat_rate: number
    retention_percentage: number; payment_terms_days: number; notes: string | null
    quoted_date: string | null; expected_completion_date: string | null
    approved_date: string | null; drawing_reference: string | null
  }
  client: { id: string; client_name: string; company: string | null; email: string | null; contact_number: string | null; address: string | null } | null
  sections: { id: string; title: string; sort_order: number }[]
  items: { id: string; section_id: string | null; description: string; unit: string | null; quoted_quantity: number; quoted_unit_rate: number; labour_rate: number | null; is_variation: boolean | null; sort_order: number }[]
  company: { company_name: string | null; email: string | null; logo_url: string | null; phone: string | null } | null
  settings: { vat_registration_number: string | null; company_registration_number: string | null; cidb_registration_number: string | null; bank_name: string | null; bank_account_number: string | null; bank_branch_code: string | null; bank_account_type: string | null } | null
}

export default function QuoteApprovalPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData]         = useState<QuoteData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [action, setAction]     = useState<'approve' | 'request_changes' | null>(null)
  const [notes, setNotes]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]         = useState<'approved' | 'requested' | null>(null)

  useEffect(() => {
    fetch(`/api/q/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        document.title = `${d.quote.quote_number} – ${d.quote.project_name} | QuotingHub`
        if (d.quote.status === 'approved') setDone('approved')
        setLoading(false)
      })
      .catch(() => { setError('Failed to load quote'); setLoading(false) })
  }, [token])

  async function submit() {
    if (!action || submitting) return
    setSubmitting(true)
    const res = await fetch(`/api/q/${token}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    })
    const json = await res.json()
    if (json.ok) setDone(action === 'approve' ? 'approved' : 'requested')
    else alert(json.error ?? 'Something went wrong')
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAGE }}>
      <Loader2 size={28} className="animate-spin" style={{ color: ACC }} />
    </div>
  )

  if (error || !data) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: PAGE }}>
      <AlertCircle size={32} style={{ color: DANGER }} />
      <p style={{ fontSize: 14, fontWeight: 500, color: DARK }}>Quote not found or link has expired.</p>
    </div>
  )

  const { quote, client, sections, items, company, settings } = data
  const subtotal  = items.reduce((s, i) => s + i.quoted_quantity * (i.quoted_unit_rate + (i.labour_rate ?? 0)), 0)
  const vatAmt    = subtotal * (quote.vat_rate / 100)
  const total     = subtotal + vatAmt
  const retention = subtotal * (quote.retention_percentage / 100)
  const isAlreadyActioned = done !== null || quote.status === 'approved' || quote.status === 'cancelled'

  const metaParts = [
    settings?.vat_registration_number  ? `VAT: ${settings.vat_registration_number}`   : null,
    settings?.company_registration_number ? `Reg: ${settings.company_registration_number}` : null,
    settings?.cidb_registration_number ? `Lic: ${settings.cidb_registration_number}` : null,
  ].filter(Boolean).join('  ·  ')

  const hasBanking = !!(settings?.bank_name || settings?.bank_account_number)

  const itemsBySection: Record<string, typeof items> = {}
  for (const item of items) {
    const key = item.section_id ?? '__free__'
    if (!itemsBySection[key]) itemsBySection[key] = []
    itemsBySection[key].push(item)
  }

  return (
    <div style={{ background: PAGE, minHeight: '100vh', padding: '32px 16px 48px' }}>
      {/* Responsive helpers */}
      <style>{`
        .doc-pad { padding: 48px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .totals-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
        @media (max-width: 600px) {
          .doc-pad { padding: 24px 20px; }
          .info-grid { grid-template-columns: 1fr; }
          .doc-header { flex-direction: column; gap: 16px; }
          .totals-row { flex-direction: column; }
        }
        @media print {
          .no-print { display: none !important; }
          body, .print-page { background: #fff !important; }
          .doc-card { box-shadow: none !important; border-radius: 0 !important; margin-bottom: 0 !important; }
          .line-item-row { padding: 4px 12px !important; }
          /* #E4E4E7 is too light to survive print rasterization at any border-width — darken for print.
             Excludes .doc-rule, the intentionally-bold dark header divider. */
          .doc-card *:not(.doc-rule) { border-color: #A0A0A0 !important; }
          .line-item-row, .info-box, .totals-box { break-inside: avoid; }
          .section-header { break-after: avoid; }
        }
      `}</style>

      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: DARK, border: `1px solid ${BORDER}` }}
          >
            <Printer size={14} /> Print Quote
          </button>
        </div>

        {/* ── Document card ── */}
        <div className="doc-pad doc-card" style={{ background: '#fff', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.10)', marginBottom: 20 }}>

          {/* Header */}
          <div className="doc-header" style={{ marginBottom: 22 }}>
            <div style={{ flex: 1, paddingRight: 24 }}>
              {company?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logo_url} alt="" style={{ maxWidth: 190, maxHeight: 56, objectFit: 'contain', display: 'block', marginBottom: 6 }} />
              )}
              <p style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 2 }}>{company?.company_name}</p>
              {company?.email && <p style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{company.email}</p>}
              {company?.phone && <p style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{company.phone}</p>}
              {metaParts && <p style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{metaParts}</p>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: ACC, letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>Quotation</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: DARK, lineHeight: 1, marginBottom: 6 }}>{quote.quote_number}</p>
              {quote.quoted_date && <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Date: {fmt(quote.quoted_date)}</p>}
              {quote.payment_terms_days > 0 && <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Payment terms: {quote.payment_terms_days} days</p>}
              {quote.status === 'approved' && (
                <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'rgba(22,163,74,0.1)', color: GREEN }}>
                  Approved{quote.approved_date ? ` · ${fmt(quote.approved_date)}` : ''}
                </span>
              )}
            </div>
          </div>

          {/* Rule */}
          <div className="doc-rule" style={{ borderTop: `1px solid ${DARK}`, marginBottom: 22 }} />

          {/* BILL TO / PROJECT */}
          <div className="info-grid" style={{ marginBottom: 22 }}>
            {client ? (
              <div className="info-box" style={{ border: `0.5px solid ${BORDER}`, borderRadius: 3, padding: 12 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: ACC, letterSpacing: 1, borderBottom: `0.5px solid ${BORDER}`, paddingBottom: 4, marginBottom: 8 }}>BILL TO</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 2 }}>{client.client_name}</p>
                {client.company        && <p style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{client.company}</p>}
                {client.email          && <p style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{client.email}</p>}
                {client.contact_number && <p style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{client.contact_number}</p>}
                {client.address        && <p style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{client.address}</p>}
              </div>
            ) : <div />}
            <div className="info-box" style={{ border: `0.5px solid ${BORDER}`, borderRadius: 3, padding: 12 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: ACC, letterSpacing: 1, borderBottom: `0.5px solid ${BORDER}`, paddingBottom: 4, marginBottom: 8 }}>PROJECT</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 2 }}>{quote.project_name}</p>
              {quote.project_address         && <p style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{quote.project_address}</p>}
              <p style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{CONTRACT_LABELS[quote.contract_type] ?? quote.contract_type}</p>
              {quote.expected_completion_date && <p style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Est. completion: {fmt(quote.expected_completion_date)}</p>}
              {quote.drawing_reference        && <p style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Drawing REF: {quote.drawing_reference}</p>}
            </div>
          </div>

          {/* Table */}
          <div style={{ marginBottom: 20 }}>
            {(itemsBySection['__free__'] ?? []).length > 0 && (
              <LineItemsTable items={itemsBySection['__free__'] ?? []} />
            )}
            {sections.map(sec => {
              const secItems = itemsBySection[sec.id] ?? []
              if (secItems.length === 0) return null
              const secTotal = secItems.reduce((s, i) => s + i.quoted_quantity * (i.quoted_unit_rate + (i.labour_rate ?? 0)), 0)
              const isCollapsed = collapsed[sec.id] ?? false
              return (
                <div key={sec.id} style={{ marginTop: 2 }}>
                  <button
                    className="section-header"
                    onClick={() => setCollapsed(c => ({ ...c, [sec.id]: !c[sec.id] }))}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: SEC_BG, border: `0.5px solid ${BORDER}`, borderBottom: isCollapsed ? `0.5px solid ${BORDER}` : 'none', textAlign: 'left', cursor: 'pointer' }}>
                    {isCollapsed
                      ? <ChevronRight size={13} style={{ color: ACC, flexShrink: 0 }} />
                      : <ChevronDown  size={13} style={{ color: ACC, flexShrink: 0 }} />}
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: ACC }}>{sec.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ACC }}>{fmtR(secTotal)}</span>
                  </button>
                  {!isCollapsed && <LineItemsTable items={secItems} indent />}
                </div>
              )
            })}
          </div>

          {/* Totals row */}
          <div className="totals-row">
            {hasBanking ? (
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: ACC, letterSpacing: 1, marginBottom: 8 }}>BANKING DETAILS</p>
                {settings?.bank_name           && <p style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 2 }}>{settings.bank_name}</p>}
                {settings?.bank_account_number && <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Acc: {settings.bank_account_number}</p>}
                {settings?.bank_branch_code    && <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Branch: {settings.bank_branch_code}</p>}
                {settings?.bank_account_type   && <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{settings.bank_account_type}</p>}
              </div>
            ) : <div style={{ flex: 1 }} />}

            <div className="totals-box" style={{ width: 230, border: `0.5px solid ${BORDER}`, borderRadius: 3, padding: 12, flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: MUTED }}>Subtotal (excl. VAT)</span>
                <span style={{ fontSize: 11, color: DARK }}>{fmtR(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: MUTED }}>VAT ({quote.vat_rate}%)</span>
                <span style={{ fontSize: 11, color: DARK }}>{fmtR(vatAmt)}</span>
              </div>
              <div style={{ borderTop: `0.5px solid ${BORDER}`, margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: ACC }}>TOTAL</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: ACC }}>{fmtR(total)}</span>
              </div>
              {retention > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: MUTED }}>Retention ({quote.retention_percentage}%)</span>
                  <span style={{ fontSize: 10, color: GOLD }}>{fmtR(retention)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: `0.5px solid ${BORDER}` }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: ACC, letterSpacing: 1, marginBottom: 6 }}>NOTES</p>
              <p style={{ fontSize: 11, color: DARK, lineHeight: 1.7 }}>{quote.notes}</p>
            </div>
          )}

        </div>

        {/* ── Approval panel ── */}
        <div className="no-print">
        {done === 'approved' ? (
          <div style={{ background: 'rgba(22,163,74,0.06)', border: `1.5px solid ${GREEN}`, borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(22,163,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Check size={24} style={{ color: GREEN }} />
            </div>
            <p style={{ fontWeight: 700, fontSize: 18, color: GREEN, marginBottom: 4 }}>Quote Approved</p>
            <p style={{ fontSize: 13, color: MUTED }}>
              {quote.approved_date ? `Approved on ${fmt(quote.approved_date)}. ` : ''}
              {company?.company_name ?? 'The contractor'} has been notified.
            </p>
          </div>
        ) : done === 'requested' ? (
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(58,124,165,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <MessageSquare size={24} style={{ color: ACC }} />
            </div>
            <p style={{ fontWeight: 700, fontSize: 18, color: DARK, marginBottom: 4 }}>Changes Requested</p>
            <p style={{ fontSize: 13, color: MUTED }}>Your feedback has been sent. {company?.company_name ?? 'The contractor'} will be in touch.</p>
          </div>
        ) : isAlreadyActioned ? (
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: MUTED }}>This quote is no longer pending approval.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: DARK, margin: '0 0 4px' }}>Your Response</h3>
            <p style={{ fontSize: 13, color: MUTED, margin: '0 0 20px' }}>Review the quote above and let us know how you&apos;d like to proceed.</p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <button onClick={() => setAction('approve')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: action === 'approve' ? GREEN : 'rgba(22,163,74,0.08)', color: action === 'approve' ? '#fff' : GREEN, border: `1.5px solid ${action === 'approve' ? GREEN : 'rgba(22,163,74,0.3)'}`, transition: 'all 0.15s' }}>
                <ThumbsUp size={15} /> Approve Quote
              </button>
              <button onClick={() => setAction('request_changes')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: action === 'request_changes' ? ACC : 'rgba(58,124,165,0.08)', color: action === 'request_changes' ? '#fff' : ACC, border: `1.5px solid ${action === 'request_changes' ? ACC : 'rgba(58,124,165,0.3)'}`, transition: 'all 0.15s' }}>
                <MessageSquare size={15} /> Request Changes
              </button>
            </div>
            {action === 'request_changes' && (
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Describe what you'd like changed…" style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 12, outline: 'none', resize: 'none', marginBottom: 16, background: '#F4F4F5', border: `1px solid ${BORDER}`, color: DARK, boxSizing: 'border-box' }} />
            )}
            {action && (
              <button onClick={() => void submit()} disabled={submitting || (action === 'request_changes' && !notes.trim())} style={{ width: '100%', padding: 12, borderRadius: 12, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: action === 'approve' ? GREEN : ACC, color: '#fff', cursor: 'pointer', opacity: (submitting || (action === 'request_changes' && !notes.trim())) ? 0.5 : 1, border: 'none', transition: 'opacity 0.15s' }}>
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {action === 'approve' ? 'Confirm Approval' : 'Send Feedback'}
              </button>
            )}
          </div>
        )}
        </div>

        <p className="no-print" style={{ textAlign: 'center', fontSize: 11, color: MUTED, marginTop: 20 }}>
          Powered by <span style={{ fontWeight: 600 }}>QuotingHub</span>
        </p>
      </div>
    </div>
  )
}

type Item = { description: string; unit: string | null; quoted_quantity: number; quoted_unit_rate: number; labour_rate: number | null; is_variation: boolean | null }

function LineItemsTable({ items, indent = false }: { items: Item[]; indent?: boolean }) {
  const hasLabour = items.some(i => (i.labour_rate ?? 0) > 0)
  const cols = hasLabour ? '1fr 48px 56px 96px 80px 96px' : '1fr 48px 56px 100px 100px'
  const headers = hasLabour
    ? ['Description', 'Unit', 'Qty', 'Unit Rate', '+Labour', 'Total']
    : ['Description', 'Unit', 'Qty', 'Rate', 'Total']

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: hasLabour ? 560 : 480 }}>
        {/* Blue header — matches PDF */}
        <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '7px 12px', background: ACC }}>
          {headers.map((h, i) => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: 0.5, textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
          ))}
        </div>
        {items.map((item, i) => {
          const lineTotal = item.quoted_quantity * (item.quoted_unit_rate + (item.labour_rate ?? 0))
          return (
            <div key={i} className="line-item-row" style={{ display: 'grid', gridTemplateColumns: cols, padding: '7px 12px', alignItems: 'start', borderBottom: `0.5px solid ${BORDER}`, background: i % 2 === 1 ? SURF : '#fff' }}>
              <div style={{ paddingLeft: indent ? 10 : 0, paddingRight: 8 }}>
                <span style={{ fontSize: 12, color: DARK }}>{item.description}</span>
                {item.is_variation && (
                  <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: GOLD, marginTop: 2 }}>VARIATION ORDER</span>
                )}
              </div>
              <span style={{ fontSize: 11, color: MUTED, textAlign: 'right' }}>{item.unit ?? '—'}</span>
              <span style={{ fontSize: 12, color: DARK, textAlign: 'right' }}>{item.quoted_quantity}</span>
              <span style={{ fontSize: 12, color: DARK, textAlign: 'right' }}>{fmtR(item.quoted_unit_rate)}</span>
              {hasLabour && (
                <span style={{ fontSize: 12, color: MUTED, textAlign: 'right' }}>{(item.labour_rate ?? 0) > 0 ? fmtR(item.labour_rate ?? 0) : '—'}</span>
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: DARK, textAlign: 'right' }}>{fmtR(lineTotal)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
