'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle, Camera, MapPin, Clock, CheckCircle2, Upload, X } from 'lucide-react'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  green: '#16A34A', danger: '#DC2626',
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:   { label: 'Scheduled',   color: '#3A7CA5', bg: 'rgba(58,124,165,0.1)' },
  in_progress: { label: 'In Progress', color: '#D9A441', bg: 'rgba(217,164,65,0.1)' },
  completed:   { label: 'Completed',   color: '#16A34A', bg: 'rgba(22,163,74,0.1)'  },
  cancelled:   { label: 'Cancelled',   color: '#71717A', bg: '#F4F4F5'              },
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
}

function compressImage(file: File, maxPx = 1920, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compression failed')), 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = url
  })
}

interface Photo { id: string; public_url: string; file_name: string | null; uploaded_by_name: string | null; created_at: string }
interface JobData {
  job: { id: string; title: string; address: string | null; notes: string | null; scheduled_date: string; start_time: string; end_time: string; status: string }
  staff: { name: string; role: string; color: string } | null
  company: { company_name: string | null; email: string | null; logo_url: string | null } | null
  photos: Photo[]
}

export default function WorkerJobPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData]       = useState<JobData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [photos, setPhotos]   = useState<Photo[]>([])
  const [workerName, setWorkerName] = useState('')
  const [nameAsked, setNameAsked]   = useState(false)
  const [pending, setPending]       = useState<{ preview: string; status: 'uploading' | 'error'; error?: string }[]>([])
  const [lightbox, setLightbox]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/job/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d); setPhotos(d.photos); setLoading(false)
      })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [token])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    // Ask for name once per session
    if (!nameAsked) {
      const name = window.prompt('Your name (optional — leave blank to skip):')
      setWorkerName(name ?? '')
      setNameAsked(true)
    }

    for (const file of Array.from(files)) {
      const preview = URL.createObjectURL(file)
      const idx = pending.length
      setPending(p => [...p, { preview, status: 'uploading' }])

      try {
        const compressed = await compressImage(file)
        const fd = new FormData()
        fd.append('photo', compressed, file.name.replace(/\.[^.]+$/, '.jpg'))
        if (workerName) fd.append('name', workerName)

        const res = await fetch(`/api/job/${token}/photos`, { method: 'POST', body: fd })
        const result = await res.json() as Photo & { error?: string }

        if (!res.ok || result.error) {
          setPending(p => p.map((x, i) => i === idx ? { ...x, status: 'error', error: result.error ?? 'Upload failed' } : x))
        } else {
          setPhotos(prev => [result, ...prev])
          setPending(p => p.filter((_, i) => i !== idx))
          URL.revokeObjectURL(preview)
        }
      } catch {
        setPending(p => p.map((x, i) => i === idx ? { ...x, status: 'error', error: 'Upload failed' } : x))
      }
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: S.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: S.muted }} />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6" style={{ background: S.bg }}>
      <AlertCircle size={36} style={{ color: S.muted }} />
      <p className="font-semibold text-lg" style={{ color: S.text }}>Job not found</p>
      <p className="text-sm text-center" style={{ color: S.muted }}>This link may be invalid or the job has been removed.</p>
    </div>
  )

  const { job, staff, company } = data
  const companyName = company?.company_name ?? company?.email ?? 'Your contractor'
  const st = STATUS_LABELS[job.status] ?? STATUS_LABELS.scheduled
  const mapsUrl = job.address ? `https://maps.google.com/?q=${encodeURIComponent(job.address)}` : null

  return (
    <div className="min-h-screen pb-10" style={{ background: S.bg }}>

      {/* Header */}
      <div className="px-4 pt-6 pb-4" style={{ background: '#1E2A38' }}>
        <p className="text-[11px] uppercase tracking-widest font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{companyName}</p>
        <h1 className="text-xl font-bold text-white leading-tight">{job.title}</h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
          {job.status === 'completed' && <CheckCircle2 size={15} style={{ color: S.green }} />}
        </div>
      </div>

      <div className="px-4 space-y-3 mt-4">

        {/* Date + time */}
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <Clock size={18} style={{ color: S.accent }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: S.text }}>{fmtDate(job.scheduled_date)}</p>
            <p className="text-sm mt-0.5" style={{ color: S.muted }}>{fmtTime(job.start_time)} – {fmtTime(job.end_time)}</p>
          </div>
        </div>

        {/* Address */}
        {job.address && (
          <a href={mapsUrl ?? '#'} target="_blank" rel="noreferrer"
            className="rounded-2xl p-4 flex items-start gap-3 block"
            style={{ background: S.card, border: `1px solid ${S.border}`, textDecoration: 'none' }}>
            <MapPin size={18} style={{ color: S.accent, flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: S.text }}>{job.address}</p>
              <p className="text-xs mt-0.5" style={{ color: S.accent }}>Open in Maps →</p>
            </div>
          </a>
        )}

        {/* Assigned to */}
        {staff && (
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: staff.color }}>
              {staff.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: S.text }}>{staff.name}</p>
              <p className="text-xs capitalize mt-0.5" style={{ color: S.muted }}>{staff.role.replace('_', ' ')}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {job.notes && (
          <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>Notes</p>
            <p className="text-sm" style={{ color: S.text }}>{job.notes}</p>
          </div>
        )}

        {/* Photos section */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.muted }}>
              Photos {photos.length > 0 && `(${photos.length})`}
            </p>
          </div>

          {/* Add photo button */}
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-2xl py-5 flex flex-col items-center gap-2 mb-3"
            style={{ background: `rgba(58,124,165,0.06)`, border: `2px dashed ${S.accent}` }}>
            <Camera size={24} style={{ color: S.accent }} />
            <span className="text-sm font-semibold" style={{ color: S.accent }}>Add Photo</span>
            <span className="text-xs" style={{ color: S.muted }}>Tap to take a photo or choose from gallery</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={e => void handleFiles(e.target.files)}
          />

          {/* Pending uploads */}
          {pending.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {pending.map((p, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden relative"
                  style={{ border: `1px solid ${S.border}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" className="w-full h-full object-cover" style={{ opacity: 0.5 }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {p.status === 'uploading'
                      ? <Loader2 size={20} className="animate-spin text-white" />
                      : <div className="text-center px-2">
                          <X size={18} style={{ color: S.danger }} className="mx-auto" />
                          <p className="text-[9px] text-white mt-1">{p.error}</p>
                        </div>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Uploaded photos grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map(photo => (
                <button key={photo.id} onClick={() => setLightbox(photo.public_url)}
                  className="aspect-square rounded-xl overflow-hidden relative block"
                  style={{ border: `1px solid ${S.border}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.public_url} alt={photo.file_name ?? ''} className="w-full h-full object-cover" />
                  {photo.uploaded_by_name && (
                    <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }}>
                      <p className="text-[9px] text-white truncate">{photo.uploaded_by_name}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {photos.length === 0 && pending.length === 0 && (
            <p className="text-center text-sm py-4" style={{ color: S.muted }}>No photos yet</p>
          )}
        </div>

        {/* Upload tip */}
        <div className="rounded-xl px-4 py-3 flex items-start gap-2" style={{ background: 'rgba(58,124,165,0.06)', border: `1px solid rgba(58,124,165,0.15)` }}>
          <Upload size={13} style={{ color: S.accent, flexShrink: 0, marginTop: 2 }} />
          <p className="text-xs" style={{ color: S.muted }}>
            Photos are automatically compressed and sent directly to <strong style={{ color: S.text }}>{companyName}</strong>.
          </p>
        </div>

      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" style={{ maxHeight: '90vh' }} />
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}>
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
