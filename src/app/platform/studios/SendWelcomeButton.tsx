'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'
import toast from 'react-hot-toast'

export function SendWelcomeButton({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function send() {
    if (!confirm('Send the welcome / how-to-use email to this studio\'s admin?')) return
    setLoading(true)
    const res = await fetch(`/api/platform/studios/${orgId}/send-welcome`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to send email')
      setLoading(false)
      return
    }
    toast.success('Welcome email sent')
    router.refresh()
  }

  return (
    <button
      onClick={send}
      disabled={loading}
      title="Send welcome / how-to-use email"
      className="flex items-center gap-1 text-xs text-[#C4A46B]/70 hover:text-[#C4A46B] transition-colors cursor-pointer disabled:opacity-40"
    >
      <Mail size={11} />
      {loading ? 'Sending…' : 'Send welcome'}
    </button>
  )
}
