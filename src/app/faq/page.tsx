'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is QuotingHub?',
        a: 'QuotingHub is a quoting and project management platform built specifically for interior designers. Create professional quotes, invoices, and purchase orders — all in one place.',
      },
      {
        q: 'Do I need to install anything?',
        a: 'No. QuotingHub is entirely browser-based. Access it from any device with an internet connection — no software installation required.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes. New accounts get a free trial period to explore the platform fully before committing to a subscription. No credit card is required to start.',
      },
    ],
  },
  {
    category: 'Billing',
    items: [
      {
        q: 'Can I cancel at any time?',
        a: 'Yes. Cancel your subscription at any time from within the platform. Cancellation takes effect at the end of your current billing period and you retain access until then.',
      },
      {
        q: 'What happens to my data if I cancel?',
        a: 'Your data is retained for 24 months after cancellation in case you wish to return. After that period it is permanently deleted. You can request earlier deletion by contacting us.',
      },
    ],
  },
  {
    category: 'Security & Privacy',
    items: [
      {
        q: 'Is my data secure?',
        a: 'Yes. All data is encrypted in transit and at rest. Your studio\'s data is isolated from other studios at the database level. We follow industry best practices for security.',
      },
      {
        q: 'Is QuotingHub POPIA compliant?',
        a: 'Yes. We take our obligations under the Protection of Personal Information Act (POPIA) seriously. You have the right to access, correct, or request deletion of your personal data at any time. See our Privacy Policy for full details.',
      },
    ],
  },
  {
    category: 'Support',
    items: [
      {
        q: 'How do I get help?',
        a: 'Use the contact form on our website and we\'ll get back to you within one business day.',
      },
    ],
  },
]

export default function FAQPage() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/logo.png" alt="QuotingHub" className="h-10 w-auto object-contain" /></Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Log in</Link>
            <Link href="/signup" className="px-4 py-2 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#2C2C2A] transition-colors font-medium">Get Started</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <p className="text-xs text-[#9A7B4F] uppercase tracking-widest font-semibold mb-3">Support</p>
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

        <div className="mt-12 pt-8 border-t border-[#D8D3C8] flex flex-wrap gap-6 text-xs text-[#8A877F]">
          <Link href="/terms" className="hover:text-[#9A7B4F] transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-[#9A7B4F] transition-colors">Privacy Policy</Link>
          <Link href="/pricing" className="hover:text-[#9A7B4F] transition-colors">Pricing</Link>
          <Link href="/" className="hover:text-[#9A7B4F] transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
