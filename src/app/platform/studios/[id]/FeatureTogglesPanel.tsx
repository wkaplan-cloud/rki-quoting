'use client'
import { useState } from 'react'
import { Presentation, Images } from 'lucide-react'

function FeatureToggle({
  orgId,
  field,
  initial,
  icon,
  title,
  description,
}: {
  orgId: string
  field: string
  initial: boolean
  icon: React.ReactNode
  title: string
  description: string
}) {
  const [enabled, setEnabled] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = !enabled
    setSaving(true)
    try {
      const res = await fetch(`/api/platform/studios/${orgId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
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
    <div className="flex items-center justify-between gap-4">
      {/* min-w-0 on both the row and the text block — without it the description
          cannot shrink and pushes the toggle off the right edge. */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-[#C4A46B]/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-white/80">{title}</p>
          <p className="text-xs text-white/40 break-words">{description}</p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50 ${enabled ? 'bg-[#C4A46B]' : 'bg-white/10'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

export function FeatureTogglesPanel({
  orgId,
  studioEnabled,
  lineItemImagesEnabled = false,
}: {
  orgId: string
  studioEnabled: boolean
  lineItemImagesEnabled?: boolean
}) {
  return (
    <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5 mb-6">
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-4">Feature Toggles</h2>
      <div className="space-y-4">
        <FeatureToggle
          orgId={orgId}
          field="studio_enabled"
          initial={studioEnabled}
          icon={<Presentation size={16} className="text-[#C4A46B]" />}
          title="Studio"
          description="Presentation boards for client design presentations"
        />
        <FeatureToggle
          orgId={orgId}
          field="line_item_images_enabled"
          initial={lineItemImagesEnabled}
          icon={<Images size={16} className="text-[#C4A46B]" />}
          title="Line item images"
          description="Images per line item, shown on quotes & invoices"
        />
      </div>
    </div>
  )
}
