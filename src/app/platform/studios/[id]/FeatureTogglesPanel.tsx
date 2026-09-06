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
      {/* min-w-0 lets a long description wrap instead of widening the row. */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-[#7E6036]/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-[#2C2C2A]">{title}</p>
          <p className="text-xs text-[#6E6B63] break-words">{description}</p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50 ${enabled ? 'bg-[#7E6036]' : 'bg-[#E5DFD5]'}`}
      >
        {/* left-0.5 is required: a button is text-align:center, so without an
            explicit left the knob's static position lands mid-track and the
            translate pushes it clean off the right edge. */}
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0'}`} />
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
    <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5 mb-6">
      <h2 className="text-xs text-[#6E6B63] uppercase tracking-wider mb-4">Feature Toggles</h2>
      <div className="space-y-4">
        <FeatureToggle
          orgId={orgId}
          field="studio_enabled"
          initial={studioEnabled}
          icon={<Presentation size={16} className="text-[#7E6036]" />}
          title="Studio"
          description="Presentation boards for client design presentations"
        />
        <FeatureToggle
          orgId={orgId}
          field="line_item_images_enabled"
          initial={lineItemImagesEnabled}
          icon={<Images size={16} className="text-[#7E6036]" />}
          title="Line item images"
          description="Upload images per line item and show them on quotes & invoices"
        />
      </div>
    </div>
  )
}
