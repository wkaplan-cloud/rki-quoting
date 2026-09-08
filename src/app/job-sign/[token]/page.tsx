'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

interface JobPricing {
  lines: { id: string; description: string; qty: number; unitPrice: number | null; amount: number | null }[]
  calloutFee: number
  labourHours: number | null
  labourRate: number | null
  labourCharge: number
  subtotal: number
  vatRate: number
  vat: number
  total: number
}

interface JobInfo {
  jobNumber: string
  title: string
  workFound: string | null
  workDone: string | null
  resolution: string | null
  alreadySigned: boolean
  companyName: string
  logoUrl: string | null
  /** Null when the card carries no charges — then nothing priced is shown. */
  pricing: JobPricing | null
}

function fmtR(n: number) {
  return 'R\u00A0' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function SignPage() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<'loading' | 'ready' | 'signing' | 'done' | 'error'>('loading')
  const [job, setJob] = useState<JobInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [signerName, setSignerName] = useState('')
  const [hasDrawn, setHasDrawn] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // Native touch event handlers for mobile (Samsung/Android Chrome suppresses pointer
  // events when touch events fire, so drawing must live here with passive:false).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function touchPos(t: Touch) {
      const rect = canvas!.getBoundingClientRect()
      return {
        x: (t.clientX - rect.left) * (canvas!.width / rect.width),
        y: (t.clientY - rect.top) * (canvas!.height / rect.height),
      }
    }

    function strokeLine(from: { x: number; y: number }, to: { x: number; y: number }) {
      const ctx = canvas!.getContext('2d')!
      ctx.strokeStyle = '#18181B'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault()
      const p = touchPos(e.touches[0])
      isDrawing.current = true
      lastPos.current = p
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      if (!isDrawing.current || !lastPos.current) return
      const p = touchPos(e.touches[0])
      strokeLine(lastPos.current, p)
      lastPos.current = p
      setHasDrawn(true)
    }

    function onTouchEnd() { isDrawing.current = false; lastPos.current = null }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    canvas.addEventListener('touchcancel', onTouchEnd)

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [status])

  useEffect(() => {
    void fetch(`/api/job-sign/${token}`)
      .then(r => r.json())
      .then((data: JobInfo & { error?: string }) => {
        if (data.error) { setErrorMsg(data.error); setStatus('error'); return }
        setJob(data)
        if (data.alreadySigned) setStatus('done')
        else setStatus('ready')
      })
      .catch(() => { setErrorMsg('Failed to load — please try again.'); setStatus('error') })
  }, [token])

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'touch') return  // touch handled by native listeners above
    e.currentTarget.setPointerCapture(e.pointerId)
    isDrawing.current = true; lastPos.current = getPos(e)
  }
  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'touch') return  // touch handled by native listeners above
    if (!isDrawing.current || !lastPos.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.strokeStyle = '#18181B'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
    setHasDrawn(true)
  }
  function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'touch') return
    isDrawing.current = false; lastPos.current = null
  }

  async function handleSubmit() {
    const canvas = canvasRef.current!
    const signature = canvas.toDataURL('image/png')
    setStatus('signing')
    const res = await fetch(`/api/job-sign/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature, signerName: signerName.trim() }),
    })
    if (res.ok) {
      setStatus('done')
    } else {
      const data = await res.json() as { error?: string }
      setErrorMsg(data.error ?? 'Failed to save — please try again.')
      setStatus('ready')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: S.bg }}>
      {/* Header */}
      <div style={{ background: '#1E2A38' }} className="px-5 py-5">
        <p className="font-bold text-white text-base">{job?.companyName || 'QuotingHub'}</p>
        <p className="text-[11px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Job Sign-off</p>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin" style={{ color: S.accent }} />
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <AlertCircle size={32} style={{ color: S.danger }} />
            <p className="font-semibold text-sm" style={{ color: S.text }}>Link unavailable</p>
            <p className="text-xs" style={{ color: S.muted }}>{errorMsg}</p>
          </div>
        )}

        {/* Already signed */}
        {(status === 'done') && (
          <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.1)' }}>
              <CheckCircle2 size={32} style={{ color: S.green }} />
            </div>
            <p className="font-bold text-base" style={{ color: S.text }}>
              {job?.alreadySigned ? 'Already approved' : 'Approval received!'}
            </p>
            <p className="text-sm" style={{ color: S.muted }}>
              {job?.alreadySigned
                ? 'This job card has already been approved.'
                : `Thank you${signerName ? `, ${signerName}` : ''}. Your signature has been saved.`}
            </p>
          </div>
        )}

        {/* Ready to sign */}
        {(status === 'ready' || status === 'signing') && job && (
          <>
            {/* Job summary */}
            <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${S.border}`, background: S.bg }}>
                <p className="text-[10px] font-mono" style={{ color: S.muted }}>{job.jobNumber}</p>
                <p className="font-bold text-sm" style={{ color: S.text }}>{job.title}</p>
              </div>
              {job.workDone && (
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Work Completed</p>
                  <p className="text-sm leading-relaxed" style={{ color: S.text }}>{job.workDone}</p>
                </div>
              )}
              {job.resolution && (
                <div className="px-4 py-3" style={{ borderTop: `1px solid ${S.border}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Resolution</p>
                  <p className="text-sm leading-relaxed" style={{ color: S.text }}>{job.resolution}</p>
                </div>
              )}
            </div>

            {/* What it comes to — the client is signing off on this price */}
            {job.pricing && (
              <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${S.border}`, background: S.bg }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Materials &amp; Charges</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 320 }}>
                    <thead>
                      <tr>
                        <th className="text-left font-semibold px-4 py-2 text-[10px] uppercase tracking-wider" style={{ color: S.muted }}>Description</th>
                        <th className="text-right font-semibold px-2 py-2 text-[10px] uppercase tracking-wider" style={{ color: S.muted }}>Qty</th>
                        <th className="text-right font-semibold px-2 py-2 text-[10px] uppercase tracking-wider whitespace-nowrap" style={{ color: S.muted }}>Unit Price</th>
                        <th className="text-right font-semibold px-4 py-2 text-[10px] uppercase tracking-wider" style={{ color: S.muted }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.pricing.calloutFee > 0 && (
                        <tr style={{ borderTop: `1px solid ${S.border}` }}>
                          <td className="px-4 py-2.5" style={{ color: S.text }}>Call-out Fee</td>
                          <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: S.muted }}>1</td>
                          <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: S.muted }}>{fmtR(job.pricing.calloutFee)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: S.text }}>{fmtR(job.pricing.calloutFee)}</td>
                        </tr>
                      )}
                      {job.pricing.labourCharge > 0 && (
                        <tr style={{ borderTop: `1px solid ${S.border}` }}>
                          <td className="px-4 py-2.5" style={{ color: S.text }}>
                            Labour
                            {job.pricing.labourHours != null && job.pricing.labourRate != null && (
                              <span style={{ color: S.muted }}> ({job.pricing.labourHours}h × {fmtR(job.pricing.labourRate)}/hr)</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: S.muted }}>{job.pricing.labourHours ?? 1}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: S.muted }}>{job.pricing.labourRate != null ? fmtR(job.pricing.labourRate) : '—'}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: S.text }}>{fmtR(job.pricing.labourCharge)}</td>
                        </tr>
                      )}
                      {job.pricing.lines.map(l => (
                        <tr key={l.id} style={{ borderTop: `1px solid ${S.border}` }}>
                          <td className="px-4 py-2.5" style={{ color: S.text }}>{l.description}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: S.muted }}>{l.qty}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: S.muted }}>{l.unitPrice != null ? fmtR(l.unitPrice) : '—'}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: S.text }}>{l.amount != null ? fmtR(l.amount) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-3 space-y-1" style={{ borderTop: `1px solid ${S.border}`, background: S.bg }}>
                  <div className="flex items-center justify-between text-xs" style={{ color: S.muted }}>
                    <span>Subtotal (excl. VAT)</span>
                    <span className="tabular-nums whitespace-nowrap">{fmtR(job.pricing.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs" style={{ color: S.muted }}>
                    <span>VAT ({job.pricing.vatRate}%)</span>
                    <span className="tabular-nums whitespace-nowrap">{fmtR(job.pricing.vat)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5" style={{ borderTop: `1px solid ${S.border}` }}>
                    <span className="text-sm font-bold" style={{ color: S.text }}>Total (incl. VAT)</span>
                    <span className="text-sm font-bold tabular-nums whitespace-nowrap" style={{ color: S.text }}>{fmtR(job.pricing.total)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Signature area */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <p className="text-sm font-semibold" style={{ color: S.text }}>Your signature</p>
              <p className="text-xs" style={{ color: S.muted }}>
                {job.pricing
                  ? 'By signing below you approve the work described above and the amount shown.'
                  : 'By signing below you confirm the work described above has been completed to your satisfaction.'}
              </p>

              <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${S.border}`, background: '#FAFAFA' }}>
                <canvas ref={canvasRef} width={600} height={200} className="w-full"
                  style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                  onPointerDown={startDraw} onPointerMove={draw} onPointerUp={endDraw} onPointerLeave={endDraw} onPointerCancel={endDraw} />
              </div>

              <div>
                <label htmlFor="signer-name" className="text-xs font-semibold mb-1.5 block" style={{ color: S.muted }}>
                  Full name of the person signing <span style={{ color: S.danger }}>*</span>
                </label>
                <input id="signer-name" value={signerName} onChange={e => setSignerName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />
              </div>

              {errorMsg && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: S.danger }}>{errorMsg}</p>
              )}
              {!errorMsg && (!signerName.trim() || !hasDrawn) && (
                <p className="text-xs" style={{ color: S.muted }}>
                  {!hasDrawn ? 'Sign in the box above to approve this work, then enter your name.' : 'Enter your name to submit.'}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { const ctx = canvasRef.current!.getContext('2d')!; ctx.clearRect(0, 0, 600, 200); setHasDrawn(false) }}
                  className="px-4 py-2.5 rounded-xl text-sm"
                  style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                  Clear
                </button>
                <button onClick={() => void handleSubmit()}
                  disabled={status === 'signing' || !signerName.trim() || !hasDrawn}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: S.green }}>
                  {status === 'signing' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  {status === 'signing' ? 'Saving…' : 'Approve & Sign'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function JobSignPage() {
  return (
    <Suspense>
      <SignPage />
    </Suspense>
  )
}
