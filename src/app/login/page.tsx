'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Mail } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [magicSending, setMagicSending] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [hashRedirecting, setHashRedirecting] = useState(() =>
    typeof window !== 'undefined' && window.location.hash.includes('access_token=')
  )
  // Show spinner immediately unless we're processing a hash token (which has its own state)
  const [checkingSession, setCheckingSession] = useState(() =>
    typeof window !== 'undefined' && !window.location.hash.includes('access_token=')
  )
  const [platformSignoutEmail, setPlatformSignoutEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [platformMode, setPlatformMode] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Storage can throw (Safari private browsing, blocked site data, strict privacy
  // extensions). A remember-me preference is never worth blocking a login over.
  function rememberFor(days: number) {
    try {
      localStorage.setItem('rki_remember_until', String(Date.now() + days * 86400000))
      sessionStorage.removeItem('rki_session_only')
    } catch {}
  }
  function rememberThisSessionOnly() {
    try {
      localStorage.removeItem('rki_remember_until')
      sessionStorage.setItem('rki_session_only', '1')
    } catch {}
  }

  // If already logged in, redirect away from the login page
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
      setCheckingSession(false)
      return
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const params = new URLSearchParams(window.location.search)
      if (!session) {
        if (params.get('from') === 'platform') setPlatformMode(true)
        setCheckingSession(false)
        return
      }
      if (params.get('from') === 'platform') {
        setPlatformSignoutEmail(session.user.email ?? null)
        setCheckingSession(false)
        return
      }
      const [{ data: portalAccount }, { data: portalMember }, { data: elecStaff }] = await Promise.all([
        supabase.from('supplier_portal_accounts').select('id').eq('auth_user_id', session.user.id).maybeSingle(),
        supabase.from('portal_org_members').select('id').eq('auth_user_id', session.user.id).not('accepted_at', 'is', null).maybeSingle(),
        supabase.from('elec_staff').select('id').eq('auth_user_id', session.user.id).eq('is_active', true).maybeSingle(),
      ])
      setCheckingSession(false)
      if (portalAccount || portalMember) router.replace('/supplier-portal/home')
      else if (elecStaff) router.replace('/supplier-portal/staff-home')
      else router.replace('/dashboard')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle email confirmation / magic link hash tokens
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token=')) return

    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const type = params.get('type')

    if (!access_token || !refresh_token) return
    setHashRedirecting(true)

    supabase.auth.setSession({ access_token, refresh_token }).then(({ data: { session }, error }) => {
      if (error || !session) { setHashRedirecting(false); return }

      if (type === 'signup') {
        try { sessionStorage.setItem('rki_session_only', '1') } catch {}
        router.replace('/welcome')
      } else if (type === 'invite') {
        try { sessionStorage.setItem('rki_session_only', '1') } catch {}
        supabase.rpc('accept_org_invite').then(() => router.replace('/set-password'))
      } else {
        // magiclink, recovery, etc — treat as remember-me login
        rememberFor(7)
        router.replace('/dashboard')
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePlatformSignout() {
    setSigningOut(true)
    await supabase.auth.signOut()
    setPlatformSignoutEmail(null)
    setPlatformMode(true)
  }

  if (hashRedirecting || checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundImage: 'url(/login-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#C4A46B] border-t-transparent animate-spin" />
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      if (rememberMe) rememberFor(7)
      else rememberThisSessionOnly()
      router.push(platformMode ? '/platform' : '/dashboard')
    } catch {
      // Never leave the button stuck on "Signing in…" with no explanation
      setError('Could not sign you in — please try again, or use the login-link option below.')
      setLoading(false)
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) { setError('Enter your email address above first'); return }
    setMagicSending(true)
    setError('')
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), redirectPath: '/login' }),
      })
      const data = await res.json()
      setMagicSending(false)
      if (!res.ok) { setError(data.error ?? 'Something went wrong. Please try again.') } else { setMagicSent(true) }
    } catch {
      setMagicSending(false)
      setError('Connection error — please try again')
    }
  }

  const cardShadow = { boxShadow: '0 40px 120px rgba(0,0,0,0.22), 0 16px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08)' }

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundImage: 'url(/login-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Left panel */}
      <div className="hidden lg:flex w-2/5 flex-col justify-between p-12 relative">
        <div className="relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-28 w-auto object-contain" style={{ filter: 'invert(1)' }} />
        </div>
        <div className="relative z-10">
          <p className="font-serif text-white/85 text-4xl leading-snug tracking-tight">
            Every project,<br />
            <em className="text-[#C4A46B]">perfectly quoted.</em>
          </p>
          <p className="text-white/40 text-sm mt-5 font-light leading-relaxed">
            Manage quotes, invoices, and purchase orders<br />
            for your interior design projects.
          </p>
        </div>
        <p className="relative z-10 text-white/20 text-xs">© QuotingHub · quotinghub.co.za</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">

        {/* Platform admin: sign-out notice */}
        {platformSignoutEmail && (
          <div className="w-full max-w-sm bg-white rounded-3xl p-9" style={cardShadow}>
            <div className="mb-6 text-center">
              <h1 className="font-serif text-2xl text-[#1A1A18] tracking-tight mb-2">Sign in as platform admin</h1>
              <p className="text-sm text-[#8A877F]">
                You&apos;re currently signed in as<br />
                <span className="font-medium text-[#2C2C2A]">{platformSignoutEmail}</span>
              </p>
            </div>
            <p className="text-sm text-[#8A877F] text-center mb-6">
              To access the platform admin, sign out first and then sign in with your admin credentials.
            </p>
            <button
              onClick={handlePlatformSignout}
              disabled={signingOut}
              className="w-full py-3 bg-[#1A1A18] text-white text-sm font-medium rounded-lg hover:bg-[#2C2C2A] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {signingOut ? 'Signing out…' : 'Sign Out & Continue'}
            </button>
          </div>
        )}

        {/* Login form */}
        {!platformSignoutEmail && (
          <div className="w-full max-w-sm bg-white rounded-3xl p-9" style={cardShadow}>

            {/* Magic link sent state */}
            {magicSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-2xl bg-[#F5F2EC] flex items-center justify-center mx-auto mb-5">
                  <Mail size={24} className="text-[#9A7B4F]" />
                </div>
                <h1 className="font-serif text-2xl text-[#1A1A18] tracking-tight mb-2">Check your email</h1>
                <p className="text-sm text-[#8A877F] leading-relaxed mb-1">
                  We sent a login link to
                </p>
                <p className="text-sm font-medium text-[#2C2C2A] mb-6">{email}</p>
                <p className="text-xs text-[#B0AA9F] leading-relaxed mb-6">
                  Click the link in the email to sign in instantly. The link expires in 60 minutes.
                </p>
                <button
                  onClick={() => setMagicSent(false)}
                  className="text-sm text-[#9A7B4F] hover:underline"
                >
                  ← Use password instead
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="font-serif text-3xl text-[#1A1A18] tracking-tight">{platformMode ? 'Platform admin sign in' : 'Welcome back'}</h1>
                  <p className="text-sm text-[#8A877F] mt-1.5">{platformMode ? 'Sign in with your admin credentials' : 'Sign in to your studio account'}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white placeholder:text-[#C4BFB5] transition-colors"
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
                        className="w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white pr-10 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#8A877F] transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-[#8A877F] cursor-pointer select-none">
                      <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="rounded border-[#D8D3C8] accent-[#9A7B4F]" />
                      Remember me
                    </label>
                    <Link href="/forgot-password" className="text-sm text-[#9A7B4F] hover:underline">Forgot password?</Link>
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#1A1A18] text-white text-sm font-medium rounded-lg hover:bg-[#2C2C2A] transition-colors disabled:opacity-50 cursor-pointer mt-1"
                  >
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>

                {!platformMode && (
                  <>
                    <div className="flex items-center gap-3 my-5">
                      <div className="flex-1 h-px bg-[#EDE9E1]" />
                      <span className="text-xs text-[#C4BFB5]">or</span>
                      <div className="flex-1 h-px bg-[#EDE9E1]" />
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleMagicLink()}
                      disabled={magicSending}
                      className="w-full py-3 border border-[#D8D3C8] text-[#2C2C2A] text-sm font-medium rounded-lg hover:bg-[#F5F2EC] hover:border-[#C4BFB5] transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Mail size={14} className="text-[#9A7B4F]" />
                      {magicSending ? 'Sending…' : 'Email me a login link'}
                    </button>
                  </>
                )}

                <p className="text-center text-sm text-[#8A877F] mt-6">
                  Don&apos;t have an account?{' '}
                  <Link href="/signup" className="text-[#9A7B4F] hover:underline">Sign up</Link>
                </p>
                <p className="text-center text-xs text-[#B0AA9F] mt-3">
                  Are you a supplier?{' '}
                  <Link href="/supplier-portal/login" className="text-[#9A7B4F] hover:underline">Sign in here</Link>
                </p>
              </>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
