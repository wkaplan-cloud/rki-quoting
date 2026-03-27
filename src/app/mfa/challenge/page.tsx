'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck } from 'lucide-react'

export default function MFAChallenPage() {
  const supabase = createClient()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: factors, error: factorsErr } = await supabase.auth.mfa.listFactors()
    if (factorsErr || !factors?.totp?.length) {
      setError('No MFA factor found. Please re-enroll.')
      setLoading(false)
      return
    }

    const factorId = factors.totp[0].id
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeErr || !challenge) {
      setError(challengeErr?.message ?? 'Failed to create challenge')
      setLoading(false)
      return
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.replace(/\s/g, ''),
    })

    if (verifyErr) {
      setError(verifyErr.message)
      setLoading(false)
      return
    }

    router.push('/platform')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0F0F0D] flex items-center justify-center p-6">
      <div className="bg-[#1A1A18] border border-white/10 rounded-2xl p-10 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl bg-[#9A7B4F]/20 flex items-center justify-center">
            <ShieldCheck size={20} className="text-[#C4A46B]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Two-factor authentication</h1>
            <p className="text-xs text-white/40 mt-0.5">Platform admin verification</p>
          </div>
        </div>

        <form onSubmit={verify} className="space-y-5">
          <p className="text-sm text-white/50 leading-relaxed">
            Open your authenticator app and enter the 6-digit code for QuotingHub.
          </p>

          <div>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={e => { setCode(e.target.value.replace(/[^0-9 ]/g, '')); setError('') }}
              placeholder="000 000"
              maxLength={7}
              required
              autoFocus
              autoComplete="one-time-code"
              className="w-full px-4 py-4 bg-[#0F0F0D] border border-white/10 rounded-lg text-white text-center text-3xl font-mono tracking-widest outline-none focus:border-[#9A7B4F] transition-colors placeholder:text-white/20"
            />
            {error && <p className="text-xs text-red-400 mt-2 text-center">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || code.replace(/\s/g, '').length < 6}
            className="w-full py-3 bg-[#9A7B4F] text-white text-sm font-medium rounded-lg hover:bg-[#C4A46B] transition-colors disabled:opacity-40 cursor-pointer"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  )
}
