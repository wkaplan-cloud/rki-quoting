'use client'
import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

/**
 * Sends the trial / trial-expired nudge to one supplier-portal account.
 *
 * Shared by the Manufacturing, Electricians and All Accounts pages — the route
 * works out which product's copy to use from the account row, so the caller
 * only has to say who to nudge.
 *
 * Keeps the sent date in local state rather than calling router.refresh(), so
 * working down a list of accounts does not re-run each page's (query-heavy)
 * server load on every click.
 */
export function PortalTrialNudgeButton({
  accountId,
  expired,
  lastNudgedAt,
  className = '',
}: {
  accountId: string
  expired: boolean
  lastNudgedAt: string | null
  className?: string
}) {
  const [sentAt, setSentAt] = useState(lastNudgedAt)
  const [loading, setLoading] = useState(false)

  async function send(e: React.MouseEvent) {
    e.stopPropagation()
    setLoading(true)
    const res = await fetch(`/api/platform/portal-accounts/${accountId}/trial-nudge`, { method: 'POST' })
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
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#7E6036]/12 text-[#7E6036] hover:bg-[#7E6036]/20 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 ${className}`}
    >
      {loading ? <Loader2 size={9} className="animate-spin" /> : <Send size={9} />}
      {loading ? '…' : sentAt ? `Nudged ${fmtDate(sentAt)}` : 'Nudge'}
    </button>
  )
}
