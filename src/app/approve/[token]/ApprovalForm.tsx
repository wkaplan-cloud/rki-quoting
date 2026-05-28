'use client'
import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react'

interface Props {
  token: string
  projectName: string
  projectNumber: string
  clientName: string | null
  initialDecision: 'approved' | 'declined' | null
}

export function ApprovalForm({ token, projectName, projectNumber, clientName, initialDecision }: Props) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [finalDecision, setFinalDecision] = useState<'approved' | 'declined' | null>(initialDecision)
  const [errorMsg, setErrorMsg] = useState('')
  const [note, setNote] = useState('')
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Auto-submit when arriving via email link with ?decision= in URL
  useEffect(() => {
    if (initialDecision) {
      submit(initialDecision)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(decision: 'approved' | 'declined') {
    setStatus('submitting')
    setFinalDecision(decision)
    try {
      const res = await fetch(`/api/approve/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (json.ok || json.error === 'already_submitted') {
        setStatus('done')
      } else {
        setErrorMsg(json.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
        setFinalDecision(null)
      }
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
      setFinalDecision(null)
    }
  }

  async function sendNote() {
    if (!note.trim()) return
    setNoteStatus('saving')
    try {
      await fetch(`/api/approve/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: note.trim() }),
      })
      setNoteStatus('saved')
    } catch {
      setNoteStatus('idle')
    }
  }

  if (status === 'submitting') {
    return (
      <div className="py-8 text-center">
        <Loader2 size={32} className="mx-auto mb-3 animate-spin" style={{ color: '#C4A46B' }} />
        <p className="text-sm" style={{ color: '#8A877F' }}>Submitting…</p>
      </div>
    )
  }

  if (status === 'done') {
    const isApproved = finalDecision === 'approved'
    return (
      <div className="space-y-5">
        <div className="text-center py-2">
          {isApproved
            ? <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: '#16A34A' }} />
            : <XCircle size={40} className="mx-auto mb-3" style={{ color: '#8A877F' }} />
          }
          <p className="font-semibold mb-1.5" style={{ color: '#2C2C2A' }}>
            {isApproved ? 'Quote approved — thank you!' : 'Response received — thank you.'}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#8A877F' }}>
            {isApproved
              ? "Your approval has been sent to the studio. We'll be in touch shortly."
              : "Your response has been sent. The studio will follow up with you."}
          </p>
        </div>

        {noteStatus === 'saved' ? (
          <p className="text-sm text-center py-2" style={{ color: '#16A34A' }}>Note sent.</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8A877F', letterSpacing: '0.08em' }}>
                Add a note <span style={{ color: '#C4BFB5', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder={isApproved ? 'Any notes for us?' : "Let us know what you'd like changed…"}
                className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-colors"
                style={{ backgroundColor: '#F5F2EC', border: '1px solid #D8D3C8', color: '#2C2C2A' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#C4A46B' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#D8D3C8' }}
              />
            </div>
            {note.trim() && (
              <button
                onClick={sendNote}
                disabled={noteStatus === 'saving'}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#4A4A47',
                  color: '#FFFFFF',
                  opacity: noteStatus === 'saving' ? 0.6 : 1,
                  cursor: noteStatus === 'saving' ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.15s',
                }}
              >
                {noteStatus === 'saving' ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : 'Send note'}
              </button>
            )}
          </>
        )}

        <p className="text-xs text-center" style={{ color: '#C4BFB5' }}>Ref: {projectNumber}</p>
      </div>
    )
  }

  // Fallback: no URL decision — show direct-submit buttons (no two-step confirm)
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed" style={{ color: '#5C5A55' }}>
        {clientName ? `Hi ${clientName}, please` : 'Please'} review and respond to the quote for{' '}
        <strong style={{ color: '#2C2C2A' }}>{projectName}</strong>.
      </p>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: '#8A877F', letterSpacing: '0.08em' }}>
          Your response
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => submit('approved')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm"
            style={{ backgroundColor: '#16A34A', color: '#FFFFFF' }}
          >
            <ThumbsUp size={15} /> Approve
          </button>
          <button
            onClick={() => submit('declined')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm border"
            style={{ borderColor: '#D8D3C8', backgroundColor: '#F5F2EC', color: '#4A4A47' }}
          >
            <ThumbsDown size={15} /> Decline
          </button>
        </div>
      </div>

      {status === 'error' && (
        <p className="text-sm" style={{ color: '#DC2626' }}>{errorMsg}</p>
      )}

      <p className="text-xs text-center" style={{ color: '#C4BFB5' }}>Ref: {projectNumber}</p>
    </div>
  )
}
