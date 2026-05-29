'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

function AcceptInviteContent() {
  const params = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const token = params.get('token') ?? ''

  const [status, setStatus] = useState<'loading' | 'form' | 'submitting' | 'done' | 'error'>('loading')
  const [staffName, setStaffName] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setError('Invalid invite link'); return }
    void fetch(`/api/supplier-portal/staff/accept-invite/validate?token=${token}`)
      .then(r => r.json())
      .then((data: { name?: string; email?: string; company?: string; error?: string }) => {
        if (data.error) { setStatus('error'); setError(data.error); return }
        setStaffName(data.name ?? '')
        setStaffEmail(data.email ?? '')
        setCompanyName(data.company ?? '')
        setStatus('form')
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setStatus('submitting'); setError('')

    // Create / update the auth account
    const res = await fetch('/api/supplier-portal/staff/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) { setStatus('form'); setError(data.error ?? 'Failed'); return }

    // Sign in immediately so there's an active session before redirecting
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: staffEmail,
      password,
    })
    if (signInError) {
      // Account was created but sign-in failed — send them to login with a hint
      setStatus('done')
      setTimeout(() => router.push('/supplier-portal/login'), 2000)
      return
    }

    setStatus('done')
    setTimeout(() => router.push('/supplier-portal/staff-home'), 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: S.bg }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.1)' }}>
        <div className="px-6 py-5" style={{ borderBottom: `1px solid ${S.border}`, background: '#1E2A38' }}>
          <p className="font-bold text-white text-lg">{companyName || 'QuotingHub'}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Staff Account Setup</p>
        </div>

        <div className="p-6">
          {status === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" style={{ color: S.accent }} size={24} />
            </div>
          )}

          {status === 'done' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle2 size={40} style={{ color: S.green }} />
              <p className="font-bold text-sm" style={{ color: S.text }}>Account created!</p>
              <p className="text-xs text-center" style={{ color: S.muted }}>Taking you to your dashboard…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <AlertCircle size={36} style={{ color: S.danger }} />
              <p className="text-sm text-center" style={{ color: S.danger }}>{error}</p>
            </div>
          )}

          {(status === 'form' || status === 'submitting') && (
            <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>Hi {staffName} 👋</p>
                <p className="text-xs" style={{ color: S.muted }}>Set a password to activate your account.</p>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                  placeholder="Repeat password"
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEF2F2', color: S.danger }}>
                  <AlertCircle size={12} />{error}
                </div>
              )}
              <button type="submit" disabled={status === 'submitting'}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {status === 'submitting' ? 'Creating account…' : 'Activate Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AcceptStaffInvitePage() {
  return (
    <Suspense>
      <AcceptInviteContent />
    </Suspense>
  )
}
