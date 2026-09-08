'use client'
import { useState } from 'react'
import { Send } from 'lucide-react'
import toast from 'react-hot-toast'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

/**
 * Sends the trial / trial-expired nudge to a studio's admin.
 *
 * Keeps the sent date in local state rather than calling router.refresh(), so
 * chasing several studios in a row does not re-run the whole (query-heavy)
 * Studios page load on every click.
 */
export function TrialNudgeButton({
  orgId,
  expired,
  lastNudgedAt,
}: {
  orgId: string
  expired: boolean
  lastNudgedAt: string | null
}) {
  const [sentAt, setSentAt] = useState(lastNudgedAt)
  const [loading, setLoading] = useState(false)

  async function send() {
    setLoading(true)
    const res = await fetch(`/api/platform/studios/${orgId}/trial-nudge`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to send nudge')
      return
    }
    if (data.skipped) {
      toast(`Not sent — ${data.skipped}`)
      return
    }
    setSentAt(data.sent_at ?? new Date().toISOString())
    toast.success(`Nudge sent to ${data.sent_to}`)
  }

  return (
    <button
      onClick={send}
      disabled={loading}
      title={expired ? 'Send trial-expired win-back email' : 'Send trial-ending nudge email'}
      className="flex items-center gap-1 text-xs text-[#7E6036]/70 hover:text-[#7E6036] transition-colors cursor-pointer disabled:opacity-40"
    >
      <Send size={11} />
      {loading ? 'Sending…' : sentAt ? `Nudged ${formatDate(sentAt)}` : 'Nudge'}
    </button>
  )
}
