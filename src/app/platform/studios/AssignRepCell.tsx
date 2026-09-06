'use client'
import { useState } from 'react'

const REPS = ['Unassigned', 'Lerato', 'Monalisa']

export function AssignRepCell({ orgId, initial }: { orgId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? 'Unassigned')
  const [saving, setSaving] = useState(false)

  async function save(next: string) {
    setValue(next)
    setSaving(true)
    await fetch(`/api/platform/studios/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_rep: next === 'Unassigned' ? null : next }),
    })
    setSaving(false)
  }

  return (
    <select
      value={value}
      onChange={e => save(e.target.value)}
      disabled={saving}
      className="text-xs bg-transparent border border-[#DED8CC] rounded px-2 py-1 text-[#3F3D38] outline-none focus:border-[#7E6036] focus:text-[#1A1A18] cursor-pointer disabled:opacity-40 transition-colors"
    >
      {REPS.map(r => (
        <option key={r} value={r} className="bg-[#FDFCF9] text-[#1A1A18]">
          {r}
        </option>
      ))}
    </select>
  )
}
