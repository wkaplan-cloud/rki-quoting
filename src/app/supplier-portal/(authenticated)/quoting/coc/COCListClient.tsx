'use client'
import { useState } from 'react'
import {
  FileCheck, Download, Loader2, Search, CheckCircle2, Plus, FileX,
} from 'lucide-react'
import type { ElecCOC, ElecSettings } from '@/lib/elec-types'
import { COCModal, newCOC } from './COCModal'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type CompletedProject = {
  id: string; quote_number: string; project_name: string; project_address: string | null
  client: { id: string; client_name: string; email: string | null } | null
}
type CompletedJobCard = {
  id: string; job_number: string; title: string; location: string | null
  client_name: string | null; client_email: string | null
}

interface Props {
  completedProjects: CompletedProject[]
  completedJobCards: CompletedJobCard[]
  cocByQuoteId: Record<string, ElecCOC>
  cocByJobCardId: Record<string, ElecCOC>
  settings: ElecSettings | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Main list ─────────────────────────────────────────────────────────────────

export function COCListClient({ completedProjects, completedJobCards, cocByQuoteId: initCBQ, cocByJobCardId: initCBJ, settings }: Props) {
  const [cocByQuoteId, setCocByQuoteId]     = useState(initCBQ)
  const [cocByJobCardId, setCocByJobCardId] = useState(initCBJ)
  const [search, setSearch]                 = useState('')
  const [editing, setEditing]               = useState<{ coc: ElecCOC; title: string; onSaved: (c: ElecCOC) => void } | null>(null)
  const [downloadingId, setDownloadingId]   = useState<string | null>(null)

  function openProject(p: CompletedProject) {
    const existing = cocByQuoteId[p.id]
    const client = !Array.isArray(p.client) ? p.client : null
    const coc = existing ?? newCOC(p.id, null, p.project_address, client?.client_name ?? null, client?.email ?? null, settings)
    setEditing({ coc, title: `${p.quote_number} — ${p.project_name}`, onSaved: updated => setCocByQuoteId(prev => ({ ...prev, [p.id]: updated })) })
  }

  function openJobCard(jc: CompletedJobCard) {
    const existing = cocByJobCardId[jc.id]
    const coc = existing ?? newCOC(null, jc.id, jc.location, jc.client_name, jc.client_email, settings)
    setEditing({ coc, title: `${jc.job_number} — ${jc.title}`, onSaved: updated => setCocByJobCardId(prev => ({ ...prev, [jc.id]: updated })) })
  }

  async function handleDownload(cocId: string, e: React.MouseEvent) {
    e.stopPropagation(); setDownloadingId(cocId)
    window.open(`/api/supplier-portal/quoting/coc/${cocId}/pdf`, '_blank')
    setDownloadingId(null)
  }

  const matchProject = (p: CompletedProject) =>
    !search ||
    p.project_name.toLowerCase().includes(search.toLowerCase()) ||
    p.quote_number.toLowerCase().includes(search.toLowerCase()) ||
    (p.client && !Array.isArray(p.client) ? p.client.client_name.toLowerCase().includes(search.toLowerCase()) : false)

  const matchJobCard = (jc: CompletedJobCard) =>
    !search ||
    jc.title.toLowerCase().includes(search.toLowerCase()) ||
    jc.job_number.toLowerCase().includes(search.toLowerCase()) ||
    (jc.client_name ?? '').toLowerCase().includes(search.toLowerCase())

  const filteredProjects  = completedProjects.filter(matchProject)
  const filteredJobCards  = completedJobCards.filter(matchJobCard)

  function ProjectRow({ p }: { p: CompletedProject }) {
    const coc = cocByQuoteId[p.id]
    const client = !Array.isArray(p.client) ? p.client : null
    const hasCOC = !!coc
    return (
      <button onClick={() => openProject(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ borderTop: `1px solid ${S.border}` }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: hasCOC ? 'rgba(22,163,74,0.08)' : S.bg }}>
          {hasCOC ? <FileCheck size={15} style={{ color: S.green }} /> : <FileX size={15} style={{ color: S.muted }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: S.text }}>{p.project_name}</span>
            <span className="text-[10px] font-mono" style={{ color: S.muted }}>{p.quote_number}</span>
            {hasCOC && coc.sent_at && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>
                <CheckCircle2 size={8} className="inline mr-0.5" />Sent
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: S.muted }}>
            {client && <span>{client.client_name}</span>}
            {hasCOC && coc.coc_number && <span style={{ color: S.accent }}>ECA {coc.coc_number}</span>}
            {hasCOC && <span>{fmtDate(coc.issue_date)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasCOC ? (
            <button onClick={e => void handleDownload(coc.id, e)} disabled={downloadingId === coc.id}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              style={{ background: S.accent, color: '#fff' }}>
              {downloadingId === coc.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} PDF
            </button>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ border: `1px solid ${S.border}`, color: S.accent }}>
              <Plus size={11} /> Add COC
            </span>
          )}
        </div>
      </button>
    )
  }

  function JobCardRow({ jc }: { jc: CompletedJobCard }) {
    const coc = cocByJobCardId[jc.id]
    const hasCOC = !!coc
    return (
      <button onClick={() => openJobCard(jc)} className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ borderTop: `1px solid ${S.border}` }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: hasCOC ? 'rgba(22,163,74,0.08)' : S.bg }}>
          {hasCOC ? <FileCheck size={15} style={{ color: S.green }} /> : <FileX size={15} style={{ color: S.muted }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: S.text }}>{jc.title}</span>
            <span className="text-[10px] font-mono" style={{ color: S.muted }}>{jc.job_number}</span>
            {hasCOC && coc.sent_at && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>
                <CheckCircle2 size={8} className="inline mr-0.5" />Sent
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: S.muted }}>
            {jc.client_name && <span>{jc.client_name}</span>}
            {hasCOC && coc.coc_number && <span style={{ color: S.accent }}>ECA {coc.coc_number}</span>}
            {hasCOC && <span>{fmtDate(coc.issue_date)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasCOC ? (
            <button onClick={e => void handleDownload(coc.id, e)} disabled={downloadingId === coc.id}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              style={{ background: S.accent, color: '#fff' }}>
              {downloadingId === coc.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} PDF
            </button>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ border: `1px solid ${S.border}`, color: S.accent }}>
              <Plus size={11} /> Add COC
            </span>
          )}
        </div>
      </button>
    )
  }

  const totalWithCOC = Object.keys(cocByQuoteId).length + Object.keys(cocByJobCardId).length

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <FileCheck size={20} style={{ color: S.accent }} />
        <div>
          <h1 className="font-bold text-sm uppercase tracking-widest" style={{ color: S.muted }}>COC</h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>
            {completedProjects.length + completedJobCards.length} completed · {totalWithCOC} have COC · {(completedProjects.length + completedJobCards.length) - totalWithCOC} outstanding
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by project name, job number or client…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }} />
      </div>

      {filteredProjects.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
            Completed Projects · {filteredProjects.length}
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {filteredProjects.map(p => <ProjectRow key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {filteredJobCards.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
            Completed Job Cards · {filteredJobCards.length}
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {filteredJobCards.map(jc => <JobCardRow key={jc.id} jc={jc} />)}
          </div>
        </div>
      )}

      {filteredProjects.length === 0 && filteredJobCards.length === 0 && (
        <div className="rounded-2xl py-16 flex flex-col items-center gap-2" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <FileCheck size={32} style={{ color: S.border }} />
          <p className="text-sm" style={{ color: S.muted }}>No completed projects or job cards yet</p>
        </div>
      )}

      {editing && (
        <COCModal
          coc={editing.coc} title={editing.title}
          onClose={() => setEditing(null)}
          onSaved={updated => { editing.onSaved(updated); setEditing(prev => prev ? { ...prev, coc: updated } : null) }}
        />
      )}
    </div>
  )
}
