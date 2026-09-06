'use client'
import { useState } from 'react'

const LABELS: Record<string, string> = {
  manufacturer: 'Product Supplier',
  trades: 'Trade / Service',
}

const STYLES: Record<string, string> = {
  manufacturer: 'bg-teal-50 text-[#0F766E] border-teal-200 hover:bg-teal-100',
  trades:       'bg-violet-50 text-[#6D28D9] border-violet-200 hover:bg-violet-100',
}

export function SupplierCategoryBadge({ accountId, initial }: { accountId: string; initial: string }) {
  const [category, setCategory] = useState(initial ?? 'manufacturer')
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = category === 'manufacturer' ? 'trades' : 'manufacturer'
    setSaving(true)
    const res = await fetch(`/api/admin/suppliers/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_category: next }),
    })
    if (res.ok) setCategory(next)
    setSaving(false)
  }

  const style = STYLES[category] ?? STYLES.manufacturer

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title="Click to toggle supplier type"
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${style}`}
    >
      {saving ? '…' : (LABELS[category] ?? category)}
    </button>
  )
}
