'use client'

import { useState } from 'react'
import { Mail, CheckCircle, Clock } from 'lucide-react'

export type IncompleteSignup = {
  user_id: string
  email: string
  full_name: string | null
  confirmed_at: string
  nudge_sent_at: string | null
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function NudgeButton({ signup }: { signup: IncompleteSignup }) {
  const [sent, setSent] = useState(!!signup.nudge_sent_at)
  const [sentAt, setSentAt] = useState(signup.nudge_sent_at)
  const [loading, setLoading] = useState(false)

  async function sendNudge() {
    setLoading(true)
    const res = await fetch('/api/platform/studios/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: signup.user_id,
        email: signup.email,
        full_name: signup.full_name,
      }),
    })
    setLoading(false)
    if (res.ok) {
      setSent(true)
      setSentAt(new Date().toISOString())
    }
  }

  if (sent && sentAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
        <CheckCircle size={12} />
        Nudge sent {timeAgo(sentAt)}
      </span>
    )
  }

  return (
    <button
      onClick={sendNudge}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs text-[#C4A46B] hover:text-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer"
    >
      <Mail size={12} />
      {loading ? 'Sending…' : 'Send nudge'}
    </button>
  )
}

export function IncompleteSignups({ signups }: { signups: IncompleteSignup[] }) {
  if (signups.length === 0) return null

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">Incomplete signups</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">{signups.length}</span>
      </div>
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Name</th>
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Email</th>
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">
                <div className="flex items-center gap-1"><Clock size={11} /> Confirmed</div>
              </th>
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Nudge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {signups.map(s => (
              <tr key={s.user_id} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-3.5 text-white/80">{s.full_name || '—'}</td>
                <td className="px-5 py-3.5 text-white/60">{s.email}</td>
                <td className="px-5 py-3.5 text-white/40 text-xs">{timeAgo(s.confirmed_at)}</td>
                <td className="px-5 py-3.5">
                  <NudgeButton signup={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
