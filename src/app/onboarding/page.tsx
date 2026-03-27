'use client'
export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Upload, X, ArrowRight, Building2, Palette } from 'lucide-react'
import toast from 'react-hot-toast'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0) // 0 = welcome, 1 = business, 2 = branding & banking
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    business_name: '',
    business_address: '',
    vat_number: '',
    phone: '',
    email_from: '',
    logo_url: '',
    bank_name: '',
    bank_account_number: '',
    bank_branch_code: '',
    footer_text: 'Thank you for your business. All prices quoted are valid for 30 days. A 70% deposit is required to confirm your order.',
  })

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function uploadLogo(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `logo.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploading(false); return }
    const { data } = supabase.storage.from('branding').getPublicUrl(path)
    set('logo_url', data.publicUrl + '?t=' + Date.now())
    toast.success('Logo uploaded')
    setUploading(false)
  }

  async function finish() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: existingOrgId } = await supabase.rpc('get_current_org_id')

    let orgId = existingOrgId

    if (!orgId) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: form.business_name })
        .select()
        .single()
      if (orgError) { toast.error(orgError.message); setSaving(false); return }
      orgId = org.id

      const { error: memberError } = await supabase.from('org_members').insert({
        org_id: orgId,
        user_id: user!.id,
        invited_email: user!.email!,
        role: 'admin',
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      if (memberError) { toast.error(memberError.message); setSaving(false); return }
    }

    const { data: existingSettings } = await supabase.from('settings').select('id').maybeSingle()
    if (existingSettings) {
      await supabase.from('settings').update({ ...form }).eq('id', existingSettings.id)
    } else {
      const { error: settingsError } = await supabase.from('settings').insert({
        user_id: user!.id,
        org_id: orgId,
        ...form,
        vat_rate: 15,
        deposit_percentage: 70,
      })
      if (settingsError) { toast.error(settingsError.message); setSaving(false); return }
    }

    router.push('/dashboard')
  }

  const steps = [
    { n: 1, label: 'Business details', icon: Building2 },
    { n: 2, label: 'Branding & banking', icon: Palette },
  ]

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Welcome screen */}
        {step === 0 && (
          <div className="bg-white border border-[#D8D3C8] rounded-xl p-10 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="h-16 w-auto object-contain mx-auto mb-8" />
            <h1 className="font-serif text-3xl text-[#1A1A18] mb-3">Welcome to QuotingHub</h1>
            <p className="text-[#8A877F] leading-relaxed mb-2">
              Let&apos;s get your studio set up. It only takes a couple of minutes.
            </p>
            <p className="text-sm text-[#8A877F] leading-relaxed mb-8">
              You&apos;ll add your business details and banking information so your quotes, invoices, and purchase orders look professional from day one.
            </p>
            <Button onClick={() => setStep(1)} className="w-full justify-center">
              Let&apos;s get started <ArrowRight size={15} />
            </Button>
            <p className="text-xs text-[#8A877F] mt-4">You can edit everything anytime from Settings</p>
          </div>
        )}

        {/* Step forms */}
        {step > 0 && (
          <>
            {/* Progress */}
            <div className="flex items-center gap-3 mb-8">
              {steps.map(({ n, label }) => (
                <div key={n} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
                    ${step >= n ? 'bg-[#9A7B4F] text-white' : 'bg-[#D8D3C8] text-[#8A877F]'}`}>
                    {n}
                  </div>
                  {n < steps.length && (
                    <div className={`h-px w-12 transition-colors ${step > n ? 'bg-[#9A7B4F]' : 'bg-[#D8D3C8]'}`} />
                  )}
                </div>
              ))}
              <span className="ml-2 text-xs text-[#8A877F]">
                {steps.find(s => s.n === step)?.label}
              </span>
            </div>

            <div className="bg-white border border-[#D8D3C8] rounded-xl p-8">

              {/* Step 1 — Business details */}
              {step === 1 && (
                <>
                  <h1 className="font-serif text-2xl text-[#1A1A18] mb-1">Set up your studio</h1>
                  <p className="text-sm text-[#8A877F] mb-6">This info appears on your quotes, invoices and purchase orders.</p>

                  <div className="space-y-4">
                    <Input
                      label="Studio / Business Name"
                      value={form.business_name}
                      onChange={e => set('business_name', e.target.value)}
                      required
                    />
                    <Textarea
                      label="Business Address"
                      value={form.business_address}
                      onChange={e => set('business_address', e.target.value)}
                      rows={3}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="VAT Number"
                        value={form.vat_number}
                        onChange={e => set('vat_number', e.target.value)}
                      />
                      <Input
                        label="Phone"
                        value={form.phone}
                        onChange={e => set('phone', e.target.value)}
                      />
                    </div>
                    <Input
                      label="Email (for sending quotes)"
                      type="email"
                      value={form.email_from}
                      onChange={e => set('email_from', e.target.value)}
                    />
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => setStep(2)} disabled={!form.business_name.trim()}>
                      Next →
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2 — Branding & banking */}
              {step === 2 && (
                <>
                  <h1 className="font-serif text-2xl text-[#1A1A18] mb-1">Branding & banking</h1>
                  <p className="text-sm text-[#8A877F] mb-6">Used on your PDFs. Both are optional — you can add these anytime in Settings.</p>

                  {/* Logo upload */}
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3">
                      Studio Logo <span className="normal-case text-[#C4A46B] ml-1">optional</span>
                    </label>

                    {form.logo_url && (
                      <div className="relative inline-block mb-3 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.logo_url} alt="Logo preview" className="h-14 w-auto object-contain border border-[#D8D3C8] rounded-lg p-2 bg-white" />
                        <button
                          type="button"
                          onClick={() => set('logo_url', '')}
                          className="absolute -top-1.5 -right-1.5 bg-white border border-[#D8D3C8] rounded-full p-0.5 text-[#8A877F] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}

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
                      className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-[#D8D3C8] rounded-lg text-sm text-[#8A877F] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Upload size={14} />
                      {uploading ? 'Uploading…' : form.logo_url ? 'Replace logo' : 'Upload logo'}
                    </button>
                    <p className="text-xs text-[#8A877F] mt-1.5">PNG, JPG, or SVG — recommended min. 400px wide</p>
                  </div>

                  {/* Banking */}
                  <div className="border-t border-[#EDE9E1] pt-5">
                    <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3">
                      Banking details <span className="normal-case text-[#C4A46B] ml-1">optional — shown on invoices</span>
                    </p>
                    <div className="space-y-3">
                      <Input
                        label="Bank Name"
                        value={form.bank_name}
                        onChange={e => set('bank_name', e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Account Number"
                          value={form.bank_account_number}
                          onChange={e => set('bank_account_number', e.target.value)}
                        />
                        <Input
                          label="Branch Code"
                          value={form.bank_branch_code}
                          onChange={e => set('bank_branch_code', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
                    >
                      ← Back
                    </button>
                    <Button onClick={finish} disabled={saving}>
                      {saving ? 'Setting up your studio…' : 'Finish setup →'}
                    </Button>
                  </div>
                </>
              )}
            </div>

            <p className="text-center text-xs text-[#8A877F] mt-4">
              You can edit all of this anytime from Settings
            </p>
          </>
        )}
      </div>
    </div>
  )
}
