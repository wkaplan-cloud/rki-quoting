'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
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
}

function SignPage() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<'loading' | 'ready' | 'signing' | 'done' | 'error'>('loading')
  const [job, setJob] = useState<JobInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [signerName, setSignerName] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

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

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault(); isDrawing.current = true; lastPos.current = getPos(e)
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isDrawing.current || !lastPos.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.strokeStyle = '#18181B'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
  }
  function endDraw() { isDrawing.current = false; lastPos.current = null }

  async function handleSubmit() {
    const canvas = canvasRef.current!
    const signature = canvas.toDataURL('image/png')
    setStatus('signing')
    const res = await fetch(`/api/job-sign/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature, signerName: signerName.trim() || undefined }),
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
              {job?.alreadySigned ? 'Already signed' : 'Signature received!'}
            </p>
            <p className="text-sm" style={{ color: S.muted }}>
              {job?.alreadySigned
                ? 'This job card has already been signed.'
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

            {/* Signature area */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <p className="text-sm font-semibold" style={{ color: S.text }}>Your signature</p>
              <p className="text-xs" style={{ color: S.muted }}>By signing below you confirm the work described above has been completed to your satisfaction.</p>

              <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${S.border}`, background: '#FAFAFA', touchAction: 'none' }}>
                <canvas ref={canvasRef} width={600} height={200} className="w-full"
                  style={{ cursor: 'crosshair', display: 'block' }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
              </div>

              <input value={signerName} onChange={e => setSignerName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: `1px solid ${S.border}`, background: S.bg, color: S.text }} />

              {errorMsg && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: S.danger }}>{errorMsg}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { const ctx = canvasRef.current!.getContext('2d')!; ctx.clearRect(0, 0, 600, 200) }}
                  className="px-4 py-2.5 rounded-xl text-sm"
                  style={{ border: `1px solid ${S.border}`, color: S.muted }}>
                  Clear
                </button>
                <button onClick={() => void handleSubmit()} disabled={status === 'signing'}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: S.green }}>
                  {status === 'signing' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  {status === 'signing' ? 'Saving…' : 'Submit Signature'}
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
