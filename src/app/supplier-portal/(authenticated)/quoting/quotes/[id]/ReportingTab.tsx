'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Camera, Loader2, AlertTriangle, TrendingDown } from 'lucide-react'
import { uniqueUploadPath } from '@/lib/upload-path'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A', gold: '#D9A441',
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TYPES = [
  { value: 'damage', label: 'Damage', icon: AlertTriangle, color: S.danger },
  { value: 'loss',   label: 'Loss',   icon: TrendingDown, color: S.gold },
  { value: 'other',  label: 'Other',  icon: AlertTriangle, color: S.muted },
]

interface Report {
  id: string; quote_id: string; portal_account_id: string
  report_type: string; description: string
  amount: number | null; notes: string | null; photo_url: string | null; created_at: string
}

interface Props {
  quoteId: string
  portalAccountId: string
}

export function ReportingTab({ quoteId, portalAccountId }: Props) {
  const supabase = createClient()
  const [reports, setReports] = useState<Report[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [type, setType] = useState('damage')
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadReports() {
    if (loaded) return
    const { data } = await supabase
      .from('elec_project_reports')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false })
    setReports((data ?? []) as Report[])
    setLoaded(true)
  }
  if (!loaded) void loadReports()

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const file = files[0]
    const path = uniqueUploadPath(`reports/${portalAccountId}/${quoteId}`, file.name)
    const { error: uploadErr } = await supabase.storage.from('job-card-photos').upload(path, file, { contentType: file.type })
    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from('job-card-photos').getPublicUrl(path)
      setPhotoUrl(publicUrl)
    }
    setUploading(false)
  }

  async function handleSave() {
    if (!desc.trim() || saving) return
    setSaving(true); setError('')
    const { data, error: err } = await supabase
      .from('elec_project_reports')
      .insert({
        quote_id: quoteId,
        portal_account_id: portalAccountId,
        report_type: type,
        description: desc.trim(),
        amount: amount ? parseFloat(amount) : null,
        notes: notes.trim() || null,
        photo_url: photoUrl,
      })
      .select()
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    setReports(prev => [data as Report, ...prev])
    setDesc(''); setAmount(''); setNotes(''); setPhotoUrl(null); setShowAdd(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('elec_project_reports').delete().eq('id', id)
    setReports(prev => prev.filter(r => r.id !== id))
  }

  const totalDamages = reports.filter(r => r.report_type !== 'other').reduce((s, r) => s + (r.amount ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      {reports.length > 0 && (
        <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
          style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Total Reported (Damages + Losses)</p>
            <p className="text-xl font-bold" style={{ color: totalDamages > 0 ? S.danger : S.text }}>{fmtR(totalDamages)}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: 'rgba(220,38,38,0.08)', color: S.danger }}>
            {reports.length} report{reports.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Report list */}
      {reports.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {reports.map((r, i) => {
            const t = TYPES.find(x => x.value === r.report_type) ?? TYPES[2]
            const Icon = t.icon
            return (
              <div key={r.id} className="px-5 py-4"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${t.color}18` }}>
                    <Icon size={14} style={{ color: t.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.color }}>{t.label}</span>
                      <span className="text-[10px]" style={{ color: S.muted }}>{new Date(r.created_at).toLocaleDateString('en-ZA')}</span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: S.text }}>{r.description}</p>
                    {r.amount != null && <p className="text-sm font-bold mt-0.5" style={{ color: t.color }}>{fmtR(r.amount)}</p>}
                    {r.notes && <p className="text-xs mt-1 italic" style={{ color: S.muted }}>{r.notes}</p>}
                    {r.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photo_url} alt="Report photo" className="mt-2 rounded-lg max-h-40 w-auto"
                        style={{ border: `1px solid ${S.border}` }} />
                    )}
                  </div>
                  <button onClick={() => void handleDelete(r.id)} className="p-1.5 rounded-lg flex-shrink-0"
                    style={{ color: S.muted }}
                    onMouseEnter={e => e.currentTarget.style.color = S.danger}
                    onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      {showAdd ? (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: S.card, border: `1.5px solid ${S.accent}` }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: S.text }}>New Report</p>
            <button onClick={() => setShowAdd(false)} style={{ color: S.muted }}><X size={16} /></button>
          </div>

          <div className="flex gap-2">
            {TYPES.map(t => (
              <button key={t.value} onClick={() => setType(t.value)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{
                  background: type === t.value ? `${t.color}15` : S.bg,
                  color: type === t.value ? t.color : S.muted,
                  border: `1.5px solid ${type === t.value ? t.color : S.border}`,
                }}>
                {t.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Description *</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Describe the damage or loss…" rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
              style={{ border: `1px solid ${S.border}`, background: S.input, color: S.text }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Amount (R)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" min="0" step="0.01"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ border: `1px solid ${S.border}`, background: S.input, color: S.text }} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Photo</label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => void handlePhotoUpload(e.target.files)} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{ border: `1px solid ${S.border}`, background: S.input, color: photoUrl ? S.green : S.muted }}>
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                {uploading ? 'Uploading…' : photoUrl ? 'Photo added ✓' : 'Add photo'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes…" rows={2}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
              style={{ border: `1px solid ${S.border}`, background: S.input, color: S.text }} />
          </div>

          {error && <p className="text-xs px-3 py-2 rounded-xl" style={{ background: '#FEF2F2', color: S.danger }}>{error}</p>}

          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted, background: S.bg }}>
              Cancel
            </button>
            <button onClick={() => void handleSave()} disabled={!desc.trim() || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: S.accent }}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Saving…' : 'Add Report'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ border: `1px solid ${S.border}`, color: S.accent, background: S.card }}>
          <Plus size={14} /> Add Report
        </button>
      )}
    </div>
  )
}
