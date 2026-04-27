'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { faqs } from './faq-data'

export function FAQContent() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 pt-10 sm:pt-16 pb-24">
        <h1 className="font-serif text-4xl text-[#1A1A18] tracking-tight mb-3">Frequently Asked Questions</h1>
        <p className="text-sm text-[#8A877F] mb-12 leading-relaxed">
          Can&apos;t find the answer? <Link href="/#contact" className="text-[#9A7B4F] hover:underline">Get in touch</Link>.
        </p>

        <div className="space-y-12">
          {faqs.map(cat => (
            <div key={cat.category}>
              <h2 className="text-xs font-semibold text-[#9A7B4F] uppercase tracking-widest mb-4">{cat.category}</h2>
              <div className="divide-y divide-[#EDE9E1] border-t border-[#EDE9E1]">
                {cat.items.map(item => {
                  const key = `${cat.category}-${item.q}`
                  const isOpen = open === key
                  return (
                    <div key={item.q}>
                      <button
                        onClick={() => setOpen(isOpen ? null : key)}
                        className="w-full text-left py-4 flex items-start justify-between gap-4 cursor-pointer"
                      >
                        <span className="text-sm font-medium text-[#1A1A18]">{item.q}</span>
                        <ChevronDown size={16} className={`flex-shrink-0 mt-0.5 text-[#8A877F] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <p className="text-sm text-[#4A4A47] leading-relaxed pb-4">{item.a}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-white border border-[#D8D3C8] rounded-2xl p-8 text-center">
          <h3 className="font-serif text-xl text-[#1A1A18] mb-2">Still have questions?</h3>
          <p className="text-sm text-[#8A877F] mb-5">Our team is happy to help.</p>
          <Link href="/#contact" className="inline-block px-6 py-2.5 bg-[#1A1A18] text-white text-sm font-medium rounded-lg hover:bg-[#2C2C2A] transition-colors">
            Contact Us
          </Link>
        </div>
      </div>
    </PublicLayout>
  )
}
