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
    <div className="min-h-screen flex" style={{ background: '#0F1C28' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12" style={{ background: '#1C2B3A' }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-7 w-auto object-contain" style={{ filter: 'invert(1) brightness(0.7)' }} />
        </div>
        <div>
          <p className="text-3xl font-bold leading-snug mb-4" style={{ color: '#E8F0F8' }}>
            Manage price requests<br />in one place.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#5A7A95' }}>
            Respond to pricing requests from interior design studios — without digging through email.
          </p>
        </div>
        <p className="text-xs" style={{ color: '#2D4159' }}>© QuotingHub · Supplier Portal</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="h-8 w-auto mx-auto object-contain" style={{ filter: 'invert(1) brightness(0.7)' }} />
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ color: '#E8F0F8' }}>Sign in</h1>
          <p className="text-sm mb-8" style={{ color: '#5A7A95' }}>Supplier Portal</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#5A7A95' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors"
                style={{ background: '#1C2B3A', border: '1px solid #2D4159', color: '#E8F0F8' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                onBlur={e => (e.currentTarget.style.borderColor = '#2D4159')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#5A7A95' }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg outline-none transition-colors"
                  style={{ background: '#1C2B3A', border: '1px solid #2D4159', color: '#E8F0F8' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#2D4159')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#4A7FA5' }}
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
              style={{ background: '#3B82F6', color: '#FFFFFF' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 space-y-2 text-center" style={{ borderTop: '1px solid #1C2B3A' }}>
            <p className="text-sm" style={{ color: '#5A7A95' }}>
              New supplier?{' '}
              <Link href="/supplier-portal/register" className="font-medium" style={{ color: '#3B82F6' }}>Create an account</Link>
            </p>
            <p className="text-xs" style={{ color: '#2D4159' }}>
              <Link href="/forgot-password" style={{ color: '#4A7FA5' }}>Forgot password?</Link>
            </p>
            <p className="text-xs" style={{ color: '#2D4159' }}>
              Are you a designer?{' '}
              <Link href="/login" style={{ color: '#4A7FA5' }}>Sign in here →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
