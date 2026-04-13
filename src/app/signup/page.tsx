'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Please enter your full name'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!/[A-Z]/.test(password)) { setError('Password must contain at least one uppercase letter'); return }
    if (!/[0-9]/.test(password)) { setError('Password must contain at least one number'); return }
    if (!acceptedTerms) { setError('Please accept the Terms of Service and Privacy Policy to continue'); return }
    setLoading(true)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
    } else {
      setDone(true)
    }
  }

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
            Quotes, invoices<br />
            <em className="text-[#C4A46B]">& purchase orders.</em>
          </p>
          <p className="text-white/40 text-sm mt-5 font-light leading-relaxed">
            Built for interior designers who are done<br />
            with legacy quoting tools.
          </p>
          <ul className="mt-6 space-y-2">
            {['Reactive quoting with real-time totals', 'Auto-generated PDFs', 'Purchase orders per supplier', 'Send quotes by email'].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-white/50">
                <span className="w-1 h-1 rounded-full bg-[#C4A46B] flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-white/20 text-xs">© QuotingHub · quotinghub.co.za</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm bg-white rounded-3xl p-9" style={{ boxShadow: '0 40px 120px rgba(0,0,0,0.22), 0 16px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08)' }}>
          {done ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-serif text-2xl text-[#1A1A18]">Check your inbox</h2>
              <p className="text-sm text-[#8A877F] leading-relaxed">
                We sent a confirmation link to<br /><strong className="text-[#2C2C2A]">{email}</strong>
              </p>
              <p className="text-xs text-[#C4BFB5] leading-relaxed">
                Click the link in the email to activate your account. Check your spam folder if you don't see it.
              </p>
              <Link href="/login" className="inline-block mt-4 text-sm text-[#9A7B4F] hover:underline">
                Back to sign in →
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="font-serif text-3xl text-[#1A1A18] tracking-tight">Create your account</h1>
                <p className="text-sm text-[#8A877F] mt-1.5">Start quoting in minutes</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                    autoComplete="name"
                    className="w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white placeholder:text-[#C4BFB5] transition-colors"
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
                      autoComplete="new-password"
                      className="w-full px-3.5 py-2.5 pr-10 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white placeholder:text-[#C4BFB5] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#8A877F] transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <p className="text-xs text-[#C4BFB5] mt-1.5">Min 8 characters, one uppercase letter and one number</p>
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
                      className="w-full px-3.5 py-2.5 pr-10 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white placeholder:text-[#C4BFB5] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#8A877F] transition-colors cursor-pointer"
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="accept-terms"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#D8D3C8] text-[#9A7B4F] cursor-pointer flex-shrink-0"
                  />
                  <label htmlFor="accept-terms" className="text-xs text-[#8A877F] leading-relaxed cursor-pointer">
                    I agree to the{' '}
                    <Link href="/terms" target="_blank" className="text-[#9A7B4F] hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" target="_blank" className="text-[#9A7B4F] hover:underline">Privacy Policy</Link>
                  </label>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !acceptedTerms}
                  className="w-full py-3 bg-[#1A1A18] text-white text-sm font-medium rounded-lg hover:bg-[#2C2C2A] transition-colors disabled:opacity-50 cursor-pointer mt-1"
                >
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>

              <p className="text-center text-sm text-[#8A877F] mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-[#9A7B4F] hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
