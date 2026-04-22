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
    <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-10 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-semibold text-[#2C2C2A] tracking-tight">Supplier Portal</h1>
          <p className="text-sm text-[#8A877F] mt-1">Sign in to view your price requests</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EDE9E1] p-8" style={{ boxShadow: '0 4px 24px rgba(44,44,42,0.08)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
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
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors"
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

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#2C2C2A] text-white text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer mt-1"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-[#8A877F] mt-5">
            New supplier?{' '}
            <Link href="/supplier-portal/register" className="text-[#9A7B4F] hover:underline">Create an account</Link>
          </p>

          <p className="text-center text-xs text-[#C4BFB5] mt-3">
            <Link href="/forgot-password" className="hover:text-[#8A877F] transition-colors">Forgot password?</Link>
          </p>
        </div>

        <p className="text-center text-xs text-[#C4BFB5] mt-6">
          Are you a designer?{' '}
          <Link href="/login" className="text-[#8A877F] hover:underline">Designer sign in →</Link>
        </p>
      </div>
    </div>
  )
}
