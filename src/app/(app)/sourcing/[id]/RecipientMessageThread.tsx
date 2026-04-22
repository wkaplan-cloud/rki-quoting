'use client'
import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, X } from 'lucide-react'
import type { SourcingMessage } from '@/lib/types'

interface Props {
  requestId: string
  recipientId: string
  recipientName: string
}

export function RecipientMessageThread({ requestId, recipientId, recipientName }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<SourcingMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/sourcing/${requestId}/messages?recipient_id=${recipientId}`)
      if (!res.ok) return
      const data = await res.json() as { messages: SourcingMessage[] }
      setMessages(data.messages)
    } catch {}
  }

  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    fetchMessages()
    intervalRef.current = setInterval(fetchMessages, 12000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requestId, recipientId])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/sourcing/${requestId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: recipientId, body: input.trim() }),
      })
      const data = await res.json() as { message?: SourcingMessage; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to send'); return }
      if (data.message) setMessages(prev => [...prev, data.message!])
      setInput('')
    } catch {
      setError('Failed to send')
    } finally {
      setSending(false)
    }
  }

  const unread = !open && messages.length > 0

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors"
      >
        <MessageSquare size={12} />
        {open ? 'Hide messages' : `Messages${messages.length > 0 ? ` (${messages.length})` : ''}`}
        {unread && <span className="w-1.5 h-1.5 rounded-full bg-[#C4A46B]" />}
      </button>

      {open && (
        <div className="mt-2 bg-[#FAFAF8] border border-[#EDE9E1] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#EDE9E1] flex items-center justify-between">
            <p className="text-xs font-semibold text-[#2C2C2A]">Messages with {recipientName}</p>
            <button onClick={() => setOpen(false)} className="text-[#C4BFB5] hover:text-[#8A877F] transition-colors">
              <X size={13} />
            </button>
          </div>

          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-xs text-[#C4BFB5] text-center py-4">No messages yet. Start the conversation.</p>
            ) : (
              messages.map(m => (
                <div
                  key={m.id}
                  className={`flex ${m.sender_type === 'designer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                      m.sender_type === 'designer'
                        ? 'bg-[#2C2C2A] text-[#F5F2EC] rounded-br-sm'
                        : 'bg-white border border-[#EDE9E1] text-[#2C2C2A] rounded-bl-sm'
                    }`}
                  >
                    {m.body}
                    <div className={`text-[9px] mt-1 ${m.sender_type === 'designer' ? 'text-white/40' : 'text-[#C4BFB5]'}`}>
                      {new Date(m.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {new Date(m.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {error && <p className="px-4 pb-2 text-xs text-red-500">{error}</p>}

          <form onSubmit={handleSend} className="px-3 pb-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Message ${recipientName}…`}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-3 py-1.5 bg-[#2C2C2A] text-white rounded text-xs font-medium hover:bg-[#9A7B4F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Send size={11} />
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
