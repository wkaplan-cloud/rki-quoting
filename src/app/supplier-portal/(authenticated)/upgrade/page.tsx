'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Zap, Check, Bolt, Lock } from 'lucide-react'
import { Suspense } from 'react'

const S = {
  bg:       '#F0F2F5',
  card:     '#FFFFFF',
  sidebar:  '#1E2A38',
  accent:   '#3A7CA5',
  gold:     '#D9A441',
  text:     '#18181B',
  muted:    '#71717A',
  border:   '#E4E4E7',
}

const TRADES = [
  {
    id:       'electrician',
    label:    'Electrician',
    icon:     Bolt,
    price:    1999,
    features: [
      'Full quote builder with sections & line items',
      'As-built quantity editing',
      'Monthly progress claims (invoice & proforma)',
      'Variation orders & project contacts',
      'Certificate of Compliance (COC) tracker',
      'Snag list management',
      'Monthly RECON dashboard',
      'Smart autocomplete from your history',
      'PDF generation for quotes & claims',
    ],
    available: true,
  },
  {
    id:       'plumber',
    label:    'Plumber',
    icon:     Zap,
    price:    499,
    features: ['Coming soon'],
    available: false,
  },
  {
    id:       'manufacturer',
    label:    'Manufacturer',
    icon:     Zap,
    price:    499,
    features: ['Coming soon'],
    available: false,
  },
]

function UpgradeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentFailed = searchParams.get('payment') === 'failed'
  const [selected, setSelected] = useState('electrician')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(paymentFailed ? 'Payment was not completed. Please try again.' : '')

  const selectedTrade = TRADES.find(t => t.id === selected)!

  async function handleUpgrade() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/supplier-portal/paystack/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planCategory: selected }),
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
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ background: 'rgba(58,124,165,0.1)', color: S.accent }}>
            <Zap size={11} />
            Quoting Upgrade
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: S.text }}>Unlock the Quoting Module</h1>
          <p className="text-sm" style={{ color: S.muted }}>
            A complete project &amp; billing system built for your trade. R1,999/month, cancel anytime.
          </p>
        </div>

        {/* Trade selector */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {TRADES.map(trade => {
            const Icon = trade.icon
            const active = selected === trade.id
            return (
              <button
                key={trade.id}
                onClick={() => trade.available && setSelected(trade.id)}
                disabled={!trade.available}
                className="relative rounded-xl p-4 text-left transition-all duration-150"
                style={{
                  background:  active ? S.accent : S.card,
                  border:      `2px solid ${active ? S.accent : S.border}`,
                  cursor:      trade.available ? 'pointer' : 'not-allowed',
                  opacity:     trade.available ? 1 : 0.5,
                  boxShadow:   active ? `0 4px 16px rgba(58,124,165,0.25)` : '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                {!trade.available && (
                  <span className="absolute top-2 right-2">
                    <Lock size={10} style={{ color: S.muted }} />
                  </span>
                )}
                <Icon size={18} className="mb-2" style={{ color: active ? '#fff' : S.accent }} />
                <p className="text-sm font-semibold" style={{ color: active ? '#fff' : S.text }}>{trade.label}</p>
                {!trade.available && (
                  <p className="text-[10px] mt-0.5" style={{ color: active ? 'rgba(255,255,255,0.6)' : S.muted }}>Coming soon</p>
                )}
              </button>
            )
          })}
        </div>

        {/* Feature card */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-lg" style={{ color: S.text }}>{selectedTrade.label} Quoting</p>
              <p className="text-sm" style={{ color: S.muted }}>Everything you need to run your projects</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: S.text }}>R{selectedTrade.price}</p>
              <p className="text-xs" style={{ color: S.muted }}>/month excl. VAT</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {selectedTrade.features.map(f => (
              <div key={f} className="flex items-start gap-2.5">
                <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: S.accent }} />
                <p className="text-sm" style={{ color: S.text }}>{f}</p>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleUpgrade}
          disabled={loading || !selectedTrade.available}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-opacity duration-150"
          style={{ background: S.accent }}
        >
          {loading ? 'Redirecting to checkout…' : `Upgrade to ${selectedTrade.label} Quoting — R${selectedTrade.price}/mo`}
        </button>

        <p className="text-center text-xs mt-4" style={{ color: S.muted }}>
          Secured by Paystack · Cancel anytime from your profile
        </p>
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
