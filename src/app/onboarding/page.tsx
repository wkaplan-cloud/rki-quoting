'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    // Step 1 — Business details
    business_name: '',
    business_address: '',
    vat_number: '',
    phone: '',
    email_from: '',
    // Step 2 — Branding & banking
    logo_url: '',
    bank_name: '',
    bank_account_number: '',
    bank_branch_code: '',
    footer_text: 'Thank you for your business. All prices quoted are valid for 30 days. A 70% deposit is required to confirm your order.',
  })

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function finish() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Check if org already exists for this user
    const { data: existingOrgId } = await supabase.rpc('get_current_org_id')

    let orgId = existingOrgId

    if (!orgId) {
      // Create org
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: form.business_name })
        .select()
        .single()
      if (orgError) { toast.error(orgError.message); setSaving(false); return }
      orgId = org.id

      // Add user as admin member
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

    // Upsert settings
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

    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-8">
      <div className="w-full max-w-lg">

        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          {[1, 2].map(n => (
            <div key={n} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
                ${step >= n ? 'bg-[#9A7B4F] text-white' : 'bg-[#D8D3C8] text-[#8A877F]'}`}>
                {n}
              </div>
              {n < 2 && <div className={`h-px w-12 transition-colors ${step > n ? 'bg-[#9A7B4F]' : 'bg-[#D8D3C8]'}`} />}
            </div>
          ))}
          <span className="ml-2 text-xs text-[#8A877F]">
            {step === 1 ? 'Business details' : 'Branding & banking'}
          </span>
        </div>

        <div className="bg-white border border-[#D8D3C8] rounded-lg p-8">

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

          {step === 2 && (
            <>
              <h1 className="font-serif text-2xl text-[#1A1A18] mb-1">Branding & banking</h1>
              <p className="text-sm text-[#8A877F] mb-6">Used on PDFs and invoices. You can update these anytime in Settings.</p>

              <div className="space-y-4">
                <Input
                  label="Logo URL"
                  value={form.logo_url}
                  onChange={e => set('logo_url', e.target.value)}
                />
                <p className="text-xs text-[#8A877F] -mt-2">Paste a direct link to your logo image. You can update this later.</p>

                <div className="border-t border-[#EDE9E1] pt-4">
                  <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3">Banking details (for invoices)</p>
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

                <div className="border-t border-[#EDE9E1] pt-4">
                  <Textarea
                    label="Quote / Invoice Footer Text"
                    value={form.footer_text}
                    onChange={e => set('footer_text', e.target.value)}
                    rows={3}
                  />
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
                  {saving ? 'Saving…' : 'Finish setup →'}
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-[#8A877F] mt-4">
          You can edit all of this anytime from Settings
        </p>
      </div>
    </div>
  )
}
