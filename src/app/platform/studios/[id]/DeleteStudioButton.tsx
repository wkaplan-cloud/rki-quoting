'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, RotateCcw, ShieldCheck, X, AlertTriangle, Trash2 } from 'lucide-react'
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
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 text-[#8F5706] text-xs font-medium hover:bg-amber-50 transition-colors flex-shrink-0 cursor-pointer"
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
          <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#DED8CC]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${step === 'mfa' || step === 'archiving' ? 'bg-[#7E6036]/12' : 'bg-amber-50'}`}>
                  {step === 'mfa' || step === 'archiving'
                    ? <ShieldCheck size={17} className="text-[#7E6036]" />
                    : <AlertTriangle size={17} className="text-[#8F5706]" />
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A18]">
                    {step === 'mfa' ? 'Verify your identity' : step === 'archiving' ? 'Archiving…' : 'Archive studio'}
                  </p>
                  <p className="text-xs text-[#6E6B63] mt-0.5">
                    {step === 'mfa' ? 'Authenticator code required' : 'Studio can be restored later'}
                  </p>
                </div>
              </div>
              {step !== 'archiving' && (
                <button onClick={close} className="text-[#6E6B63] hover:text-[#1A1A18] transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              )}
            </div>

            {step === 'confirm' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-[#3F3D38] leading-relaxed">
                  You are about to archive{' '}
                  <span className="text-[#1A1A18] font-semibold">&ldquo;{studioName}&rdquo;</span>.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-[#8F5706] leading-relaxed">
                    The studio and all its data will be preserved but the studio will lose access to the platform. You can restore it at any time. Data is permanently deleted after <strong>24 months</strong>.
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={close} className="flex-1 py-2.5 rounded-lg border border-[#DED8CC] text-[#3F3D38] text-sm hover:bg-[#EFEBE3] transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={() => setStep('mfa')} className="flex-1 py-2.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium transition-colors cursor-pointer">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {step === 'mfa' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-[#3F3D38] leading-relaxed">
                  Enter the 6-digit code from your authenticator app to archive{' '}
                  <span className="text-[#1A1A18] font-medium">&ldquo;{studioName}&rdquo;</span>.
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
                  className="w-full px-4 py-4 bg-[#F5F2EC] border border-[#DED8CC] rounded-lg text-[#1A1A18] text-center text-3xl font-mono tracking-widest outline-none focus:border-[#7E6036] transition-colors placeholder:text-[#6E6B63]"
                />
                {mfaError && <p className="text-xs text-[#B91C1C] text-center">{mfaError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setStep('confirm'); setCode(''); setMfaError('') }} disabled={loading}
                    className="flex-1 py-2.5 rounded-lg border border-[#DED8CC] text-[#3F3D38] text-sm hover:bg-[#EFEBE3] transition-colors disabled:opacity-40 cursor-pointer">
                    ← Back
                  </button>
                  <button onClick={verifyAndArchive} disabled={loading || code.replace(/\s/g, '').length < 6}
                    className="flex-1 py-2.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2">
                    <ShieldCheck size={14} />
                    {loading ? 'Verifying…' : 'Verify & Archive'}
                  </button>
                </div>
              </div>
            )}

            {step === 'archiving' && (
              <div className="px-6 py-10 flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#7E6036] border-t-transparent animate-spin" />
                <p className="text-sm text-[#5C5A54]">Archiving &ldquo;{studioName}&rdquo;…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

type PurgeStep = 'confirm' | 'type-name' | 'mfa' | 'deleting'

export function DeleteStudioButton({ orgId, studioName }: { orgId: string; studioName: string }) {
  const [step, setStep] = useState<PurgeStep | null>(null)
  const [typed, setTyped] = useState('')
  const [code, setCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (step === 'mfa') setTimeout(() => inputRef.current?.focus(), 80)
  }, [step])

  function open() { setTyped(''); setCode(''); setMfaError(''); setStep('confirm') }
  function close() { if (loading) return; setStep(null); setTyped(''); setCode(''); setMfaError('') }

  async function verifyAndDelete() {
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

    setStep('deleting')
    const res = await fetch(`/api/platform/studios/${orgId}/purge`, { method: 'DELETE' })

    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to delete studio')
      setStep('mfa')
      setLoading(false)
      return
    }

    toast.success(`"${studioName}" has been permanently deleted`)
    router.push('/platform/studios')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={open}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-[#B91C1C] text-xs font-medium hover:bg-red-500/10 transition-colors flex-shrink-0 cursor-pointer"
      >
        <Trash2 size={13} />
        Delete permanently
      </button>

      {step !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#DED8CC]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${step === 'mfa' || step === 'deleting' ? 'bg-[#7E6036]/12' : 'bg-red-50'}`}>
                  {step === 'mfa' || step === 'deleting'
                    ? <ShieldCheck size={17} className="text-[#7E6036]" />
                    : <Trash2 size={17} className="text-[#B91C1C]" />
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A18]">
                    {step === 'mfa' ? 'Verify your identity' : step === 'deleting' ? 'Deleting…' : step === 'type-name' ? 'Confirm deletion' : 'Delete studio permanently'}
                  </p>
                  <p className="text-xs text-[#6E6B63] mt-0.5">
                    {step === 'mfa' ? 'Authenticator code required' : step === 'deleting' ? 'This cannot be undone' : 'This action cannot be reversed'}
                  </p>
                </div>
              </div>
              {step !== 'deleting' && (
                <button onClick={close} className="text-[#6E6B63] hover:text-[#1A1A18] transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              )}
            </div>

            {step === 'confirm' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-[#3F3D38] leading-relaxed">
                  You are about to <span className="text-[#B91C1C] font-semibold">permanently delete</span>{' '}
                  <span className="text-[#1A1A18] font-semibold">&ldquo;{studioName}&rdquo;</span>.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-2">
                  <p className="text-xs text-[#B91C1C] font-semibold">This will permanently erase:</p>
                  <ul className="text-xs text-[#B91C1C]/80 space-y-1 leading-relaxed list-disc list-inside">
                    <li>All projects, quotes, invoices &amp; purchase orders</li>
                    <li>All clients, suppliers &amp; price lists</li>
                    <li>All team member accounts &amp; settings</li>
                    <li>The studio itself</li>
                  </ul>
                  <p className="text-xs text-[#B91C1C]/60 pt-1">There is no undo.</p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={close} className="flex-1 py-2.5 rounded-lg border border-[#DED8CC] text-[#3F3D38] text-sm hover:bg-[#EFEBE3] transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={() => setStep('type-name')} className="flex-1 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-[#1A1A18] text-sm font-medium transition-colors cursor-pointer">
                    I understand →
                  </button>
                </div>
              </div>
            )}

            {step === 'type-name' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-[#3F3D38] leading-relaxed">
                  Type <span className="text-[#1A1A18] font-mono font-semibold">{studioName}</span> to confirm.
                </p>
                <input
                  type="text"
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  placeholder={studioName}
                  className="w-full px-4 py-3 bg-[#F5F2EC] border border-[#DED8CC] rounded-lg text-[#1A1A18] text-sm outline-none focus:border-red-400 transition-colors placeholder:text-[#6E6B63]"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => { setStep('confirm'); setTyped('') }} className="flex-1 py-2.5 rounded-lg border border-[#DED8CC] text-[#3F3D38] text-sm hover:bg-[#EFEBE3] transition-colors cursor-pointer">
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep('mfa')}
                    disabled={typed !== studioName}
                    className="flex-1 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-[#1A1A18] text-sm font-medium transition-colors disabled:opacity-30 cursor-pointer"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {step === 'mfa' && (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-[#3F3D38] leading-relaxed">
                  Enter your authenticator code to permanently delete{' '}
                  <span className="text-[#1A1A18] font-medium">&ldquo;{studioName}&rdquo;</span>.
                </p>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/[^0-9 ]/g, '')); setMfaError('') }}
                  onKeyDown={e => { if (e.key === 'Enter' && code.replace(/\s/g, '').length === 6) verifyAndDelete() }}
                  placeholder="000 000"
                  maxLength={7}
                  autoComplete="one-time-code"
                  className="w-full px-4 py-4 bg-[#F5F2EC] border border-[#DED8CC] rounded-lg text-[#1A1A18] text-center text-3xl font-mono tracking-widest outline-none focus:border-red-400 transition-colors placeholder:text-[#6E6B63]"
                />
                {mfaError && <p className="text-xs text-[#B91C1C] text-center">{mfaError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setStep('type-name'); setCode(''); setMfaError('') }} disabled={loading}
                    className="flex-1 py-2.5 rounded-lg border border-[#DED8CC] text-[#3F3D38] text-sm hover:bg-[#EFEBE3] transition-colors disabled:opacity-40 cursor-pointer">
                    ← Back
                  </button>
                  <button onClick={verifyAndDelete} disabled={loading || code.replace(/\s/g, '').length < 6}
                    className="flex-1 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-[#1A1A18] text-sm font-medium transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2">
                    <ShieldCheck size={14} />
                    {loading ? 'Verifying…' : 'Delete forever'}
                  </button>
                </div>
              </div>
            )}

            {step === 'deleting' && (
              <div className="px-6 py-10 flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                <p className="text-sm text-[#5C5A54]">Deleting &ldquo;{studioName}&rdquo;…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export function QuickDeleteButton({ orgId, studioName }: { orgId: string; studioName: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`Quick-delete "${studioName}"? This is permanent and skips MFA.`)) return
    setLoading(true)
    // Archive first (required by purge route)
    const archiveRes = await fetch(`/api/platform/studios/${orgId}`, { method: 'DELETE' })
    if (!archiveRes.ok) {
      const d = await archiveRes.json()
      toast.error(d.error ?? 'Archive step failed')
      setLoading(false)
      return
    }
    // Then purge
    const purgeRes = await fetch(`/api/platform/studios/${orgId}/purge`, { method: 'DELETE' })
    if (!purgeRes.ok) {
      const d = await purgeRes.json()
      toast.error(d.error ?? 'Purge step failed')
      setLoading(false)
      return
    }
    toast.success(`"${studioName}" deleted`)
    router.push('/platform/studios')
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-1 text-xs text-[#B91C1C]/70 hover:text-[#B91C1C] transition-colors cursor-pointer disabled:opacity-40"
      title="Quick delete (no MFA) — testing only"
    >
      <Trash2 size={11} />
      {loading ? 'Deleting…' : 'Quick delete'}
    </button>
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
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/30 text-[#047857] text-xs font-medium hover:bg-emerald-500/10 transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50"
    >
      <RotateCcw size={13} />
      {loading ? 'Restoring…' : 'Restore studio'}
    </button>
  )
}
