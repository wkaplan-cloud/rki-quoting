'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Upload, X, CheckCircle, Zap, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSearchParams, useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compressImage'

interface Settings {
  id?: string
  sage_access_token?: string | null
  sage_refresh_token?: string | null
  sage_token_expires_at?: string | null
  sage_company_id?: string | null
  sage_username?: string | null
  sage_item_id?: number | null
  xero_access_token?: string | null
  xero_tenant_id?: string | null
  xero_tenant_name?: string | null
  sourcing_enabled?: boolean | null
  business_name?: string | null
  business_address?: string | null
  vat_number?: string | null
  phone?: string | null
  email_from?: string | null
  logo_url?: string | null
  bank_name?: string | null
  bank_account_number?: string | null
  bank_branch_code?: string | null
  vat_rate?: number | null
  deposit_percentage?: number | null
  footer_text?: string | null
  terms_conditions?: string | null
  company_registration?: string | null
  quote_validity_days?: number | null
  payment_terms?: string | null
  lead_time?: string | null
  email_template_quote?: string | null
  email_template_invoice?: string | null
  accounts_email?: string | null
}

export function StudioSettingsForm({ settings, plan, isAdmin }: { settings: Settings | null; plan?: string; isAdmin?: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()

  const [sageConnected, setSageConnected] = useState(!!(settings?.sage_access_token || settings?.sage_username))
  const [sageCompanyId, setSageCompanyId] = useState(settings?.sage_company_id ?? '')
  const [xeroConnected, setXeroConnected] = useState(!!(settings?.xero_access_token && settings?.xero_tenant_id))
  const [xeroTenantName, setXeroTenantName] = useState(settings?.xero_tenant_name ?? '')
  const [disconnectingXero, setDisconnectingXero] = useState(false)
  const [fetchingCompanyId, setFetchingCompanyId] = useState(false)
  const [sageItems, setSageItems] = useState<{ id: number; label: string; code: string }[]>([])
  const [fetchingItems, setFetchingItems] = useState(false)
  const [showItemDropdown, setShowItemDropdown] = useState(false)
  const [selectedItemLabel, setSelectedItemLabel] = useState<string | null>(null)
  const [savedItemId, setSavedItemId] = useState(settings?.sage_item_id ? String(settings.sage_item_id) : '')
  const [showBasicForm, setShowBasicForm] = useState(false)
  const [basicEmail, setBasicEmail] = useState('')
  const [basicPassword, setBasicPassword] = useState('')
  const [connectingBasic, setConnectingBasic] = useState(false)

  type SessionInfo = { id: string; created_at: string; last_active_at: string; expires_at: string | null; is_current: boolean }
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [signingOutOthers, setSigningOutOthers] = useState(false)

  async function loadSessions() {
    setSessionsLoading(true)
    try {
      const res = await fetch('/api/account/sessions')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to load sessions'); return }
      setSessions(data.sessions ?? [])
      setSessionsLoaded(true)
    } catch {
      toast.error('Failed to load sessions')
    } finally {
      setSessionsLoading(false)
    }
  }

  async function signOutOthers() {
    if (!confirm('Sign out all other sessions? Any other devices will be logged out immediately.')) return
    setSigningOutOthers(true)
    try {
      await supabase.auth.signOut({ scope: 'others' })
      setSessions(s => s.filter(x => x.is_current))
      toast.success('All other sessions signed out')
    } catch {
      toast.error('Failed to sign out other sessions')
    } finally {
      setSigningOutOthers(false)
    }
  }

  async function fetchCompanyId() {
    setFetchingCompanyId(true)
    try {
      const res = await fetch('/api/sage/fetch-company-id', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to fetch company ID'); return }
      setSageCompanyId(data.company_id)
      setSageConnected(true)
      toast.success(`Company found: ${data.company_name} (ID: ${data.company_id})`)
    } catch {
      toast.error('Failed to fetch company ID')
    } finally {
      setFetchingCompanyId(false)
    }
  }

  async function fetchSageItems() {
    setFetchingItems(true)
    try {
      const res = await fetch('/api/sage/items')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to fetch Sage items'); return }
      setSageItems(data.items ?? [])
      setShowItemDropdown(true)
    } catch {
      toast.error('Failed to fetch Sage items')
    } finally {
      setFetchingItems(false)
    }
  }

  async function selectItem(item: { id: number; label: string; code: string }) {
    setShowItemDropdown(false)
    setSavedItemId(String(item.id))
    setSelectedItemLabel(item.label)
    // Also keep form in sync for the main save
    set('sage_item_id', String(item.id))
    // Auto-save immediately
    const { error } = await supabase.from('settings').update({ sage_item_id: item.id }).eq('id', settings!.id)
    if (error) {
      toast.error('Failed to save item: ' + error.message)
    } else {
      toast.success(`Sage item set to "${item.label}"`)
    }
  }

  async function connectBasic() {
    setConnectingBasic(true)
    try {
      const res = await fetch('/api/sage/connect-basic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: basicEmail, password: basicPassword }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to connect to Sage'); return }
      setSageConnected(true)
      setSageCompanyId(data.company_id)
      setShowBasicForm(false)
      setBasicEmail('')
      setBasicPassword('')
      toast.success(`Connected to Sage — ${data.company_name} (ID: ${data.company_id})`)
    } catch {
      toast.error('Failed to connect to Sage')
    } finally {
      setConnectingBasic(false)
    }
  }

  async function disconnectXero() {
    if (!confirm('Disconnect Xero? You will need to reconnect to push invoices.')) return
    setDisconnectingXero(true)
    const res = await fetch('/api/xero/disconnect', { method: 'POST' })
    if (res.ok) {
      setXeroConnected(false)
      setXeroTenantName('')
      toast.success('Xero disconnected')
    } else {
      toast.error('Failed to disconnect Xero')
    }
    setDisconnectingXero(false)
  }

  // Show toast from OAuth callback redirect params, then clear them from the URL
  useEffect(() => {
    if (searchParams.get('sage_connected') === '1') {
      toast.success('Sage connected successfully')
      setSageConnected(true)
      router.replace('/admin')
    }
    const err = searchParams.get('sage_error')
    if (err) {
      const messages: Record<string, string> = {
        invalid_state: 'Security check failed — please try connecting again',
        token_exchange_failed: 'Sage rejected the authorisation — please try again',
        no_code: 'No authorisation code returned from Sage',
        unknown: 'Something went wrong connecting to Sage',
      }
      toast.error(messages[err] ?? `Sage error: ${err}`)
      router.replace('/admin')
    }
    if (searchParams.get('xero_connected') === '1') {
      const tenant = searchParams.get('xero_tenant') ?? ''
      toast.success(tenant ? `Xero connected — ${tenant}` : 'Xero connected successfully')
      setXeroConnected(true)
      if (tenant) setXeroTenantName(tenant)
      router.replace('/admin')
    }
    const xeroErr = searchParams.get('xero_error')
    if (xeroErr) {
      const messages: Record<string, string> = {
        invalid_state: 'Security check failed — please try connecting again',
        token_exchange_failed: 'Xero rejected the authorisation — please try again',
        no_code: 'No authorisation code returned from Xero',
        unknown: 'Something went wrong connecting to Xero',
      }
      toast.error(messages[xeroErr] ?? `Xero error: ${xeroErr}`)
      router.replace('/admin')
    }
  }, [searchParams, router])

  const [form, setForm] = useState({
    business_name:          settings?.business_name ?? '',
    business_address:       settings?.business_address ?? '',
    vat_number:             settings?.vat_number ?? '',
    phone:                  settings?.phone ?? '',
    email_from:             settings?.email_from ?? '',
    logo_url:               settings?.logo_url ?? '',
    bank_name:              settings?.bank_name ?? '',
    bank_account_number:    settings?.bank_account_number ?? '',
    bank_branch_code:       settings?.bank_branch_code ?? '',
    vat_rate:               String(settings?.vat_rate ?? 15),
    deposit_percentage:     String(settings?.deposit_percentage ?? 50),
    footer_text:            settings?.footer_text ?? 'Thank you for your business.',
    terms_conditions:       settings?.terms_conditions ?? '',
    company_registration:   settings?.company_registration ?? '',
    email_template_quote:   settings?.email_template_quote ?? `Dear {{client_name}},\n\nPlease find attached your quotation for {{project_name}}.\n\nPlease don't hesitate to contact us should you have any questions or require any amendments.\n\nKind regards,\n{{studio_name}}`,
    email_template_invoice: settings?.email_template_invoice ?? `Dear {{client_name}},\n\nPlease find attached your invoice for {{project_name}}.\n\nKindly arrange payment at your earliest convenience.\n\nKind regards,\n{{studio_name}}`,
    accounts_email:         settings?.accounts_email ?? '',
    sage_item_id:           String(settings?.sage_item_id ?? ''),
    quote_validity_days:    String(settings?.quote_validity_days ?? 30),
    payment_terms:          settings?.payment_terms ?? '',
    lead_time:              settings?.lead_time ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function uploadLogo(file: File) {
    setUploading(true)
    let compressed: File
    try { compressed = await compressImage(file) } catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed'); setUploading(false); return }
    const ext = compressed.name.split('.').pop()
    const path = `logo.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload(path, compressed, { upsert: true, contentType: compressed.type })
    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploading(false); return }
    const { data } = supabase.storage.from('branding').getPublicUrl(path)
    set('logo_url', data.publicUrl + '?t=' + Date.now())
    toast.success('Logo uploaded')
    setUploading(false)
  }

  async function disconnectSage() {
    if (!confirm('Disconnect Sage? You will need to reconnect to push invoices.')) return
    setDisconnecting(true)
    const res = await fetch('/api/sage/disconnect', { method: 'POST' })
    if (res.ok) {
      setSageConnected(false)
      toast.success('Sage disconnected')
    } else {
      toast.error('Failed to disconnect Sage')
    }
    setDisconnecting(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('settings').update({
      ...form,
      vat_rate: parseFloat(form.vat_rate),
      deposit_percentage: parseFloat(form.deposit_percentage),
      sage_item_id: form.sage_item_id ? parseInt(form.sage_item_id) : null,
      quote_validity_days: form.quote_validity_days ? parseInt(form.quote_validity_days) : 30,
    }).eq('id', settings!.id)
    if (error) { toast.error(error.message) } else { toast.success('Studio settings saved') }
    setSaving(false)
  }

  const displayItemId = savedItemId
  const displayItemLabel = selectedItemLabel

  return (
    <div className="space-y-8">
    <form id="settings-form" onSubmit={save} className="space-y-8">

      {/* Row 1: Business Details + Branding & Contact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Business Details */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Business Details</h2>
          <Input label="Studio / Business Name" value={form.business_name} onChange={e => set('business_name', e.target.value)} />
          <Textarea label="Business Address" value={form.business_address} onChange={e => set('business_address', e.target.value)} rows={3} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="VAT Number" value={form.vat_number} onChange={e => set('vat_number', e.target.value)} />
            <Input label="Company Registration" value={form.company_registration} onChange={e => set('company_registration', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
            <Input label="Reply-to Email" type="email" value={form.email_from} onChange={e => set('email_from', e.target.value)} />
          </div>
          <Input label="Accounts Email (BCC on all POs)" type="email" value={form.accounts_email} onChange={e => set('accounts_email', e.target.value)} />
        </section>

        {/* Branding + Banking */}
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Branding</h2>
            <div>
              <label className="text-xs font-medium text-[#8A877F] block mb-2">Logo</label>
              <div className="flex items-center gap-4">
                {form.logo_url && (
                  <div className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.logo_url} alt="Logo" className="h-14 max-w-[180px] object-contain rounded border border-[#D8D3C8] p-2 bg-white" />
                    <button
                      type="button"
                      onClick={() => set('logo_url', '')}
                      className="absolute -top-1.5 -right-1.5 bg-white border border-[#D8D3C8] rounded-full p-0.5 text-[#8A877F] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#D8D3C8] rounded text-sm text-[#8A877F] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Upload size={14} />
                    {uploading ? 'Uploading…' : form.logo_url ? 'Replace logo' : 'Upload logo'}
                  </button>
                  <p className="text-xs text-[#8A877F] mt-1.5">PNG, JPG, or SVG — recommended min. 400px wide</p>
                </div>
              </div>
            </div>
          </section>

          {plan === 'agency' && (
            <section className="space-y-4 border-t border-[#EDE9E1] pt-6">
              <div>
                <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Custom Branded PDFs</h2>
                <p className="text-xs text-[#8A877F] mt-1">Upload your current invoice or letterhead and we will match it on your QuotingHub PDFs.</p>
              </div>
              <label className="flex items-center gap-2 px-4 py-3 bg-[#F5F2EC] border border-dashed border-[#D8D3C8] rounded cursor-pointer hover:border-[#9A7B4F] transition-colors w-fit">
                <Upload size={14} className="text-[#8A877F]" />
                <span className="text-sm text-[#8A877F]">{uploading ? 'Uploading…' : 'Upload file (PDF or image)'}</span>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploading(true)
                    let compressed: File
                    try { compressed = await compressImage(file) } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); setUploading(false); e.target.value = ''; return }
                    const ext = compressed.name.split('.').pop()
                    const path = `letterhead.${ext}`
                    const { error: uploadError } = await supabase.storage
                      .from('branding')
                      .upload(path, compressed, { upsert: true, contentType: compressed.type })
                    if (uploadError) { toast.error('Upload failed: ' + uploadError.message) }
                    else toast.success("Letterhead uploaded — we'll be in touch to apply your branding.")
                    setUploading(false)
                    e.target.value = ''
                  }}
                />
              </label>
            </section>
          )}

          <section className="space-y-4 border-t border-[#EDE9E1] pt-6">
            <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Banking Details</h2>
            <Input label="Bank Name" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Account Number" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} />
              <Input label="Branch Code" value={form.bank_branch_code} onChange={e => set('bank_branch_code', e.target.value)} />
            </div>
          </section>
        </div>
      </div>

      {/* Row 2: Quote Defaults + Email Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-[#EDE9E1] pt-8">

        {/* Quote Defaults */}
        <section className="space-y-4">
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Quote Defaults</h2>
          <div className="grid grid-cols-3 gap-4">
            <Input label="VAT Rate (%)" type="number" min="0" step="0.1" value={form.vat_rate} onChange={e => set('vat_rate', e.target.value)} />
            <Input label="Deposit (%)" type="number" min="0" max="100" step="1" value={form.deposit_percentage} onChange={e => set('deposit_percentage', e.target.value)} />
            <Input label="Quote Valid For (days)" type="number" min="1" step="1" value={form.quote_validity_days} onChange={e => set('quote_validity_days', e.target.value)} />
          </div>
          <Textarea label="Payment Terms (shown on quote PDF)" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} rows={2} placeholder="e.g. 50% deposit on order confirmation, balance payable before delivery." />
          <Input label="Estimated Lead Time (shown on quote PDF)" value={form.lead_time} onChange={e => set('lead_time', e.target.value)} placeholder="e.g. 6–8 weeks from deposit confirmation" />
          <Textarea label="Quote / Invoice Footer Text" value={form.footer_text} onChange={e => set('footer_text', e.target.value)} rows={3} />
          <Textarea label="Terms & Conditions (shown on quote PDF)" value={form.terms_conditions} onChange={e => set('terms_conditions', e.target.value)} rows={7} />
        </section>

        {/* Email Templates */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Email Templates</h2>
            <p className="text-xs text-[#8A877F] mt-1">Use <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{client_name}}'}</span>, <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{project_name}}'}</span>, <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{project_number}}'}</span>, <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{studio_name}}'}</span> as placeholders.</p>
          </div>
          <Textarea label="Quote Email Body" value={form.email_template_quote} onChange={e => set('email_template_quote', e.target.value)} rows={7} />
          <Textarea label="Invoice Email Body" value={form.email_template_invoice} onChange={e => set('email_template_invoice', e.target.value)} rows={7} />
        </section>
      </div>

    </form>

      {/* Sage Integration — Agency plan only, outside the main form to avoid state resets */}
      {/* Only show Sage if Xero is not connected */}
      {plan === 'agency' && !xeroConnected && <section className="space-y-4 border-t border-[#EDE9E1] pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Sage Business Cloud Accounting</h2>
          {sageConnected && (
            <div className="flex items-center gap-2">
              <CheckCircle size={13} className="text-green-600" />
              <span className="text-xs text-green-700 font-medium">Connected</span>
            </div>
          )}
        </div>

        {sageConnected ? (
          <>
          <div className="flex items-center justify-between bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg px-5 py-4">
            <div>
              <p className="text-sm font-medium text-[#2C2C2A]">Your Sage account is connected</p>
              <p className="text-xs text-[#8A877F] mt-0.5">
                Invoices can be pushed from any project. Payment status syncs automatically.
                {sageCompanyId && (
                  <span className="ml-1 font-mono">Company ID: {sageCompanyId}</span>
                )}
              </p>
              {!sageCompanyId && (
                <button
                  type="button"
                  onClick={fetchCompanyId}
                  disabled={fetchingCompanyId}
                  className="mt-2 text-xs text-[#9A7B4F] hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {fetchingCompanyId ? 'Fetching…' : 'Fetch Company ID from Sage →'}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={disconnectSage}
              disabled={disconnecting}
              className="ml-6 flex-shrink-0 text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50 cursor-pointer"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
          <div className="mt-3 max-w-xs space-y-2">
            <label className="text-xs font-medium text-[#8A877F] block">Sage Item (used on invoice lines)</label>
            {displayItemId ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-[#F5F2EC] border border-[#D8D3C8] rounded text-sm text-[#2C2C2A]">
                  {displayItemLabel ? `${displayItemLabel} (ID: ${displayItemId})` : `ID: ${displayItemId}`}
                </div>
                <button
                  type="button"
                  onClick={fetchSageItems}
                  disabled={fetchingItems}
                  className="text-xs text-[#9A7B4F] hover:underline disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {fetchingItems ? 'Loading…' : 'Change'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={fetchSageItems}
                disabled={fetchingItems}
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#D8D3C8] rounded text-sm text-[#8A877F] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {fetchingItems ? 'Fetching items…' : 'Select item from Sage →'}
              </button>
            )}
            {showItemDropdown && sageItems.length > 0 && (
              <div className="border border-[#D8D3C8] rounded bg-white shadow-sm max-h-48 overflow-y-auto">
                {sageItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F2EC] text-[#2C2C2A] border-b border-[#EDE9E1] last:border-0 cursor-pointer"
                  >
                    <span className="font-medium">{item.label}</span>
                    {item.code && <span className="ml-2 text-xs text-[#8A877F]">{item.code}</span>}
                    <span className="ml-2 text-xs text-[#8A877F] font-mono">ID: {item.id}</span>
                  </button>
                ))}
              </div>
            )}
            {showItemDropdown && sageItems.length === 0 && !fetchingItems && (
              <p className="text-xs text-[#8A877F]">No items found in Sage.</p>
            )}
          </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#8A877F]">
              Connect your Sage account to push invoices directly — no double-entry, no copy-paste.
              Choose the method that matches your Sage plan.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: OAuth (reseller/Sage ID) */}
              <div className="bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg px-5 py-4 flex flex-col gap-3">
                <div>
                  <p className="text-sm font-medium text-[#2C2C2A]">Connect via Sage ID</p>
                  <p className="text-xs text-[#8A877F] mt-0.5">For reseller plan users — redirects to Sage login.</p>
                </div>
                <a
                  href="/api/sage/connect"
                  className="self-start flex items-center gap-2 px-4 py-2 bg-[#1A1A18] text-white text-xs rounded hover:bg-[#2C2C2A] transition-colors"
                >
                  <Zap size={12} />
                  Connect via Sage ID
                </a>
              </div>

              {/* Option 2: Basic Auth (live accounting.sageone.co.za) */}
              <div className="bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg px-5 py-4 flex flex-col gap-3">
                <div>
                  <p className="text-sm font-medium text-[#2C2C2A]">Connect with email &amp; password</p>
                  <p className="text-xs text-[#8A877F] mt-0.5">For standard Sage accounts — uses your Sage login.</p>
                </div>
                {!showBasicForm ? (
                  <button
                    type="button"
                    onClick={() => setShowBasicForm(true)}
                    className="self-start flex items-center gap-2 px-4 py-2 bg-[#1A1A18] text-white text-xs rounded hover:bg-[#2C2C2A] transition-colors cursor-pointer"
                  >
                    <KeyRound size={12} />
                    Enter credentials
                  </button>
                ) : (
                  <div className="space-y-2">
                    <Input
                      label="Sage email"
                      type="email"
                      value={basicEmail}
                      onChange={e => setBasicEmail(e.target.value)}
                    />
                    <Input
                      label="Sage password"
                      type="password"
                      value={basicPassword}
                      onChange={e => setBasicPassword(e.target.value)}
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={connectBasic}
                        disabled={connectingBasic || !basicEmail || !basicPassword}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1A1A18] text-white text-xs rounded hover:bg-[#2C2C2A] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {connectingBasic ? 'Connecting…' : 'Connect'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowBasicForm(false); setBasicEmail(''); setBasicPassword('') }}
                        className="text-xs text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>}

      {/* Xero Integration — Agency plan only, only show if Sage is not connected */}
      {plan === 'agency' && !sageConnected && (
        <section className="space-y-4 border-t border-[#EDE9E1] pt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Xero Accounting</h2>
            {xeroConnected && (
              <div className="flex items-center gap-2">
                <CheckCircle size={13} className="text-green-600" />
                <span className="text-xs text-green-700 font-medium">Connected</span>
              </div>
            )}
          </div>

          {xeroConnected ? (
            <div className="flex items-center justify-between bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg px-5 py-4">
              <div>
                <p className="text-sm font-medium text-[#2C2C2A]">
                  {xeroTenantName ? `Connected to ${xeroTenantName}` : 'Your Xero account is connected'}
                </p>
                <p className="text-xs text-[#8A877F] mt-0.5">
                  Invoices can be pushed to Xero from any project as a draft.
                </p>
              </div>
              <button
                type="button"
                onClick={disconnectXero}
                disabled={disconnectingXero}
                className="ml-6 flex-shrink-0 text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50 cursor-pointer"
              >
                {disconnectingXero ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#8A877F]">
                Connect your Xero account to push invoices directly from any project — no double-entry.
              </p>
              <div className="bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg px-5 py-4 flex flex-col gap-3 w-fit">
                <div>
                  <p className="text-sm font-medium text-[#2C2C2A]">Connect via Xero</p>
                  <p className="text-xs text-[#8A877F] mt-0.5">Redirects to Xero to authorise QuotingHub.</p>
                </div>
                <a
                  href="/api/xero/connect"
                  className="self-start flex items-center gap-2 px-4 py-2 bg-[#1A1A18] text-white text-xs rounded hover:bg-[#2C2C2A] transition-colors"
                >
                  <Zap size={12} />
                  Connect Xero
                </a>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Active Sessions — admin only */}
      {isAdmin && (
        <section className="space-y-4 border-t border-[#EDE9E1] pt-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Active Sessions</h2>
              <p className="text-xs text-[#8A877F] mt-0.5">Devices currently signed in to your account.</p>
            </div>
            {!sessionsLoaded && (
              <button
                type="button"
                onClick={loadSessions}
                disabled={sessionsLoading}
                className="text-xs text-[#9A7B4F] hover:underline disabled:opacity-50 cursor-pointer"
              >
                {sessionsLoading ? 'Loading…' : 'Show sessions →'}
              </button>
            )}
          </div>

          {sessionsLoaded && (
            <>
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#2C2C2A]">
                          {s.is_current ? 'This device' : 'Other session'}
                        </span>
                        {s.is_current && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">current</span>
                        )}
                      </div>
                      <p className="text-xs text-[#8A877F] mt-0.5">
                        Started {new Date(s.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}Last active {new Date(s.last_active_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {sessions.filter(s => !s.is_current).length > 0 && (
                <button
                  type="button"
                  onClick={signOutOthers}
                  disabled={signingOutOthers}
                  className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50 cursor-pointer"
                >
                  {signingOutOthers ? 'Signing out…' : `Sign out ${sessions.filter(s => !s.is_current).length} other session${sessions.filter(s => !s.is_current).length > 1 ? 's' : ''}`}
                </button>
              )}
              {sessions.filter(s => !s.is_current).length === 0 && (
                <p className="text-xs text-[#8A877F]">No other active sessions.</p>
              )}
            </>
          )}
        </section>
      )}

      {/* Save button — always at the very bottom */}
      <div className="border-t border-[#EDE9E1] pt-6">
        <Button type="submit" form="settings-form" disabled={saving}>{saving ? 'Saving…' : 'Save Studio Settings'}</Button>
      </div>
    </div>
  )
}
