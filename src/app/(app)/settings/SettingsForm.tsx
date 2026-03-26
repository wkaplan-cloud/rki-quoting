'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export function SettingsForm({ currentFullName }: { currentFullName: string }) {
  const [fullName, setFullName] = useState(currentFullName)
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Please enter your name'); return }
    setSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName.trim() }),
    })
    if (!res.ok) { const { error } = await res.json(); toast.error(error ?? 'Failed') }
    else toast.success('Profile saved')
    setSaving(false)
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Input
        label="Full Name"
        value={fullName}
        onChange={e => setFullName(e.target.value)}
        required
      />
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-[#2C2C2A] text-white text-sm rounded hover:bg-[#9A7B4F] transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
