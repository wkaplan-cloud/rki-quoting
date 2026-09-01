'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Zap, ChevronRight, Users, Briefcase, FolderOpen } from 'lucide-react'
import { Suspense } from 'react'
import { PLANS, planRank } from '@/lib/plan-features'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', sidebar: '#1E2A38',
}

const TIER_ICON = { starter: Users, professional: Briefcase, business: FolderOpen } as const
const TIER_COLOR = { starter: '#3A7CA5', professional: '#D9A441', business: '#166534' } as const
const TIER_BG   = { starter: 'rgba(58,124,165,0.08)', professional: 'rgba(217,164,65,0.08)', business: 'rgba(22,101,52,0.08)' } as const

function UpgradeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentFailed = searchParams.get('payment') === 'failed'
  const currentPlan = searchParams.get('current') ?? null
  const currentRank = planRank(currentPlan)
  const [selected, setSelected] = useState<string>(
    currentRank > 0
      ? (PLANS.find(p => planRank(p.id) > currentRank)?.id ?? 'business')
      : 'professional'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(paymentFailed ? 'Payment was not completed — please try again.' : '')

  const selectedPlan = PLANS.find(p => p.id === selected)!

  async function handleUpgrade() {
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/supplier-portal/paystack/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selected }),
      })
      const data = await res.json() as { authorization_url?: string; error?: string }
      if (!res.ok || !data.authorization_url) {
        setError(data.error ?? 'Could not start checkout. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.authorization_url
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: S.bg }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ background: 'rgba(58,124,165,0.1)', color: S.accent }}>
            <Zap size={11} />
            QuotingHub for Electricians
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: S.text }}>{currentRank > 0 ? 'Upgrade your plan' : 'Choose your plan'}</h1>
          <p className="text-sm" style={{ color: S.muted }}>
            All plans include 2 admin users and up to 20 staff. Cancel anytime.
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {PLANS.map(plan => {
            const Icon = TIER_ICON[plan.id as keyof typeof TIER_ICON] ?? Zap
            const color = TIER_COLOR[plan.id as keyof typeof TIER_COLOR] ?? S.accent
            const bg    = TIER_BG[plan.id as keyof typeof TIER_BG] ?? 'rgba(58,124,165,0.08)'
            const isCurrent = currentRank > 0 && planRank(plan.id) === currentRank
            const isDisabled = currentRank > 0 && planRank(plan.id) <= currentRank
            const isSelected = selected === plan.id && !isDisabled
            const isPopular = plan.id === 'professional' && !isDisabled

            return (
              <button key={plan.id} onClick={() => setSelected(plan.id)} disabled={isDisabled}
                className="relative rounded-2xl p-5 text-left transition-all duration-150 disabled:cursor-not-allowed"
                style={{
                  background: S.card,
                  border: `2px solid ${isSelected ? color : S.border}`,
                  boxShadow: isSelected ? `0 4px 20px ${color}22` : '0 1px 4px rgba(0,0,0,0.06)',
                  opacity: isDisabled ? 0.55 : 1,
                }}>
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full text-white whitespace-nowrap"
                    style={{ background: S.muted }}>
                    Your current plan
                  </span>
                )}
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full text-white"
                    style={{ background: S.gold }}>
                    Most Popular
                  </span>
                )}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <p className="font-bold text-base mb-0.5" style={{ color: S.text }}>{plan.label}</p>
                <p className="text-xs mb-3" style={{ color: S.muted }}>{plan.tagline}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold" style={{ color: isSelected ? color : S.text }}>R{plan.price.toLocaleString()}</span>
                  <span className="text-xs" style={{ color: S.muted }}>/mo</span>
                </div>
                <div className="mt-4 space-y-2">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2">
                      <Check size={12} className="mt-0.5 shrink-0" style={{ color }} />
                      <p className="text-xs leading-snug" style={{ color: S.text }}>{f}</p>
                    </div>
                  ))}
                </div>
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: color }}>
                    <Check size={11} color="#fff" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Staff add-on note */}
        <div className="rounded-xl px-4 py-3 mb-6 flex items-center gap-3"
          style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <Users size={14} style={{ color: S.muted }} />
          <p className="text-xs" style={{ color: S.muted }}>
            <span className="font-semibold" style={{ color: S.text }}>21+ staff?</span> Add R40/month per extra staff member — billed automatically through Paystack after setup.
          </p>
        </div>

        {/* Setup fee */}
        <div className="rounded-xl px-4 py-4 mb-6 flex items-center justify-between gap-4"
          style={{ background: 'rgba(217,164,65,0.06)', border: `1px solid rgba(217,164,65,0.2)` }}>
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Zap size={14} style={{ color: S.gold, flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: S.text }}>Setup & Training — R2,500 once-off</p>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>We&apos;ll onboard your team, configure staff devices, and walk you through the system.</p>
            </div>
          </div>
          <a
            href="https://paystack.com/buy/setup--training--r2500-once-off-vmoejb"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0"
            style={{ background: S.gold, color: '#fff' }}
          >
            Pay R2,500 <ChevronRight size={13} />
          </a>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            {error}
          </div>
        )}

        <button onClick={handleUpgrade} disabled={loading || planRank(selectedPlan.id) <= currentRank}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: TIER_COLOR[selectedPlan.id as keyof typeof TIER_COLOR] ?? S.accent }}>
          {loading ? 'Redirecting to checkout…' : planRank(selectedPlan.id) <= currentRank ? (
            'You’re already on the top plan'
          ) : (
            <>
              {currentRank > 0 ? 'Upgrade' : 'Subscribe'} to {selectedPlan.label} — R{selectedPlan.price.toLocaleString()}/mo
              <ChevronRight size={16} />
            </>
          )}
        </button>

        <p className="text-center text-xs mt-4" style={{ color: S.muted }}>
          Secured by Paystack · Cancel anytime from your profile
        </p>

        <button onClick={() => router.back()} className="w-full text-center text-xs mt-3" style={{ color: S.muted }}>
          ← Go back
        </button>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradeContent />
    </Suspense>
  )
}
