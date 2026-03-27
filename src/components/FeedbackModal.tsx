'use client'
import { useState } from 'react'
import { X, Send, CheckCircle, MessageSquare } from 'lucide-react'

const TYPES = ['Feedback', 'Help & Support', 'Feature Request'] as const

interface Props {
  userEmail: string
  userName: string
  companyName: string
  onClose: () => void
}

export function FeedbackModal({ userEmail, userName, companyName, onClose }: Props) {
  const [type, setType] = useState<typeof TYPES[number]>('Feedback')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, email: userEmail, type, message, company: companyName }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to send')
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8D3C8]">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-[#C4A46B]" />
            <h2 className="font-serif text-base font-medium text-[#1A1A18]">Contact</h2>
          </div>
          <button onClick={onClose} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
            <X size={17} />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-5">
            <CheckCircle size={32} className="text-[#C4A46B] mb-3" />
            <h3 className="font-serif text-lg text-[#1A1A18] mb-1">Message sent</h3>
            <p className="text-sm text-[#8A877F]">We&apos;ll get back to you shortly.</p>
            <button onClick={onClose} className="mt-6 text-sm text-[#9A7B4F] hover:underline cursor-pointer">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-1.5">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as typeof TYPES[number])}
                className="w-full px-3 py-2.5 text-sm border border-[#D8D3C8] rounded-lg bg-white text-[#1A1A18] focus:outline-none focus:border-[#9A7B4F] transition-colors cursor-pointer"
              >
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-1.5">Message <span className="text-[#C4A46B]">*</span></label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-[#D8D3C8] rounded-lg bg-white text-[#1A1A18] focus:outline-none focus:border-[#9A7B4F] transition-colors resize-none"
              />
            </div>

            <p className="text-xs text-[#8A877F]">Sending as <span className="text-[#2C2C2A] font-medium">{userEmail}</span></p>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">Cancel</button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending…' : <><Send size={13} /> Send</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
