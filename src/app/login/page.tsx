'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundImage: 'url(/login-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Left panel — transparent overlay on dark half */}
      <div className="hidden lg:flex w-2/5 flex-col justify-between p-12 relative">
        {/* Logo */}
        <div className="relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-28 w-auto object-contain" style={{ filter: 'invert(1)' }} />
        </div>

        {/* Tagline */}
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

      {/* Right panel — transparent overlay on light half */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm bg-white rounded-3xl p-9" style={{ boxShadow: '0 40px 120px rgba(0,0,0,0.22), 0 16px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="mb-8">
            <h1 className="font-serif text-3xl text-[#1A1A18] tracking-tight">Welcome back</h1>
            <p className="text-sm text-[#8A877F] mt-1.5">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@yourstudio.com"
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
                  placeholder="••••••••"
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
                <input type="checkbox" className="rounded border-[#D8D3C8] accent-[#9A7B4F]" />
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
      </div>
    </div>
  )
}
