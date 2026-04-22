'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!companyName.trim()) { setError('Please enter your company name'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)

    // Create portal account
    const res = await fetch('/api/supplier-portal/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, company_name: companyName.trim() }),
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

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
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
