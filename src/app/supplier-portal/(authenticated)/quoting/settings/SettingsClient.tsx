'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Zap, Link2, Link2Off, RefreshCw, ArrowUpRight } from 'lucide-react'
import type { ElecSettings } from '@/lib/elec-types'

const S = {
  bg:     '#F0F2F5',
  card:   '#FFFFFF',
  accent: '#3A7CA5',
  text:   '#18181B',
  muted:  '#71717A',
  border: '#E4E4E7',
  input:  '#F4F4F5',
}

function deriveCompanyCode(name: string): string {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 5)
}

interface Props {
  portalAccountId: string
  companyName: string
  settings: ElecSettings | null
  justUpgraded?: boolean
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>{label}</label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: S.muted }}>{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors"
      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
      onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
      onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
    />
  )
}

function NumberInput({ value, onChange, placeholder, min }: {
  value: string; onChange: (v: string) => void; placeholder?: string; min?: number
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors"
      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
      onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
      onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
    />
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <h2 className="text-sm font-bold uppercase tracking-widest mb-5" style={{ color: S.muted }}>{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

export function SettingsClient({ portalAccountId, companyName, settings, justUpgraded = false }: Props) {
  const supabase = createClient()

  // Defaults
  const [vatRate, setVatRate]               = useState(String(settings?.default_vat_rate ?? 15))
  const [retention, setRetention]           = useState(String(settings?.default_retention_percentage ?? 0))
  const [paymentTerms, setPaymentTerms]     = useState(String(settings?.default_payment_terms_days ?? 30))
  const [defectsLiability, setDefectsLiability] = useState(String(settings?.default_defects_liability_days ?? 90))

  // Company code + prefixes
  const [companyCodeVal, setCompanyCodeVal] = useState(settings?.company_code ?? '')
  const [quotePrefix, setQuotePrefix]   = useState(settings?.quote_prefix ?? 'QU')
  const [claimPrefix, setClaimPrefix]   = useState(settings?.claim_prefix ?? 'CLM')
  const [voPrefix, setVoPrefix]         = useState(settings?.vo_prefix ?? 'VO')
  const [cocPrefix, setCocPrefix]       = useState(settings?.coc_prefix ?? 'COC')

  // Footer
  const [footer, setFooter] = useState(settings?.email_footer_text ?? '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  // Sage
  const [sageConnected, setSageConnected] = useState(!!(settings?.sage_company_id))
  const [sageCompanyId, setSageCompanyId] = useState(settings?.sage_company_id ?? '')
  const [sageUsername, setSageUsername]   = useState(settings?.sage_username ?? '')
  const [sageEmail, setSageEmail]         = useState('')
  const [sagePassword, setSagePassword]   = useState('')
  const [sageConnecting, setSageConnecting] = useState(false)
  const [sageDisconnecting, setSageDisconnecting] = useState(false)
  const [sageError, setSageError]         = useState('')
  const [sageSuccess, setSageSuccess]     = useState('')

  async function handleSageConnect() {
    if (!sageEmail.trim() || !sagePassword.trim()) { setSageError('Email and password required'); return }
    setSageConnecting(true); setSageError(''); setSageSuccess('')
    const res = await fetch('/api/supplier-portal/quoting/sage/connect-basic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sageEmail.trim(), password: sagePassword }),
    })
    const data = await res.json()
    setSageConnecting(false)
    if (!res.ok) { setSageError(data.error ?? 'Connection failed'); return }
    setSageConnected(true)
    setSageCompanyId(data.company_id)
    setSageUsername(sageEmail.trim())
    setSageSuccess(`Connected to ${data.company_name}`)
    setSageEmail(''); setSagePassword('')
  }

  async function handleSageDisconnect() {
    if (!confirm('Disconnect Sage? You can reconnect at any time.')) return
    setSageDisconnecting(true)
    const res = await fetch('/api/supplier-portal/quoting/sage/disconnect', { method: 'POST' })
    setSageDisconnecting(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setSageError(d.error ?? 'Failed to disconnect'); return }
    setSageConnected(false); setSageCompanyId(''); setSageUsername(''); setSageSuccess(''); setSageError('')
  }

  // Auto-dismiss saved banner
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(t)
  }, [saved])

  async function handleSave() {
    setSaving(true)
    setError('')
    const derivedCode = deriveCompanyCode(companyName)

    // Core settings — always upsert these (no new columns required)
    const payload = {
      portal_account_id:              portalAccountId,
      default_vat_rate:               parseFloat(vatRate) || 15,
      default_retention_percentage:   parseFloat(retention) || 0,
      default_payment_terms_days:     parseInt(paymentTerms) || 30,
      default_defects_liability_days: parseInt(defectsLiability) || 90,
      quote_prefix:                   quotePrefix.trim() || 'QU',
      claim_prefix:                   claimPrefix.trim() || 'CLM',
      vo_prefix:                      voPrefix.trim() || 'VO',
      coc_prefix:                     cocPrefix.trim() || 'COC',
      email_footer_text:              footer.trim() || null,
      updated_at:                     new Date().toISOString(),
    }

    const { error: err } = await supabase
      .from('elec_settings')
      .upsert(payload, { onConflict: 'portal_account_id' })

    if (err) { setSaving(false); setError(err.message); return }

    // Company code — best-effort update (requires DB migration; silently skips if column absent)
    const codeToSave = companyCodeVal.trim().toUpperCase() || derivedCode || null
    const { error: codeErr } = await supabase
      .from('elec_settings')
      .update({ company_code: codeToSave })
      .eq('portal_account_id', portalAccountId)

    setSaving(false)
    // Ignore codeErr — column may not exist yet until migration is run
    if (!codeErr) {
      // If it saved fine, nothing extra to do
    }
    setSaved(true)
  }

  return (
    <div className="space-y-6">

        {/* Upgrade success banner */}
        {justUpgraded && (
          <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: 'rgba(58,124,165,0.1)', border: `1px solid rgba(58,124,165,0.25)` }}>
            <Zap size={16} style={{ color: S.accent, flexShrink: 0 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: S.accent }}>You&apos;re now on the Quoting plan</p>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>Complete your settings below and then head to the Quoting section to create your first quote.</p>
            </div>
          </div>
        )}

        {/* Quote Defaults */}
        <Section title="Quote Defaults">
          <p className="text-xs -mt-2 mb-2" style={{ color: S.muted }}>Pre-filled on every new quote. You can override per project.</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="VAT Rate (%)" hint="Standard SA VAT = 15">
              <NumberInput value={vatRate} onChange={setVatRate} placeholder="15" min={0} />
            </Field>
            <Field label="Retention (%)" hint="% held back until final completion">
              <NumberInput value={retention} onChange={setRetention} placeholder="0" min={0} />
            </Field>
            <Field label="Payment Terms (days)" hint="e.g. 30 = net 30">
              <NumberInput value={paymentTerms} onChange={setPaymentTerms} placeholder="30" min={1} />
            </Field>
            <Field label="Defects Liability (days)" hint="Standard = 90 days after practical completion">
              <NumberInput value={defectsLiability} onChange={setDefectsLiability} placeholder="90" min={1} />
            </Field>
          </div>
        </Section>

        {/* Document Prefixes */}
        <Section title="Document Numbering">
          {(() => {
            const derivedCode = deriveCompanyCode(companyName)
            const effectiveCode = companyCodeVal.trim().toUpperCase() || derivedCode
            const year = new Date().getFullYear()
            return (
              <>
                <div className="-mt-2 mb-4 flex items-end gap-4">
                  <div className="flex-1">
                    <Field label="Company Code" hint={`Auto-derived from your company name: "${derivedCode || '—'}". Override here if needed.`}>
                      <Input
                        value={companyCodeVal}
                        onChange={v => setCompanyCodeVal(v.toUpperCase().slice(0, 6))}
                        placeholder={derivedCode || 'e.g. RKI'}
                      />
                    </Field>
                  </div>
                  <div className="shrink-0 pb-0.5 text-right">
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: S.muted }}>Quote example</p>
                    <p className="text-xs font-mono font-semibold" style={{ color: S.text }}>
                      {effectiveCode ? `${effectiveCode}-${quotePrefix || 'QU'}-${year}-001` : `${quotePrefix || 'QU'}-${year}-001`}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <Field label="Quotes">
                    <Input value={quotePrefix} onChange={setQuotePrefix} placeholder="EQ" />
                  </Field>
                  <Field label="Claims">
                    <Input value={claimPrefix} onChange={setClaimPrefix} placeholder="CLM" />
                  </Field>
                  <Field label="Var. Orders">
                    <Input value={voPrefix} onChange={setVoPrefix} placeholder="VO" />
                  </Field>
                  <Field label="COC">
                    <Input value={cocPrefix} onChange={setCocPrefix} placeholder="COC" />
                  </Field>
                </div>
              </>
            )
          })()}
        </Section>

        {/* PDF Footer */}
        <Section title="PDF Footer">
          <Field label="Footer Text" hint="Appears at the bottom of all generated PDFs">
            <textarea
              value={footer}
              onChange={e => setFooter(e.target.value)}
              rows={3}
              placeholder="e.g. All work guaranteed for 12 months. E&OE."
              className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none resize-none transition-colors"
              style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
              onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
              onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
            />
          </Field>
        </Section>

        {/* Sage Accounting */}
        <Section title="Sage Accounting">
          {sageConnected ? (
            <div>
              <div className="flex items-center gap-3 p-4 rounded-xl mb-4" style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)' }}>
                <Link2 size={16} style={{ color: '#16A34A', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#16A34A' }}>Connected to Sage</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: S.muted }}>
                    {sageUsername && <span>{sageUsername} · </span>}
                    Company ID: {sageCompanyId}
                  </p>
                </div>
                <button onClick={handleSageDisconnect} disabled={sageDisconnecting}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ color: '#DC2626', background: '#FEF2F2' }}>
                  <Link2Off size={12} /> {sageDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
              {sageSuccess && <p className="text-xs mt-1" style={{ color: '#16A34A' }}>{sageSuccess}</p>}
              <p className="text-xs" style={{ color: S.muted }}>
                Claims and quotes can now be pushed to Sage as tax invoices directly from the Claims tab.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs mb-4 -mt-2" style={{ color: S.muted }}>
                Connect your Sage One account to push claims as tax invoices and automatically sync payment status.
              </p>
              <div className="space-y-3">
                <Field label="Sage Email">
                  <Input type="email" value={sageEmail} onChange={setSageEmail} placeholder="your@email.com" />
                </Field>
                <Field label="Sage Password">
                  <Input type="password" value={sagePassword} onChange={setSagePassword} placeholder="••••••••" />
                </Field>
              </div>
              {sageError && (
                <p className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                  {sageError}
                </p>
              )}
              <button onClick={handleSageConnect} disabled={sageConnecting || !sageEmail || !sagePassword}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                <ArrowUpRight size={14} /> {sageConnecting ? 'Connecting…' : 'Connect to Sage'}
              </button>
            </div>
          )}
        </Section>

        {error && (
          <p className="px-4 py-3 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            {error}
          </p>
        )}

        <div className="flex items-center justify-between pb-8">
          {saved ? (
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#16A34A' }}>
              <Check size={16} />
              Settings saved
            </div>
          ) : <div />}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
            style={{ background: S.accent }}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
    </div>
  )
}
