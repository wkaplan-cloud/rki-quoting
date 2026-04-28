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
    <div className="min-h-screen flex">
      {/* Left panel — brand blue with large logo */}
      <div className="hidden lg:flex lg:w-2/5 flex-col items-center justify-between py-16 px-12" style={{ background: '#34495E' }}>
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
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
                style={{ background: '#F4F4F5', border: '1.5px solid #E4E4E7', color: '#18181B', transition: 'border-color 0.15s, background 0.15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#34495E'; e.currentTarget.style.background = '#FFFFFF' }}
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
                  onFocus={e => { e.currentTarget.style.borderColor = '#34495E'; e.currentTarget.style.background = '#FFFFFF' }}
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
              style={{ background: '#34495E', color: '#FFFFFF', transition: 'opacity 0.15s' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 space-y-2 text-center" style={{ borderTop: '1px solid #F4F4F5' }}>
            <p className="text-sm" style={{ color: '#71717A' }}>
              New supplier?{' '}
              <Link href="/supplier-portal/register" className="font-medium hover:underline" style={{ color: '#34495E' }}>Create an account</Link>
            </p>
            <p className="text-xs">
              <Link href="/forgot-password" className="hover:underline" style={{ color: '#A1A1AA' }}>Forgot password?</Link>
            </p>
            <p className="text-xs" style={{ color: '#A1A1AA' }}>
              Are you a designer?{' '}
              <Link href="/login" className="hover:underline" style={{ color: '#71717A' }}>Sign in here →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
