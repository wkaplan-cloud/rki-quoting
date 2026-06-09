'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compressImage'
import { Check, Loader2, Upload, X, Plus, AlertCircle, CheckCircle2, Users, RotateCcw, Trash2, ChevronRight, Zap, Receipt } from 'lucide-react'
import type { PortalOrgMember, ElecSettings } from '@/lib/elec-types'
import { SettingsClient } from '../quoting/settings/SettingsClient'
import { PLANS, planRank } from '@/lib/plan-features'

interface Props {
  portalAccountId: string
  hasQuoting: boolean
  isManufacturer?: boolean
  plan: string | null
  subscriptionStatus: string | null
  trialEndsAt: string | null
  staffCount: number
  setupFeePaid: boolean
  initialTab: 'profile' | 'settings'
  justUpgraded: boolean
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
  elecSettings: ElecSettings | null
  categoryOptions: string[]
  orgMembers: PortalOrgMember[] | null
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

export function SupplierProfileClient({ portalAccountId, hasQuoting, isManufacturer = false, plan, subscriptionStatus, trialEndsAt, staffCount, setupFeePaid, initialTab, justUpgraded, account, elecSettings, categoryOptions, orgMembers }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'profile' | 'settings'>(initialTab)

  function switchTab(t: 'profile' | 'settings') {
    setTab(t)
    router.replace(`/supplier-portal/profile${t === 'settings' ? '?tab=settings' : ''}`, { scroll: false })
  }

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

  // Admin Users
  const [members, setMembers] = useState<PortalOrgMember[]>(orgMembers ?? [])
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteDone, setInviteDone] = useState(false)
  const [resending, setResending] = useState<string | null>(null)
  const [resentId, setResentId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleResend(memberId: string, memberEmail: string, memberName: string | null) {
    setResending(memberId)
    const res = await fetch('/api/supplier-portal/quoting/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: memberEmail, name: memberName ?? undefined }),
    })
    setResending(null)
    if (res.ok) {
      setResentId(memberId)
      setTimeout(() => setResentId(null), 3000)
    }
  }

  async function handleDelete(memberId: string) {
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

  function toggleCategory(cat: string) {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return }
    setUploading(true); setError('')
    let compressed: File
    try { compressed = await compressImage(file, 800) } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); setUploading(false); return }
    const ext = compressed.name.split('.').pop() ?? 'jpg'
    const storagePath = `supplier-portal/${portalAccountId}/logo.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload(storagePath, compressed, { upsert: true, contentType: compressed.type })
    if (uploadError) { setError('Upload failed: ' + uploadError.message); setUploading(false); return }
    const { data } = supabase.storage.from('branding').getPublicUrl(storagePath)
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
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181B' }}>
          {tab === 'settings' ? 'Settings' : 'Profile'}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#71717A' }}>
          {tab === 'settings' ? 'Default values and configuration for your quoting.' : 'Your business account details'}
        </p>
        {hasQuoting && !isManufacturer && (
          <div className="flex gap-1 mt-3 p-1 rounded-xl w-fit" style={{ background: '#F1F5F9' }}>
            <button
              onClick={() => switchTab('profile')}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              style={tab === 'profile' ? { background: '#FFFFFF', color: '#18181B', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: '#6B7280' }}
            >
              Profile
            </button>
            <button
              onClick={() => switchTab('settings')}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              style={tab === 'settings' ? { background: '#FFFFFF', color: '#18181B', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: '#6B7280' }}
            >
              Settings
            </button>
          </div>
        )}
      </div>

      {tab === 'settings' && !isManufacturer ? (
        <SettingsClient portalAccountId={portalAccountId} companyName={account.company_name} settings={elecSettings} justUpgraded={justUpgraded} />
      ) : (
      <>

      {/* ── Plan section ── */}
      {(() => {
        const currentRank = planRank(plan)
        const currentPlan = PLANS.find(p => p.id === plan) ?? (plan === 'quoting' ? PLANS[2] : null)
        const nextPlans = PLANS.filter(p => planRank(p.id) > currentRank)
        const isTrialing = subscriptionStatus === 'trialing' && trialEndsAt != null && new Date(trialEndsAt) > new Date()
        const isActive = subscriptionStatus === 'active'
        const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000)) : 0
        const TIER_COLOR: Record<string, string> = { starter: '#3A7CA5', professional: '#D9A441', business: '#166534', quoting: '#166534' }
        const color = TIER_COLOR[plan ?? ''] ?? '#71717A'

        // Trial users are exploring — they need a Subscribe button regardless of which plan they're trialing
        const showSubscribeBtn = isTrialing
        const showUpgradeBtn   = isActive && nextPlans.length > 0
        const showHighestPlan  = isActive && nextPlans.length === 0

        return (
          <div className="p-5 rounded-xl space-y-4" style={{ background: isTrialing ? 'rgba(217,164,65,0.04)' : '#FFFFFF', border: `1px solid ${isTrialing ? 'rgba(217,164,65,0.3)' : '#E4E4E7'}` }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#71717A' }}>Your Plan</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {isTrialing ? (
                    // Trial — don't show the plan name, show trial status prominently
                    <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(217,164,65,0.15)', color: '#D9A441' }}>
                      Free Trial
                    </span>
                  ) : currentPlan ? (
                    <span className="text-sm font-bold px-3 py-1 rounded-full"
                      style={{ background: `${color}15`, color }}>
                      {currentPlan.label}
                    </span>
                  ) : (
                    <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: '#F4F4F5', color: '#71717A' }}>
                      No plan
                    </span>
                  )}
                  {isTrialing && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(217,164,65,0.1)', color: '#D9A441' }}>
                      {trialDaysLeft}d remaining
                    </span>
                  )}
                  {isActive && (
                    <span className="text-xs flex items-center gap-1" style={{ color: '#16A34A' }}>
                      <CheckCircle2 size={12} /> Active
                    </span>
                  )}
                </div>
                {isTrialing ? (
                  <p className="text-xs mt-1" style={{ color: '#92400E' }}>
                    You have full access during your trial. Subscribe before it expires to keep access.
                  </p>
                ) : currentPlan ? (
                  <p className="text-xs mt-1" style={{ color: '#71717A' }}>
                    R{currentPlan.price.toLocaleString()}/month · {currentPlan.tagline}
                  </p>
                ) : null}
              </div>

              {showSubscribeBtn && (
                <a href="/supplier-portal/upgrade"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white flex-shrink-0"
                  style={{ background: '#D9A441' }}>
                  Subscribe Now <ChevronRight size={14} />
                </a>
              )}
              {showUpgradeBtn && (
                <a href={`/supplier-portal/upgrade?current=${plan}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
                  style={{ background: '#3A7CA5' }}>
                  Upgrade Plan <ChevronRight size={14} />
                </a>
              )}
              {showHighestPlan && (
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                  <Zap size={11} /> Highest plan
                </div>
              )}
            </div>

            {/* Trial: show all 3 plans to compare */}
            {isTrialing && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {PLANS.map(p => {
                  const c = TIER_COLOR[p.id] ?? '#71717A'
                  return (
                    <div key={p.id} className="rounded-xl p-3 space-y-2" style={{ background: '#F9FAFB', border: '1px solid #E4E4E7' }}>
                      <div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${c}15`, color: c }}>{p.label}</span>
                        <p className="text-xs font-bold mt-1.5" style={{ color: '#18181B' }}>R{p.price.toLocaleString()}/mo</p>
                      </div>
                      <div className="space-y-1">
                        {p.features.slice(0, 4).map(f => (
                          <div key={f} className="flex items-start gap-1.5">
                            <Check size={10} className="mt-0.5 flex-shrink-0" style={{ color: c }} />
                            <p className="text-[11px] leading-snug" style={{ color: '#52525B' }}>{f}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Active: what they have + what's next */}
            {isActive && nextPlans.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#71717A' }}>Included in your plan:</p>
                <div className="space-y-1 mb-3">
                  {(currentPlan?.features ?? ['No features — upgrade to get started']).map(f => (
                    <div key={f} className="flex items-start gap-2">
                      <Check size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#16A34A' }} />
                      <p className="text-xs" style={{ color: '#52525B' }}>{f}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#71717A' }}>Unlock with {nextPlans[0].label}:</p>
                <div className="space-y-1">
                  {nextPlans[0].features.filter(f => !(currentPlan?.features as readonly string[] | undefined)?.includes(f)).slice(0, 4).map(f => (
                    <div key={f} className="flex items-start gap-2">
                      <div className="w-3 h-3 rounded-full border flex items-center justify-center mt-0.5 flex-shrink-0" style={{ borderColor: '#D8D3C8' }} />
                      <p className="text-xs" style={{ color: '#A1A1AA' }}>{f}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extra staff notice */}
            {isActive && staffCount > 20 && (() => {
              const extra = staffCount - 20
              const monthlyCost = extra * 40
              return (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(217,164,65,0.07)', border: '1px solid rgba(217,164,65,0.25)' }}>
                  <Users size={14} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#92400E' }}>
                      Extra staff charge — {extra} staff over limit
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#92400E', opacity: 0.8 }}>
                      Your plan includes 20 staff. You have {staffCount} active staff members.
                      An additional <strong>R{monthlyCost}/month</strong> ({extra} × R40) will be added to your subscription.
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Setup fee notice — visible from day 1 regardless of subscription status */}
            {!setupFeePaid && (
              <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 rounded-xl"
                style={{ background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.25)' }}>
                <div className="flex items-start gap-3">
                  <Receipt size={14} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#92400E' }}>Setup & Training fee outstanding</p>
                    <p className="text-xs mt-0.5" style={{ color: '#92400E', opacity: 0.8 }}>
                      R2,500 once-off — covers onboarding, staff device setup, and training.
                    </p>
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
          </div>
        )
      })()}

      {isManufacturer && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
          style={{ background: 'rgba(58,124,165,0.06)', border: '1px solid rgba(58,124,165,0.2)' }}>
          <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: '#3A7CA5', color: '#fff' }}>i</div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1E3A5F' }}>Business details live in Settings</p>
            <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>
              Company name, logo, address, banking, VAT, and document defaults are managed in{' '}
              <a href="/supplier-portal/manufacturing/settings" className="font-semibold underline" style={{ color: '#3A7CA5' }}>Manufacturing → Settings</a>.
              That&apos;s where they&apos;re read from when generating quotes and invoices.
            </p>
          </div>
        </div>
      )}

      {!isManufacturer && <form onSubmit={handleSave} className="space-y-5">
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
            <p className="text-xs mb-3" style={{ color: '#A1A1AA' }}>Appears on the top-left of all PDFs and job cards. Best results: <strong style={{ color: '#52525B' }}>landscape PNG or SVG</strong> with a transparent background. Larger images are automatically resized — no need to resize before uploading.</p>
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
                <p className="text-[10px] mt-1.5" style={{ color: '#A1A1AA' }}>PNG, SVG, or JPG · max 5 MB · auto-resized if larger than 800 px</p>
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

          <Field label="License Number">
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

        {/* What do you supply? — marketplace suppliers only */}
        {!hasQuoting && (
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
        )}

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
      </form>}

      {/* Admin Users — only shown for quoting plan accounts */}
      {orgMembers !== null && (
        <div className="pt-6 border-t border-[#E4E4E7]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#71717A' }}>Admin Users</p>
              <p className="text-xs mt-0.5" style={{ color: '#A1A1AA' }}>Give other people full admin access to this organisation.</p>
            </div>
            <button onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ color: '#3A7CA5', background: 'rgba(58,124,165,0.08)' }}>
              <Plus size={12} /> Invite Admin
            </button>
          </div>

          {members.length === 0 && (
            <div className="rounded-xl py-8 text-center" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
              <Users size={20} className="mx-auto mb-2" style={{ color: '#A1A1AA' }} />
              <p className="text-sm" style={{ color: '#71717A' }}>No additional admins yet</p>
            </div>
          )}

          {members.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
              {members.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderTop: i > 0 ? '1px solid #E4E4E7' : undefined }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: m.accepted_at ? '#3A7CA5' : '#A1A1AA' }}>
                    {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {m.name && <p className="text-sm font-semibold" style={{ color: '#18181B' }}>{m.name}</p>}
                    <p className="text-xs" style={{ color: '#71717A' }}>{m.email}</p>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: m.accepted_at ? 'rgba(22,163,74,0.1)' : 'rgba(217,164,65,0.1)', color: m.accepted_at ? '#16A34A' : '#D9A441' }}>
                    {m.accepted_at ? 'Active' : 'Pending'}
                  </span>
                  {/* Resend — pending only */}
                  {!m.accepted_at && (
                    <button
                      type="button"
                      onClick={() => void handleResend(m.id, m.email, m.name)}
                      disabled={resending === m.id}
                      title="Resend invite"
                      className="flex-shrink-0 p-1.5 rounded-lg disabled:opacity-50 transition-colors"
                      style={{ color: resentId === m.id ? '#16A34A' : '#A1A1AA', background: 'transparent' }}
                    >
                      {resending === m.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : resentId === m.id
                          ? <CheckCircle2 size={14} />
                          : <RotateCcw size={14} />}
                    </button>
                  )}
                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => void handleDelete(m.id)}
                    disabled={deleting === m.id}
                    title="Remove admin"
                    className="flex-shrink-0 p-1.5 rounded-lg disabled:opacity-50 transition-colors"
                    style={{ color: '#A1A1AA', background: 'transparent' }}
                  >
                    {deleting === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Invite modal */}
          {showInvite && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
              onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}>
              <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E4E4E7' }}>
                  <h2 className="font-bold text-sm" style={{ color: '#18181B' }}>Invite Admin</h2>
                  <button onClick={() => setShowInvite(false)} style={{ color: '#71717A' }}><X size={15} /></button>
                </div>
                {inviteDone ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <CheckCircle2 size={36} style={{ color: '#16A34A' }} />
                    <p className="text-sm font-semibold" style={{ color: '#18181B' }}>Invite sent!</p>
                  </div>
                ) : (
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#71717A' }}>Email *</label>
                      <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="admin@example.com"
                        className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                        style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#71717A' }}>Name (optional)</label>
                      <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name"
                        className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                        style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }} />
                    </div>
                    {inviteError && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                        <AlertCircle size={12} />{inviteError}
                      </div>
                    )}
                    <button onClick={() => void handleInviteAdmin()} disabled={inviting || !inviteEmail.trim()}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: '#3A7CA5' }}>
                      {inviting ? <><Loader2 size={14} className="animate-spin inline mr-2" />Sending…</> : 'Send Invite'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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

      </>
      )}
    </div>
  )
}
