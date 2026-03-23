'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="min-h-screen flex bg-[#F5F2EC]">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-[#1A1A18] flex-col justify-between p-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QuotingHub" className="h-40 w-auto object-contain" style={{ filter: 'invert(1)' }} />
        <div>
          <p className="font-serif text-white/80 text-3xl leading-snug">
            Every project,<br />
            <em className="text-[#C4A46B]">perfectly quoted.</em>
          </p>
          <p className="text-white/40 text-sm mt-4 font-light leading-relaxed">
            Manage quotes, invoices, and purchase orders<br />
            for your interior design projects.
          </p>
        </div>
        <p className="text-white/20 text-xs">© QuotingHub · quotinghub.co.za</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-serif text-2xl text-[#1A1A18]">Welcome back</h1>
            <p className="text-sm text-[#8A877F] mt-1">Sign in to your account</p>
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
              placeholder="••••••••"
              required
            />
            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}
            <Button type="submit" disabled={loading} className="w-full justify-center py-2.5 mt-2">
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
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
