'use client'
import { useState } from 'react'
import { Presentation } from 'lucide-react'

export function FeatureTogglesPanel({ orgId, studioEnabled }: { orgId: string; studioEnabled: boolean }) {
  const [enabled, setEnabled] = useState(studioEnabled)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = !enabled
    setSaving(true)
    try {
      const res = await fetch(`/api/platform/studios/${orgId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studio_enabled: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Failed to update')
        return
      }
      setEnabled(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5 mb-6">
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-4">Feature Toggles</h2>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#C4A46B]/10 flex items-center justify-center">
            <Presentation size={16} className="text-[#C4A46B]" />
          </div>
          <div>
            <p className="text-sm text-white/80">Studio</p>
            <p className="text-xs text-white/40">Presentation boards for client design presentations</p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          role="switch"
          aria-checked={enabled}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50 ${enabled ? 'bg-[#C4A46B]' : 'bg-white/10'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  )
}
