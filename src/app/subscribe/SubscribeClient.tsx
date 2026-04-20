'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const plans = [
  {
    id: 'solo',
    name: 'Solo',
    price: 699,
    description: 'For independent designers running their own studio.',
    features: [
      'Unlimited projects & quotes',
      'Branded PDF quotes & invoices',
      'Purchase orders per supplier',
      'Supplier price list access',
      'Design fee calculations built in',
      '1 user',
    ],
    highlight: false,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 1499,
    description: 'For growing studios with a small team.',
    features: [
      'Everything in Solo',
      'Up to 5 team members',
      'Shared projects & live collaboration',
      'Team project pipeline view',
      'Priority support',
    ],
    highlight: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 2499,
    description: 'For established firms and high-volume studios.',
    features: [
      'Everything in Studio',
      'Unlimited team members',
      'Price Requests — send sourcing requests to suppliers directly',
      'Dedicated account support',
    ],
    highlight: false,
  },
]

export function SubscribeClient({ trialExpired, daysLeft, userEmail, studioName, memberCount }: { trialExpired: boolean; daysLeft: number; userEmail: string; studioName: string; memberCount: number }) {
  const [loading, setLoading] = useState<string | null>(null)
  const soloDisabled = memberCount > 1
  const studioDisabled = memberCount > 5

  async function handleSubscribe(planId: string) {
    setLoading(planId)
    try {
      const res = await fetch('/api/paystack/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      // Redirect to Paystack checkout
      window.location.href = data.authorization_url
    } catch {
      toast.error('Something went wrong. Please try again.')
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
          All plans include a 30-day free trial. Pricing is based on studio size — not features.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {plans.map(plan => {
            const isDisabled = (plan.id === 'solo' && soloDisabled) || (plan.id === 'studio' && studioDisabled)
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-8 flex flex-col relative ${
                  isDisabled
                    ? 'bg-[#F5F2EC] border-[#D8D3C8] opacity-50 select-none'
                    : plan.highlight
                    ? 'bg-[#1A1A18] border-[#1A1A18] text-white'
                    : 'bg-white border-[#D8D3C8] text-[#1A1A18]'
                }`}
              >
                {isDisabled && (
                  <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
                    <span className="bg-white border border-[#D8D3C8] text-[#8A877F] text-xs font-medium px-3 py-1.5 rounded-full shadow-sm">
                      Not available — your studio has too many users
                    </span>
                  </div>
                )}
                {plan.highlight && !isDisabled && (
                  <span className="inline-block self-start bg-[#9A7B4F] text-white text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider mb-4">
                    Most popular
                  </span>
                )}
                <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${plan.highlight && !isDisabled ? 'text-[#C4A46B]' : 'text-[#9A7B4F]'}`}>
                  {plan.name}
                </p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="font-serif text-4xl">R{plan.price.toLocaleString()}</span>
                  <span className={`text-sm mb-1.5 ${plan.highlight && !isDisabled ? 'text-white/50' : 'text-[#8A877F]'}`}>/month</span>
                </div>
                <p className={`text-sm mb-6 ${plan.highlight && !isDisabled ? 'text-white/60' : 'text-[#8A877F]'}`}>{plan.description}</p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <Check size={13} className={`mt-0.5 flex-shrink-0 ${plan.highlight && !isDisabled ? 'text-[#C4A46B]' : 'text-[#9A7B4F]'}`} />
                      <span className={`text-sm ${plan.highlight && !isDisabled ? 'text-white/80' : 'text-[#2C2C2A]'}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !isDisabled && handleSubscribe(plan.id)}
                  disabled={loading !== null || isDisabled}
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-colors ${
                    isDisabled
                      ? 'bg-[#D8D3C8] text-[#8A877F] cursor-not-allowed'
                      : plan.highlight
                      ? 'bg-[#9A7B4F] text-white hover:bg-[#B8956A] cursor-pointer disabled:opacity-60'
                      : 'bg-[#1A1A18] text-white hover:bg-[#9A7B4F] cursor-pointer disabled:opacity-60'
                  }`}
                >
                  {loading === plan.id ? 'Redirecting to payment…' : <>Subscribe to {plan.name} <ArrowRight size={14} /></>}
                </button>
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-[#8A877F]">
          Need help choosing?{' '}
          <a href="/#contact" className="text-[#9A7B4F] hover:underline">
            Contact us
          </a>
        </p>

        {!trialExpired && (
          <p className="text-center text-xs text-[#C4BFB5] mt-4">
            <Link href="/dashboard" className="hover:text-[#8A877F] transition-colors">
              ← Continue using my trial
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
