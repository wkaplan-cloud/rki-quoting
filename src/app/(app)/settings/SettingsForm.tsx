'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

interface Props {
  currentFullName: string
  email: string
  currentPhone: string
  currentJobTitle: string
}

export function SettingsForm({ currentFullName, email, currentPhone, currentJobTitle }: Props) {
  const [fullName, setFullName] = useState(currentFullName)
  const [phone, setPhone] = useState(currentPhone)
  const [jobTitle, setJobTitle] = useState(currentJobTitle)
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Please enter your name'); return }
    setSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim(), job_title: jobTitle.trim() }),
    })
    if (!res.ok) { const { error } = await res.json(); toast.error(error ?? 'Failed') }
    else toast.success('Profile saved')
    setSaving(false)
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {/* Email — read-only */}
      <div>
        <label className="block text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-1.5">Email</label>
        <div className="px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#8A877F] bg-[#F5F2EC] select-all">
          {email}
        </div>
        <p className="text-xs text-[#C4BFB5] mt-1">Email cannot be changed here. Contact support if needed.</p>
      </div>

      <Input
        label="Full Name"
        value={fullName}
        onChange={e => setFullName(e.target.value)}
        required
      />

      <Input
        label="Phone Number"
        type="tel"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        placeholder="+27 82 000 0000"
      />

      <Input
        label="Job Title"
        value={jobTitle}
        onChange={e => setJobTitle(e.target.value)}
        placeholder="e.g. Interior Designer, Studio Manager"
      />

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-[#2C2C2A] text-white text-sm rounded hover:bg-[#9A7B4F] transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </form>
  )
}
