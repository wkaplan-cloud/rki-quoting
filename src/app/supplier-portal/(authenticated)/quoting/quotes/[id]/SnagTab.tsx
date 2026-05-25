'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X } from 'lucide-react'
import type { ElecSnagItem, ElecSnagStatus } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

const SNAG_STATUS: Record<ElecSnagStatus, { label: string; color: string; bg: string; next: ElecSnagStatus | null; nextLabel: string; nextColor: string }> = {
  open:        { label: 'Open',        color: '#DC2626', bg: '#FEF2F2',               next: 'in_progress', nextLabel: 'Start',   nextColor: '#D9A441' },
  in_progress: { label: 'In Progress', color: '#D9A441', bg: 'rgba(217,164,65,0.1)', next: 'resolved',    nextLabel: 'Resolve', nextColor: '#16A34A' },
  resolved:    { label: 'Resolved',    color: '#16A34A', bg: 'rgba(22,163,74,0.1)',  next: null,          nextLabel: '',        nextColor: '' },
}

interface Props {
  quoteId: string
  initialSnags: ElecSnagItem[]
}

export function SnagTab({ quoteId, initialSnags }: Props) {
  const supabase = createClient()
  const [snags, setSnags] = useState(initialSnags)
  const [filter, setFilter] = useState<ElecSnagStatus | ''>('')
  const [showAdd, setShowAdd] = useState(false)
  const [formDesc, setFormDesc] = useState('')
  const [formRaisedBy, setFormRaisedBy] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!formDesc.trim()) { setError('Description required'); return }
    setLoading(true); setError('')
    const { data, error: err } = await supabase
      .from('elec_snag_items')
      .insert({
        quote_id: quoteId,
        description: formDesc.trim(),
        raised_by: formRaisedBy.trim() || null,
        notes: formNotes.trim() || null,
        status: 'open',
        raised_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()
    if (err) { setError(err.message); setLoading(false); return }
    setSnags(prev => [data as ElecSnagItem, ...prev])
    setFormDesc(''); setFormRaisedBy(''); setFormNotes('')
    setShowAdd(false); setLoading(false)
  }

  async function advance(snag: ElecSnagItem) {
    const st = SNAG_STATUS[snag.status]
    if (!st.next) return
    const patch: Partial<ElecSnagItem> = { status: st.next }
    if (st.next === 'resolved') patch.resolved_date = new Date().toISOString().split('T')[0]
    await supabase.from('elec_snag_items').update(patch).eq('id', snag.id)
    setSnags(prev => prev.map(s => s.id === snag.id ? { ...s, ...patch } : s))
  }

  const counts = {
    open:        snags.filter(s => s.status === 'open').length,
    in_progress: snags.filter(s => s.status === 'in_progress').length,
    resolved:    snags.filter(s => s.status === 'resolved').length,
  }
  const filtered = filter ? snags.filter(s => s.status === filter) : snags

  const filterBtn = (val: ElecSnagStatus | '', label: string) => (
    <button key={val} onClick={() => setFilter(val)}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
      style={{
        background: filter === val ? S.accent : S.card,
        color:      filter === val ? '#fff' : S.muted,
        border:     `1px solid ${filter === val ? S.accent : S.border}`,
      }}>
      {label}
    </button>
  )

  return (
    <div>
      {/* Filter + action bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {filterBtn('', `All (${snags.length})`)}
        {filterBtn('open',        `Open (${counts.open})`)}
        {filterBtn('in_progress', `In Progress (${counts.in_progress})`)}
        {filterBtn('resolved',    `Resolved (${counts.resolved})`)}
        <div className="flex-1" />
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ color: S.accent, background: 'rgba(58,124,165,0.08)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(58,124,165,0.08)'}>
          <Plus size={12} /> Add Snag
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ color: S.text }}>New Snag Item</h3>
            <button onClick={() => { setShowAdd(false); setError('') }} style={{ color: S.muted }}><X size={14} /></button>
          </div>
          <div className="space-y-3 mb-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Description *</label>
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} autoFocus
                placeholder="Describe the defect or outstanding item"
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Raised By</label>
              <input value={formRaisedBy} onChange={e => setFormRaisedBy(e.target.value)} placeholder="Name (optional)"
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          </div>
          {error && <p className="text-sm px-3 py-2 rounded mb-3" style={{ background: '#FEF2F2', color: S.danger, border: '1px solid #FECACA' }}>{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setError('') }}
              className="px-4 py-2 text-sm rounded-lg" style={{ color: S.muted }}>Cancel</button>
            <button onClick={handleCreate} disabled={loading || !formDesc.trim()}
              className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: S.accent }}>{loading ? 'Adding…' : 'Add Snag'}</button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 && (
        <div className="rounded-2xl py-10 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <p className="text-sm" style={{ color: S.muted }}>
            {snags.length === 0 ? 'No snag items yet' : 'No items match this filter'}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {filtered.map((snag, i) => {
            const st = SNAG_STATUS[snag.status]
            return (
              <div key={snag.id} className="px-5 py-4 flex items-start gap-3"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    <span className="text-xs" style={{ color: S.muted }}>{snag.raised_date}</span>
                    {snag.resolved_date && (
                      <span className="text-xs" style={{ color: S.green }}>Resolved {snag.resolved_date}</span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: S.text }}>{snag.description}</p>
                  {snag.raised_by && <p className="text-xs mt-0.5" style={{ color: S.muted }}>Raised by: {snag.raised_by}</p>}
                  {snag.notes && <p className="text-xs mt-1 italic" style={{ color: S.muted }}>{snag.notes}</p>}
                </div>
                {st.next && (
                  <button onClick={() => advance(snag)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: st.nextColor }}>
                    {st.nextLabel}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
