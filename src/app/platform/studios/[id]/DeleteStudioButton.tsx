'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, RotateCcw, ShieldCheck, X, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type ModalStep = 'confirm' | 'mfa' | 'archiving'

export function ArchiveStudioButton({ orgId, studioName }: { orgId: string; studioName: string }) {
  const [step, setStep] = useState<ModalStep | null>(null)
  const [code, setCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (step === 'mfa') setTimeout(() => inputRef.current?.focus(), 80)
  }, [step])

  function open() { setCode(''); setMfaError(''); setStep('confirm') }
  function close() { if (loading) return; setStep(null); setCode(''); setMfaError('') }

  async function verifyAndArchive() {
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

    setStep('archiving')
    const res = await fetch(`/api/platform/studios/${orgId}`, { method: 'DELETE' })

    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to archive studio')
      setStep('mfa')
      setLoading(false)
      return
    }

    toast.success(`"${studioName}" has been archived`)
    router.push('/platform/studios')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={open}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/10 transition-colors flex-shrink-0 cursor-pointer"
      >
        <Archive size={13} />
        Archive studio
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
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${step === 'mfa' || step === 'archiving' ? 'bg-[#9A7B4F]/20' : 'bg-amber-500/15'}`}>
                  {step === 'mfa' || step === 'archiving'
                    ? <ShieldCheck size={17} className="text-[#C4A46B]" />
                    : <AlertTriangle size={17} className="text-amber-400" />
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {step === 'mfa' ? 'Verify your identity' : step === 'archiving' ? 'Archiving…' : 'Archive studio'}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {step === 'mfa' ? 'Authenticator code required' : 'Studio can be restored later'}
                  </p>
                </div>
              </div>
              {step !== 'archiving' && (
                <button onClick={close} className="text-white/30 hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              )}
            </div>

            {step === 'confirm' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-white/60 leading-relaxed">
                  You are about to archive{' '}
                  <span className="text-white font-semibold">&ldquo;{studioName}&rdquo;</span>.
                </p>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                  <p className="text-xs text-amber-300 leading-relaxed">
                    The studio and all its data will be preserved but the studio will lose access to the platform. You can restore it at any time. Data is permanently deleted after <strong>24 months</strong>.
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={close} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={() => setStep('mfa')} className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors cursor-pointer">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {step === 'mfa' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-white/60 leading-relaxed">
                  Enter the 6-digit code from your authenticator app to archive{' '}
                  <span className="text-white font-medium">&ldquo;{studioName}&rdquo;</span>.
                </p>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/[^0-9 ]/g, '')); setMfaError('') }}
                  onKeyDown={e => { if (e.key === 'Enter' && code.replace(/\s/g, '').length === 6) verifyAndArchive() }}
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
                  <button onClick={verifyAndArchive} disabled={loading || code.replace(/\s/g, '').length < 6}
                    className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2">
                    <ShieldCheck size={14} />
                    {loading ? 'Verifying…' : 'Verify & Archive'}
                  </button>
                </div>
              </div>
            )}

            {step === 'archiving' && (
              <div className="px-6 py-10 flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#9A7B4F] border-t-transparent animate-spin" />
                <p className="text-sm text-white/50">Archiving &ldquo;{studioName}&rdquo;…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export function RestoreStudioButton({ orgId, studioName }: { orgId: string; studioName: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function restore() {
    setLoading(true)
    const res = await fetch(`/api/platform/studios/${orgId}`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to restore studio')
    } else {
      toast.success(`"${studioName}" has been restored`)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={restore}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/10 transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50"
    >
      <RotateCcw size={13} />
      {loading ? 'Restoring…' : 'Restore studio'}
    </button>
  )
}
