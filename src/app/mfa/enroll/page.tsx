'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Loader2 } from 'lucide-react'

export default function MFAEnrollPage() {
  const supabase = createClient()
  const router = useRouter()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(true)

  useEffect(() => {
    async function startEnroll() {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'QuotingHub', friendlyName: 'Platform Admin' })
      if (error || !data) { setError(error?.message ?? 'Failed to start MFA setup'); setEnrolling(false); return }
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setFactorId(data.id)
      setEnrolling(false)
    }
    startEnroll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/platform')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0F0F0D] flex items-center justify-center p-6">
      <div className="bg-[#1A1A18] border border-white/10 rounded-2xl p-10 w-full max-w-md">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl bg-[#9A7B4F]/20 flex items-center justify-center">
            <ShieldCheck size={20} className="text-[#C4A46B]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Set up two-factor authentication</h1>
            <p className="text-xs text-white/40 mt-0.5">Required for platform admin access</p>
          </div>
        </div>

        {enrolling ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-white/30 animate-spin" />
          </div>
        ) : error && !qrCode ? (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">{error}</p>
        ) : (
          <form onSubmit={verify} className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm text-white/60 leading-relaxed">
                Scan the QR code below with an authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code to confirm.
              </p>

              {qrCode && (
                <div className="flex justify-center py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="MFA QR Code" className="w-48 h-48 rounded-lg bg-white p-2" />
                </div>
              )}

              {secret && (
                <div className="bg-[#0F0F0D] border border-white/10 rounded-lg px-4 py-3">
                  <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mb-1">Manual entry key</p>
                  <p className="text-sm font-mono text-white/70 break-all select-all">{secret}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-white/40 uppercase tracking-widest mb-2">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={e => { setCode(e.target.value.replace(/[^0-9 ]/g, '')); setError('') }}
                placeholder="000 000"
                maxLength={7}
                required
                autoComplete="one-time-code"
                className="w-full px-4 py-3 bg-[#0F0F0D] border border-white/10 rounded-lg text-white text-center text-2xl font-mono tracking-widest outline-none focus:border-[#9A7B4F] transition-colors placeholder:text-white/20"
              />
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || code.replace(/\s/g, '').length < 6}
              className="w-full py-3 bg-[#9A7B4F] text-white text-sm font-medium rounded-lg hover:bg-[#C4A46B] transition-colors disabled:opacity-40 cursor-pointer"
            >
              {loading ? 'Verifying…' : 'Activate & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
