'use client'
import { useRef, useState } from 'react'
import { Send, Copy, Check, Mail, RotateCcw } from 'lucide-react'
import type { AskAnswer, AskTurn } from '@/lib/agent/ask'

interface Exchange { question: string; answer: AskAnswer | null; error: string | null }

const linkClass = 'underline hover:text-[#2C2C2A] focus-visible:text-[#2C2C2A] focus-visible:outline-none active:opacity-70'

// "Ask Mia": admins ask about the studio's own business. Answers come from the
// studio's data; drafts are for a person to send.
export function AskMia({ name }: { name: string }) {
  const [question, setQuestion] = useState('')
  const [log, setLog] = useState<Exchange[]>([])
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function ask() {
    const q = question.trim()
    if (!q || busy) return
    // The conversation so far, so follow-ups ("and last year?") make sense.
    const history: AskTurn[] = log.flatMap(x => x.answer ? [{ role: 'user', content: x.question }, { role: 'assistant', content: x.answer.text }] as AskTurn[] : [])
    const messages: AskTurn[] = [...history.slice(-12), { role: 'user', content: q }]
    setLog(l => [...l, { question: q, answer: null, error: null }])
    setQuestion('')
    setBusy(true)
    try {
      const res = await fetch('/api/agent/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }) })
      const data = await res.json().catch(() => ({}))
      setLog(l => l.map((x, i) => i === l.length - 1
        ? res.ok ? { ...x, answer: data as AskAnswer } : { ...x, error: data.error ?? 'Something went wrong. Try again.' }
        : x))
    } catch {
      setLog(l => l.map((x, i) => i === l.length - 1 ? { ...x, error: 'Could not reach the server. Try again.' } : x))
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="rounded-lg border border-[#D8D3C8] bg-white">
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="text-sm font-semibold text-[#2C2C2A]">Ask {name}</h2>
        {log.length > 0 && (
          <button className={`flex items-center gap-1 text-xs text-[#8A877F] cursor-pointer ${linkClass}`} onClick={() => setLog([])} disabled={busy}>
            <RotateCcw size={12} /> Start again
          </button>
        )}
      </div>
      <p className="px-4 text-xs text-[#8A877F]">
        Questions about your clients, suppliers, prices and mail. Only admins see this. {name} reads; she can draft an email but never sends one.
      </p>

      {log.length > 0 && (
        <div className="px-4 pt-3 space-y-4 max-h-[60vh] overflow-y-auto">
          {log.map((x, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium text-[#2C2C2A]">{x.question}</p>
              {!x.answer && !x.error && <p className="text-sm text-[#8A877F]">{name} is looking…</p>}
              {x.error && <p className="text-sm text-[#B4472F]">{x.error}</p>}
              {x.answer && <AnswerBlock answer={x.answer} />}
            </div>
          ))}
        </div>
      )}

      <div className="p-4 flex gap-2 items-end">
        <label className="flex-1">
          <span className="block text-xs font-medium text-[#5F5C55] mb-1">Your question</span>
          <textarea
            ref={inputRef}
            rows={2}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
            className="w-full text-sm px-3 py-2 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] focus-visible:border-[#9A7B4F] transition-colors text-[#2C2C2A] resize-y"
          />
        </label>
        <button
          onClick={ask}
          disabled={busy || !question.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#2C2C2A] text-white text-sm font-semibold cursor-pointer hover:bg-[#45443F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A7B4F] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,transform]"
        >
          <Send size={14} /> Ask
        </button>
      </div>
    </div>
  )
}

function AnswerBlock({ answer }: { answer: AskAnswer }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-[#2C2C2A] whitespace-pre-wrap leading-relaxed">{answer.text}</p>
      {answer.sources.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#7E6036]">
          <span className="text-[#8A877F]">Sources:</span>
          {answer.sources.map(s => (
            <a key={s.href} href={s.href} target={s.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={linkClass}>{s.label}</a>
          ))}
        </div>
      )}
      {answer.drafts.map((d, i) => <DraftCard key={i} draft={d} />)}
    </div>
  )
}

function DraftCard({ draft }: { draft: AskAnswer['drafts'][number] }) {
  const [copied, setCopied] = useState(false)
  const isAddress = /\S+@\S+\.\S+/.test(draft.to)
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1${isAddress ? `&to=${encodeURIComponent(draft.to)}` : ''}&su=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`

  async function copy() {
    await navigator.clipboard.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-md border border-[#E6E1D6] bg-[#FAF8F4] p-3 text-sm space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8A877F]">Draft, not sent</p>
      <p><span className="text-[#8A877F]">To:</span> {draft.to}</p>
      <p><span className="text-[#8A877F]">Subject:</span> {draft.subject}</p>
      <p className="whitespace-pre-wrap text-[#2C2C2A] pt-1">{draft.body}</p>
      <div className="flex gap-4 pt-1 text-xs text-[#7E6036]">
        <button className={`flex items-center gap-1 cursor-pointer ${linkClass}`} onClick={copy}>
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
        <a className={`flex items-center gap-1 ${linkClass}`} href={gmail} target="_blank" rel="noreferrer">
          <Mail size={12} /> Open in Gmail
        </a>
      </div>
    </div>
  )
}
