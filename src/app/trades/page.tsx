import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Check, ArrowRight, ChevronRight, HardHat, Wrench, Zap } from 'lucide-react'
import { NavMobile } from '../_components/NavMobile'

export const metadata: Metadata = {
  title: 'QuotingHub for Trades — Quoting Software for South African Contractors',
  description: 'Professional quoting, invoicing, job cards, and business management for South African electricians, plumbers, and contractors. Built for the way tradespeople actually work.',
  alternates: { canonical: 'https://quotinghub.co.za/trades' },
  openGraph: {
    title: 'QuotingHub for Trades | Quoting Software for South African Contractors',
    description: 'Quotes, invoices, job cards, and COCs — built for South African electricians and tradespeople.',
    url: 'https://quotinghub.co.za/trades',
    images: [{ url: 'https://quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
  },
}

const TRADES = [
  {
    id: 'electrician',
    label: 'Electricians',
    icon: Zap,
    status: 'live' as const,
    headline: 'Quote, invoice, COC, job cards, staff management.',
    bullets: [
      'Professional quotes with itemised labour & materials',
      'Progress claims and certificates',
      'Digital COC — SANS 10142-1 compliant',
      'Job cards with GPS clock-in/out',
      'Staff timesheets and notifications',
    ],
    href: '/trades/electrician',
  },
  {
    id: 'plumber',
    label: 'Plumbers',
    icon: Wrench,
    status: 'soon' as const,
    headline: 'The same powerful system, built for plumbing businesses.',
    bullets: [
      'Itemised quotes with labour and materials',
      'Job cards and field reporting',
      'Compliance certificates',
      'Staff and subcontractor management',
    ],
    href: null,
  },
  {
    id: 'contractor',
    label: 'General Contractors',
    icon: HardHat,
    status: 'soon' as const,
    headline: 'Run your contracting business from quote to completion.',
    bullets: [
      'Multi-trade project quoting',
      'Claims and variation orders',
      'Subcontractor management',
      'Job cards and site reporting',
    ],
    href: null,
  },
]

export default function TradesHubPage() {
  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 sm:h-32 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="QuotingHub" width={220} height={220} className="h-16 sm:h-28 w-auto max-w-[160px] sm:max-w-[220px] object-contain" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">For Designers</Link>
            <Link href="/supplier-portal/login" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Log in</Link>
            <Link href="/supplier-portal/register?type=trades" className="hidden sm:inline-flex px-4 py-2 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Get started free
            </Link>
            <NavMobile />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#9A7B4F]/10 border border-[#9A7B4F]/25 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C4A46B]" />
            <span className="text-xs font-medium text-[#9A7B4F] tracking-wide">Built for South African tradespeople</span>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-[#1A1A18] leading-[1.05] tracking-tight mb-5">
            QuotingHub<br />
            <em className="text-[#C4A46B] not-italic">for Trades.</em>
          </h1>
          <p className="text-xl text-[#8A877F] max-w-2xl mx-auto leading-relaxed mb-4">
            The same professional quoting and business management system — now built for electricians, plumbers, and contractors.
          </p>
          <p className="text-base text-[#8A877F] max-w-xl mx-auto leading-relaxed mb-10">
            Quotes, invoices, job cards, compliance certificates, GPS staff tracking, and more. Everything you need to run a professional trade business in South Africa.
          </p>
        </div>
      </section>

      {/* Trade cards */}
      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TRADES.map(trade => {
              const Icon = trade.icon
              const isLive = trade.status === 'live'
              return (
                <div key={trade.id}
                  className={`rounded-2xl border p-8 flex flex-col ${isLive ? 'border-[#1A1A18] bg-[#1A1A18] relative overflow-hidden' : 'border-[#D8D3C8] bg-white'}`}>
                  {isLive && (
                    <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#C4A46B]/10 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  )}
                  <div className="relative">
                    <div className="flex items-start justify-between mb-5">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isLive ? 'bg-[#C4A46B]/20' : 'bg-[#9A7B4F]/10'}`}>
                        <Icon size={20} className={isLive ? 'text-[#C4A46B]' : 'text-[#9A7B4F]'} />
                      </div>
                      {isLive ? (
                        <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">
                          Live now
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#9A7B4F]/10 text-[#9A7B4F] border border-[#9A7B4F]/20">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <h2 className={`font-serif text-2xl mb-2 ${isLive ? 'text-white' : 'text-[#1A1A18]'}`}>{trade.label}</h2>
                    <p className={`text-sm leading-relaxed mb-6 ${isLive ? 'text-white/60' : 'text-[#8A877F]'}`}>{trade.headline}</p>
                    <ul className="space-y-2.5 mb-8">
                      {trade.bullets.map(b => (
                        <li key={b} className={`flex items-start gap-2.5 text-sm ${isLive ? 'text-white/75' : 'text-[#2C2C2A]'}`}>
                          <Check size={13} className={`flex-shrink-0 mt-0.5 ${isLive ? 'text-[#C4A46B]' : 'text-[#C4A46B]'}`} />
                          {b}
                        </li>
                      ))}
                    </ul>
                    {trade.href ? (
                      <Link href={trade.href}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#9A7B4F] text-white text-sm font-medium rounded-lg hover:bg-[#C4A46B] transition-colors">
                        Learn more <ArrowRight size={14} />
                      </Link>
                    ) : (
                      <p className={`text-xs ${isLive ? 'text-white/30' : 'text-[#C4BFB5]'}`}>Notify me when available →</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Why QuotingHub for trades */}
      <section className="py-20 px-6 bg-white border-y border-[#D8D3C8]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">Why QuotingHub</p>
          <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18] tracking-tight mb-5">
            Built for how trade businesses actually run.
          </h2>
          <p className="text-[#8A877F] text-lg max-w-2xl mx-auto leading-relaxed mb-14">
            Generic quoting tools aren't built for trade work. QuotingHub understands progress claims, compliance certificates, job cards, and the realities of running a field-based business in South Africa.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              {
                label: 'vs Excel & WhatsApp',
                desc: 'No more quoting from a spreadsheet and chasing payments on WhatsApp. Send professional PDFs, track job status, and get paid faster.',
              },
              {
                label: 'vs Generic invoicing apps',
                desc: 'Generic apps don\'t understand progress claims, COCs, variation orders, or job cards. QuotingHub is built around the trade workflow.',
              },
              {
                label: 'vs Paper job cards',
                desc: 'Digital job cards with GPS clock-in, site photos, client signature, and instant PDF delivery. No lost paperwork, no disputes.',
              },
            ].map(({ label, desc }) => (
              <div key={label} className="p-6 rounded-xl border border-[#EDE9E1]">
                <p className="text-xs font-semibold text-[#9A7B4F] uppercase tracking-widest mb-3">{label}</p>
                <p className="text-sm text-[#8A877F] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight mb-5">
            Ready to run a more professional business?
          </h2>
          <p className="text-[#8A877F] text-lg mb-10">
            Start with a free trial — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/supplier-portal/register?type=trades"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#1A1A18] text-[#F5F2EC] font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Start free trial <ChevronRight size={16} />
            </Link>
            <Link href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-[#D8D3C8] text-[#2C2C2A] font-medium rounded-lg hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors bg-white">
              For interior designers
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D8D3C8] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/">
            <Image src="/logo.png" alt="QuotingHub" width={80} height={80} className="h-16 w-auto object-contain" />
          </Link>
          <p className="text-xs text-[#8A877F]">© {new Date().getFullYear()} QuotingHub · quotinghub.co.za</p>
          <div className="flex items-center gap-5">
            <Link href="/" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">For Designers</Link>
            <Link href="/trades/electrician" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">For Electricians</Link>
            <Link href="/terms" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Terms</Link>
            <Link href="/privacy" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
