'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Please enter your full name'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSaving(true)
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, full_name: fullName.trim() }),
    })
    if (!res.ok) {
      const { error } = await res.json()
      toast.error(error ?? 'Failed to set password')
      setSaving(false)
      return
    }
    toast.success('Welcome!')
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    router.push(orgId ? '/' : '/onboarding')
  }

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-[#D8D3C8] rounded-lg p-8">
          <h1 className="font-serif text-2xl text-[#1A1A18] mb-1">Set up your account</h1>
          <p className="text-sm text-[#8A877F] mb-6">Enter your name and choose a password to get started.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Continue →'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
