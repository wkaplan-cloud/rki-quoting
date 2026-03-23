'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface Settings {
  id?: string
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
}

export function SettingsForm({ settings }: { settings: Settings | null }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [logoError, setLogoError] = useState(false)
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
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

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
          <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+27 11 xxx xxxx" />
        </div>
        <Input label="Email (for sending quotes)" type="email" value={form.email_from} onChange={e => set('email_from', e.target.value)} />
      </section>

      {/* Branding */}
      <section className="space-y-4 border-t border-[#EDE9E1] pt-6">
        <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Branding</h2>
        <Input label="Logo URL" value={form.logo_url} onChange={e => { set('logo_url', e.target.value); setLogoError(false) }} placeholder="https://yourdomain.co.za/logo.png" />
        {form.logo_url && (
          logoError ? (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 space-y-1">
              <p className="font-medium">Image couldn't load — the URL must be a direct link to the image file.</p>
              <p className="text-red-500">Google Drive / Dropbox share links won't work. Right-click your image online → "Copy image address" to get a direct URL ending in .png, .jpg, or .svg.</p>
            </div>
          ) : (
            <img src={form.logo_url} alt="Logo preview" onError={() => setLogoError(true)} className="h-12 object-contain rounded border border-[#EDE9E1] p-1" />
          )
        )}
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
      </section>

      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
    </form>
  )
}
