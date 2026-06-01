'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Mail, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type LoginTab = 'supplier' | 'staff'

function SupplierLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [tab, setTab] = useState<LoginTab>('supplier')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicSending, setMagicSending] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  // Staff login
  const [staffUsername, setStaffUsername] = useState('')
  const [staffPin, setStaffPin] = useState(['', '', '', ''])
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffError, setStaffError] = useState('')
  const [hashRedirecting, setHashRedirecting] = useState(() =>
    typeof window !== 'undefined' && window.location.hash.includes('access_token=')
  )

  // Handle magic link hash tokens on return from email
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token=')) return

    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) return

    setHashRedirecting(true)
    supabase.auth.setSession({ access_token, refresh_token }).then(({ data: { session }, error }) => {
      if (error || !session) { setHashRedirecting(false); return }
      const redirectTo = searchParams.get('redirect')
      const dest = redirectTo?.startsWith('/supplier-portal/') ? redirectTo : '/supplier-portal/home'
      router.replace(dest)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (signInError) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }
    const redirectTo = searchParams.get('redirect')
    const dest = redirectTo?.startsWith('/supplier-portal/') ? redirectTo : '/supplier-portal/home'
    router.push(dest)
  }

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault()
    const pin = staffPin.join('')
    if (!staffUsername.trim() || pin.length !== 4) { setStaffError('Enter your username and 4-digit PIN'); return }
    setStaffLoading(true); setStaffError('')
    const res = await fetch('/api/supplier-portal/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: staffUsername.trim(), pin }),
    })
    const data = await res.json() as { access_token?: string; refresh_token?: string; error?: string }
    if (!res.ok || !data.access_token) { setStaffError(data.error ?? 'Invalid username or PIN'); setStaffLoading(false); return }
    await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token! })
    router.push('/supplier-portal/staff-home')
  }

  function handlePinDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...staffPin]
    next[index] = digit
    setStaffPin(next)
    if (digit && index < 3) pinRefs[index + 1].current?.focus()
    if (!digit && index > 0) pinRefs[index - 1].current?.focus()
  }

  async function handleMagicLink() {
    if (!email.trim()) { setError('Enter your email address above first'); return }
    setMagicSending(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin + '/supplier-portal/login' },
    })
    setMagicSending(false)
    if (error) { setError(error.message) } else { setMagicSent(true) }
  }

  if (hashRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FA' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#3A7CA5] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col items-center justify-between py-16 px-12" style={{ background: '#1E2A38' }}>
        <div />
        <div className="flex flex-col items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="w-72 object-contain" style={{ filter: 'invert(1) brightness(1)' }} />
          <p className="text-sm font-medium tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>Supplier Portal</p>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>© QuotingHub · quotinghub.co.za</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#F8F9FA' }}>
        <div className="w-full max-w-sm bg-white rounded-2xl p-8" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="lg:hidden mb-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="h-10 w-auto mx-auto object-contain" />
          </div>

          {/* Magic link sent state */}
          {/* Tab switcher */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: '#F4F4F5' }}>
            <button onClick={() => { setTab('supplier'); setError(''); setStaffError('') }}
              className="flex-1 py-2 text-sm font-semibold rounded-lg transition-colors"
              style={{ background: tab === 'supplier' ? '#FFFFFF' : 'transparent', color: tab === 'supplier' ? '#18181B' : '#71717A', boxShadow: tab === 'supplier' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              Supplier
            </button>
            <button onClick={() => { setTab('staff'); setError(''); setStaffError('') }}
              className="flex-1 py-2 text-sm font-semibold rounded-lg transition-colors"
              style={{ background: tab === 'staff' ? '#FFFFFF' : 'transparent', color: tab === 'staff' ? '#18181B' : '#71717A', boxShadow: tab === 'staff' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              Staff
            </button>
          </div>

          {/* Staff login */}
          {tab === 'staff' && (
            <form onSubmit={e => void handleStaffLogin(e)} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Username</label>
                <input
                  type="text"
                  value={staffUsername}
                  onChange={e => setStaffUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  required autoFocus autoComplete="username"
                  placeholder="e.g. john123"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none font-mono"
                  style={{ background: '#F4F4F5', border: '1.5px solid #E4E4E7', color: '#18181B' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#3A7CA5'; e.currentTarget.style.background = '#FFFFFF' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.background = '#F4F4F5' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>PIN</label>
                <div className="flex gap-3 justify-center">
                  {staffPin.map((digit, i) => (
                    <input
                      key={i}
                      ref={pinRefs[i]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handlePinDigit(i, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Backspace' && !digit && i > 0) pinRefs[i - 1].current?.focus() }}
                      className="w-14 h-14 text-center text-xl font-bold rounded-xl outline-none"
                      style={{ background: '#F4F4F5', border: `2px solid ${digit ? '#3A7CA5' : '#E4E4E7'}`, color: '#18181B' }}
                      onFocus={e => e.currentTarget.style.borderColor = '#3A7CA5'}
                      onBlur={e => { if (!digit) e.currentTarget.style.borderColor = '#E4E4E7' }}
                    />
                  ))}
                </div>
              </div>
              {staffError && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{staffError}</p>
              )}
              <button type="submit" disabled={staffLoading}
                className="w-full py-3 text-sm font-semibold rounded-lg disabled:opacity-50"
                style={{ background: '#3A7CA5', color: '#FFFFFF' }}>
                {staffLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          {tab === 'supplier' && (magicSent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(58,124,165,0.1)' }}>
                <Mail size={24} style={{ color: '#3A7CA5' }} />
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: '#18181B' }}>Check your email</h1>
              <p className="text-sm mb-1" style={{ color: '#71717A' }}>We sent a login link to</p>
              <p className="text-sm font-medium mb-6" style={{ color: '#18181B' }}>{email}</p>
              <p className="text-xs leading-relaxed mb-6" style={{ color: '#A1A1AA' }}>
                Click the link in the email to sign in instantly. The link expires in 60 minutes.
              </p>
              <button
                onClick={() => setMagicSent(false)}
                className="text-sm hover:underline" style={{ color: '#3A7CA5' }}
              >
                ← Use password instead
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-1" style={{ color: '#18181B' }}>Sign in</h1>
              <p className="text-sm mb-7" style={{ color: '#71717A' }}>Supplier Portal</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
                    style={{ background: '#F4F4F5', border: '1.5px solid #E4E4E7', color: '#18181B', transition: 'border-color 0.15s, background 0.15s' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3A7CA5'; e.currentTarget.style.background = '#FFFFFF' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.background = '#F4F4F5' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg outline-none"
                      style={{ background: '#F4F4F5', border: '1.5px solid #E4E4E7', color: '#18181B', transition: 'border-color 0.15s, background 0.15s' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#3A7CA5'; e.currentTarget.style.background = '#FFFFFF' }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.background = '#F4F4F5' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: '#A1A1AA' }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 text-sm font-semibold rounded-lg disabled:opacity-50 cursor-pointer mt-1"
                  style={{ background: '#3A7CA5', color: '#FFFFFF', transition: 'opacity 0.15s' }}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px" style={{ background: '#F4F4F5' }} />
                <span className="text-xs" style={{ color: '#D4D4D8' }}>or</span>
                <div className="flex-1 h-px" style={{ background: '#F4F4F5' }} />
              </div>

              {/* Magic link button */}
              <button
                type="button"
                onClick={() => void handleMagicLink()}
                disabled={magicSending}
                className="w-full py-3 text-sm font-medium rounded-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                style={{ border: '1.5px solid #E4E4E7', color: '#3A7CA5', background: '#FFFFFF', transition: 'border-color 0.15s, background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3A7CA5'; e.currentTarget.style.background = 'rgba(58,124,165,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E4E4E7'; e.currentTarget.style.background = '#FFFFFF' }}
              >
                <Mail size={14} />
                {magicSending ? 'Sending…' : 'Email me a login link'}
              </button>

              <div className="mt-6 pt-5 space-y-2 text-center" style={{ borderTop: '1px solid #F4F4F5' }}>
                <p className="text-sm" style={{ color: '#71717A' }}>
                  New supplier?{' '}
                  <Link href="/supplier-portal/register" className="font-medium hover:underline" style={{ color: '#3A7CA5' }}>Create an account</Link>
                </p>
                <p className="text-xs" style={{ color: '#A1A1AA' }}>
                  Are you a designer?{' '}
                  <Link href="/login" className="hover:underline" style={{ color: '#71717A' }}>Sign in here →</Link>
                </p>
              </div>
            </>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SupplierLoginPage() {
  return (
    <Suspense>
      <SupplierLoginForm />
    </Suspense>
  )
}
