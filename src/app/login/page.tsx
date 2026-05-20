'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, PenLine, ShoppingBag } from 'lucide-react'

const SUPPLIER_PORTAL_URL = process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL ?? 'https://suppliers.quotinghub.co.za'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [role, setRole] = useState<'designer' | null>(null)
  const [hashRedirecting, setHashRedirecting] = useState(() =>
    typeof window !== 'undefined' && window.location.hash.includes('access_token=')
  )
  const [checkingSession, setCheckingSession] = useState(false)
  const [platformSignoutEmail, setPlatformSignoutEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [platformMode, setPlatformMode] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // If already logged in, redirect away from the login page
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
      setCheckingSession(false)
      return
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const params = new URLSearchParams(window.location.search)
      if (!session) {
        // No session — if coming from /platform, drop straight to the admin login form
        if (params.get('from') === 'platform') {
          setPlatformMode(true)
          setRole('designer')
        }
        setCheckingSession(false)
        return
      }
      // Signed in but coming from /platform as a non-admin: show sign-out notice
      if (params.get('from') === 'platform') {
        setPlatformSignoutEmail(session.user.email ?? null)
        setCheckingSession(false)
        return
      }
      const { data: portalAccount } = await supabase
        .from('supplier_portal_accounts')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .maybeSingle()
      setCheckingSession(false)
      router.replace(portalAccount ? '/supplier-portal/dashboard' : '/dashboard')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase implicit flow: email confirmation links redirect to /login with tokens
  // in the URL hash (#access_token=...&type=signup).
  // We parse the tokens directly and call setSession() — this is the only race-free
  // approach. onAuthStateChange can miss the event if it fires before the listener
  // is registered. getSession() races with hash processing and returns null.
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
      if (error || !session) {
        // Something went wrong — drop back to login
        setHashRedirecting(false)
        return
      }
      // Mark this as a session-only login so SessionGuard doesn't sign the user out
      // (email-confirmed users never go through the login form's remember-me logic)
      sessionStorage.setItem('rki_session_only', '1')
      if (type === 'signup') {
        router.replace('/welcome')
      } else if (type === 'invite') {
        supabase.rpc('accept_org_invite').then(() => router.replace('/set-password'))
      } else {
        router.replace('/dashboard')
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePlatformSignout() {
    setSigningOut(true)
    await supabase.auth.signOut()
    setPlatformSignoutEmail(null)
    setPlatformMode(true)
    setRole('designer')
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
    const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      if (rememberMe) {
        const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000
        localStorage.setItem('rki_remember_until', String(expiry))
        sessionStorage.removeItem('rki_session_only')
      } else {
        localStorage.removeItem('rki_remember_until')
        sessionStorage.setItem('rki_session_only', '1')
      }
      if (platformMode) {
        router.push('/platform')
        return
      }
      router.push('/dashboard')
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

        {/* Role selector */}
        {!platformSignoutEmail && !role && (
          <div className="w-full max-w-sm bg-white rounded-3xl p-9" style={cardShadow}>
            <div className="mb-8 text-center">
              <h1 className="font-serif text-3xl text-[#1A1A18] tracking-tight">Welcome back</h1>
              <p className="text-sm text-[#8A877F] mt-1.5">How would you like to sign in?</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => setRole('designer')}
                className="w-full flex items-center gap-4 px-5 py-4 border-2 border-[#D8D3C8] rounded-2xl text-left hover:border-[#9A7B4F] hover:bg-[#F5F2EC] transition-all duration-150 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#1A1A18] flex items-center justify-center shrink-0">
                  <PenLine size={18} className="text-[#C4A46B]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A18]">Designer / Studio</p>
                  <p className="text-xs text-[#8A877F]">Quotes, invoices & purchase orders</p>
                </div>
              </button>
              <Link
                href="/supplier-portal/login"
                className="w-full flex items-center gap-4 px-5 py-4 border-2 border-[#D8D3C8] rounded-2xl text-left hover:border-[#9A7B4F] hover:bg-[#F5F2EC] transition-all duration-150 no-underline block"
              >
                <div className="w-10 h-10 rounded-xl bg-[#F5F2EC] border border-[#D8D3C8] flex items-center justify-center shrink-0">
                  <ShoppingBag size={18} className="text-[#9A7B4F]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A18]">Supplier</p>
                  <p className="text-xs text-[#8A877F]">Price requests & product catalogue</p>
                </div>
              </Link>
            </div>
            <p className="text-center text-sm text-[#8A877F] mt-7">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-[#9A7B4F] hover:underline">Sign up</Link>
            </p>
          </div>
        )}

        {/* Designer login form */}
        {!platformSignoutEmail && role === 'designer' && (
          <div className="w-full max-w-sm bg-white rounded-3xl p-9" style={cardShadow}>
            <div className="mb-8">
              <button onClick={() => setRole(null)} className="text-xs text-[#8A877F] hover:text-[#2C2C2A] transition-colors mb-4 flex items-center gap-1">
                ← Back
              </button>
              <h1 className="font-serif text-3xl text-[#1A1A18] tracking-tight">{platformMode ? 'Platform admin sign in' : 'Designer sign in'}</h1>
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

            <p className="text-center text-sm text-[#8A877F] mt-6">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-[#9A7B4F] hover:underline">Sign up</Link>
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
