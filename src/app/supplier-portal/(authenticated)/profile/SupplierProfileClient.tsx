'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2, Upload, X } from 'lucide-react'

interface Props {
  portalAccountId: string
  account: {
    email: string
    company_name: string
    contact_name: string
    phone: string
    address: string
    categories: string[]
    description: string
    website: string
    logo_url: string | null
  }
  elecSettings: {
    cidb_registration_number: string | null
    company_registration_number: string | null
    vat_registration_number: string | null
    bank_name: string | null
    bank_account_number: string | null
    bank_branch_code: string | null
    bank_account_type: string | null
  } | null
  categoryOptions: string[]
}

const INPUT_STYLE = {
  background: '#F4F4F5',
  border: '1px solid #E4E4E7',
  color: '#18181B',
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>{label}</label>
      {hint && <p className="text-xs mb-1.5" style={{ color: '#52525B' }}>{hint}</p>}
      {children}
    </div>
  )
}

export function SupplierProfileClient({ portalAccountId, account, elecSettings, categoryOptions }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Business details
  const [companyName, setCompanyName] = useState(account.company_name)
  const [contactName, setContactName] = useState(account.contact_name)
  const [phone, setPhone] = useState(account.phone)
  const [address, setAddress] = useState(account.address)
  const [categories, setCategories] = useState<string[]>(account.categories)
  const [description, setDescription] = useState(account.description)
  const [website, setWebsite] = useState(account.website)

  // Company documents
  const [cidb, setCidb]       = useState(elecSettings?.cidb_registration_number ?? '')
  const [compReg, setCompReg] = useState(elecSettings?.company_registration_number ?? '')
  const [vatReg, setVatReg]   = useState(elecSettings?.vat_registration_number ?? '')

  // Banking
  const [bankName, setBankName]   = useState(elecSettings?.bank_name ?? '')
  const [accNumber, setAccNumber] = useState(elecSettings?.bank_account_number ?? '')
  const [branchCode, setBranchCode] = useState(elecSettings?.bank_branch_code ?? '')
  const [accType, setAccType]     = useState(elecSettings?.bank_account_type ?? 'Current')

  const [logoUrl, setLogoUrl] = useState<string | null>(account.logo_url)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteRequesting, setDeleteRequesting] = useState(false)
  const [deleteRequested, setDeleteRequested] = useState(false)

  function toggleCategory(cat: string) {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Logo must be under 5 MB'); return }
    setUploading(true); setError('')
    const ext = file.name.split('.').pop() ?? 'png'
    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload(`logo.${ext}`, file, { upsert: true, contentType: file.type })
    if (uploadError) { setError('Upload failed: ' + uploadError.message); setUploading(false); return }
    const { data } = supabase.storage.from('branding').getPublicUrl(`logo.${ext}`)
    const url = data.publicUrl + '?t=' + Date.now()
    setLogoUrl(url)
    // Save immediately so the logo persists without needing to hit Save Profile
    await fetch('/api/supplier-portal/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: url }),
    })
    setUploading(false)
  }

  async function handleDeleteRequest() {
    setDeleteRequesting(true)
    try {
      const res = await fetch('/api/supplier-portal/delete-request', { method: 'POST' })
      if (!res.ok) throw new Error()
      setDeleteRequested(true)
    } catch {
      setError('Failed to send deletion request. Please email hello@quotinghub.co.za directly.')
    } finally {
      setDeleteRequesting(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      // Save profile (company name, contact, etc.)
      const profileRes = await fetch('/api/supplier-portal/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName, contact_name: contactName, phone, address, categories, description, website, logo_url: logoUrl }),
      })
      const profileJson = await profileRes.json()
      if (!profileRes.ok) throw new Error(profileJson.error)

      // Save company documents & banking to elec_settings
      const docsBankingPayload = {
        portal_account_id:           portalAccountId,
        cidb_registration_number:    cidb.trim() || null,
        company_registration_number: compReg.trim() || null,
        vat_registration_number:     vatReg.trim() || null,
        bank_name:                   bankName.trim() || null,
        bank_account_number:         accNumber.trim() || null,
        bank_branch_code:            branchCode.trim() || null,
        bank_account_type:           accType.trim() || null,
        updated_at:                  new Date().toISOString(),
      }

      if (elecSettings) {
        const { error: elecErr } = await supabase
          .from('elec_settings')
          .update(docsBankingPayload)
          .eq('portal_account_id', portalAccountId)
        if (elecErr) throw new Error(elecErr.message)
      } else {
        const { error: elecErr } = await supabase
          .from('elec_settings')
          .insert({
            ...docsBankingPayload,
            default_vat_rate: 15,
            default_retention_percentage: 0,
            default_payment_terms_days: 30,
            default_defects_liability_days: 90,
            quote_prefix: 'EQ',
            claim_prefix: 'CLM',
            vo_prefix: 'VO',
            coc_prefix: 'COC',
          })
        if (elecErr) throw new Error(elecErr.message)
      }

      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors'
  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = '#71717A'),
    onBlur:  (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = '#E4E4E7'),
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181B' }}>Profile</h1>
        <p className="text-sm mt-0.5" style={{ color: '#71717A' }}>Your supplier account details</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Read-only email */}
        <div className="p-4 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#71717A' }}>Email</p>
          <p className="text-sm font-medium" style={{ color: '#52525B' }}>{account.email}</p>
          <p className="text-xs mt-1" style={{ color: '#A1A1AA' }}>Email cannot be changed. Contact support if needed.</p>
        </div>

        {/* Business Details */}
        <div className="p-5 rounded-xl space-y-5" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#71717A' }}>Business Details</p>

          {/* Logo upload */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#71717A' }}>Company Logo</label>
            <p className="text-xs mb-3" style={{ color: '#A1A1AA' }}>Appears on the top-left of all PDFs in place of your company name text. PNG or SVG recommended.</p>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Company logo" className="h-14 max-w-[200px] object-contain rounded-lg border p-2 bg-white" style={{ borderColor: '#E4E4E7' }} />
                  <button
                    type="button"
                    onClick={async () => { setLogoUrl(null); await fetch('/api/supplier-portal/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_url: null }) }) }}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: '#DC2626', color: '#fff' }}
                    title="Remove logo"
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <div className="h-14 w-32 rounded-lg flex items-center justify-center text-xs" style={{ border: '1.5px dashed #E4E4E7', color: '#A1A1AA' }}>
                  No logo
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleLogoUpload(f); e.target.value = '' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-50 transition-opacity"
                  style={{ background: '#F4F4F5', color: '#18181B', border: '1px solid #E4E4E7' }}
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {uploading ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
                </button>
                <p className="text-[10px] mt-1.5" style={{ color: '#A1A1AA' }}>Max 5 MB · PNG, JPG, or SVG</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Company / Trading Name">
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
            </Field>
            <Field label="Contact Name">
              <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                placeholder="Your full name" className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+27 11 000 0000" className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
            </Field>
            <Field label="Website">
              <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                placeholder="https://yoursite.co.za" className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
            </Field>
          </div>

          <Field label="Address">
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="123 Main Rd, Johannesburg" className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
          </Field>

          <Field label="About" hint="Describe what you supply — designers will see this.">
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="e.g. Premium upholstery fabrics and trimmings…"
              className={`${inputCls} resize-none`} style={INPUT_STYLE}
              onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')} />
          </Field>
        </div>

        {/* Company Documents & Banking */}
        <div className="p-5 rounded-xl space-y-5" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#71717A' }}>Company Documents & Banking</p>
            <p className="text-xs mt-1" style={{ color: '#A1A1AA' }}>Registration numbers and banking details appear on your quotes and invoice PDFs.</p>
          </div>

          <Field label="CIDB Registration Number">
            <input type="text" value={cidb} onChange={e => setCidb(e.target.value)}
              placeholder="e.g. 123456" className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Company Registration">
              <input type="text" value={compReg} onChange={e => setCompReg(e.target.value)}
                placeholder="e.g. 2020/123456/07" className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
            </Field>
            <Field label="VAT Registration">
              <input type="text" value={vatReg} onChange={e => setVatReg(e.target.value)}
                placeholder="e.g. 4123456789" className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
            </Field>
          </div>

          <div className="pt-1" style={{ borderTop: '1px solid #F4F4F5' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#71717A' }}>Banking Details</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bank Name">
                  <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                    placeholder="e.g. FNB" className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
                </Field>
                <Field label="Account Type">
                  <select value={accType} onChange={e => setAccType(e.target.value)}
                    className={inputCls} style={INPUT_STYLE}
                    onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}>
                    <option>Current</option>
                    <option>Savings</option>
                    <option>Cheque</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Account Number">
                  <input type="text" value={accNumber} onChange={e => setAccNumber(e.target.value)}
                    placeholder="e.g. 62012345678" className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
                </Field>
                <Field label="Branch Code">
                  <input type="text" value={branchCode} onChange={e => setBranchCode(e.target.value)}
                    placeholder="e.g. 250655" className={inputCls} style={INPUT_STYLE} {...focusHandlers} />
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* What do you supply? */}
        <div className="p-5 rounded-xl space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#71717A' }}>What do you supply?</p>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map(cat => {
              const active = categories.includes(cat)
              return (
                <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    background: active ? '#34495E' : '#F4F4F5',
                    color: active ? '#FFFFFF' : '#71717A',
                    border: active ? '1px solid #34495E' : '1px solid #E4E4E7',
                  }}>
                  {active && <span className="mr-1">✓</span>}
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#1A1020', color: '#F87171', border: '1px solid #3B1F1F' }}>{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: '#34495E', color: '#FFFFFF' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#34D399' }}>
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </form>

      {/* Delete account */}
      <div className="pt-6 border-t border-[#E4E4E7]">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#71717A' }}>Danger Zone</p>
        {deleteRequested ? (
          <p className="text-sm px-4 py-3 rounded-lg" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
            Deletion request sent. We&apos;ll remove your account within 1–2 business days.
          </p>
        ) : !deleteConfirm ? (
          <button type="button" onClick={() => setDeleteConfirm(true)}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer"
            style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            Delete Account
          </button>
        ) : (
          <div className="p-4 rounded-lg space-y-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p className="text-sm font-medium" style={{ color: '#DC2626' }}>Are you sure you want to delete your account?</p>
            <p className="text-xs" style={{ color: '#7F1D1D' }}>
              This will send a deletion request to QuotingHub. Your account will be removed within 1–2 business days. This cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleDeleteRequest} disabled={deleteRequesting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                style={{ background: '#DC2626', color: '#FFFFFF' }}>
                {deleteRequesting && <Loader2 size={13} className="animate-spin" />}
                {deleteRequesting ? 'Sending…' : 'Yes, delete my account'}
              </button>
              <button type="button" onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer"
                style={{ background: '#FFFFFF', color: '#71717A', border: '1px solid #E4E4E7' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
