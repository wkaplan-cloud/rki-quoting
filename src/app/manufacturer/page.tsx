import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  Check, ArrowRight, ChevronRight,
  Hammer, FileText, Receipt, Users, BookOpen, Package,
} from 'lucide-react'
import { NavMobile } from '../_components/NavMobile'
import { PublicFooter } from '@/components/layout/PublicFooter'

export const metadata: Metadata = {
  title: 'QuotingHub for Manufacturers — Quoting Software for South African Furniture Makers',
  description: 'Professional quoting, invoicing, and client management for South African furniture manufacturers and wood workshops. Quote custom jobs, manage your price book, and invoice from one system.',
  alternates: { canonical: 'https://quotinghub.co.za/manufacturer' },
  openGraph: {
    title: 'QuotingHub for Manufacturers | Furniture & Wood Workshop Software',
    description: 'Quote custom manufacturing jobs, manage clients, and invoice professionally — built for South African furniture makers and wood workshops.',
    url: 'https://quotinghub.co.za/manufacturer',
    images: [{ url: 'https://quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
  },
}

const FEATURES = [
  {
    icon: FileText,
    title: 'Quote custom jobs in minutes',
    desc: 'Build detailed manufacturing quotes with itemised materials, labour, and finishes. Send a branded PDF to your client — no more WhatsApp voice notes or Excel files.',
  },
  {
    icon: BookOpen,
    title: 'Price book — set your rates once',
    desc: 'Build your catalogue of standard items, materials, and labour rates. Every new quote pulls from your price book — consistent pricing, faster quoting.',
  },
  {
    icon: Receipt,
    title: 'Invoice directly from your quote',
    desc: 'Convert an accepted quote to an invoice in one click. Track what\'s been paid and what\'s outstanding — all in one place.',
  },
  {
    icon: Users,
    title: 'Manage all your clients',
    desc: 'Keep your full client list — interior designers, developers, private clients — with project history attached. Never lose track of a job.',
  },
  {
    icon: Package,
    title: 'Receive briefs from designers',
    desc: 'Interior designers on QuotingHub can send you manufacturing requests directly. Respond with a quote without a single email.',
  },
  {
    icon: Hammer,
    title: 'Built for custom manufacturing',
    desc: 'Not a generic invoicing tool. QuotingHub understands custom job quoting — variable quantities, multiple materials, finishing options, and client sign-off.',
  },
]

const INCLUDE_ITEMS = [
  'Unlimited quotes and invoices',
  'Full client management',
  'Custom price book',
  'Branded PDF documents',
  'Receive requests from QuotingHub designers',
  'Job history per client',
  '30-day free trial, no credit card',
]

export default function ManufacturerLandingPage() {
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
            <Link href="/trades" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">For Trades</Link>
            <Link href="#cta" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Pricing</Link>
            <Link href="/supplier-portal/login" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Log in</Link>
            <Link href="/supplier-portal/register?type=manufacturer_quoting" className="hidden sm:inline-flex px-4 py-2 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Get started free
            </Link>
            <NavMobile manufacturer />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#9A7B4F]/10 border border-[#9A7B4F]/25 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C4A46B]" />
            <span className="text-xs font-medium text-[#9A7B4F] tracking-wide">Built for South African furniture manufacturers</span>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-[#1A1A18] leading-[1.05] tracking-tight mb-5">
            QuotingHub<br />
            <em className="text-[#C4A46B] not-italic">for Manufacturers.</em>
          </h1>
          <p className="text-xl text-[#8A877F] max-w-2xl mx-auto leading-relaxed mb-10">
            Quote custom jobs, manage your clients, and invoice professionally — built for wood workshops, furniture makers, and custom manufacturers in South Africa.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/supplier-portal/register?type=manufacturer_quoting"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors"
            >
              Start free trial <ArrowRight size={15} />
            </Link>
            <Link
              href="/supplier-portal/login"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[#D8D3C8] text-[#2C2C2A] text-sm font-medium rounded-lg hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors bg-white"
            >
              Log in to your account
            </Link>
          </div>
          <p className="text-sm text-[#C4BFB5] mt-4">30-day free trial · No credit card required</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-white border-y border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">What&apos;s included</p>
            <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18] tracking-tight">
              Everything your workshop needs to quote and invoice professionally.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group p-6 rounded-xl border border-[#EDE9E1] hover:border-[#C4A46B]/40 hover:bg-[#F5F2EC] transition-all duration-200">
                <div className="w-10 h-10 rounded-lg bg-[#9A7B4F]/10 flex items-center justify-center mb-4 group-hover:bg-[#9A7B4F]/20 transition-colors">
                  <Icon size={18} className="text-[#9A7B4F]" />
                </div>
                <h3 className="font-medium text-[#1A1A18] mb-2 text-sm">{title}</h3>
                <p className="text-sm text-[#8A877F] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included callout */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-[#1A1A18] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#C4A46B]/8 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
            <div className="relative p-10 md:p-16 flex flex-col md:flex-row items-start md:items-center gap-10">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-[#C4A46B]/15 border border-[#C4A46B]/25 rounded-full px-4 py-1.5 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C4A46B]" />
                  <span className="text-xs font-medium text-[#C4A46B] tracking-wide uppercase">Everything in one system</span>
                </div>
                <h2 className="font-serif text-3xl md:text-4xl text-white leading-tight tracking-tight mb-4">
                  Stop quoting on WhatsApp.<br />Start winning more jobs.
                </h2>
                <p className="text-white/60 text-lg leading-relaxed mb-8 max-w-lg">
                  Every custom job deserves a professional quote. QuotingHub gives your workshop the same tools used by top design studios — so you look the part and get paid faster.
                </p>
                <ul className="space-y-3">
                  {INCLUDE_ITEMS.map(i => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white/75">
                      <Check size={14} className="text-[#C4A46B] flex-shrink-0 mt-0.5" />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="hidden md:flex flex-col items-center justify-center w-48 flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-[#C4A46B]/15 flex items-center justify-center mb-4">
                  <Hammer size={36} className="text-[#C4A46B]" />
                </div>
                <p className="text-white/30 text-xs text-center leading-relaxed">Built for South African workshops</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why QuotingHub */}
      <section className="py-20 px-6 bg-white border-y border-[#D8D3C8]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">Why QuotingHub</p>
          <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18] tracking-tight mb-5">
            Built for how custom manufacturers actually work.
          </h2>
          <p className="text-[#8A877F] text-lg max-w-2xl mx-auto leading-relaxed mb-14">
            Generic invoicing tools aren&apos;t built for custom job workflows. QuotingHub understands variable materials, custom specs, and the back-and-forth of bespoke manufacturing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              {
                label: 'vs WhatsApp & voice notes',
                desc: 'No more sending prices over WhatsApp and hoping the client remembers. Send a professional PDF quote they can approve and reference later.',
              },
              {
                label: 'vs Excel spreadsheets',
                desc: 'Excel wasn\'t built for quoting custom jobs. QuotingHub has a price book, client management, and invoice tracking — all connected.',
              },
              {
                label: 'vs Generic invoicing apps',
                desc: 'Generic apps don\'t understand custom job quoting. QuotingHub is built around the manufacturing workflow — from first brief to final invoice.',
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
      <section id="cta" className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight mb-5">
            Ready to run a more professional workshop?
          </h2>
          <p className="text-[#8A877F] text-lg mb-10">
            Start with a free trial — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/supplier-portal/register?type=manufacturer_quoting"
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

      <PublicFooter />

    </div>
  )
}
