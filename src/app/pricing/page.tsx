import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'

const plans = [
  {
    name: 'Solo',
    price: 599,
    description: 'For freelance designers and single-person studios.',
    features: [
      'Unlimited projects & quotes',
      'Auto-generated PDFs',
      'Purchase orders per supplier',
      'Send quotes & POs by email',
      'Price list access (Home Fabrics & more)',
      'Client portal',
      '1 user',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    name: 'Studio',
    price: 1099,
    description: 'For growing studios with a full team.',
    features: [
      'Everything in Solo',
      'Unlimited team members',
      'Multi-user collaboration',
      'Price list access (Home Fabrics & more)',
      'Team project management',
      'Priority support',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-6 h-32 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-28 w-auto object-contain" />
          <div className="flex items-center gap-3">
            <Link href="/" className="px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">
              Home
            </Link>
            <Link href="/login" className="px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">
              Log in
            </Link>
            <Link href="/signup" className="px-4 py-2 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-52 pb-10 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#9A7B4F]/10 border border-[#9A7B4F]/25 rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-medium text-[#9A7B4F] uppercase tracking-wider">Simple pricing</span>
          </div>
          <h1 className="font-serif text-5xl text-[#1A1A18] leading-tight tracking-tight mb-4">
            30 days free.<br />No card required.
          </h1>
          <p className="text-[#8A877F] text-lg leading-relaxed">
            Start quoting immediately. After your trial, choose the plan that fits your studio.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="mb-6">
                <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${plan.highlight ? 'text-[#C4A46B]' : 'text-[#9A7B4F]'}`}>
                  {plan.name}
                </p>
                <div className="flex items-end gap-1 mb-2">
                  <span className="font-serif text-4xl">R{plan.price.toLocaleString()}</span>
                  <span className={`text-sm mb-1.5 ${plan.highlight ? 'text-white/50' : 'text-[#8A877F]'}`}>/month</span>
                </div>
                <p className={`text-sm leading-relaxed ${plan.highlight ? 'text-white/60' : 'text-[#8A877F]'}`}>
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check size={14} className={`mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-[#C4A46B]' : 'text-[#9A7B4F]'}`} />
                    <span className={`text-sm ${plan.highlight ? 'text-white/80' : 'text-[#2C2C2A]'}`}>{feature}</span>
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
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24 border-t border-[#D8D3C8] pt-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-3xl text-[#1A1A18] mb-10 text-center">Common questions</h2>
          <div className="space-y-8">
            {[
              {
                q: 'What happens after my 30-day trial?',
                a: "You'll be prompted to choose a plan to keep access. Your data is never deleted — if you subscribe within a few days of expiry everything is exactly as you left it.",
              },
              {
                q: 'Do I need a credit card to start?',
                a: 'No. Sign up with just your email address. You only enter payment details when you choose to subscribe after the trial.',
              },
              {
                q: 'What is the difference between Solo and Studio?',
                a: 'Solo is for one-person studios. Studio allows unlimited team members so your whole team can collaborate on projects together.',
              },
              {
                q: 'What does price list access include?',
                a: 'Both plans include access to the Home Fabrics price list so you can browse and pull products directly into your quotes. More supplier price lists are being added.',
              },
              {
                q: 'Can I cancel at any time?',
                a: 'Yes. There are no long-term contracts. Cancel anytime from your account settings.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-[#EDE9E1] pb-8">
                <p className="font-medium text-[#1A1A18] mb-2">{q}</p>
                <p className="text-sm text-[#8A877F] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-[#1A1A18] px-6 py-16 text-center">
        <p className="font-serif text-3xl text-white mb-3">Ready to start?</p>
        <p className="text-white/50 text-sm mb-8">Join interior designers already using QuotingHub to run their studios.</p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 bg-[#9A7B4F] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[#B8956A] transition-colors"
        >
          Start your free trial <ArrowRight size={14} />
        </Link>
      </section>

      <footer className="bg-[#0F0F0D] px-6 py-6 text-center">
        <p className="text-xs text-white/20">© {new Date().getFullYear()} QuotingHub · quotinghub.co.za</p>
      </footer>
    </div>
  )
}
