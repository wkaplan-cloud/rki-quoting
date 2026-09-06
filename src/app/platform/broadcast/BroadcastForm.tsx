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
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-[#047857]">
          Email sent successfully.
        </div>
      )}

      {/* Recipients */}
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5">
        <label className="block text-xs text-[#6E6B63] uppercase tracking-wider mb-3">Recipients</label>
        <div className="flex flex-wrap gap-2">
          {PLAN_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filter === opt.value
                  ? 'bg-[#7E6036] text-white'
                  : 'bg-[#EFEBE3] text-[#5C5A54] hover:bg-[#E5DFD5] hover:text-[#1A1A18]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-sm">
          <Users size={14} className="text-[#7E6036]" />
          <span className="text-[#1A1A18] font-semibold">{count}</span>
          <span className="text-[#6E6B63]">studio admin{count !== 1 ? 's' : ''} will receive this email</span>
        </div>
      </div>

      {/* Subject */}
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5">
        <label className="block text-xs text-[#6E6B63] uppercase tracking-wider mb-2">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="e.g. New feature: bulk import for line items"
          className="w-full bg-[#F5F2EC] border border-[#DED8CC] rounded-lg px-3 py-2.5 text-sm text-[#1A1A18] placeholder:text-[#6E6B63] focus:outline-none focus:border-[#7E6036]"
        />
      </div>

      {/* Body */}
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5">
        <label className="block text-xs text-[#6E6B63] uppercase tracking-wider mb-2">Message</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write your message here. Plain text, keep it concise. Replies will go to hello@quotinghub.co.za."
          rows={8}
          className="w-full bg-[#F5F2EC] border border-[#DED8CC] rounded-lg px-3 py-2.5 text-sm text-[#1A1A18] placeholder:text-[#6E6B63] focus:outline-none focus:border-[#7E6036] resize-none"
        />
        <p className="text-xs text-[#8A877F] mt-2">Your message will be wrapped in the standard QuotingHub email template.</p>
      </div>

      {/* Preview snippet */}
      {body.trim() && (
        <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5">
          <p className="text-xs text-[#6E6B63] uppercase tracking-wider mb-3">Preview</p>
          <div className="bg-[#F5F2EC] border border-[#DED8CC] rounded-lg p-4">
            <p className="text-xs text-[#6E6B63] mb-1">Subject: <span className="text-[#3F3D38]">{subject || '(no subject)'}</span></p>
            <hr className="border-[#DED8CC] my-2" />
            <p className="text-sm text-[#3F3D38] whitespace-pre-wrap leading-relaxed">{body}</p>
          </div>
        </div>
      )}

      <button
        onClick={send}
        disabled={sending || count === 0 || !subject.trim() || !body.trim()}
        className="flex items-center gap-2 px-6 py-3 bg-[#7E6036] text-white text-sm font-medium rounded-xl hover:bg-[#5F4726] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Send size={15} />
        {sending ? 'Sending…' : `Send to ${count} studio${count !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
