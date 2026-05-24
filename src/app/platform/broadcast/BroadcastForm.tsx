'use client'
import { useState } from 'react'
import { Send, Users } from 'lucide-react'
import toast from 'react-hot-toast'

const PLAN_OPTIONS = [
  { value: 'all', label: 'All active studios' },
  { value: 'solo', label: 'Solo plan only' },
  { value: 'studio', label: 'Studio plan only' },
  { value: 'agency', label: 'Agency plan only' },
  { value: 'trialing', label: 'All active trials' },
]

export function BroadcastForm({ recipientCounts }: {
  recipientCounts: Record<string, number>
}) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [filter, setFilter] = useState('all')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const count = recipientCounts[filter] ?? 0

  async function send() {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and message are required')
      return
    }
    if (!confirm(`Send to ${count} studio${count !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setSending(true)
    const res = await fetch('/api/platform/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body, filter }),
    })
    setSending(false)
    if (res.ok) {
      const d = await res.json()
      toast.success(`Sent to ${d.sent} recipient${d.sent !== 1 ? 's' : ''}`)
      setSent(true)
      setSubject('')
      setBody('')
      setFilter('all')
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Failed to send')
    }
  }

  return (
    <div className="space-y-6">
      {sent && (
        <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
          Email sent successfully.
        </div>
      )}

      {/* Recipients */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
        <label className="block text-xs text-white/40 uppercase tracking-wider mb-3">Recipients</label>
        <div className="flex flex-wrap gap-2">
          {PLAN_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filter === opt.value
                  ? 'bg-[#9A7B4F] text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-sm">
          <Users size={14} className="text-[#C4A46B]" />
          <span className="text-white font-semibold">{count}</span>
          <span className="text-white/40">studio admin{count !== 1 ? 's' : ''} will receive this email</span>
        </div>
      </div>

      {/* Subject */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
        <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="e.g. New feature: bulk import for line items"
          className="w-full bg-[#0F0F0D] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#9A7B4F]"
        />
      </div>

      {/* Body */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
        <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Message</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write your message here. Plain text, keep it concise. Replies will go to hello@quotinghub.co.za."
          rows={8}
          className="w-full bg-[#0F0F0D] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#9A7B4F] resize-none"
        />
        <p className="text-xs text-white/20 mt-2">Your message will be wrapped in the standard QuotingHub email template.</p>
      </div>

      {/* Preview snippet */}
      {body.trim() && (
        <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Preview</p>
          <div className="bg-[#0F0F0D] border border-white/10 rounded-lg p-4">
            <p className="text-xs text-white/40 mb-1">Subject: <span className="text-white/70">{subject || '(no subject)'}</span></p>
            <hr className="border-white/10 my-2" />
            <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{body}</p>
          </div>
        </div>
      )}

      <button
        onClick={send}
        disabled={sending || count === 0 || !subject.trim() || !body.trim()}
        className="flex items-center gap-2 px-6 py-3 bg-[#9A7B4F] text-white text-sm font-medium rounded-xl hover:bg-[#B8956A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Send size={15} />
        {sending ? 'Sending…' : `Send to ${count} studio${count !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
