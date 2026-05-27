'use client'
import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react'

interface Props {
  token: string
  projectName: string
  projectNumber: string
  clientName: string | null
  initialDecision: 'approved' | 'declined' | null
  alreadySubmitted: boolean
  submittedDecision: 'approved' | 'declined' | null
}

export function ApprovalForm({ token, projectName, projectNumber, clientName, initialDecision, alreadySubmitted, submittedDecision }: Props) {
  const [decision, setDecision] = useState<'approved' | 'declined' | null>(initialDecision)
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (alreadySubmitted) {
    const isApproved = submittedDecision === 'approved'
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#F5F2EC' }}>
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            {isApproved
              ? <CheckCircle2 size={48} className="mx-auto" style={{ color: '#16A34A' }} />
              : <XCircle size={48} className="mx-auto" style={{ color: '#8A877F' }} />
            }
          </div>
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#2C2C2A' }}>
            Response already submitted
          </h1>
          <p className="text-sm" style={{ color: '#8A877F' }}>
            You {isApproved ? 'approved' : 'declined'} the quote for <strong>{projectName}</strong>.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    const isApproved = decision === 'approved'
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#F5F2EC' }}>
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            {isApproved
              ? <CheckCircle2 size={56} className="mx-auto" style={{ color: '#16A34A' }} />
              : <XCircle size={56} className="mx-auto" style={{ color: '#8A877F' }} />
            }
          </div>
          <h1 className="text-2xl font-semibold mb-3" style={{ color: '#2C2C2A' }}>
            {isApproved ? 'Quote approved — thank you!' : 'Response received — thank you.'}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#8A877F' }}>
            {isApproved
              ? 'Your approval has been sent. We\'ll be in touch shortly to get things moving.'
              : 'Your feedback has been sent. We\'ll review and follow up with you.'}
          </p>
        </div>
      </div>
    )
  }

  async function handleSubmit() {
    if (!decision) return
    setStatus('submitting')
    try {
      const res = await fetch(`/api/approve/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment: comment.trim() || undefined }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (json.ok) {
        setStatus('done')
      } else if (json.error === 'already_submitted') {
        setStatus('done')
      } else {
        setErrorMsg(json.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <p className="text-sm leading-relaxed" style={{ color: '#5C5A55' }}>
        {clientName ? `Hi ${clientName}, please` : 'Please'} review and respond to the quote for{' '}
        <strong style={{ color: '#2C2C2A' }}>{projectName}</strong>.
      </p>

      {/* Decision buttons */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#8A877F', letterSpacing: '0.08em' }}>
          Your response
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setDecision('approved')}
            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 font-semibold text-sm transition-all"
            style={{
              borderColor: decision === 'approved' ? '#16A34A' : '#D8D3C8',
              backgroundColor: decision === 'approved' ? '#F0FDF4' : '#FFFFFF',
              color: decision === 'approved' ? '#16A34A' : '#8A877F',
            }}
          >
            <ThumbsUp size={16} />
            Approve
          </button>
          <button
            onClick={() => setDecision('declined')}
            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 font-semibold text-sm transition-all"
            style={{
              borderColor: decision === 'declined' ? '#8A877F' : '#D8D3C8',
              backgroundColor: decision === 'declined' ? '#F5F2EC' : '#FFFFFF',
              color: decision === 'declined' ? '#4A4A47' : '#8A877F',
            }}
          >
            <ThumbsDown size={16} />
            Decline
          </button>
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8A877F', letterSpacing: '0.08em' }}>
          Comment <span style={{ color: '#C4BFB5', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          placeholder={decision === 'declined' ? 'Let us know what you\'d like changed…' : 'Any notes for us?'}
          className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-colors"
          style={{
            backgroundColor: '#F5F2EC',
            border: '1px solid #D8D3C8',
            color: '#2C2C2A',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#C4A46B' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#D8D3C8' }}
        />
      </div>

      {/* Error */}
      {status === 'error' && (
        <p className="text-sm" style={{ color: '#DC2626' }}>{errorMsg}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!decision || status === 'submitting'}
        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-opacity flex items-center justify-center gap-2"
        style={{
          backgroundColor: decision === 'approved' ? '#16A34A' : decision === 'declined' ? '#4A4A47' : '#D8D3C8',
          color: '#FFFFFF',
          opacity: !decision || status === 'submitting' ? 0.6 : 1,
          cursor: !decision ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'submitting' ? (
          <><Loader2 size={16} className="animate-spin" /> Submitting…</>
        ) : decision === 'approved' ? (
          <><CheckCircle2 size={16} /> Confirm Approval</>
        ) : decision === 'declined' ? (
          'Submit Response'
        ) : (
          'Select a response above'
        )}
      </button>

      <p className="text-xs text-center" style={{ color: '#C4BFB5' }}>
        Ref: {projectNumber}
      </p>
    </div>
  )
}
