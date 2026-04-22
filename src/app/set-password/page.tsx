'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  // 'invite' = new team member setup, 'recovery' = password reset
  const [flowType, setFlowType] = useState<'invite' | 'recovery' | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token=')) {
      // No hash token — assume the session is already set (redirect from login invite flow)
      setFlowType('invite')
      setSessionReady(true)
      return
    }

    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const type = params.get('type')

    if (!access_token || !refresh_token) {
      setFlowType('invite')
      setSessionReady(true)
      return
    }

    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) {
        toast.error('Invalid or expired reset link. Please request a new one.')
        router.replace('/forgot-password')
        return
      }
      setFlowType(type === 'recovery' ? 'recovery' : 'invite')
      setSessionReady(true)
      // Clean the hash from the URL
      window.history.replaceState(null, '', window.location.pathname)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (flowType === 'invite' && !fullName.trim()) { toast.error('Please enter your full name'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSaving(true)
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, full_name: flowType === 'invite' ? fullName.trim() : undefined }),
    })
    if (!res.ok) {
      const { error } = await res.json()
      toast.error(error ?? 'Failed to set password')
      setSaving(false)
      return
    }
    if (flowType === 'recovery') {
      toast.success('Password updated — please sign in')
      router.push('/login')
    } else {
      toast.success('Welcome!')
      const { data: orgId } = await supabase.rpc('get_current_org_id')
      router.push(orgId ? '/dashboard' : '/onboarding')
    }
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#9A7B4F] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-[#D8D3C8] rounded-lg p-8">
          <h1 className="font-serif text-2xl text-[#1A1A18] mb-1">
            {flowType === 'recovery' ? 'Set a new password' : 'Set up your account'}
          </h1>
          <p className="text-sm text-[#8A877F] mb-6">
            {flowType === 'recovery'
              ? 'Choose a new password for your account.'
              : 'Enter your name and choose a password to get started.'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {flowType === 'invite' && (
              <Input
                label="Full name"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 pr-9 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A] focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#8A877F] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  className="w-full px-3 py-2 pr-9 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A] focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#8A877F] transition-colors cursor-pointer"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Saving…' : flowType === 'recovery' ? 'Update password' : 'Continue →'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
