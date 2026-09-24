'use client'
import { useState } from 'react'
import { FileText, Send, Loader2, Check, AlertCircle, KeyRound } from 'lucide-react'
import { DevicesPanel } from '@/components/devices/DevicesPanel'
import { WorkHoursCard } from '../../WorkHoursCard'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: 'var(--qh-accent)',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

/**
 * The end of an installer's project: what was installed (the device register),
 * how long it took, and the pack that goes to the client.
 */
export function HandoverTab({ quoteId, clientId, clientEmail }: { quoteId: string; clientId: string | null; clientEmail: string | null }) {
  const [withLogins, setWithLogins] = useState(false)
  const [email, setEmail] = useState(clientEmail ?? '')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  const pdfUrl = `/api/supplier-portal/quoting/quotes/${quoteId}/handover-pdf${withLogins ? '?credentials=1' : ''}`

  async function send() {
    setStatus('sending'); setError('')
    const res = await fetch(`/api/supplier-portal/quoting/quotes/${quoteId}/send-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), message: message.trim() || undefined, include_credentials: withLogins }),
    })
    const d = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
    if (!res.ok || !d.ok) { setStatus('error'); setError(d.error ?? 'Could not send the handover pack'); return }
    setStatus('sent')
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
      <DevicesPanel quoteId={quoteId} clientId={clientId} />

      <div className="space-y-4">
        <WorkHoursCard quoteId={quoteId} />

        <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Handover pack</p>
          <p className="text-xs mb-3" style={{ color: S.muted }}>
            Every device by room — serial, MAC, IP, warranty — with support details and a sign-off block.
          </p>

          <label className="flex items-start gap-2 text-xs mb-3 cursor-pointer" style={{ color: S.text }}>
            <input type="checkbox" checked={withLogins} onChange={e => setWithLogins(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-medium flex items-center gap-1"><KeyRound size={11} /> Include device logins</span>
              <span className="block" style={{ color: S.muted }}>Usernames and passwords print in the pack. Leave off unless the client should hold them.</span>
            </span>
          </label>

          <a href={pdfUrl} target="_blank" rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mb-4"
            style={{ background: S.bg, color: S.text, border: `1px solid ${S.border}` }}>
            <FileText size={14} /> Open PDF
          </a>

          {status === 'sent' ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(22,163,74,0.08)', color: S.green }}>
              <Check size={14} /> Sent to {email}
            </div>
          ) : (
            <>
              <label htmlFor="handover-email" className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Email to</label>
              <input id="handover-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none mb-2" style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
              <label htmlFor="handover-message" className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Message (optional)</label>
              <textarea id="handover-message" rows={2} value={message} onChange={e => setMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none mb-3" style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
              {status === 'error' && (
                <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: S.danger }}><AlertCircle size={12} />{error}</p>
              )}
              <button onClick={() => void send()} disabled={!email.trim() || status === 'sending'}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                {status === 'sending' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {status === 'sending' ? 'Sending…' : 'Email handover pack'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
