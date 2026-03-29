'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const plans = [
  {
    id: 'solo',
    name: 'Solo',
    price: 599,
    description: 'For freelance designers and single-person studios.',
    features: [
      'Unlimited projects & quotes',
      'Auto-generated PDFs',
      'Purchase orders per supplier',
      'Send quotes & POs by email',
      'Price list access',
      '1 user',
    ],
    highlight: false,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 1099,
    description: 'For growing studios with a full team.',
    features: [
      'Everything in Solo',
      'Unlimited team members',
      'Multi-user collaboration',
      'Price list access',
      'Priority support',
    ],
    highlight: true,
  },
]

export function SubscribeClient({ trialExpired, daysLeft }: { trialExpired: boolean; daysLeft: number }) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleSubscribe(planId: string) {
    setLoading(planId)
    // Stripe checkout will be wired up here once keys are configured
    // For now, notify the platform admin by email
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: `Subscription request — ${planId} plan`,
          message: `A studio is requesting to subscribe to the ${planId} plan (R${planId === 'solo' ? '599' : '1,099'}/month). Please action this in the platform admin.`,
          email: 'subscription@quotinghub.co.za',
          name: 'Subscription Request',
        }),
      })
      toast.success("Request sent! We'll be in touch within 24 hours to activate your plan.")
    } catch {
      toast.error('Something went wrong. Please email us at hello@quotinghub.co.za')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex flex-col items-center justify-center px-6 py-16">
      {/* Logo */}
      <Link href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QuotingHub" className="h-20 w-auto object-contain mb-10" />
      </Link>

      {/* Status banner */}
      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl mb-10 text-sm font-medium ${
        trialExpired
          ? 'bg-red-50 border border-red-200 text-red-700'
          : 'bg-[#9A7B4F]/10 border border-[#9A7B4F]/25 text-[#9A7B4F]'
      }`}>
        {trialExpired ? <AlertCircle size={15} /> : <Clock size={15} />}
        {trialExpired
          ? 'Your 30-day trial has ended. Choose a plan to continue.'
          : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your free trial.`}
      </div>

      <div className="w-full max-w-3xl">
        <h1 className="font-serif text-4xl text-[#1A1A18] text-center mb-2">Choose your plan</h1>
        <p className="text-[#8A877F] text-center text-sm mb-10">
          Both plans include a 30-day free trial and price list access.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-8 flex flex-col ${
                plan.highlight
                  ? 'bg-[#1A1A18] border-[#1A1A18] text-white'
                  : 'bg-white border-[#D8D3C8] text-[#1A1A18]'
              }`}
            >
              {plan.highlight && (
                <span className="inline-block self-start bg-[#9A7B4F] text-white text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider mb-4">
                  Most popular
                </span>
              )}
              <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${plan.highlight ? 'text-[#C4A46B]' : 'text-[#9A7B4F]'}`}>
                {plan.name}
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-serif text-4xl">R{plan.price.toLocaleString()}</span>
                <span className={`text-sm mb-1.5 ${plan.highlight ? 'text-white/50' : 'text-[#8A877F]'}`}>/month</span>
              </div>
              <p className={`text-sm mb-6 ${plan.highlight ? 'text-white/60' : 'text-[#8A877F]'}`}>{plan.description}</p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={13} className={`mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-[#C4A46B]' : 'text-[#9A7B4F]'}`} />
                    <span className={`text-sm ${plan.highlight ? 'text-white/80' : 'text-[#2C2C2A]'}`}>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading !== null}
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer ${
                  plan.highlight
                    ? 'bg-[#9A7B4F] text-white hover:bg-[#B8956A]'
                    : 'bg-[#1A1A18] text-white hover:bg-[#9A7B4F]'
                }`}
              >
                {loading === plan.id ? 'Sending request…' : <>Subscribe to {plan.name} <ArrowRight size={14} /></>}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-[#8A877F]">
          Need help choosing?{' '}
          <a href="mailto:hello@quotinghub.co.za" className="text-[#9A7B4F] hover:underline">
            Email us
          </a>
        </p>

        {!trialExpired && (
          <p className="text-center text-xs text-[#C4BFB5] mt-3">
            <Link href="/dashboard" className="hover:text-[#8A877F] transition-colors">
              ← Continue using my trial
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
