'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const INPUT_STYLE = {
  background: '#18181B',
  border: '1px solid #27272A',
  color: '#FAFAFA',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>{label}</label>
      {children}
    </div>
  )
}

function StyledInput({ type = 'text', value, onChange, placeholder, required, autoFocus, autoComplete }: {
  type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; autoFocus?: boolean; autoComplete?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors"
      style={INPUT_STYLE}
      onFocus={e => (e.currentTarget.style.borderColor = '#3F3F46')}
      onBlur={e => (e.currentTarget.style.borderColor = '#27272A')}
    />
  )
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const noPortalAccount = searchParams.get('notice') === 'no-portal-account'
  const supabase = createClient()
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [tcAccepted, setTcAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey) return
    function render() {
      if (!widgetRef.current || !(window as any).turnstile) return
      if (widgetId.current != null) return
      widgetId.current = (window as any).turnstile.render(widgetRef.current, { sitekey: siteKey, theme: 'dark' })
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
      body: JSON.stringify({ email: email.trim(), password, company_name: companyName.trim(), cf_token: cfToken }),
    })
    const data = await res.json() as { error?: string }
    if (!res.ok) { setError(data.error ?? 'Registration failed'); setLoading(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    })
    if (signInError) { router.push('/supplier-portal/login'); return }
    router.push('/supplier-portal/dashboard')
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0F0F10' }}>
      {siteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit" strategy="lazyOnload" />
      )}

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12" style={{ background: '#18181B' }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-7 w-auto object-contain" style={{ filter: 'invert(1) brightness(0.7)' }} />
        </div>
        <div>
          <p className="text-3xl font-bold leading-snug mb-4" style={{ color: '#FAFAFA' }}>
            Join the QuotingHub<br />supplier network.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#71717A' }}>
            Receive price requests directly from interior design studios. Respond faster, win more business.
          </p>
          <div className="mt-8 space-y-3">
            {['Free to join — no monthly fees', 'All price requests in one dashboard', 'Message designers directly per request'].map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#3F3F46' }} />
                <p className="text-sm" style={{ color: '#A1A1AA' }}>{f}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{ color: '#27272A' }}>© QuotingHub · Supplier Portal</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-start justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm py-10">
          <div className="lg:hidden mb-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="h-8 w-auto mx-auto object-contain" style={{ filter: 'invert(1) brightness(0.7)' }} />
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ color: '#FAFAFA' }}>Create account</h1>
          <p className="text-sm mb-7" style={{ color: '#71717A' }}>Supplier Portal · Free forever</p>

          {noPortalAccount && (
            <div className="mb-5 px-4 py-3 rounded-lg text-xs leading-relaxed" style={{ background: '#27272A', border: '1px solid #3F3F46', color: '#A1A1AA' }}>
              <strong style={{ color: '#D4D4D8' }}>No supplier account found.</strong> You signed in but don&apos;t have a Supplier Portal account yet. Register below to get access.
            </div>
          )}

          <div className="mb-5 px-4 py-3 rounded-lg text-xs leading-relaxed" style={{ background: '#18181B', border: '1px solid #27272A', color: '#A1A1AA' }}>
            <strong style={{ color: '#D4D4D8' }}>Important:</strong> Use the same email address that design studios use when sending you price requests.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Company Name">
              <StyledInput value={companyName} onChange={setCompanyName} placeholder="e.g. ABC Fabrics (Pty) Ltd" required autoFocus />
            </Field>
            <Field label="Email">
              <StyledInput type="email" value={email} onChange={setEmail} required autoComplete="email" />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg outline-none transition-colors"
                  style={INPUT_STYLE}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3F3F46')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#27272A')}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#52525B' }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-xs mt-1" style={{ color: '#27272A' }}>Min. 8 characters</p>
            </Field>
            <Field label="Confirm Password">
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg outline-none transition-colors"
                  style={INPUT_STYLE}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3F3F46')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#27272A')}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#52525B' }}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            {/* Platform fee notice */}
            <div className="px-4 py-3 rounded-lg text-xs leading-relaxed" style={{ background: '#1A2820', border: '1px solid #2A4A3A', color: '#6EE7B7' }}>
              <p className="font-semibold mb-1" style={{ color: '#A7F3D0' }}>Platform Fee</p>
              <p>A fee of <strong>1% of the confirmed deal value</strong> is charged to the supplier for each order confirmed through QuotingHub.</p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tcAccepted}
                onChange={e => setTcAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded cursor-pointer shrink-0"
                style={{ accentColor: '#3F3F46' }}
              />
              <span className="text-xs leading-relaxed" style={{ color: '#A1A1AA' }}>
                I agree to the{' '}
                <a href="/supplier-portal/terms" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: '#D4D4D8' }}>Terms &amp; Conditions</a>
                {' '}and{' '}
                <a href="/supplier-portal/privacy" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: '#D4D4D8' }}>Privacy Policy</a>
                , including the 1% platform fee on confirmed deals.
              </span>
            </label>

            {siteKey && <div ref={widgetRef} />}

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#1A1020', color: '#F87171', border: '1px solid #3B1F1F' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !tcAccepted}
              className="w-full py-3 text-white text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50 cursor-pointer mt-1 hover:opacity-90"
              style={{ background: '#1B4F8A' }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: '#71717A' }}>
            Already have an account?{' '}
            <Link href="/supplier-portal/login" className="font-medium hover:underline" style={{ color: '#9A7B4F' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SupplierRegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
