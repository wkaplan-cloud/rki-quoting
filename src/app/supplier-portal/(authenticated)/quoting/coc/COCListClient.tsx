'use client'
import { useState } from 'react'
import Link from 'next/link'
import { FileCheck, Download, Loader2, Search, CheckCircle2, Plus, ExternalLink } from 'lucide-react'
import type { ElecCOC } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

type COCWithQuote = ElecCOC & {
  quote: { id: string; quote_number: string; project_name: string; project_address: string | null } | null
  job_card: { id: string; job_number: string; title: string; location: string | null } | null
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  initialCOCs: COCWithQuote[]
}

export function COCListClient({ initialCOCs }: Props) {
  const [cocs] = useState(initialCOCs)
  const [search, setSearch] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Split into three categories
  const projectCOCs = cocs.filter(c => c.quote !== null)
  const jobCardCOCs = cocs.filter(c => c.job_card !== null && c.quote === null)
  const standaloneCOCs = cocs.filter(c => c.quote === null && c.job_card === null)

  const filtered = (list: COCWithQuote[]) =>
    list.filter(c =>
      !search ||
      c.coc_number.toLowerCase().includes(search.toLowerCase()) ||
      (c.quote?.project_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.installation_address ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.owner_name ?? '').toLowerCase().includes(search.toLowerCase())
    )

  async function handleDownload(coc: COCWithQuote) {
    setDownloadingId(coc.id)
    const win = window.open(`/api/supplier-portal/quoting/coc/${coc.id}/pdf`, '_blank')
    if (!win) window.location.href = `/api/supplier-portal/quoting/coc/${coc.id}/pdf`
    setDownloadingId(null)
  }

  function COCRow({ coc }: { coc: COCWithQuote }) {
    const testsPassed = [
      coc.earth_continuity, coc.insulation_resistance, coc.polarity,
      coc.earth_leakage, coc.overcurrent_protection, coc.phase_rotation,
    ].filter(r => r === 'pass').length
    const hasFail = [
      coc.earth_continuity, coc.insulation_resistance, coc.polarity,
      coc.earth_leakage, coc.overcurrent_protection, coc.phase_rotation,
    ].some(r => r === 'fail')

    return (
      <div className="flex items-center gap-4 px-4 py-3" style={{ borderTop: `1px solid ${S.border}` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: hasFail ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)' }}>
          <FileCheck size={16} style={{ color: hasFail ? S.danger : S.green }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold font-mono" style={{ color: S.text }}>{coc.coc_number}</span>
            {coc.sent_at && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>
                <CheckCircle2 size={9} className="inline mr-0.5" />Sent
              </span>
            )}
            {coc.linked_doc_number && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: S.bg, color: S.muted, border: `1px solid ${S.border}` }}>
                Doc: {coc.linked_doc_number}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs mt-0.5 flex-wrap" style={{ color: S.muted }}>
            {coc.installation_address && <span>{coc.installation_address}</span>}
            {coc.owner_name && <span>· {coc.owner_name}</span>}
            <span>· {fmtDate(coc.issue_date)}</span>
          </div>
          {coc.quote && (
            <Link href={`/supplier-portal/quoting/quotes/${coc.quote.id}`}
              className="flex items-center gap-1 text-[10px] font-medium mt-0.5 hover:underline"
              style={{ color: S.accent }}>
              <ExternalLink size={9} />
              {coc.quote.quote_number} — {coc.quote.project_name}
            </Link>
          )}
          {coc.job_card && (
            <Link href={`/supplier-portal/quoting/job-cards/${coc.job_card.id}`}
              className="flex items-center gap-1 text-[10px] font-medium mt-0.5 hover:underline"
              style={{ color: S.accent }}>
              <ExternalLink size={9} />
              {coc.job_card.job_number} — {coc.job_card.title}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: hasFail ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)', color: hasFail ? S.danger : S.green }}>
            {testsPassed}/6 tests
          </span>
          <button
            onClick={() => void handleDownload(coc)}
            disabled={downloadingId === coc.id}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            style={{ background: S.accent, color: '#fff' }}>
            {downloadingId === coc.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            PDF
          </button>
        </div>
      </div>
    )
  }

  function EmptyState({ label }: { label: string }) {
    return (
      <div className="py-12 flex flex-col items-center gap-2">
        <FileCheck size={28} style={{ color: S.border }} />
        <p className="text-sm" style={{ color: S.muted }}>{label}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck size={20} style={{ color: S.accent }} />
          <div>
            <h1 className="font-bold text-sm uppercase tracking-widest" style={{ color: S.muted }}>COC</h1>
            <p className="text-xs mt-0.5" style={{ color: S.muted }}>Certificates of Compliance · {cocs.length} total</p>
          </div>
        </div>
        <Link
          href="/supplier-portal/quoting/quotes"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
          style={{ background: S.accent, color: '#fff' }}>
          <Plus size={14} /> Add COC via Project
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by COC number, address or owner…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }}
        />
      </div>

      {/* Project COCs */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
          Linked to Projects · {filtered(projectCOCs).length}
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {filtered(projectCOCs).length === 0
            ? <EmptyState label="No project COCs yet — open a project and go to the COC tab" />
            : filtered(projectCOCs).map(coc => <COCRow key={coc.id} coc={coc} />)
          }
        </div>
      </div>

      {/* Job Card COCs */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
          Linked to Job Cards · {filtered(jobCardCOCs).length}
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {filtered(jobCardCOCs).length === 0
            ? <EmptyState label="No job card COCs yet — open a job card and go to the COC tab" />
            : filtered(jobCardCOCs).map(coc => <COCRow key={coc.id} coc={coc} />)
          }
        </div>
      </div>

      {/* Standalone COCs */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: S.muted }}>
          Standalone · {filtered(standaloneCOCs).length}
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {filtered(standaloneCOCs).length === 0
            ? <EmptyState label="No standalone COCs yet" />
            : filtered(standaloneCOCs).map(coc => <COCRow key={coc.id} coc={coc} />)
          }
        </div>
      </div>
    </div>
  )
}
