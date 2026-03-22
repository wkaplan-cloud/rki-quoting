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
  email_from?: string | null
  vat_rate?: number | null
  deposit_percentage?: number | null
  footer_text?: string | null
}

export function SettingsForm({ settings, userId }: { settings: Settings | null; userId: string }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    business_name: settings?.business_name ?? 'R Kaplan Interiors',
    email_from: settings?.email_from ?? 'quotes@rkaplaninteriors.co.za',
    vat_rate: String(settings?.vat_rate ?? 15),
    deposit_percentage: String(settings?.deposit_percentage ?? 70),
    footer_text: settings?.footer_text ?? 'Thank you for your business. All prices quoted are valid for 30 days. A 70% deposit is required to confirm your order.',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      user_id: userId,
      vat_rate: parseFloat(form.vat_rate),
      deposit_percentage: parseFloat(form.deposit_percentage),
    }
    const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'user_id' })
    if (error) { toast.error(error.message) } else { toast.success('Settings saved') }
    setSaving(false)
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Input label="Business Name" value={form.business_name} onChange={e => set('business_name', e.target.value)} />
      <Input label="Email From" type="email" value={form.email_from} onChange={e => set('email_from', e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="VAT Rate (%)" type="number" min="0" step="0.1" value={form.vat_rate} onChange={e => set('vat_rate', e.target.value)} />
        <Input label="Deposit (%)" type="number" min="0" max="100" step="1" value={form.deposit_percentage} onChange={e => set('deposit_percentage', e.target.value)} />
      </div>
      <Textarea label="Quote/Invoice Footer Text" value={form.footer_text} onChange={e => set('footer_text', e.target.value)} rows={4} />
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
    </form>
  )
}
