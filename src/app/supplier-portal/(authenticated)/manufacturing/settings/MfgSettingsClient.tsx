'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, Loader2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MfgSettings } from '@/lib/mfg-types'

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
        className="relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0"
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
}

export function MfgSettingsClient({ portalAccountId, settings }: Props) {
  const supabase = createClient()

  // Business identity
  const [businessName, setBusinessName] = useState(settings?.business_name ?? '')
  const [logoUrl, setLogoUrl]           = useState(settings?.logo_url ?? '')
  const [address, setAddress]           = useState(settings?.address ?? '')
  const [email, setEmail]               = useState(settings?.email ?? '')
  const [phone, setPhone]               = useState(settings?.phone ?? '')
  const [companyReg, setCompanyReg]     = useState(settings?.company_registration_number ?? '')

  // VAT
  const [vatRegistered, setVatRegistered] = useState(settings?.vat_registered ?? false)
  const [vatNumber, setVatNumber]         = useState(settings?.vat_registration_number ?? '')
  const [vatRate, setVatRate]             = useState(String(settings?.default_vat_rate ?? 15))

  // Banking
  const [bankName, setBankName]             = useState(settings?.bank_name ?? '')
  const [bankHolder, setBankHolder]         = useState(settings?.bank_account_holder ?? '')
  const [bankAccount, setBankAccount]       = useState(settings?.bank_account_number ?? '')
  const [bankBranch, setBankBranch]         = useState(settings?.bank_branch_code ?? '')
  const [bankType, setBankType]             = useState(settings?.bank_account_type ?? 'cheque')

  // Quote defaults
  const [markup, setMarkup]             = useState(String(settings?.default_markup_percentage ?? 30))
  const [validity, setValidity]         = useState(String(settings?.quote_validity_days ?? 30))
  const [deposit, setDeposit]           = useState(String(settings?.default_deposit_percentage ?? 50))
  const [paymentTerms, setPaymentTerms] = useState(settings?.default_payment_terms ?? '50% deposit on acceptance, balance on completion.')

  // Document numbering
  const [quotePrefix, setQuotePrefix]     = useState(settings?.quote_prefix ?? 'QUO')
  const [invoicePrefix, setInvoicePrefix] = useState(settings?.invoice_prefix ?? 'INV')
  const [accentColor, setAccentColor]     = useState(settings?.accent_color ?? '#1B4F8A')

  // T&Cs
  const [tandc, setTandc] = useState(settings?.terms_and_conditions ?? '')

  // UI state
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')
  const [uploading, setUploading] = useState(false)
  const autoSaveTimer             = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef                = useRef(true)

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [saved])

  const handleSave = useCallback(async () => {
    setSaving(true); setError('')
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
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string }).error ?? 'Save failed'); return }
    setSaved(true)
  }, [businessName, logoUrl, address, email, phone, companyReg, vatRegistered, vatNumber, vatRate, bankName, bankHolder, bankAccount, bankBranch, bankType, markup, validity, deposit, paymentTerms, quotePrefix, invoicePrefix, accentColor, tandc])

  // Auto-save debounce (1.5s), skip first render
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
    if (upErr) { setUploading(false); setError('Logo upload failed'); return }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
    setLogoUrl(urlData.publicUrl)
    setUploading(false)
  }

  return (
    <div>
      {/* Business Identity */}
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

        {/* Logo */}
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

      {/* VAT */}
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

      {/* Banking */}
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

      {/* Quote Defaults */}
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

      {/* Document Numbering */}
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

      {/* Terms & Conditions */}
      <Section title="Terms & Conditions" hint="Printed at the bottom of every quote and invoice PDF.">
        <textarea value={tandc} onChange={e => setTandc(e.target.value)} rows={8}
          placeholder="1. Payment terms: 50% deposit on acceptance of quotation, balance on completion.&#10;2. All prices are valid for 30 days from date of quotation.&#10;3. ..."
          className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none resize-y transition-colors"
          style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
          onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
          onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
        />
      </Section>

      {error && (
        <p className="px-4 py-3 rounded-lg text-sm mb-4" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pb-12 text-xs" style={{ color: S.muted }}>
        {saving && <><Loader2 size={12} className="animate-spin" /> Saving…</>}
        {saved && !saving && <><Check size={12} style={{ color: '#16A34A' }} /><span style={{ color: '#16A34A' }}>Saved</span></>}
      </div>
    </div>
  )
}
