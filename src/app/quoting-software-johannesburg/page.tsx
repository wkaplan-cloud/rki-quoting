import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, MapPin } from 'lucide-react'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PLANS, INSTALLER_PLANS } from '@/lib/plan-features'

const URL = 'https://www.quotinghub.co.za/quoting-software-johannesburg'

export const metadata: Metadata = {
  title: 'Quoting Software in Johannesburg — Interior Designers, Electricians & Installers',
  description: 'QuotingHub is South African quoting software for Johannesburg interior designers, electricians and home automation, AV and CCTV installers. Rand pricing, 15% VAT, Sage integration, 30-day free trial.',
  alternates: { canonical: URL },
  openGraph: {
    title: 'Quoting Software in Johannesburg | QuotingHub',
    description: 'Quotes, invoices, purchase orders, COCs, job cards and support contracts for Johannesburg interior designers, electricians and installers.',
    url: URL,
    images: [{ url: 'https://www.quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
  },
}

const AREAS = ['Sandton', 'Rosebank', 'Randburg', 'Fourways', 'Midrand', 'Bryanston', 'Melrose', 'Linksfield', 'Roodepoort', 'Soweto', 'the East Rand', 'the West Rand']

const electricianFrom = PLANS[0].price
const electricianQuoting = PLANS[PLANS.length - 1].price
const installerFrom = INSTALLER_PLANS[0].price
const rand = (n: number) => `R${n.toLocaleString('en-ZA')}`

const TRADES = [
  {
    who: 'Interior designers & decorators',
    href: '/pricing',
    price: 'From R699/month',
    points: [
      'Quotes built from your supplier price lists',
      'Purchase orders to each supplier from one project',
      'Design fees, markups, deposits and 15% VAT worked out for you',
      'Branded PDFs and online client approval',
    ],
  },
  {
    who: 'Electricians',
    href: '/trades/electrician',
    price: `From ${rand(electricianFrom)}/month · full quoting ${rand(electricianQuoting)}/month`,
    points: [
      'Itemised quotes with materials, labour and preliminaries',
      'Monthly progress claims and variation orders',
      'Digital COC (SANS 10142-1)',
      'Job cards and GPS clock-in for staff',
    ],
  },
  {
    who: 'Home automation, AV & CCTV installers',
    href: '/trades/installer',
    price: `From ${rand(installerFrom)}/month`,
    points: [
      'Room-by-room quotes with kits and good/better/best options',
      'Distributor price lists imported in rand',
      'Device register and client handover packs',
      'Support contracts that invoice themselves',
    ],
  },
]

const FAQS = [
  {
    q: 'What is the best quoting software in Johannesburg?',
    a: 'For Johannesburg interior designers, electricians and home automation, AV or CCTV installers, QuotingHub is quoting software built in South Africa for those three kinds of business. It prices in rand, handles 15% VAT, pushes to Sage, and has tools each trade needs: supplier purchase orders for designers, progress claims and a digital COC for electricians, and device registers and support contracts for installers.',
  },
  {
    q: 'Is QuotingHub available in Johannesburg?',
    a: 'Yes. QuotingHub runs in the browser and on phones, so it works anywhere in Johannesburg and Gauteng — Sandton, Rosebank, Randburg, Fourways, Midrand and beyond — and across South Africa.',
  },
  {
    q: 'How much does quoting software cost in South Africa?',
    a: `QuotingHub plans are billed monthly in rand: interior designers from R699, electricians from ${rand(electricianFrom)} (full quoting and claims at ${rand(electricianQuoting)}), and installers from ${rand(installerFrom)}. Every plan has a 30-day free trial with no credit card and no contract.`,
  },
  {
    q: 'Does QuotingHub work with Sage?',
    a: 'Yes. Invoices and claims push to Sage Business Cloud Accounting, so your books stay in Sage while quoting and jobs run in QuotingHub.',
  },
]

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QuotingHub',
  url: URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  description: 'Quoting software for Johannesburg interior designers, electricians and home automation, AV and CCTV installers. Rand pricing, 15% VAT and Sage integration.',
  areaServed: {
    '@type': 'City',
    name: 'Johannesburg',
    containedInPlace: {
      '@type': 'State',
      name: 'Gauteng',
      containedInPlace: { '@type': 'Country', name: 'South Africa' },
    },
  },
  offers: { '@type': 'AggregateOffer', priceCurrency: 'ZAR', lowPrice: '699', highPrice: String(INSTALLER_PLANS[INSTALLER_PLANS.length - 1].price) },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://www.quotinghub.co.za' },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export default function QuotingSoftwareJohannesburgPage() {
  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }}
      />

      {/* Hero */}
      <section className="pt-8 sm:pt-16 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#9A7B4F]/10 border border-[#9A7B4F]/25 rounded-full px-4 py-1.5 mb-8">
            <MapPin size={12} className="text-[#C4A46B]" />
            <span className="text-xs font-medium text-[#9A7B4F] tracking-wide">Johannesburg, Gauteng</span>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-[#1A1A18] leading-[1.05] tracking-tight mb-6">
            Quoting software for<br />
            <em className="text-[#C4A46B] not-italic">Johannesburg businesses.</em>
          </h1>
          <p className="text-lg text-[#8A877F] max-w-2xl mx-auto leading-relaxed mb-6">
            QuotingHub is South African quoting software for interior designers, electricians and home automation, AV and CCTV installers. Quotes, invoices and the paperwork that follows — priced in rand, with 15% VAT and Sage built in.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {AREAS.map(a => (
              <span key={a} className="text-xs text-[#8A877F] bg-white border border-[#D8D3C8] rounded-full px-3 py-1">{a}</span>
            ))}
          </div>
          <p className="text-sm text-[#C4BFB5]">30-day free trial · No credit card · Month-to-month</p>
        </div>
      </section>

      {/* Three trades */}
      <section className="py-20 px-6 bg-white border-y border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18] tracking-tight text-center mb-12">
            Pick your business
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TRADES.map(t => (
              <div key={t.who} className="rounded-2xl border border-[#D8D3C8] p-8 flex flex-col">
                <h3 className="font-serif text-2xl text-[#1A1A18] mb-1">{t.who}</h3>
                <p className="text-sm text-[#9A7B4F] mb-6">{t.price}</p>
                <ul className="space-y-2.5 mb-8">
                  {t.points.map(p => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-[#2C2C2A]">
                      <Check size={13} className="text-[#C4A46B] flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href={t.href}
                  className="mt-auto inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 text-sm font-medium rounded-lg bg-[#1A1A18] text-[#F5F2EC] hover:bg-[#9A7B4F] active:bg-[#7E6440] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A7B4F] transition-colors"
                >
                  See how it works <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18] tracking-tight text-center mb-10">
            Questions
          </h2>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="p-6 rounded-xl border border-[#EDE9E1] bg-white">
                <h3 className="font-medium text-[#1A1A18] mb-2 text-sm">{q}</h3>
                <p className="text-sm text-[#8A877F] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-[#8A877F] text-center mt-10">
            Comparing options? Read <Link href="/blog/best-quoting-software-south-africa" className="text-[#9A7B4F] hover:underline">the best quoting software in South Africa</Link>.
          </p>
        </div>
      </section>
    </PublicLayout>
  )
}
