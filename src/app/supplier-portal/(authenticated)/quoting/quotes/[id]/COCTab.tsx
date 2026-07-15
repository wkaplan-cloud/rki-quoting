'use client'
import { useState } from 'react'
import { FileCheck, FileX, ChevronRight, Download, CheckCircle2, Camera } from 'lucide-react'
import type { ElecCOC } from '@/lib/elec-types'
import { COCModal, newCOC } from '../../coc/COCModal'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

interface Props {
  quoteId: string
  initialCOC: ElecCOC | null
  projectAddress?: string | null
  clientName?: string | null
  clientEmail?: string | null
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Same full SANS 10142-1 COC as the main COC section and job-card COC tab — shared COCModal.
export function COCTab({ quoteId, initialCOC, projectAddress, clientName, clientEmail }: Props) {
  const [coc, setCOC] = useState<ElecCOC | null>(initialCOC)
  const [open, setOpen] = useState(false)

  const hasCOC = !!coc
  const editingCOC = coc ?? newCOC(quoteId, null, projectAddress ?? null, clientName ?? null, clientEmail ?? null, null)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: hasCOC ? 'rgba(22,163,74,0.08)' : S.bg }}>
            {hasCOC ? <FileCheck size={18} style={{ color: S.green }} /> : <FileX size={18} style={{ color: S.muted }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: S.text }}>
              {hasCOC ? (coc.coc_number ? `ECA ${coc.coc_number}` : 'Certificate of Compliance') : 'No COC yet'}
            </p>
            <div className="flex items-center gap-3 text-xs mt-0.5 flex-wrap" style={{ color: S.muted }}>
              {hasCOC ? (
                <>
                  <span>Issued {fmtDate(coc.issue_date)}</span>
                  {(coc.photos?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1"><Camera size={10} />{coc.photos!.length} photo{coc.photos!.length !== 1 ? 's' : ''}</span>
                  )}
                  {coc.sent_at && (
                    <span className="flex items-center gap-0.5 font-semibold" style={{ color: S.green }}>
                      <CheckCircle2 size={10} />Sent
                    </span>
                  )}
                </>
              ) : (
                <span>Create the SANS 10142-1 Certificate of Compliance for this project</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasCOC && (
              <button onClick={() => window.open(`/api/supplier-portal/quoting/coc/${coc.id}/pdf`, '_blank')}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: S.bg, color: S.text, border: `1px solid ${S.border}` }}>
                <Download size={12} /> PDF
              </button>
            )}
            <button onClick={() => setOpen(true)}
              className="flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: S.accent }}>
              {hasCOC ? 'Open COC' : 'Create COC'} <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <COCModal
          coc={editingCOC}
          title="Project"
          onClose={() => setOpen(false)}
          onSaved={updated => setCOC(updated)}
        />
      )}
    </div>
  )
}
