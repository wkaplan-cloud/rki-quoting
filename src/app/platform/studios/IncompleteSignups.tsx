'use client'

import { useState } from 'react'
import { Mail, Clock, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function NudgeButton({ signup }: { signup: IncompleteSignup }) {
  const [lastNudgedAt, setLastNudgedAt] = useState(signup.nudge_sent_at)
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
      setLastNudgedAt(new Date().toISOString())
      toast.success('Nudge sent')
    } else {
      toast.error('Failed to send nudge')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={sendNudge}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs text-[#7E6036] hover:text-[#7E6036] transition-colors disabled:opacity-50 cursor-pointer"
      >
        <Mail size={12} />
        {loading ? 'Sending…' : 'Send nudge'}
      </button>
      {lastNudgedAt && (
        <span className="text-xs text-[#6E6B63]">
          Last nudged: {formatDate(lastNudgedAt)}
        </span>
      )}
    </div>
  )
}

function DeleteSignupButton({ userId, email, onDeleted }: { userId: string; email: string; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete incomplete signup for ${email}? This removes their auth account permanently.`)) return
    setLoading(true)
    const res = await fetch('/api/platform/studios/incomplete-signup', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success('Signup deleted')
      onDeleted()
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to delete')
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs text-[#B91C1C]/60 hover:text-[#B91C1C] transition-colors disabled:opacity-40 cursor-pointer"
      title="Delete this auth account"
    >
      <Trash2 size={12} />
      {loading ? 'Deleting…' : 'Delete'}
    </button>
  )
}

export function IncompleteSignups({ signups: initial }: { signups: IncompleteSignup[] }) {
  const [signups, setSignups] = useState(initial)

  if (signups.length === 0) return null

  function remove(userId: string) {
    setSignups(prev => prev.filter(s => s.user_id !== userId))
  }

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-medium text-[#6E6B63] uppercase tracking-wider">Incomplete signups</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-[#8F5706]">{signups.length}</span>
      </div>
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[34rem]">
            <thead>
              <tr className="border-b border-[#DED8CC]">
                <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">Name</th>
                <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">Email</th>
                <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">
                  <div className="flex items-center gap-1"><Clock size={11} /> Confirmed</div>
                </th>
                <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">Nudge</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE3]">
              {signups.map(s => (
                <tr key={s.user_id} className="hover:bg-[#EFEBE3] transition-colors">
                  <td className="px-5 py-3.5 text-[#2C2C2A]">{s.full_name || '—'}</td>
                  <td className="px-5 py-3.5 text-[#3F3D38]">{s.email}</td>
                  <td className="px-5 py-3.5 text-[#6E6B63] text-xs">{timeAgo(s.confirmed_at)}</td>
                  <td className="px-5 py-3.5">
                    <NudgeButton signup={s} />
                  </td>
                  <td className="px-5 py-3.5">
                    <DeleteSignupButton userId={s.user_id} email={s.email} onDeleted={() => remove(s.user_id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
