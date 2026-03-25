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
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSaving(true)
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      const { error } = await res.json()
      toast.error(error ?? 'Failed to set password')
      setSaving(false)
      return
    }
    toast.success('Password set — welcome!')
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    router.push(orgId ? '/' : '/onboarding')
  }

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-[#D8D3C8] rounded-lg p-8">
          <h1 className="font-serif text-2xl text-[#1A1A18] mb-1">Set your password</h1>
          <p className="text-sm text-[#8A877F] mb-6">Choose a password to secure your account.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              required
            />
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Set password & continue →'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
