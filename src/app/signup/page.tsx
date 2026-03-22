'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#F5F2EC]">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-[#1A1A18] flex-col justify-between p-12">
        <div className="font-serif text-white text-xl">
          Quoting Studio
          <span className="block text-[#C4A46B] text-xs font-sans font-normal tracking-widest uppercase mt-1">
            For Interior Designers
          </span>
        </div>
        <div>
          <p className="font-serif text-white/80 text-3xl leading-snug">
            Quotes, invoices<br />
            <em className="text-[#C4A46B]">& purchase orders.</em>
          </p>
          <p className="text-white/40 text-sm mt-4 font-light leading-relaxed">
            Built for interior designers who are done<br />
            fighting with spreadsheets.
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
        <p className="text-white/20 text-xs">Powered by RKI</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-serif text-2xl text-[#1A1A18]">Check your email</h2>
              <p className="text-sm text-[#8A877F]">
                We sent a confirmation link to <strong>{email}</strong>.<br />
                Click it to activate your account.
              </p>
              <Link href="/login" className="inline-block mt-4 text-sm text-[#9A7B4F] hover:underline">
                Back to sign in →
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="font-serif text-2xl text-[#1A1A18]">Create your account</h1>
                <p className="text-sm text-[#8A877F] mt-1">Start quoting in minutes</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@yourstudio.com"
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                />
                {error && (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
                )}
                <Button type="submit" disabled={loading} className="w-full justify-center py-2.5 mt-2">
                  {loading ? 'Creating account…' : 'Create Account'}
                </Button>
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
