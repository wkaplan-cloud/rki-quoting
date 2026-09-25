import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  Check, ArrowRight, ChevronRight,
  LayoutGrid, Package, Layers, Router, FileCheck, Repeat, ClipboardList, Upload,
} from 'lucide-react'
import { NavMobile } from '../../_components/NavMobile'
import { NavDropdown } from '../../_components/NavDropdown'
import { INSTALLER_PLANS } from '@/lib/plan-features'
import { PublicFooter } from '@/components/layout/PublicFooter'

export const metadata: Metadata = {
  title: 'Quoting Software for Home Automation, AV & CCTV Installers | QuotingHub',
  description: 'Room-by-room quotes with kits and price-list import, good/better/best options, device registers, handover packs and support contracts that invoice themselves. Built for South African installers. 30-day free trial.',
  alternates: { canonical: 'https://quotinghub.co.za/trades/installer' },
  openGraph: {
    title: 'Quoting Software for Home Automation, AV & CCTV Installers | QuotingHub',
    description: 'Quote room by room, hand over every device, and bill support plans automatically — the business system for South African installers.',
    url: 'https://quotinghub.co.za/trades/installer',
    images: [{ url: 'https://quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quoting Software for Home Automation, AV & CCTV Installers | QuotingHub',
    description: 'Quote room by room, hand over every device, and bill support plans automatically — the business system for South African installers.',
    images: ['https://quotinghub.co.za/og-image.png'],
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QuotingHub for Installers',
  url: 'https://quotinghub.co.za/trades/installer',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  description: 'Quoting, device registers, handover packs and support contracts for home automation, AV, CCTV and networking installers in South Africa.',
  areaServed: { '@type': 'Country', name: 'South Africa' },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

const SIGNUP = '/supplier-portal/register?type=installer'

const FEATURES = [
  {
    icon: LayoutGrid,
    title: 'Room-by-room quotes',
    desc: 'Quote the lounge, the cinema, the driveway cameras — each room its own section, with cost, markup and margin on every line.',
  },
  {
    icon: Upload,
    title: 'Import your price lists',
    desc: 'Upload your distributor’s CSV or Excel price list. Match the columns once, set a markup, and next month’s list updates your prices instead of duplicating them.',
  },
  {
    icon: Package,
    title: 'Kits in one click',
    desc: 'Build your standard packages once — a 4-camera CCTV system, a cinema room, a Control4 starter — and drop them into any quote.',
  },
  {
    icon: Layers,
    title: 'Good, better, best',
    desc: 'Offer alternatives and optional extras. The client picks online, the total follows, and a deposit is raised the moment they accept.',
  },
  {
    icon: ClipboardList,
    title: 'Jobs, schedule & programming hours',
    desc: 'Job cards, a team calendar and GPS clock-in on your techs’ phones — with programming time kept apart from install time.',
  },
  {
    icon: Router,
    title: 'A device register for every site',
    desc: 'Serial, MAC, IP, firmware and warranty for every device, scanned from the barcode on site. Logins stored encrypted.',
  },
  {
    icon: FileCheck,
    title: 'Handover packs',
    desc: 'Every device by room, warranties, support details and a sign-off block — one PDF, emailed to the client when you hand over.',
  },
  {
    icon: Repeat,
    title: 'Support contracts that bill themselves',
    desc: 'Monthly or annual plans that invoice automatically, remind you before renewal, and show which clients cost more than they pay.',
  },
]

const FAQS = [
  {
    q: 'Can I bring in my distributor price lists?',
    a: 'Yes. Upload the CSV or Excel file you get from your distributor, match the columns, and set a markup. Items keep their SKU and brand, and re-importing next month’s list updates prices rather than creating duplicates.',
  },
  {
    q: 'How do support contracts work?',
    a: 'Put a client on a monthly or annual plan with a fee, the visits it includes, and your rate for anything outside it. QuotingHub raises the invoice each period, can email it and push it to Sage, reminds you 30 days before renewal, and marks each callout on a job card as covered or chargeable.',
  },
  {
    q: 'Does it work with Sage?',
    a: 'Yes. Claims and support-plan invoices push to Sage Business Cloud Accounting, so your books stay in Sage while quoting, jobs and support run in QuotingHub.',
  },
  {
    q: 'Can my technicians use it on their phones?',
    a: 'Yes. Techs clock in with GPS, work job cards, register devices by scanning serial and MAC barcodes, and capture client signatures — all from their phone.',
  },
  {
    q: 'Which plan do I need?',
    a: 'Installer covers quoting, projects, job cards, devices and handover packs. Installer Pro adds support contracts and automatic recurring invoicing. Your 30-day trial includes everything, so you can decide once you’ve used it.',
  },
  {
    q: 'Is there a long-term contract?',
    a: 'No. Month-to-month, cancel any time. Start with a 30-day free trial — no credit card required.',
  },
]

/** A quote, drawn the way it looks in the product: rooms, lines and a good/better/best choice. */
function QuoteMock() {
  const row = (d: string, q: string, t: string) => (
    <div key={d} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className="text-[#2C2C2A] truncate">{d}</span>
      <span className="text-[#8A877F] tabular-nums shrink-0">{q}</span>
      <span className="text-[#1A1A18] font-medium tabular-nums shrink-0 w-24 text-right">{t}</span>
    </div>
  )
  return (
    <div className="w-full max-w-[440px] rounded-2xl bg-white border border-[#D8D3C8] shadow-[0_24px_60px_-20px_rgba(26,26,24,0.25)] p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[#8A877F]">Quote HAV-QU-2026-004</p>
          <p className="font-serif text-lg text-[#1A1A18]">Parkhurst — Cinema Room</p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#1F5C45]/10 text-[#1F5C45]">Sent</span>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1F5C45] mb-1">Cinema package — choose one</p>
      <div className="rounded-xl border border-[#EDE9E1] divide-y divide-[#EDE9E1] mb-4">
        {[
          { t: 'Good — 5.1 with a 65" OLED', p: 'R 90 214', on: false },
          { t: 'Better — laser projector, 120" screen', p: 'R 137 885', on: true },
          { t: 'Best — 7.2 with Control4', p: 'R 172 604', on: false },
        ].map(o => (
          <div key={o.t} className={`flex items-center gap-2.5 px-3 py-2 text-[13px] ${o.on ? 'bg-[#1F5C45]/[0.06]' : ''}`}>
            <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${o.on ? 'border-[#1F5C45] bg-[#1F5C45]' : 'border-[#D8D3C8]'}`} />
            <span className="flex-1 text-[#2C2C2A] truncate">{o.t}</span>
            <span className={`tabular-nums ${o.on ? 'text-[#1F5C45] font-semibold' : 'text-[#8A877F]'}`}>{o.p}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A877F] mb-1">Labour & programming</p>
      {row('Installation technician', '12 hr', 'R 7 812')}
      {row('Control4 programming', '3 hr', 'R 2 640')}

      <div className="mt-4 pt-4 border-t border-[#EDE9E1] flex items-end justify-between">
        <div>
          <p className="text-[11px] text-[#8A877F]">Deposit on acceptance (60%)</p>
          <p className="text-[13px] font-medium text-[#2C2C2A] tabular-nums">R 102 353</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-[#8A877F]">Total incl. VAT</p>
          <p className="text-xl font-bold text-[#1F5C45] tabular-nums">R 170 588</p>
        </div>
      </div>
    </div>
  )
}

export default function InstallerLandingPage() {
  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 sm:h-32 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="QuotingHub" width={220} height={220} className="h-16 sm:h-28 w-auto max-w-[160px] sm:max-w-[220px] object-contain" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <NavDropdown />
            <Link href="#pricing" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Pricing</Link>
            <Link href="/supplier-portal/login" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Log in</Link>
            <Link href={SIGNUP}
              className="hidden sm:inline-flex px-4 py-2 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#1F5C45] transition-colors">
              Start free trial
            </Link>
            <NavMobile trades />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-[#1F5C45]/10 border border-[#1F5C45]/25 rounded-full px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6FAF8F]" />
                <span className="text-xs font-medium text-[#1F5C45] tracking-wide">Home automation · AV · CCTV · Networking</span>
              </div>
              <h1 className="font-serif text-5xl md:text-6xl text-[#1A1A18] leading-[1.05] tracking-tight mb-5">
                Quote it. Install it.<br />
                Hand it over.<br />
                <em className="text-[#1F5C45] not-italic">Keep the support revenue.</em>
              </h1>
              <p className="text-xl text-[#8A877F] leading-relaxed mb-4 max-w-2xl">
                The business system for South African installers — room-by-room quotes with kits and options, a register of every device you fit, and support contracts that invoice themselves.
              </p>
              <p className="text-base text-[#8A877F] leading-relaxed mb-10 max-w-xl">
                Keep Sage for your books. Everything before the invoice — the quote, the install, the handover and the support plan — runs in QuotingHub.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href={SIGNUP}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#1F5C45] transition-colors">
                  Start your free trial <ArrowRight size={15} />
                </Link>
                <Link href="#pricing"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[#D8D3C8] text-[#2C2C2A] text-sm font-medium rounded-lg hover:border-[#1F5C45] hover:text-[#1F5C45] transition-colors bg-white">
                  See pricing
                </Link>
              </div>
              <p className="text-sm text-[#C4BFB5] mt-4">30-day free trial · plans from R2,999/month · Cancel any time</p>
            </div>
            <div className="flex-shrink-0 w-full lg:w-[440px] flex items-center justify-center">
              <QuoteMock />
            </div>
          </div>
        </div>
      </section>

      {/* Proof bar */}
      <div className="border-y border-[#D8D3C8] bg-white py-5 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {['Distributor price-list import', 'Kits & good/better/best', 'Barcode device register', 'Automatic support invoicing', '30-day free trial'].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-[#8A877F]">
              <Check size={13} className="text-[#6FAF8F] flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="py-24 px-6 bg-white border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-[#1F5C45] uppercase tracking-widest mb-3">Everything you need</p>
            <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight">From the first quote to years of support.</h2>
            <p className="text-[#8A877F] text-lg mt-4 max-w-xl mx-auto leading-relaxed">
              Built around how installers actually work — rooms, kits, devices and the support that follows.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group p-6 rounded-xl border border-[#EDE9E1] hover:border-[#6FAF8F]/50 hover:bg-[#F5F2EC] transition-colors duration-200">
                <div className="w-10 h-10 rounded-lg bg-[#1F5C45]/10 flex items-center justify-center mb-4 group-hover:bg-[#1F5C45]/15 transition-colors">
                  <Icon size={18} className="text-[#1F5C45]" />
                </div>
                <h3 className="font-medium text-[#1A1A18] mb-2 text-sm leading-snug">{title}</h3>
                <p className="text-sm text-[#8A877F] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support contracts callout */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-[#10261D] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#6FAF8F]/10 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
            <div className="relative p-10 md:p-16 flex flex-col md:flex-row items-start md:items-center gap-10">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-[#6FAF8F]/15 border border-[#6FAF8F]/25 rounded-full px-4 py-1.5 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6FAF8F]" />
                  <span className="text-xs font-medium text-[#8FCBAE] tracking-wide uppercase">Installer Pro</span>
                </div>
                <h2 className="font-serif text-3xl md:text-4xl text-white leading-tight tracking-tight mb-4">
                  Support plans that<br />bill themselves.
                </h2>
                <p className="text-white/60 text-lg leading-relaxed mb-6 max-w-lg">
                  Most installers sell support and then lose track of it. Put each client on a monthly or annual plan and QuotingHub does the rest.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Invoices raised every period — emailed and pushed to Sage if you want',
                    'Callouts marked covered or chargeable on the job card',
                    'Visits used against visits included, per contract year',
                    'A reminder 30 days before every renewal',
                    'See which plans pay their way — and which cost you',
                  ].map(i => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white/75">
                      <Check size={14} className="text-[#6FAF8F] flex-shrink-0 mt-0.5" />
                      {i}
                    </li>
                  ))}
                </ul>
                <Link href={SIGNUP}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#1F5C45] text-white text-sm font-medium rounded-lg hover:bg-[#2A7558] transition-colors">
                  Start free trial <ArrowRight size={14} />
                </Link>
              </div>
              <div className="hidden md:flex flex-col items-center justify-center w-48 flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-[#6FAF8F]/15 flex items-center justify-center mb-4">
                  <Repeat size={36} className="text-[#6FAF8F]" />
                </div>
                <p className="text-white/30 text-xs text-center leading-relaxed">Recurring revenue, tracked</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-white border-y border-[#D8D3C8] overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-[#1F5C45] uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18] tracking-tight mb-2">Two plans. Everything included in your trial.</h2>
            <p className="text-[#8A877F] text-base">30-day free trial · No credit card required · Up to 20 staff on every plan</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {INSTALLER_PLANS.map(plan => {
              const isHighlighted = plan.id === 'installer_pro'
              return (
                <div key={plan.id}
                  className={`rounded-2xl border p-8 flex flex-col relative ${isHighlighted ? 'border-[#10261D] bg-[#10261D]' : 'border-[#D8D3C8] bg-white'}`}>
                  {isHighlighted && (
                    <>
                      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#6FAF8F]/10 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-[#6FAF8F] text-[#10261D]">
                        Recommended
                      </span>
                    </>
                  )}
                  <div className="relative flex flex-col flex-1">
                    <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${isHighlighted ? 'text-[#8FCBAE]' : 'text-[#1F5C45]'}`}>{plan.label}</p>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className={`text-3xl font-bold ${isHighlighted ? 'text-white' : 'text-[#1A1A18]'}`}>R{plan.price.toLocaleString('en-ZA')}</span>
                      <span className={`text-sm ${isHighlighted ? 'text-white/50' : 'text-[#8A877F]'}`}>/mo</span>
                    </div>
                    <p className={`text-xs mb-6 leading-relaxed ${isHighlighted ? 'text-white/50' : 'text-[#8A877F]'}`}>{plan.tagline}</p>
                    <ul className="space-y-2.5 mb-8">
                      {plan.features.map(f => (
                        <li key={f} className={`flex items-start gap-2.5 text-sm ${isHighlighted ? 'text-white/75' : 'text-[#2C2C2A]'}`}>
                          <Check size={13} className="text-[#6FAF8F] flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href={SIGNUP}
                      className={`mt-auto inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${isHighlighted ? 'bg-[#1F5C45] text-white hover:bg-[#2A7558]' : 'bg-[#1A1A18] text-[#F5F2EC] hover:bg-[#1F5C45]'}`}>
                      Start free trial <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-center text-xs text-[#C4BFB5] mt-6">
            21+ staff: R40/month per extra staff member · Setup & training R2,500 once-off · Month-to-month, cancel any time
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-[#1F5C45] uppercase tracking-widest mb-3">Questions</p>
            <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18] tracking-tight">Frequently asked</h2>
          </div>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="p-6 rounded-xl border border-[#EDE9E1] bg-white">
                <p className="font-medium text-[#1A1A18] mb-2 text-sm">{q}</p>
                <p className="text-sm text-[#8A877F] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-white border-t border-[#D8D3C8]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight mb-5">
            Ready to run every install — and every support plan — properly?
          </h2>
          <p className="text-[#8A877F] text-lg mb-10">
            Start your free trial today. No credit card, no commitment.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={SIGNUP}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#1A1A18] text-[#F5F2EC] font-medium rounded-lg hover:bg-[#1F5C45] transition-colors">
              Start free trial <ChevronRight size={16} />
            </Link>
            <Link href="/trades"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-[#D8D3C8] text-[#2C2C2A] font-medium rounded-lg hover:border-[#1F5C45] hover:text-[#1F5C45] transition-colors bg-white">
              Other trades
            </Link>
          </div>
          <p className="text-sm text-[#C4BFB5] mt-5">30-day free trial · No credit card required · Cancel any time</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
