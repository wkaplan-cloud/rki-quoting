'use client'
import { useState } from 'react'
import { Tag } from 'lucide-react'
import toast from 'react-hot-toast'

export function BetaFeaturesPanel({
  userId,
  initialSourcingEnabled,
}: {
  userId: string
  initialSourcingEnabled: boolean
}) {
  const [sourcingEnabled, setSourcingEnabled] = useState(initialSourcingEnabled)
  const [toggling, setToggling] = useState(false)

  async function toggleSourcing() {
    setToggling(true)
    const next = !sourcingEnabled
    const res = await fetch(`/api/platform/studios/${userId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcing_enabled: next }),
    })
    if (!res.ok) {
      toast.error('Failed to update feature flag')
    } else {
      setSourcingEnabled(next)
      toast.success(`Request Price ${next ? 'enabled' : 'disabled'} for this studio`)
    }
    setToggling(false)
  }

  return (
    <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-white/10">
        <h2 className="text-xs text-white/40 uppercase tracking-wider">Beta Features</h2>
      </div>
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Tag size={15} className="text-[#C4A46B] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-white/80">Request Price</p>
            <p className="text-xs text-white/40 mt-0.5">
              Enables the top-level &quot;Request Price&quot; section — suppliers receive token-based email links, no login required.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSourcing}
          disabled={toggling}
          role="switch"
          aria-checked={sourcingEnabled}
          className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 cursor-pointer ${
            sourcingEnabled ? 'bg-[#C4A46B]' : 'bg-white/10'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
              sourcingEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
