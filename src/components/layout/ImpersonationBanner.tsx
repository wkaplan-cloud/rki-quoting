'use client'
import { useState } from 'react'
import { Eye } from 'lucide-react'
import toast from 'react-hot-toast'

export function ImpersonationBanner({ targetEmail, orgName, adminEmail }: { targetEmail: string; orgName: string; adminEmail: string }) {
  const [loading, setLoading] = useState(false)

  async function exit() {
    setLoading(true)
    const res = await fetch('/api/platform/impersonate/exit', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to exit impersonation')
      setLoading(false)
      return
    }
    window.location.href = data.redirectTo ?? '/platform/studios'
  }

  return (
    <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-center gap-3 text-sm flex-wrap">
      <Eye size={15} className="flex-shrink-0" />
      <span>
        Viewing as <strong>{targetEmail}</strong> ({orgName}) — impersonated by {adminEmail}
      </span>
      <button
        onClick={exit}
        disabled={loading}
        className="flex-shrink-0 bg-white text-blue-600 font-semibold text-xs px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors disabled:opacity-60"
      >
        {loading ? 'Exiting…' : 'Exit impersonation'}
      </button>
    </div>
  )
}
