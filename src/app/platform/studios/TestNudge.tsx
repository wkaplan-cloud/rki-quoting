'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Sends the real onboarding nudge to any address, through the exact path the
 * hourly cron uses — same sender, same DKIM key, same unsubscribe headers.
 *
 * Used to prove the marketing domain actually delivers before a real signup
 * is the one to find out. Test sends are not recorded in onboarding_nudges.
 */
export function TestNudge() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!email.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/platform/studios/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), full_name: name.trim() || null, test: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send')
      } else if (data.skipped) {
        toast.error(`Not sent — ${data.skipped}`)
      } else {
        toast.success(`Test nudge sent from ${data.from ?? 'the marketing sender'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-10">
      <h2 className="text-sm font-medium text-[#6E6B63] uppercase tracking-wider mb-4">
        Send a test nudge
      </h2>
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5">
        <p className="text-xs text-[#6E6B63] mb-4 leading-relaxed">
          Sends the real &ldquo;Complete your setup&rdquo; email to any address, using the same
          sender and unsubscribe headers as the hourly cron. Not recorded against any account.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label htmlFor="test-nudge-email" className="block text-xs text-[#5C5A54] mb-1.5">
              Email address
            </label>
            <input
              id="test-nudge-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              className="w-full bg-[#FDFCF9] border border-[#DED8CC] rounded-lg px-3 py-2 text-sm text-[#2C2C2A] focus:outline-none focus-visible:border-[#7E6036]/60 transition-colors"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="test-nudge-name" className="block text-xs text-[#5C5A54] mb-1.5">
              Name (optional)
            </label>
            <input
              id="test-nudge-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              className="w-full bg-[#FDFCF9] border border-[#DED8CC] rounded-lg px-3 py-2 text-sm text-[#2C2C2A] focus:outline-none focus-visible:border-[#7E6036]/60 transition-colors"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={send}
              disabled={loading || !email.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7E6036] text-white text-sm font-medium hover:bg-[#5F4726] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7E6036] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Send size={14} />
              {loading ? 'Sending…' : 'Send test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
