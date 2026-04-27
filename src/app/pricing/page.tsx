import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { PublicLayout } from '@/components/layout/PublicLayout'

export const metadata: Metadata = {
  title: 'Pricing — Quoting Software for Interior Designers',
  description: 'Solo from R699/month. Studio from R1,499/month. Agency from R2,499/month. Unlimited quotes, invoices, and purchase orders. 30-day free trial. No credit card required.',
  alternates: {
    canonical: 'https://quotinghub.co.za/pricing',
  },
  openGraph: {
    title: 'Pricing — QuotingHub for Interior Designers',
    description: 'Solo from R699/month. Studio from R1,499/month. 30-day free trial, no credit card required.',
    url: 'https://quotinghub.co.za/pricing',
    images: [{ url: 'https://quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
  },
}

const pricingSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QuotingHub',
  url: 'https://quotinghub.co.za',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  offers: [
    {
      '@type': 'Offer',
      name: 'Solo',
      price: '699',
      priceCurrency: 'ZAR',
      description: 'For independent designers running their own studio. 1 user, unlimited projects, quotes, and invoices.',
      eligibleCustomerType: 'https://schema.org/Business',
    },
    {
      '@type': 'Offer',
      name: 'Studio',
      price: '1499',
      priceCurrency: 'ZAR',
      description: 'For growing studios with a team. Up to 5 team members, pipeline dashboard, profit analytics.',
      eligibleCustomerType: 'https://schema.org/Business',
    },
    {
      '@type': 'Offer',
      name: 'Agency',
      price: '2499',
      priceCurrency: 'ZAR',
      description: 'For established firms and high-volume studios. Unlimited team members, Sage integration, custom branded PDFs.',
      eligibleCustomerType: 'https://schema.org/Business',
    },
  ],
}

const plans = [
  {
    name: 'Solo',
    price: 699,
    audience: 'For independent designers running their own studio.',
    tagline: 'Everything you need to quote, invoice, and order professionally.',
    features: [
      '1 user',
      'Unlimited projects, quotes & invoices',
      'Client-ready PDF quotes & invoices',
      'Purchase orders sent directly to suppliers',
      'Clients, suppliers & price list management',
      'Supplier fabric catalogue access',
      'Request Price — send sourcing requests to suppliers',
      'Design fee calculations built in',
      'Basic dashboard: project count, pipeline & revenue',
    ],
    cta: 'Start quoting professionally',
    highlight: false,
  },
  {
    name: 'Studio',
    price: 1499,
    audience: 'For growing studios with a team.',
    tagline: 'Full visibility, collaboration, and operational tools for your studio.',
    features: [
      'Everything in Solo',
      'Up to 5 team members with role permissions',
      'Full pipeline dashboard + Kanban board',
      'Production Sheet PDF for internal use',
      'Markup Calculator',
      'Bulk import tools',
      'Profit analytics per project & per year',
      'Team audit log',
    ],
    cta: 'Grow your studio',
    highlight: true,
  },
  {
    name: 'Agency',
    price: 2499,
    audience: 'For established firms and high-volume studios.',
    tagline: 'No limits. Full integration.',
    features: [
      'Everything in Studio',
      'Unlimited team members',
      'Sage Business Cloud Accounting integration',
      'Custom branded PDFs — we match your letterhead',
    ],
    cta: 'Run a more efficient studio',
    highlight: false,
    premium: true,
  },
]

export default function PricingPage() {
  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema).replace(/</g, '\\u003c') }}
      />
      {/* Hero */}
      <section className="pt-10 sm:pt-16 pb-10 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#9A7B4F]/10 border border-[#9A7B4F]/25 rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-medium text-[#9A7B4F] uppercase tracking-wider">Pricing that grows with your business</span>
          </div>
          <h1 className="font-serif text-5xl text-[#1A1A18] leading-tight tracking-tight mb-4">
            A system built to<br />
            <em className="text-[#C4A46B] not-italic">grow with your studio.</em>
          </h1>
          <p className="text-[#8A877F] text-lg leading-relaxed mb-3">
            Start your 30-day free trial. No credit card required.
          </p>
          <p className="text-[#8A877F] text-base leading-relaxed max-w-xl mx-auto">
            Every plan gives you a complete quoting system. As your studio grows, unlock team collaboration, advanced analytics, Sage integration, and custom-branded documents.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 relative flex flex-col ${
                plan.highlight
                  ? 'bg-[#1A1A18] border-[#1A1A18] text-white'
                  : 'bg-white border-[#D8D3C8] text-[#1A1A18]'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#9A7B4F] text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                    Most popular
                  </span>
                </div>
              )}
              {plan.premium && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#C4A46B] text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                    Full workflow
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${plan.highlight ? 'text-[#C4A46B]' : 'text-[#9A7B4F]'}`}>
                  {plan.name}
                </p>
                <div className="flex items-end gap-1 mb-2">
                  <span className="font-serif text-4xl">R{plan.price.toLocaleString()}</span>
                  <span className={`text-sm mb-1.5 ${plan.highlight ? 'text-white/50' : 'text-[#8A877F]'}`}>/month</span>
                </div>
                <p className={`text-sm font-medium mb-1 ${plan.highlight ? 'text-white/90' : 'text-[#2C2C2A]'}`}>
                  {plan.audience}
                </p>
                <p className={`text-sm leading-relaxed italic ${plan.highlight ? 'text-white/50' : 'text-[#8A877F]'}`}>
                  {plan.tagline}
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check size={14} className={`mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-[#C4A46B]' : 'text-[#9A7B4F]'}`} />
                    <span className={`text-sm leading-snug ${plan.highlight ? 'text-white/80' : 'text-[#2C2C2A]'}`}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-colors ${
                  plan.highlight
                    ? 'bg-[#9A7B4F] text-white hover:bg-[#B8956A]'
                    : 'bg-[#1A1A18] text-white hover:bg-[#9A7B4F]'
                }`}
              >
                {plan.cta} <ArrowRight size={14} />
              </Link>

              <p className={`text-center text-xs mt-3 ${plan.highlight ? 'text-white/30' : 'text-[#C4BFB5]'}`}>
                30-day free trial · No credit card required
              </p>
            </div>
          ))}
        </div>

        {/* Scaling note */}
        <div className="max-w-2xl mx-auto mt-10 text-center">
          <p className="text-sm text-[#8A877F] leading-relaxed border border-[#EDE9E1] rounded-xl px-6 py-4 bg-white">
            <span className="font-medium text-[#2C2C2A]">Why do larger plans cost more?</span> Larger studios have larger teams and generate more revenue. Higher tiers unlock the tools that scale with you — team collaboration, pipeline analytics, Sage accounting, and custom-branded documents. Every plan starts with a fully functional quoting system.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24 border-t border-[#D8D3C8] pt-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-3xl text-[#1A1A18] mb-10 text-center">Common questions</h2>
          <div className="space-y-8">
            {[
              { q: 'What happens after my 30-day trial?', a: "You'll be prompted to choose a plan to keep access. Your data is never deleted — if you subscribe within a few days of expiry, everything is exactly as you left it." },
              { q: 'Do I need a credit card to start?', a: 'No. Sign up with just your email address. You only enter payment details when you choose to subscribe after the trial.' },
              { q: 'What is Price Requests?', a: 'Price Requests is available on all plans. It lets you select items, attach images and descriptions, and send pricing requests directly to your suppliers — all from inside QuotingHub. It eliminates the back-and-forth email chains that slow down sourcing and quoting.' },
              { q: 'Can I upgrade my plan later?', a: 'Yes. You can upgrade at any time from your account settings. Your data and projects carry over seamlessly.' },
              { q: 'Can I cancel at any time?', a: 'Yes. There are no long-term contracts. Cancel anytime from your account settings — no questions asked.' },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-[#EDE9E1] pb-8">
                <p className="font-medium text-[#1A1A18] mb-2">{q}</p>
                <p className="text-sm text-[#8A877F] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1A1A18] px-6 py-16 text-center">
        <p className="font-serif text-3xl text-white mb-3">Your studio deserves a better system.</p>
        <p className="text-white/50 text-sm mb-8 max-w-md mx-auto">Join interior designers across South Africa quoting professionally and winning more projects.</p>
        <Link href="/signup" className="inline-flex items-center gap-2 bg-[#9A7B4F] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[#B8956A] transition-colors">
          Start your free trial <ArrowRight size={14} />
        </Link>
        <p className="text-white/25 text-xs mt-4">30 days free · No credit card required</p>
      </section>
    </PublicLayout>
  )
}
