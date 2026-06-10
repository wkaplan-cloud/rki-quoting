'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, Loader2, Upload, ChevronRight, CheckCircle2, Receipt, Users, Plus, RotateCcw, Trash2, AlertCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MfgSettings } from '@/lib/mfg-types'
import type { PortalOrgMember } from '@/lib/elec-types'

const S = {
  bg:     '#F5F7F9',
  card:   '#FFFFFF',
  accent: '#1B4F8A',
  text:   '#18181B',
  muted:  '#71717A',
  border: '#E4E4E7',
  input:  '#F4F4F5',
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 mb-6" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <h2 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: S.muted }}>{title}</h2>
      {hint && <p className="text-xs mb-5" style={{ color: S.muted }}>{hint}</p>}
      {!hint && <div className="mb-5" />}
      <div className="space-y-4">{children}</div>
    </div>
  )
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

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors"
      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
      onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
      onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
    />
  )
}

function NumberInput({ value, onChange, placeholder, min }: { value: string; onChange: (v: string) => void; placeholder?: string; min?: number }) {
  return (
    <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} min={min}
      className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors"
      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
      onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
      onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
    />
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div onClick={() => onChange(!checked)}
        className="relative rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? S.accent : S.border, width: 40, height: 22 }}>
        <div className="absolute top-0.5 transition-transform rounded-full bg-white shadow"
          style={{ width: 18, height: 18, left: 2, transform: checked ? 'translateX(18px)' : 'translateX(0)' }} />
      </div>
      <span className="text-sm" style={{ color: S.text }}>{label}</span>
    </label>
  )
}

interface Props {
  portalAccountId: string
  settings: MfgSettings | null
  // Account tab
  accountEmail: string
  plan: string | null
  subscriptionStatus: string | null
  trialEndsAt: string | null
  staffCount: number
  setupFeePaid: boolean
  orgMembers: PortalOrgMember[]
  initialTab?: 'business' | 'account'
  receivePriceRequests?: boolean
}

export function MfgSettingsClient({ portalAccountId, settings, accountEmail, plan, subscriptionStatus, trialEndsAt, staffCount, setupFeePaid, orgMembers, initialTab = 'business', receivePriceRequests: initialReceivePriceRequests = false }: Props) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'business' | 'account'>(initialTab)

  // ── Business tab state ──────────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState(settings?.business_name ?? '')
  const [logoUrl, setLogoUrl]           = useState(settings?.logo_url ?? '')
  const [address, setAddress]           = useState(settings?.address ?? '')
  const [email, setEmail]               = useState(settings?.email ?? '')
  const [phone, setPhone]               = useState(settings?.phone ?? '')
  const [companyReg, setCompanyReg]     = useState(settings?.company_registration_number ?? '')
  const [vatRegistered, setVatRegistered] = useState(settings?.vat_registered ?? false)
  const [vatNumber, setVatNumber]         = useState(settings?.vat_registration_number ?? '')
  const [vatRate, setVatRate]             = useState(String(settings?.default_vat_rate ?? 15))
  const [bankName, setBankName]             = useState(settings?.bank_name ?? '')
  const [bankHolder, setBankHolder]         = useState(settings?.bank_account_holder ?? '')
  const [bankAccount, setBankAccount]       = useState(settings?.bank_account_number ?? '')
  const [bankBranch, setBankBranch]         = useState(settings?.bank_branch_code ?? '')
  const [bankType, setBankType]             = useState(settings?.bank_account_type ?? 'cheque')
  const [markup, setMarkup]             = useState(String(settings?.default_markup_percentage ?? 30))
  const [validity, setValidity]         = useState(String(settings?.quote_validity_days ?? 30))
  const [deposit, setDeposit]           = useState(String(settings?.default_deposit_percentage ?? 50))
  const [paymentTerms, setPaymentTerms] = useState(settings?.default_payment_terms ?? '50% deposit on acceptance, balance on completion.')
  const [quotePrefix, setQuotePrefix]     = useState(settings?.quote_prefix ?? 'QUO')
  const [invoicePrefix, setInvoicePrefix] = useState(settings?.invoice_prefix ?? 'INV')
  const [accentColor, setAccentColor]     = useState(settings?.accent_color ?? '#1B4F8A')
  const [tandc, setTandc] = useState(settings?.terms_and_conditions ?? '')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploading, setUploading] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef    = useRef(true)

  // ── Account tab state ───────────────────────────────────────────────────────
  const [members, setMembers]         = useState<PortalOrgMember[]>(orgMembers)
  const [showInvite, setShowInvite]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName]   = useState('')
  const [inviting, setInviting]       = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteDone, setInviteDone]   = useState(false)
  const [resending, setResending]     = useState<string | null>(null)
  const [resentId, setResentId]       = useState<string | null>(null)
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm]       = useState(false)
  const [deleteRequesting, setDeleteRequesting] = useState(false)
  const [deleteRequested, setDeleteRequested]   = useState(false)
  const [deleteError, setDeleteError]           = useState('')

  // Supplier network toggle
  const [receivePriceRequests, setReceivePriceRequests] = useState(initialReceivePriceRequests)
  const [savingNetwork, setSavingNetwork] = useState(false)

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [saved])

  const handleSave = useCallback(async () => {
    setSaving(true); setSaveError('')
    const res = await fetch('/api/supplier-portal/manufacturing/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_name: businessName.trim() || null,
        logo_url: logoUrl.trim() || null,
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        company_registration_number: companyReg.trim() || null,
        vat_registered: vatRegistered,
        vat_registration_number: vatNumber.trim() || null,
        default_vat_rate: vatRate !== '' ? parseFloat(vatRate) : 15,
        bank_name: bankName.trim() || null,
        bank_account_holder: bankHolder.trim() || null,
        bank_account_number: bankAccount.trim() || null,
        bank_branch_code: bankBranch.trim() || null,
        bank_account_type: bankType || null,
        default_markup_percentage: markup !== '' ? parseFloat(markup) : 30,
        quote_validity_days: validity !== '' ? parseInt(validity) : 30,
        default_deposit_percentage: deposit !== '' ? parseFloat(deposit) : 50,
        default_payment_terms: paymentTerms.trim() || null,
        quote_prefix: quotePrefix.trim() || 'QUO',
        invoice_prefix: invoicePrefix.trim() || 'INV',
        accent_color: accentColor || '#1B4F8A',
        terms_and_conditions: tandc.trim() || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setSaveError((d as { error?: string }).error ?? 'Save failed'); return }
    setSaved(true)
  }, [businessName, logoUrl, address, email, phone, companyReg, vatRegistered, vatNumber, vatRate, bankName, bankHolder, bankAccount, bankBranch, bankType, markup, validity, deposit, paymentTerms, quotePrefix, invoicePrefix, accentColor, tandc])

  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return }
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { void handleSave() }, 1500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [businessName, logoUrl, address, email, phone, companyReg, vatRegistered, vatNumber, vatRate, bankName, bankHolder, bankAccount, bankBranch, bankType, markup, validity, deposit, paymentTerms, quotePrefix, invoicePrefix, accentColor, tandc, handleSave])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `mfg-logos/${portalAccountId}.${ext}`
    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (upErr) { setUploading(false); setSaveError('Logo upload failed'); return }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
    setLogoUrl(urlData.publicUrl)
    setUploading(false)
  }

  async function handleResend(memberId: string, memberEmail: string, memberName: string | null) {
    setResending(memberId)
    await fetch('/api/supplier-portal/quoting/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: memberEmail, name: memberName ?? undefined }),
    })
    setResending(null)
    setResentId(memberId)
    setTimeout(() => setResentId(null), 3000)
  }

  async function handleDeleteMember(memberId: string) {
    if (!confirm('Remove this admin? If they have already accepted the invite, their account will be deleted.')) return
    setDeleting(memberId)
    const res = await fetch('/api/supplier-portal/quoting/team/remove', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    setDeleting(null)
    if (res.ok) setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  async function handleInviteAdmin() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteError(''); setInviteDone(false)
    const res = await fetch('/api/supplier-portal/quoting/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim() || undefined }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setInviting(false)
    if (!res.ok || !data.ok) { setInviteError(data.error ?? 'Failed'); return }
    setInviteDone(true)
    setMembers(prev => [...prev, {
      id: crypto.randomUUID(),
      portal_account_id: portalAccountId,
      auth_user_id: null,
      email: inviteEmail.trim(),
      name: inviteName.trim() || null,
      role: 'admin',
      invited_by: null,
      invite_token: null,
      invited_at: new Date().toISOString(),
      accepted_at: null,
      created_at: new Date().toISOString(),
    }])
    setInviteEmail(''); setInviteName('')
    setTimeout(() => { setInviteDone(false); setShowInvite(false) }, 2000)
  }

  async function handleDeleteRequest() {
    setDeleteRequesting(true); setDeleteError('')
    try {
      const res = await fetch('/api/supplier-portal/delete-request', { method: 'POST' })
      if (!res.ok) throw new Error()
      setDeleteRequested(true)
    } catch {
      setDeleteError('Failed to send deletion request. Please email hello@quotinghub.co.za directly.')
    } finally {
      setDeleteRequesting(false)
    }
  }

  const isActive  = subscriptionStatus === 'active'
  const isTrialing = subscriptionStatus === 'trialing' && trialEndsAt != null && new Date(trialEndsAt) > new Date()
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000)) : 0

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: '#F1F5F9' }}>
        {(['business', 'account'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors"
            style={activeTab === t
              ? { background: '#FFFFFF', color: '#18181B', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
              : { color: '#6B7280' }}>
            {t === 'business' ? 'Business' : 'Account'}
          </button>
        ))}
      </div>

      {/* ── Business tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'business' && (
        <>
          <Section title="Business Identity" hint="Appears on every quote and invoice PDF.">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Business Name">
                  <Input value={businessName} onChange={setBusinessName} placeholder="Craft Woodworks (Pty) Ltd" />
                </Field>
              </div>
              <Field label="Email">
                <Input type="email" value={email} onChange={setEmail} placeholder="info@craftwoodworks.co.za" />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={setPhone} placeholder="021 555 0123" />
              </Field>
              <div className="col-span-2">
                <Field label="Address">
                  <Input value={address} onChange={setAddress} placeholder="14 Mill Street, Cape Town" />
                </Field>
              </div>
              <Field label="Company Registration No.">
                <Input value={companyReg} onChange={setCompanyReg} placeholder="2019/123456/07" />
              </Field>
            </div>
            <div className="pt-2">
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: S.muted }}>Logo</label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain rounded-lg border" style={{ borderColor: S.border }} />
                ) : (
                  <div className="h-14 w-24 rounded-lg flex items-center justify-center text-xs" style={{ background: S.input, border: `1.5px dashed ${S.border}`, color: S.muted }}>
                    No logo
                  </div>
                )}
                <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}>
                  <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                </label>
              </div>
            </div>
          </Section>

          <Section title="VAT">
            <Toggle checked={vatRegistered} onChange={setVatRegistered} label="I am VAT registered" />
            {vatRegistered && (
              <div className="grid grid-cols-2 gap-4 pt-1">
                <Field label="VAT Registration Number">
                  <Input value={vatNumber} onChange={setVatNumber} placeholder="4560123456" />
                </Field>
                <Field label="VAT Rate (%)" hint="Standard SA VAT = 15%">
                  <NumberInput value={vatRate} onChange={setVatRate} placeholder="15" min={0} />
                </Field>
              </div>
            )}
          </Section>

          <Section title="Banking Details" hint="Printed on every quote and invoice. Clients use this to pay deposits.">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bank Name">
                <Input value={bankName} onChange={setBankName} placeholder="First National Bank" />
              </Field>
              <Field label="Account Holder">
                <Input value={bankHolder} onChange={setBankHolder} placeholder="Craft Woodworks (Pty) Ltd" />
              </Field>
              <Field label="Account Number">
                <Input value={bankAccount} onChange={setBankAccount} placeholder="62 8374 9201" />
              </Field>
              <Field label="Branch Code">
                <Input value={bankBranch} onChange={setBankBranch} placeholder="250 655" />
              </Field>
              <Field label="Account Type">
                <select value={bankType} onChange={e => setBankType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}>
                  <option value="cheque">Cheque / Current</option>
                  <option value="savings">Savings</option>
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Quote Defaults" hint="Pre-filled on every new quote. Override per quote as needed.">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Default Markup (%)" hint="Applied to materials. Adjustable per line item.">
                <NumberInput value={markup} onChange={setMarkup} placeholder="30" min={0} />
              </Field>
              <Field label="Quote Validity (days)">
                <NumberInput value={validity} onChange={setValidity} placeholder="30" min={1} />
              </Field>
              <Field label="Default Deposit (%)">
                <NumberInput value={deposit} onChange={setDeposit} placeholder="50" min={0} />
              </Field>
            </div>
            <Field label="Default Payment Terms">
              <textarea value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} rows={2}
                placeholder="50% deposit on acceptance, balance on completion."
                className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none resize-none transition-colors"
                style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
                onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
                onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
              />
            </Field>
          </Section>

          <Section title="Document Numbering">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Quote Prefix" hint={`e.g. ${quotePrefix || 'QUO'}-001`}>
                <Input value={quotePrefix} onChange={v => setQuotePrefix(v.toUpperCase().slice(0, 6))} placeholder="QUO" />
              </Field>
              <Field label="Invoice Prefix" hint={`e.g. ${invoicePrefix || 'INV'}-001`}>
                <Input value={invoicePrefix} onChange={v => setInvoicePrefix(v.toUpperCase().slice(0, 6))} placeholder="INV" />
              </Field>
              <Field label="Accent Colour" hint="Used on PDF headers">
                <div className="flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5"
                    style={{ background: S.input, border: `1.5px solid ${S.border}` }} />
                  <span className="text-sm font-mono" style={{ color: S.muted }}>{accentColor}</span>
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Terms & Conditions" hint="Printed at the bottom of every quote and invoice PDF.">
            <textarea value={tandc} onChange={e => setTandc(e.target.value)} rows={8}
              placeholder="1. Payment terms: 50% deposit on acceptance of quotation, balance on completion.&#10;2. All prices are valid for 30 days from date of quotation.&#10;3. ..."
              className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none resize-y transition-colors"
              style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
              onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
              onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
            />
          </Section>

          {saveError && (
            <p className="px-4 py-3 rounded-lg text-sm mb-4" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
              {saveError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pb-12 text-xs" style={{ color: S.muted }}>
            {saving && <><Loader2 size={12} className="animate-spin" /> Saving…</>}
            {saved && !saving && <><Check size={12} style={{ color: '#16A34A' }} /><span style={{ color: '#16A34A' }}>Saved</span></>}
          </div>
        </>
      )}

      {/* ── Account tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <div className="space-y-6">

          {/* Subscription */}
          <div className="p-5 rounded-2xl space-y-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.muted }}>Subscription</p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {isTrialing ? (
                  <>
                    <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(217,164,65,0.15)', color: '#D9A441' }}>
                      Free Trial
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(217,164,65,0.1)', color: '#D9A441' }}>
                      {trialDaysLeft}d remaining
                    </span>
                    <p className="w-full text-xs mt-1" style={{ color: '#92400E' }}>
                      You have full access during your trial. Subscribe before it expires to keep access.
                    </p>
                  </>
                ) : isActive ? (
                  <span className="text-xs flex items-center gap-1" style={{ color: '#16A34A' }}>
                    <CheckCircle2 size={12} /> Active subscription
                  </span>
                ) : (
                  <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ background: '#F4F4F5', color: S.muted }}>
                    No active subscription
                  </span>
                )}
              </div>
              {isTrialing && (
                <a href="/supplier-portal/upgrade"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white flex-shrink-0"
                  style={{ background: '#D9A441' }}>
                  Subscribe Now <ChevronRight size={14} />
                </a>
              )}
              {!isTrialing && !isActive && (
                <a href="/supplier-portal/upgrade"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
                  style={{ background: S.accent }}>
                  Reactivate <ChevronRight size={14} />
                </a>
              )}
            </div>

            {/* Setup fee */}
            {!setupFeePaid && (
              <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 rounded-xl"
                style={{ background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.25)' }}>
                <div className="flex items-start gap-3">
                  <Receipt size={14} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#92400E' }}>Setup & Training fee outstanding</p>
                    <p className="text-xs mt-0.5" style={{ color: '#92400E', opacity: 0.8 }}>R2,500 once-off — covers onboarding, staff device setup, and training.</p>
                  </div>
                </div>
                <a href="https://paystack.com/buy/setup--training--r2500-once-off-vmoejb"
                  target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: '#D97706', color: '#fff' }}>
                  Pay R2,500 →
                </a>
              </div>
            )}

            {/* Extra staff */}
            {isActive && staffCount > 20 && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(217,164,65,0.07)', border: '1px solid rgba(217,164,65,0.25)' }}>
                <Users size={14} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#92400E' }}>
                    Extra staff charge — {staffCount - 20} staff over limit
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#92400E', opacity: 0.8 }}>
                    Your plan includes 20 staff. An additional <strong>R{(staffCount - 20) * 40}/month</strong> will be added.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Supplier Network */}
          <div className="p-5 rounded-2xl space-y-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.muted }}>Supplier Network</p>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium mb-0.5" style={{ color: S.text }}>Receive price requests from designers</p>
                <p className="text-xs leading-relaxed" style={{ color: S.muted }}>
                  When enabled, interior designers on QuotingHub can send you product pricing requests and your business appears in the supplier network.
                </p>
              </div>
              <div className="flex-shrink-0 pt-0.5">
                <div
                  onClick={async () => {
                    const next = !receivePriceRequests
                    setReceivePriceRequests(next)
                    setSavingNetwork(true)
                    await fetch('/api/supplier-portal/account', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ receive_price_requests: next }),
                    })
                    setSavingNetwork(false)
                  }}
                  className="relative rounded-full transition-colors flex-shrink-0 cursor-pointer"
                  style={{ background: receivePriceRequests ? S.accent : S.border, width: 40, height: 22, opacity: savingNetwork ? 0.6 : 1 }}
                >
                  <div className="absolute top-0.5 transition-transform rounded-full bg-white shadow"
                    style={{ width: 18, height: 18, left: 2, transform: receivePriceRequests ? 'translateX(18px)' : 'translateX(0)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Login email */}
          <div className="p-4 rounded-2xl" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: S.muted }}>Login Email</p>
            <p className="text-sm font-medium mt-2" style={{ color: '#52525B' }}>{accountEmail}</p>
            <p className="text-xs mt-1" style={{ color: '#A1A1AA' }}>Email cannot be changed. Contact support if needed.</p>
          </div>

          {/* Admin users */}
          <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.muted }}>Admin Users</p>
                <p className="text-xs mt-0.5" style={{ color: '#A1A1AA' }}>Give other people full admin access to this organisation.</p>
              </div>
              <button onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: S.accent, background: 'rgba(27,79,138,0.08)' }}>
                <Plus size={12} /> Invite Admin
              </button>
            </div>

            {members.length === 0 ? (
              <div className="py-8 text-center">
                <Users size={20} className="mx-auto mb-2" style={{ color: '#A1A1AA' }} />
                <p className="text-sm" style={{ color: S.muted }}>No additional admins yet</p>
              </div>
            ) : (
              members.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3.5"
                  style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: m.accepted_at ? S.accent : '#A1A1AA' }}>
                    {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {m.name && <p className="text-sm font-semibold" style={{ color: S.text }}>{m.name}</p>}
                    <p className="text-xs" style={{ color: S.muted }}>{m.email}</p>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: m.accepted_at ? 'rgba(22,163,74,0.1)' : 'rgba(217,164,65,0.1)', color: m.accepted_at ? '#16A34A' : '#D9A441' }}>
                    {m.accepted_at ? 'Active' : 'Pending'}
                  </span>
                  {!m.accepted_at && (
                    <button type="button" onClick={() => void handleResend(m.id, m.email, m.name)}
                      disabled={resending === m.id} title="Resend invite"
                      className="flex-shrink-0 p-1.5 rounded-lg disabled:opacity-50"
                      style={{ color: resentId === m.id ? '#16A34A' : '#A1A1AA' }}>
                      {resending === m.id ? <Loader2 size={14} className="animate-spin" /> : resentId === m.id ? <Check size={14} /> : <RotateCcw size={14} />}
                    </button>
                  )}
                  <button type="button" onClick={() => void handleDeleteMember(m.id)}
                    disabled={deleting === m.id} title="Remove admin"
                    className="flex-shrink-0 p-1.5 rounded-lg disabled:opacity-50"
                    style={{ color: '#A1A1AA' }}>
                    {deleting === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Danger zone */}
          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: S.muted }}>Danger Zone</p>
            {deleteRequested ? (
              <p className="text-sm px-4 py-3 rounded-lg" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                Deletion request sent. We&apos;ll remove your account within 1–2 business days.
              </p>
            ) : !deleteConfirm ? (
              <button type="button" onClick={() => setDeleteConfirm(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                Delete Account
              </button>
            ) : (
              <div className="p-4 rounded-lg space-y-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <p className="text-sm font-medium" style={{ color: '#DC2626' }}>Are you sure you want to delete your account?</p>
                <p className="text-xs" style={{ color: '#7F1D1D' }}>This will send a deletion request to QuotingHub. Your account will be removed within 1–2 business days. This cannot be undone.</p>
                {deleteError && <p className="text-xs" style={{ color: '#DC2626' }}>{deleteError}</p>}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleDeleteRequest} disabled={deleteRequesting}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                    style={{ background: '#DC2626', color: '#FFFFFF' }}>
                    {deleteRequesting && <Loader2 size={13} className="animate-spin" />}
                    {deleteRequesting ? 'Sending…' : 'Yes, delete my account'}
                  </button>
                  <button type="button" onClick={() => setDeleteConfirm(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg"
                    style={{ background: '#FFFFFF', color: S.muted, border: `1px solid ${S.border}` }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <h2 className="font-bold text-sm" style={{ color: S.text }}>Invite Admin</h2>
              <button onClick={() => setShowInvite(false)} style={{ color: S.muted }}><X size={15} /></button>
            </div>
            {inviteDone ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <CheckCircle2 size={36} style={{ color: '#16A34A' }} />
                <p className="text-sm font-semibold" style={{ color: S.text }}>Invite sent!</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Email *</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="admin@example.com"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Name (optional)</label>
                  <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                {inviteError && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                    <AlertCircle size={12} />{inviteError}
                  </div>
                )}
                <button onClick={() => void handleInviteAdmin()} disabled={inviting || !inviteEmail.trim()}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: S.accent }}>
                  {inviting ? <><Loader2 size={14} className="animate-spin inline mr-2" />Sending…</> : 'Send Invite'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
