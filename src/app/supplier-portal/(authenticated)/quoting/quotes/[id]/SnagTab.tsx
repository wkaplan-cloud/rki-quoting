'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText, Loader2, X, Download } from 'lucide-react'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

interface SnagDoc { id: string; name: string; url: string; created_at: string }

interface Props {
  quoteId: string
  portalAccountId: string
}

export function SnagTab({ quoteId, portalAccountId }: Props) {
  const supabase = createClient()
  const [docs, setDocs] = useState<SnagDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadDocs() {
    if (loaded) return
    const { data } = await supabase
      .from('elec_snag_documents')
      .select('id, name, url, created_at')
      .eq('quote_id', quoteId)
      .order('created_at')
    setDocs((data ?? []) as SnagDoc[])
    setLoaded(true)
  }

  // Load on first render
  if (!loaded) void loadDocs()

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true); setError('')
    for (const file of Array.from(files)) {
      const path = `snag-docs/${portalAccountId}/${quoteId}/${Date.now()}-${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('job-card-photos')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadErr) { setError(uploadErr.message); continue }
      const { data: { publicUrl } } = supabase.storage.from('job-card-photos').getPublicUrl(path)
      const { data: doc } = await supabase
        .from('elec_snag_documents')
        .insert({ quote_id: quoteId, portal_account_id: portalAccountId, name: file.name, url: publicUrl })
        .select()
        .single()
      if (doc) setDocs(prev => [...prev, doc as SnagDoc])
    }
    setUploading(false)
  }

  async function handleDelete(docId: string) {
    await supabase.from('elec_snag_documents').delete().eq('id', docId)
    setDocs(prev => prev.filter(d => d.id !== docId))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>Snag List Documents</p>
        <p className="text-xs mb-4" style={{ color: S.muted }}>Upload snag list documents (PDF, Word, Excel, images)</p>

        {docs.length > 0 && (
          <div className="space-y-2 mb-4">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: S.bg, border: `1px solid ${S.border}` }}>
                <FileText size={16} style={{ color: S.accent, flexShrink: 0 }} />
                <span className="flex-1 text-sm truncate" style={{ color: S.text }}>{doc.name}</span>
                <span className="text-[10px] flex-shrink-0" style={{ color: S.muted }}>
                  {new Date(doc.created_at).toLocaleDateString('en-ZA')}
                </span>
                <a href={doc.url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ color: S.accent }}>
                  <Download size={14} />
                </a>
                <button onClick={() => void handleDelete(doc.id)}
                  className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ color: S.muted }}
                  onMouseEnter={e => e.currentTarget.style.color = S.danger}
                  onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {docs.length === 0 && !uploading && (
          <div className="rounded-xl py-8 flex flex-col items-center gap-2 mb-4"
            style={{ border: `2px dashed ${S.border}` }}>
            <FileText size={28} style={{ color: S.border }} />
            <p className="text-sm" style={{ color: S.muted }}>No documents uploaded yet</p>
          </div>
        )}

        {error && <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: S.danger }}>{error}</p>}

        <input ref={fileRef} type="file" multiple className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={e => void handleUpload(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: S.accent }}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>
      </div>
    </div>
  )
}
