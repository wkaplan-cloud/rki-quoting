'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, ArrowLeft, Check, Package, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const INPUT_STYLE = {
  background: '#F4F4F5',
  border: '1.5px solid #E4E4E7',
  color: '#18181B',
  transition: 'border-color 0.15s, background 0.15s',
}

type Category = 'manufacturer' | 'trades'

// ── Screen 1: type selector ───────────────────────────────────────────────────
function TypeSelector({ onSelect }: { onSelect: (c: Category) => void }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0F1923' }}>

      {/* Logo bar */}
      <div className="flex items-center justify-between px-8 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QuotingHub" className="h-16 sm:h-20 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)', opacity: 0.7 }} />
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Already have an account?{' '}
          <Link href="/supplier-portal/login" className="hover:underline" style={{ color: 'rgba(255,255,255,0.6)' }}>Sign in</Link>
        </p>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: '#3A7CA5' }}>Get started free</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3 leading-tight" style={{ color: '#FFFFFF' }}>
          What best describes<br />your business?
        </h1>
        <p className="text-sm text-center mb-12" style={{ color: 'rgba(255,255,255,0.45)' }}>
          We&apos;ll tailor your experience from the start.
        </p>

        <div className="grid sm:grid-cols-2 gap-5 w-full max-w-2xl">

          {/* Product Supplier */}
          <button
            onClick={() => onSelect('manufacturer')}
            className="group text-left rounded-2xl p-7 transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px solid rgba(255,255,255,0.1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(58,124,165,0.12)'; e.currentTarget.style.borderColor = 'rgba(58,124,165,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(58,124,165,0.2)' }}>
              <Package size={22} style={{ color: '#3A7CA5' }} />
            </div>
            <h2 className="text-lg font-bold mb-1.5" style={{ color: '#FFFFFF' }}>Product Supplier</h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Fabrics, stone, furniture, lighting, wallpaper — receive price requests from interior design studios.
            </p>
            <div className="space-y-1.5">
              {['Free to join', 'All requests in one dashboard', '1% fee on accepted requests'].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Check size={11} style={{ color: '#3A7CA5', flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{f}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-sm font-semibold" style={{ color: '#3A7CA5' }}>Free forever</span>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(58,124,165,0.15)', color: '#3A7CA5' }}>Get started →</span>
            </div>
          </button>

          {/* Electrician */}
          <button
            onClick={() => onSelect('trades')}
            className="group text-left rounded-2xl p-7 transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'rgba(217,164,65,0.06)',
              border: '1.5px solid rgba(217,164,65,0.2)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(217,164,65,0.12)'; e.currentTarget.style.borderColor = 'rgba(217,164,65,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(217,164,65,0.06)'; e.currentTarget.style.borderColor = 'rgba(217,164,65,0.2)' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(217,164,65,0.15)' }}>
              <Zap size={22} style={{ color: '#D9A441' }} />
            </div>
            <h2 className="text-lg font-bold mb-1.5" style={{ color: '#FFFFFF' }}>Electrician</h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Quote jobs, schedule your team, send progress claims and invoices — built specifically for electrical contractors.
            </p>
            <div className="space-y-1.5">
              {['Full quoting & claims system', 'Team scheduling & job photos', 'PDF generation & COC tracker'].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Check size={11} style={{ color: '#D9A441', flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{f}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <span className="text-xs font-semibold" style={{ color: '#D9A441' }}>30-day free trial</span>
                <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>then R499/mo</span>
              </div>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(217,164,65,0.15)', color: '#D9A441' }}>Get started →</span>
            </div>
          </button>

        </div>
      </div>
    </div>
  )
}

// ── Screen 2: registration form ───────────────────────────────────────────────
function RegisterForm({ category, onBack }: { category: Category; onBack: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const noPortalAccount = searchParams.get('notice') === 'no-portal-account'
  const supabase = createClient()

  const [companyName, setCompanyName]   = useState('')
  const [contactName, setContactName]   = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [tcAccepted, setTcAccepted]     = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetId  = useRef<string | null>(null)
  const siteKey   = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const isElec = category === 'trades'

  useEffect(() => {
    if (!siteKey) return
    function render() {
      if (!widgetRef.current || !(window as any).turnstile) return
      if (widgetId.current != null) return
      widgetId.current = (window as any).turnstile.render(widgetRef.current, { sitekey: siteKey, theme: 'light' })
    }
    if ((window as any).turnstile) { render() }
    else {
      const prev = (window as any).onloadTurnstileCallback
      ;(window as any).onloadTurnstileCallback = () => { render(); if (prev) prev() }
    }
    return () => {
      if (widgetId.current != null && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
  }, [siteKey])

  useEffect(() => {
    if (error && siteKey && (window as any).turnstile && widgetId.current != null) {
      (window as any).turnstile.reset(widgetId.current)
    }
  }, [error, siteKey])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!companyName.trim()) { setError('Please enter your company name'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!tcAccepted) { setError('Please accept the terms and conditions to continue'); return }

    const cfToken = siteKey && widgetId.current != null
      ? (window as any).turnstile.getResponse(widgetId.current)
      : undefined
    if (siteKey && !cfToken) { setError('Please complete the security check.'); return }

    setLoading(true)
    const res = await fetch('/api/supplier-portal/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, company_name: companyName.trim(), contact_name: contactName.trim(), supplier_category: category, cf_token: cfToken }),
    })
    const data = await res.json() as { error?: string }
    if (!res.ok) { setError(data.error ?? 'Registration failed'); setLoading(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    })
    if (signInError) { router.push('/supplier-portal/login'); return }
    router.push('/supplier-portal/home')
  }

  const accent     = isElec ? '#D9A441' : '#3A7CA5'
  const accentBg   = isElec ? 'rgba(217,164,65,0.1)' : 'rgba(58,124,165,0.1)'
  const panelBg    = isElec ? '#1A1408' : '#0F1923'
  const submitBg   = isElec ? '#D9A441' : '#3A7CA5'
  const submitText = isElec ? '#1A1408' : '#FFFFFF'

  const leftFeatures = isElec
    ? ['Full quoting & progress claims', 'Team scheduling with drag & drop', 'Worker job links & photo uploads', 'PDF generation for all documents', 'COC tracker & snag list']
    : ['Receive requests from design studios', 'Manage your full price list', 'Respond faster, win more business', 'All requests in one dashboard']

  return (
    <div className="min-h-screen flex">
      {siteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit" strategy="lazyOnload" />
      )}

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between py-14 px-12" style={{ background: panelBg }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-32 sm:h-40 w-auto object-contain mb-12" style={{ filter: 'brightness(0) invert(1)', opacity: 0.7 }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6" style={{ background: accentBg }}>
            {isElec ? <Zap size={20} style={{ color: accent }} /> : <Package size={20} style={{ color: accent }} />}
          </div>
          <h2 className="text-2xl font-bold leading-snug mb-2" style={{ color: '#FFFFFF' }}>
            {isElec ? 'Built for electrical contractors.' : 'Join the QuotingHub supplier network.'}
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {isElec
              ? 'Everything you need to quote, invoice, and manage your team — in one place.'
              : 'Receive price requests directly from interior design studios. Respond faster, win more business.'}
          </p>
          <div className="space-y-3">
            {leftFeatures.map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: accentBg }}>
                  <Check size={10} style={{ color: accent }} />
                </div>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          {isElec ? (
            <div className="rounded-xl px-4 py-4 mb-6" style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.2)' }}>
              <p className="text-xs font-semibold mb-0.5" style={{ color: '#D9A441' }}>30 days free, then R499/month</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>No card required. Cancel anytime.</p>
            </div>
          ) : (
            <div className="rounded-xl px-4 py-4 mb-6" style={{ background: 'rgba(58,124,165,0.08)', border: '1px solid rgba(58,124,165,0.2)' }}>
              <p className="text-xs font-semibold mb-0.5" style={{ color: '#3A7CA5' }}>Free forever</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>1% fee applies to confirmed deals only.</p>
            </div>
          )}
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>© QuotingHub · quotinghub.co.za</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-start justify-center p-6 sm:p-10 overflow-y-auto" style={{ background: '#F8F9FA' }}>
        <div className="w-full max-w-sm py-6">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="h-16 sm:h-20 w-auto mx-auto object-contain" />
          </div>

          <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)' }}>

            {/* Back + heading */}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs mb-6 hover:opacity-70 transition-opacity"
              style={{ color: '#71717A' }}
            >
              <ArrowLeft size={13} /> Change account type
            </button>

            {/* Type badge */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: accentBg }}>
                {isElec ? <Zap size={12} style={{ color: accent }} /> : <Package size={12} style={{ color: accent }} />}
              </div>
              <span className="text-xs font-semibold" style={{ color: accent }}>
                {isElec ? 'Electrician' : 'Product Supplier'}
              </span>
            </div>

            <h1 className="text-2xl font-bold mb-1" style={{ color: '#18181B' }}>Create account</h1>
            <p className="text-sm mb-6" style={{ color: '#71717A' }}>
              {isElec ? '30-day free trial — no card required' : 'Free forever · No monthly fees'}
            </p>

            {noPortalAccount && (
              <div className="mb-5 px-4 py-3 rounded-lg text-xs leading-relaxed" style={{ background: '#F0F2F5', border: '1px solid #D1D8E0', color: '#3A7CA5' }}>
                <strong>No supplier account found.</strong> Register below to get access.
              </div>
            )}

            {!isElec && (
              <div className="mb-5 px-4 py-3 rounded-lg text-xs leading-relaxed" style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#52525B' }}>
                <strong style={{ color: '#18181B' }}>Tip:</strong> Use the same email address that design studios use when sending you price requests.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Company Name</label>
                <input
                  value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder={isElec ? 'e.g. Smith Electrical (Pty) Ltd' : 'e.g. ABC Fabrics (Pty) Ltd'}
                  required autoFocus
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
                  style={INPUT_STYLE}
                  onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = '#FFFFFF' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.background = '#F4F4F5' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Your Name</label>
                <input
                  value={contactName} onChange={e => setContactName(e.target.value)}
                  placeholder="Full name" autoComplete="name"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
                  style={INPUT_STYLE}
                  onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = '#FFFFFF' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.background = '#F4F4F5' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
                  style={INPUT_STYLE}
                  onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = '#FFFFFF' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.background = '#F4F4F5' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    required autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg outline-none"
                    style={INPUT_STYLE}
                    onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = '#FFFFFF' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.background = '#F4F4F5' }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#A1A1AA' }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-xs mt-1" style={{ color: '#A1A1AA' }}>Min. 8 characters</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                    required autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg outline-none"
                    style={INPUT_STYLE}
                    onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = '#FFFFFF' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.background = '#F4F4F5' }}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#A1A1AA' }}>
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Fee notice */}
              {!isElec && (
                <div className="px-4 py-3 rounded-lg text-xs leading-relaxed" style={{ background: '#F0F8FF', border: '1px solid #BFDBFE', color: '#1D4ED8' }}>
                  A <strong>1% platform fee</strong> applies to the value of all confirmed deals through QuotingHub.
                </div>
              )}

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox" checked={tcAccepted} onChange={e => setTcAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded cursor-pointer shrink-0"
                  style={{ accentColor: accent }}
                />
                <span className="text-xs leading-relaxed" style={{ color: '#71717A' }}>
                  I agree to the{' '}
                  <a href="/supplier-portal/terms" target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{ color: accent }}>Terms &amp; Conditions</a>
                  {' '}and{' '}
                  <a href="/supplier-portal/privacy" target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{ color: accent }}>Privacy Policy</a>
                  {!isElec && ', including the 1% platform fee on confirmed deals'}.
                </span>
              </label>

              {siteKey && <div ref={widgetRef} />}

              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !tcAccepted}
                className="w-full py-3 text-sm font-bold rounded-lg disabled:opacity-50 cursor-pointer mt-1"
                style={{ background: submitBg, color: submitText, transition: 'opacity 0.15s' }}
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm mt-6 pt-5" style={{ color: '#71717A', borderTop: '1px solid #F4F4F5' }}>
              Already have an account?{' '}
              <Link href="/supplier-portal/login" className="font-medium hover:underline" style={{ color: accent }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Root component ─────────────────────────────────────────────────────────────
function RegisterFlow() {
  const [category, setCategory] = useState<Category | null>(null)

  if (!category) return <TypeSelector onSelect={setCategory} />
  return <RegisterForm category={category} onBack={() => setCategory(null)} />
}

export default function SupplierRegisterPage() {
  return (
    <Suspense>
      <RegisterFlow />
    </Suspense>
  )
}
