'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, MailOpen, Tag, Send } from 'lucide-react'

interface Submission {
  id: string
  name: string | null
  email: string
  type: string | null
  message: string
  read: boolean
  created_at: string
  replied_at: string | null
}

const TYPE_COLOURS: Record<string, string> = {
  'Feedback': 'bg-blue-500/10 text-blue-400',
  'Help & Support': 'bg-amber-500/10 text-amber-400',
  'Feature Request': 'bg-purple-500/10 text-purple-400',
}

export function MessagesClient({ submissions }: { submissions: Submission[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Submission | null>(null)
  const [list, setList] = useState(submissions)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ id: string; at: Date } | null>(null)

  function getRepliedAt(msg: Submission) {
    if (sent?.id === msg.id) return sent.at
    if (msg.replied_at) return new Date(msg.replied_at)
    return null
  }

  async function openMessage(msg: Submission) {
    setSelected(msg)
    setReply('')
    setSent(null)
    if (!msg.read) {
      await fetch('/api/platform/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id }),
      })
      setList(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
      router.refresh()
    }
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)]">
      {/* List */}
      <div className="w-80 flex-shrink-0 bg-[#1A1A18] border border-white/10 rounded-xl overflow-y-auto">
        {list.length === 0 && (
          <p className="text-center text-sm text-white/30 py-12">No messages yet</p>
        )}
        {list.map(msg => (
          <button
            key={msg.id}
            onClick={() => openMessage(msg)}
            className={`w-full text-left px-4 py-3.5 border-b border-white/5 hover:bg-white/5 transition-colors ${selected?.id === msg.id ? 'bg-white/5' : ''}`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                {msg.read
                  ? <MailOpen size={12} className="text-white/20 flex-shrink-0" />
                  : <Mail size={12} className="text-[#C4A46B] flex-shrink-0" />
                }
                <span className={`text-sm truncate ${msg.read ? 'text-white/50' : 'text-white font-medium'}`}>
                  {msg.name || msg.email}
                </span>
              </div>
              <span className="text-[10px] text-white/25 flex-shrink-0 mt-0.5">
                {new Date(msg.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            {msg.type && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full mb-1 ${TYPE_COLOURS[msg.type] ?? 'bg-white/5 text-white/30'}`}>
                <Tag size={8} /> {msg.type}
              </span>
            )}
            <p className="text-xs text-white/30 truncate">{msg.message}</p>
          </button>
        ))}
      </div>

      {/* Detail */}
      <div className="flex-1 bg-[#1A1A18] border border-white/10 rounded-xl p-6 overflow-y-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MailOpen size={32} className="text-white/10 mb-3" />
            <p className="text-sm text-white/25">Select a message to read</p>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-white mb-1">{selected.name || selected.email}</h2>
                <p className="text-sm text-white/40">{selected.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/25">
                  {new Date(selected.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-white/20">
                  {new Date(selected.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {selected.type && (
              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full mb-4 ${TYPE_COLOURS[selected.type] ?? 'bg-white/5 text-white/30'}`}>
                <Tag size={10} /> {selected.type}
              </span>
            )}

            <div className="bg-[#0F0F0D] border border-white/10 rounded-lg p-4">
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
            </div>

            <div className="mt-6">
              {getRepliedAt(selected) ? (
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <Mail size={13} /> Reply sent to {selected.email}
                  <span className="text-white/25 text-xs">
                    {getRepliedAt(selected)!.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} at {getRepliedAt(selected)!.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder={`Reply to ${selected.name || selected.email}…`}
                    rows={4}
                    className="w-full bg-[#0F0F0D] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:border-white/20"
                  />
                  <button
                    disabled={!reply.trim() || sending}
                    onClick={async () => {
                      setSending(true)
                      const res = await fetch('/api/platform/messages/reply', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: selected.email, toName: selected.name, message: reply, id: selected.id }),
                      })
                      setSending(false)
                      if (res.ok) { setSent({ id: selected.id, at: new Date() }); setReply('') }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#C4A46B] text-[#1A1A18] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={13} /> {sending ? 'Sending…' : 'Send reply'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
