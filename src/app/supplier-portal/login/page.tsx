'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SupplierLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    router.push('/supplier-portal/dashboard')
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0F0F10' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12" style={{ background: '#18181B' }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-7 w-auto object-contain" style={{ filter: 'invert(1) brightness(0.7)' }} />
        </div>
        <div>
          <p className="text-3xl font-bold leading-snug mb-4" style={{ color: '#FAFAFA' }}>
            Manage price requests<br />in one place.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#71717A' }}>
            Respond to pricing requests from interior design studios — without digging through email.
          </p>
        </div>
        <p className="text-xs" style={{ color: '#27272A' }}>© QuotingHub · Supplier Portal</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="h-8 w-auto mx-auto object-contain" style={{ filter: 'invert(1) brightness(0.7)' }} />
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ color: '#FAFAFA' }}>Sign in</h1>
          <p className="text-sm mb-8" style={{ color: '#71717A' }}>Supplier Portal</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors"
                style={{ background: '#18181B', border: '1px solid #27272A', color: '#FAFAFA' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3F3F46')}
                onBlur={e => (e.currentTarget.style.borderColor = '#27272A')}
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
                  className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg outline-none transition-colors"
                  style={{ background: '#18181B', border: '1px solid #27272A', color: '#FAFAFA' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3F3F46')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#27272A')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#52525B' }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#1A1020', color: '#F87171', border: '1px solid #3B1F1F' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 mt-1"
              style={{ background: '#3F3F46', color: '#FFFFFF' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 space-y-2 text-center" style={{ borderTop: '1px solid #18181B' }}>
            <p className="text-sm" style={{ color: '#71717A' }}>
              New supplier?{' '}
              <Link href="/supplier-portal/register" className="font-medium" style={{ color: '#3F3F46' }}>Create an account</Link>
            </p>
            <p className="text-xs" style={{ color: '#27272A' }}>
              <Link href="/forgot-password" style={{ color: '#52525B' }}>Forgot password?</Link>
            </p>
            <p className="text-xs" style={{ color: '#27272A' }}>
              Are you a designer?{' '}
              <Link href="/login" style={{ color: '#52525B' }}>Sign in here →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
