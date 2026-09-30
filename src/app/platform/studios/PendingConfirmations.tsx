'use client'

import { useState } from 'react'
import { Mail, Clock, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export type PendingConfirmation = {
  user_id: string
  email: string
  full_name: string | null
  signed_up_at: string
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function ResendButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function resend() {
    setLoading(true)
    const res = await fetch('/api/platform/studios/resend-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    setLoading(false)
    if (res.ok) {
      setSent(true)
      toast.success('Confirmation email sent')
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to send')
    }
  }

  return (
    <button
      onClick={resend}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs text-[#7E6036] hover:underline focus-visible:underline outline-none transition-colors disabled:opacity-50 cursor-pointer"
    >
      <Mail size={12} />
      {loading ? 'Sending…' : sent ? 'Sent · resend again' : 'Resend confirmation'}
    </button>
  )
}

function DeleteButton({ userId, email, onDeleted }: { userId: string; email: string; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete the unconfirmed signup for ${email}? This removes their auth account permanently.`)) return
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
      const data = await res.json().catch(() => ({}))
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

/** Self-signups who haven't clicked their confirmation link, so have no studio yet. */
export function PendingConfirmations({ signups: initial }: { signups: PendingConfirmation[] }) {
  const [signups, setSignups] = useState(initial)

  if (signups.length === 0) return null

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-sm font-medium text-[#6E6B63] uppercase tracking-wider">Pending confirmation</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-[#8F5706]">{signups.length}</span>
      </div>
      <p className="text-xs text-[#6E6B63] mb-4">Signed up but haven&apos;t clicked the link in their confirmation email yet.</p>
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[34rem]">
            <thead>
              <tr className="border-b border-[#DED8CC]">
                <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">Name</th>
                <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">Email</th>
                <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">
                  <div className="flex items-center gap-1"><Clock size={11} /> Signed up</div>
                </th>
                <th className="px-5 py-3" />
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE3]">
              {signups.map(s => (
                <tr key={s.user_id} className="hover:bg-[#EFEBE3] transition-colors">
                  <td className="px-5 py-3.5 text-[#2C2C2A]">{s.full_name || '—'}</td>
                  <td className="px-5 py-3.5 text-[#3F3D38]">{s.email}</td>
                  <td className="px-5 py-3.5 text-[#6E6B63] text-xs">{timeAgo(s.signed_up_at)}</td>
                  <td className="px-5 py-3.5"><ResendButton userId={s.user_id} /></td>
                  <td className="px-5 py-3.5">
                    <DeleteButton
                      userId={s.user_id}
                      email={s.email}
                      onDeleted={() => setSignups(prev => prev.filter(p => p.user_id !== s.user_id))}
                    />
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
