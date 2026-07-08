'use client'
import { useState, useRef, useEffect } from 'react'
import { UserCog, ShieldCheck, X, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type Step = 'confirm' | 'mfa' | 'starting'

export function ImpersonateButton({ orgId, studioName, adminEmail }: { orgId: string; studioName: string; adminEmail: string | null }) {
  const [step, setStep] = useState<Step | null>(null)
  const [code, setCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (step === 'mfa') setTimeout(() => inputRef.current?.focus(), 80)
  }, [step])

  function open() { setCode(''); setMfaError(''); setStep('confirm') }
  function close() { if (loading) return; setStep(null); setCode(''); setMfaError('') }

  async function verifyAndImpersonate() {
    setLoading(true)
    setMfaError('')

    const { data: factors, error: factorsErr } = await supabase.auth.mfa.listFactors()
    if (factorsErr || !factors?.totp?.length) {
      setMfaError('No authenticator found. Please re-enroll MFA.')
      setLoading(false)
      return
    }

    const factorId = factors.totp[0].id
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeErr || !challenge) {
      setMfaError(challengeErr?.message ?? 'Failed to create MFA challenge')
      setLoading(false)
      return
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.replace(/\s/g, ''),
    })

    if (verifyErr) {
      setMfaError('Incorrect code. Please try again.')
      setLoading(false)
      setCode('')
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    setStep('starting')
    const res = await fetch(`/api/platform/studios/${orgId}/impersonate`, { method: 'POST' })
    const data = await res.json()

    if (!res.ok || !data.signInUrl) {
      toast.error(data.error ?? 'Failed to start impersonation')
      setStep('mfa')
      setLoading(false)
      return
    }

    window.location.href = data.signInUrl
  }

  if (!adminEmail) return null

  return (
    <>
      <button
        onClick={open}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/10 transition-colors flex-shrink-0 cursor-pointer"
      >
        <Eye size={13} />
        Impersonate
      </button>

      {step !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div className="bg-[#1A1A18] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${step === 'mfa' || step === 'starting' ? 'bg-[#9A7B4F]/20' : 'bg-blue-500/15'}`}>
                  {step === 'mfa' || step === 'starting'
                    ? <ShieldCheck size={17} className="text-[#C4A46B]" />
                    : <UserCog size={17} className="text-blue-400" />
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {step === 'mfa' ? 'Verify your identity' : step === 'starting' ? 'Starting…' : 'Impersonate studio admin'}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {step === 'mfa' ? 'Authenticator code required' : 'Logs you in as their account'}
                  </p>
                </div>
              </div>
              {step !== 'starting' && (
                <button onClick={close} className="text-white/30 hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              )}
            </div>

            {step === 'confirm' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-white/60 leading-relaxed">
                  You are about to view the app as{' '}
                  <span className="text-white font-semibold">{adminEmail}</span>, admin of{' '}
                  <span className="text-white font-semibold">&ldquo;{studioName}&rdquo;</span>.
                </p>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
                  <p className="text-xs text-blue-300 leading-relaxed">
                    This replaces your session with theirs — any action you take will be as them. You&apos;ll see an &ldquo;Exit impersonation&rdquo; banner while active, and it&apos;s logged.
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={close} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={() => setStep('mfa')} className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors cursor-pointer">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {step === 'mfa' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-white/60 leading-relaxed">
                  Enter the 6-digit code from your authenticator app to impersonate{' '}
                  <span className="text-white font-medium">{adminEmail}</span>.
                </p>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/[^0-9 ]/g, '')); setMfaError('') }}
                  onKeyDown={e => { if (e.key === 'Enter' && code.replace(/\s/g, '').length === 6) verifyAndImpersonate() }}
                  placeholder="000 000"
                  maxLength={7}
                  autoComplete="one-time-code"
                  className="w-full px-4 py-4 bg-[#0F0F0D] border border-white/10 rounded-lg text-white text-center text-3xl font-mono tracking-widest outline-none focus:border-[#9A7B4F] transition-colors placeholder:text-white/20"
                />
                {mfaError && <p className="text-xs text-red-400 text-center">{mfaError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setStep('confirm'); setCode(''); setMfaError('') }} disabled={loading}
                    className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors disabled:opacity-40 cursor-pointer">
                    ← Back
                  </button>
                  <button onClick={verifyAndImpersonate} disabled={loading || code.replace(/\s/g, '').length < 6}
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2">
                    <ShieldCheck size={14} />
                    {loading ? 'Verifying…' : 'Verify & Impersonate'}
                  </button>
                </div>
              </div>
            )}

            {step === 'starting' && (
              <div className="px-6 py-10 flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#9A7B4F] border-t-transparent animate-spin" />
                <p className="text-sm text-white/50">Starting impersonation session…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
