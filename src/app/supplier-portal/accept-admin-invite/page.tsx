'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

function AcceptAdminContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''

  const [status, setStatus] = useState<'loading' | 'form' | 'existing' | 'submitting' | 'done' | 'error'>('loading')
  const [info, setInfo] = useState<{ name?: string; company?: string; email?: string; existingAccount?: boolean }>({})
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setError('Invalid invite link'); return }
    void fetch(`/api/supplier-portal/quoting/team/accept?token=${token}`)
      .then(async r => {
        const data = await r.json() as typeof info & { error?: string }
        if (!r.ok || data.error) { setStatus('error'); setError(data.error ?? 'Invalid invite link'); return }
        setInfo(data)
        // If the email already has an account, skip password setup
        setStatus(data.existingAccount ? 'existing' : 'form')
      })
      .catch(() => { setStatus('error'); setError('Something went wrong. Please request a new invite link.') })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'existing') {
      if (password.length < 8) { setError('Password must be at least 8 characters'); return }
      if (password !== confirm) { setError('Passwords do not match'); return }
    }
    setStatus('submitting'); setError('')
    const res = await fetch('/api/supplier-portal/quoting/team/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: status !== 'existing' ? password : undefined }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) { setStatus(info.existingAccount ? 'existing' : 'form'); setError(data.error ?? 'Failed'); return }
    setStatus('done')
    // Redirect to supplier portal login — the accept flow doesn't create a browser session
    setTimeout(() => router.push('/supplier-portal/login'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: S.bg }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.1)' }}>
        <div className="px-6 py-5" style={{ borderBottom: `1px solid ${S.border}`, background: '#1E2A38' }}>
          <p className="font-bold text-white text-lg">{info.company || 'QuotingHub'}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Admin Account Setup</p>
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
              <p className="font-bold text-sm" style={{ color: S.text }}>Access granted!</p>
              <p className="text-xs text-center" style={{ color: S.muted }}>Taking you to sign in…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <AlertCircle size={36} style={{ color: S.danger }} />
              <p className="text-sm text-center" style={{ color: S.danger }}>{error}</p>
            </div>
          )}

          {/* Existing account — no password needed, just confirm */}
          {(status === 'existing' || (status === 'submitting' && info.existingAccount)) && (
            <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>
                  {info.name ? `Hi ${info.name} 👋` : 'Welcome'}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: S.muted }}>
                  <strong style={{ color: S.text }}>{info.email}</strong> already has a QuotingHub account.
                  Click below to link it to <strong style={{ color: S.text }}>{info.company}</strong> — use your existing password to sign in afterwards.
                </p>
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEF2F2', color: S.danger }}>
                  <AlertCircle size={12} />{error}
                </div>
              )}
              <button type="submit" disabled={status === 'submitting'}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {status === 'submitting' ? 'Activating…' : 'Accept & Link Account'}
              </button>
            </form>
          )}

          {/* New account — set a password */}
          {(status === 'form' || (status === 'submitting' && !info.existingAccount)) && (
            <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>
                  {info.name ? `Hi ${info.name} 👋` : 'Welcome to QuotingHub'}
                </p>
                <p className="text-xs" style={{ color: S.muted }}>Set a password for <strong>{info.email}</strong></p>
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
                {status === 'submitting' ? 'Activating…' : 'Activate Admin Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AcceptAdminInvitePage() {
  return <Suspense><AcceptAdminContent /></Suspense>
}
