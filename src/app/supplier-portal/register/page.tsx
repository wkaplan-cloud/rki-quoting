'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
      widgetId.current = (window as any).turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        theme: 'light',
      })
    }
    if ((window as any).turnstile) {
      render()
    } else {
      const prev = (window as any).onloadTurnstileCallback
      ;(window as any).onloadTurnstileCallback = () => {
        render()
        if (prev) prev()
      }
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
    if (siteKey && !cfToken) {
      setError('Please complete the security check.')
      return
    }

    setLoading(true)

    // Create portal account
    const res = await fetch('/api/supplier-portal/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, company_name: companyName.trim(), cf_token: cfToken }),
    })
    const data = await res.json() as { error?: string }
    if (!res.ok) {
      setError(data.error ?? 'Registration failed')
      setLoading(false)
      return
    }

    // Sign in immediately
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError) {
      setError('Account created. Please sign in.')
      setLoading(false)
      router.push('/supplier-portal/login')
      return
    }

    router.push('/supplier-portal/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-6">
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit"
          strategy="lazyOnload"
        />
      )}
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-10 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-semibold text-[#2C2C2A] tracking-tight">Supplier Portal</h1>
          <p className="text-sm text-[#8A877F] mt-1">Create your free supplier account</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EDE9E1] p-8" style={{ boxShadow: '0 4px 24px rgba(44,44,42,0.08)' }}>
          {noPortalAccount && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-xs text-amber-800 leading-relaxed">
              <strong>No supplier account found.</strong> You signed in but don&apos;t have a Supplier Portal account yet. Register below to get access.
            </div>
          )}

          <div className="bg-[#F5F2EC] border border-[#EDE9E1] rounded-lg px-4 py-3 mb-5 text-xs text-[#6B6860] leading-relaxed">
            <strong className="text-[#2C2C2A]">Important:</strong> Use the same email address that design studios use when sending you price requests. This lets us automatically show your requests in your dashboard.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. ABC Fabrics (Pty) Ltd"
                required
                autoFocus
                className="w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 pr-10 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#8A877F] transition-colors cursor-pointer">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-xs text-[#C4BFB5] mt-1">Min. 8 characters</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 pr-10 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#8A877F] transition-colors cursor-pointer">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="bg-[#FFF9F0] border border-[#F0D9B0] rounded-lg px-4 py-3 text-xs text-[#6B6860] leading-relaxed">
              <p className="font-semibold text-[#2C2C2A] mb-1">Platform Fee</p>
              <p>A fee of <strong>1% of the confirmed deal value</strong> is charged to the supplier for each order confirmed through the QuotingHub platform. By registering you agree to this fee structure.</p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tcAccepted}
                onChange={e => setTcAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#D8D3C8] accent-[#9A7B4F] flex-shrink-0 cursor-pointer"
              />
              <span className="text-xs text-[#6B6860] leading-relaxed">
                I have read and agree to the <strong className="text-[#2C2C2A]">Terms &amp; Conditions</strong>, including the 1% platform fee on confirmed deals processed through QuotingHub.
              </span>
            </label>

            {siteKey && <div ref={widgetRef} />}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !tcAccepted}
              className="w-full py-3 bg-[#2C2C2A] text-white text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer mt-1"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-[#8A877F] mt-5">
            Already have an account?{' '}
            <Link href="/supplier-portal/login" className="text-[#9A7B4F] hover:underline">Sign in</Link>
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
