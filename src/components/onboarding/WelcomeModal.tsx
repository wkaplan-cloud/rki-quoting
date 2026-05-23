'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ArrowRight, Users, FolderOpen, FileText } from 'lucide-react'
import { startTour } from './GuidedTour'

const STEPS = [
  {
    icon: Users,
    title: 'Add your clients & suppliers',
    desc: 'Build your contact book so you can pull them into quotes instantly.',
  },
  {
    icon: FolderOpen,
    title: 'Create a project',
    desc: 'Each project holds your quotes, line items, and pipeline stages.',
  },
  {
    icon: FileText,
    title: 'Build and send your quote',
    desc: 'Add line items, apply markup, generate a PDF, and send.',
  },
]

export function WelcomeModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('qh-welcome-seen')) setShow(true)
  }, [])

  function dismiss() {
    localStorage.setItem('qh-welcome-seen', '1')
    setShow(false)
    setTimeout(startTour, 300)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="QuotingHub" width={64} height={64} className="w-16 h-auto object-contain" />
        </div>

        <h1 className="font-serif text-2xl text-[#1A1A18] text-center mb-2">Welcome to QuotingHub</h1>
        <p className="text-sm text-[#8A877F] text-center mb-8 leading-relaxed">
          Here's how the whole system works — three steps and you're quoting.
        </p>

        <div className="space-y-6 mb-8">
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-[#1A1A18] text-white flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">{title}</p>
                <p className="text-xs text-[#8A877F] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={dismiss}
          className="w-full py-3 bg-[#1A1A18] text-white text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors flex items-center justify-center gap-2"
        >
          Get started <ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}
