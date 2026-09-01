'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, X, ChevronRight } from 'lucide-react'
import { startTour } from './GuidedTour'

interface Props {
  hasClients: boolean
  hasSuppliers: boolean
  hasProjects: boolean
  hasSentQuote: boolean
}

const STEPS = [
  { key: 'clients',   label: 'Add your first client',    href: '/clients/new',   desc: 'Who you\'re designing for' },
  { key: 'suppliers', label: 'Add your first supplier',  href: '/suppliers/new', desc: 'Where your materials come from' },
  { key: 'projects',  label: 'Create your first project', href: '/projects/new', desc: 'Your workspace for a job' },
  { key: 'quote',     label: 'Send your first quote',    href: '/projects',      desc: 'Build line items and generate a PDF' },
]

export function OnboardingChecklist({ hasClients, hasSuppliers, hasProjects, hasSentQuote }: Props) {
  const [visible, setVisible] = useState(false)

  const completed = { clients: hasClients, suppliers: hasSuppliers, projects: hasProjects, quote: hasSentQuote }
  const completedCount = Object.values(completed).filter(Boolean).length
  const allDone = completedCount === 4

  useEffect(() => {
    if (allDone) {
      localStorage.setItem('qh-checklist-dismissed', '1')
      return
    }
    // Restores a value from browser storage, which only exists after mount — reading it during render would not match the server-rendered HTML.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!localStorage.getItem('qh-checklist-dismissed')) setVisible(true)
  }, [allDone])

  function dismiss() {
    localStorage.setItem('qh-checklist-dismissed', '1')
    setVisible(false)
  }

  if (!visible) return null

  function retakeTour() {
    localStorage.removeItem('qh-tour-seen')
    startTour()
  }

  return (
    <div data-tour="checklist" className="bg-white border border-[#D8D3C8] rounded-lg p-5">
      <div className="flex items-start justify-between mb-1">
        <h2 className="text-sm font-semibold text-[#1A1A18]">Getting started</h2>
        <button onClick={dismiss} className="text-[#8A877F] hover:text-[#1A1A18] transition-colors -mt-0.5" aria-label="Dismiss checklist">
          <X size={15} />
        </button>
      </div>

      <p className="text-xs text-[#8A877F] mb-4">{completedCount} of 4 complete</p>

      <div className="h-1 bg-[#F0EDE7] rounded-full mb-5">
        <div
          className="h-1 bg-[#9A7B4F] rounded-full transition-[width] duration-500"
          style={{ width: `${(completedCount / 4) * 100}%` }}
        />
      </div>

      <div className="space-y-1">
        {STEPS.map(({ key, label, href, desc }) => {
          const done = completed[key as keyof typeof completed]
          return done ? (
            <div key={key} className="flex items-center gap-3 px-2.5 py-2 rounded-lg">
              <CheckCircle2 size={18} className="text-[#9A7B4F] flex-shrink-0" />
              <p className="text-sm line-through text-[#B0AC9F]">{label}</p>
            </div>
          ) : (
            <Link
              key={key}
              href={href}
              className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-[#F5F2EC] group transition-colors"
            >
              <Circle size={18} className="text-[#C4B99A] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A18]">{label}</p>
                <p className="text-xs text-[#8A877F] mt-0.5">{desc}</p>
              </div>
              <ChevronRight size={14} className="text-[#C4B99A] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          )
        })}
      </div>

      <button
        onClick={retakeTour}
        className="mt-4 text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors"
      >
        Retake the tour →
      </button>
    </div>
  )
}
