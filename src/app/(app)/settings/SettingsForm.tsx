'use client'
import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Upload, X, CheckCircle, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface Settings {
  id?: string
  sage_api_key?: string | null
  sage_username?: string | null
  sage_password?: string | null
  sage_company_id?: string | null
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
  email_template_quote?: string | null
  email_template_invoice?: string | null
}

export function SettingsForm({ settings }: { settings: Settings | null }) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingSage, setSavingSage] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [sageForm, setSageForm] = useState({
    sage_api_key: settings?.sage_api_key ?? '',
    sage_username: '',
    sage_password: '',
    sage_company_id: settings?.sage_company_id ?? '',
  })
  const sageConnected = !!(settings?.sage_api_key && settings?.sage_username && settings?.sage_password && settings?.sage_company_id)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void searchParams }, [searchParams])

  const setSage = (k: string, v: string) => setSageForm(f => ({ ...f, [k]: v }))

  async function saveSageCredentials() {
    setSavingSage(true)
    const update: Record<string, string> = {
      sage_api_key: sageForm.sage_api_key,
      sage_company_id: sageForm.sage_company_id,
    }
    if (sageForm.sage_username) update.sage_username = sageForm.sage_username
    if (sageForm.sage_password) update.sage_password = sageForm.sage_password
    const { error } = await supabase.from('settings').update(update).eq('id', settings!.id)
    if (error) { toast.error(error.message) } else { toast.success('Sage credentials saved') }
    setSavingSage(false)
  }

  async function disconnectSage() {
    const cleared = { sage_api_key: null, sage_username: null, sage_password: null, sage_company_id: null }
    await supabase.from('settings').update(cleared).eq('id', settings!.id)
    setSageForm({ sage_api_key: '', sage_username: '', sage_password: '', sage_company_id: '' })
    toast.success('Sage disconnected')
  }
  const [form, setForm] = useState({
    business_name:       settings?.business_name ?? '',
    business_address:    settings?.business_address ?? '',
    vat_number:          settings?.vat_number ?? '',
    phone:               settings?.phone ?? '',
    email_from:          settings?.email_from ?? '',
    logo_url:            settings?.logo_url ?? '',
    bank_name:           settings?.bank_name ?? '',
    bank_account_number: settings?.bank_account_number ?? '',
    bank_branch_code:    settings?.bank_branch_code ?? '',
    vat_rate:            String(settings?.vat_rate ?? 15),
    deposit_percentage:  String(settings?.deposit_percentage ?? 70),
    footer_text:         settings?.footer_text ?? 'Thank you for your business. All prices quoted are valid for 30 days. A 70% deposit is required to confirm your order.',
    terms_conditions:    settings?.terms_conditions ?? '',
    company_registration: settings?.company_registration ?? '',
    email_template_quote: settings?.email_template_quote ?? `Dear {{client_name}},\n\nPlease find attached your quotation for {{project_name}}.\n\nReference: {{project_number}}\n\nPlease don't hesitate to contact us should you have any questions or require any amendments.\n\nKind regards,\n{{studio_name}}`,
    email_template_invoice: settings?.email_template_invoice ?? `Dear {{client_name}},\n\nPlease find attached your invoice for {{project_name}}.\n\nReference: {{project_number}}\n\nKindly arrange payment at your earliest convenience.\n\nKind regards,\n{{studio_name}}`,
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function uploadLogo(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `logo.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploading(false); return }
    const { data } = supabase.storage.from('branding').getPublicUrl(path)
    // Bust cache so the new logo shows immediately
    set('logo_url', data.publicUrl + '?t=' + Date.now())
    toast.success('Logo uploaded')
    setUploading(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('settings').update({
      ...form,
      vat_rate: parseFloat(form.vat_rate),
      deposit_percentage: parseFloat(form.deposit_percentage),
    }).eq('id', settings!.id)
    if (error) { toast.error(error.message) } else { toast.success('Settings saved') }
    setSaving(false)
  }

  return (
    <form onSubmit={save} className="space-y-8">

      {/* Business */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Business Details</h2>
        <Input label="Studio / Business Name" value={form.business_name} onChange={e => set('business_name', e.target.value)} />
        <Textarea label="Business Address" value={form.business_address} onChange={e => set('business_address', e.target.value)} rows={3} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="VAT Number" value={form.vat_number} onChange={e => set('vat_number', e.target.value)} placeholder="4xxxxxxxxx" />
          <Input label="Company Registration" value={form.company_registration} onChange={e => set('company_registration', e.target.value)} placeholder="2005/xxxxxx/xx" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+27 11 xxx xxxx" />
        </div>
        <Input label="Email (for sending quotes)" type="email" value={form.email_from} onChange={e => set('email_from', e.target.value)} />
      </section>

      {/* Branding */}
      <section className="space-y-4 border-t border-[#EDE9E1] pt-6">
        <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Branding</h2>
        <div>
          <label className="text-xs font-medium text-[#8A877F] block mb-2">Logo</label>
          <div className="flex items-center gap-4">
            {form.logo_url && (
              <div className="relative group">
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

      {/* Banking */}
      <section className="space-y-4 border-t border-[#EDE9E1] pt-6">
        <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Banking Details</h2>
        <Input label="Bank Name" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="FNB / Standard Bank…" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Account Number" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} />
          <Input label="Branch Code" value={form.bank_branch_code} onChange={e => set('bank_branch_code', e.target.value)} />
        </div>
      </section>

      {/* Defaults */}
      <section className="space-y-4 border-t border-[#EDE9E1] pt-6">
        <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Quote Defaults</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input label="VAT Rate (%)" type="number" min="0" step="0.1" value={form.vat_rate} onChange={e => set('vat_rate', e.target.value)} />
          <Input label="Deposit (%)" type="number" min="0" max="100" step="1" value={form.deposit_percentage} onChange={e => set('deposit_percentage', e.target.value)} />
        </div>
        <Textarea label="Quote / Invoice Footer Text" value={form.footer_text} onChange={e => set('footer_text', e.target.value)} rows={3} />
        <Textarea label="Terms & Conditions (shown on quote PDF alongside totals)" value={form.terms_conditions} onChange={e => set('terms_conditions', e.target.value)} rows={6} placeholder="1. Prices are valid for 30 days.&#10;2. A 70% deposit is required to confirm the order.&#10;3. ..." />
      </section>

      {/* Email Templates */}
      <section className="space-y-4 border-t border-[#EDE9E1] pt-6">
        <div>
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Email Templates</h2>
          <p className="text-xs text-[#8A877F] mt-1">Use <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{client_name}}'}</span>, <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{project_name}}'}</span>, <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{project_number}}'}</span>, <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{studio_name}}'}</span> as placeholders.</p>
        </div>
        <Textarea label="Quote Email Body" value={form.email_template_quote} onChange={e => set('email_template_quote', e.target.value)} rows={7} />
        <Textarea label="Invoice Email Body" value={form.email_template_invoice} onChange={e => set('email_template_invoice', e.target.value)} rows={7} />
      </section>

      {/* Sage Integration */}
      <section className="space-y-4 border-t border-[#EDE9E1] pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Sage One SA Integration</h2>
          {sageConnected && (
            <div className="flex items-center gap-2">
              <CheckCircle size={13} className="text-green-600" />
              <span className="text-xs text-green-700 font-medium">Connected</span>
              <button type="button" onClick={disconnectSage} className="text-xs text-red-400 hover:text-red-600 underline ml-1">Clear</button>
            </div>
          )}
        </div>
        <p className="text-xs text-[#8A877F]">Enter your Sage One SA credentials. Get your API key from <span className="font-mono">accounting.sageone.co.za/Marketing/DeveloperProgram.aspx</span></p>
        <Input label="API Key" value={sageForm.sage_api_key} onChange={e => setSage('sage_api_key', e.target.value)} placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}" />
        <Input label="Sage Username (email)" type="email" value={sageForm.sage_username} onChange={e => setSage('sage_username', e.target.value)} placeholder="you@example.co.za" />
        <div className="relative">
          <Input label="Sage Password" type={showPassword ? 'text' : 'password'} value={sageForm.sage_password} onChange={e => setSage('sage_password', e.target.value)} />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-[30px] text-[#8A877F] hover:text-[#2C2C2A]"
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <Input label="Company ID" value={sageForm.sage_company_id} onChange={e => setSage('sage_company_id', e.target.value)} placeholder="Found in your Sage One account URL or settings" />
        <button
          type="button"
          onClick={saveSageCredentials}
          disabled={savingSage}
          className="px-4 py-2 bg-[#1A1A18] text-white text-sm rounded hover:bg-[#2C2C2A] transition-colors disabled:opacity-50"
        >
          {savingSage ? 'Saving…' : 'Save Sage Credentials'}
        </button>
      </section>

      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
    </form>
  )
}
