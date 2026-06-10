'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Zap, FileText, Receipt, Users, BookOpen, Mail, GitBranch, Layers } from 'lucide-react'
import { Suspense } from 'react'
import { MANUFACTURER_PLAN } from '@/lib/plan-features'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#1B4F8A',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
}

const FEATURE_ICONS: Record<string, React.ElementType> = {
  'Unlimited quotes & invoices':                             FileText,
  'Professional PDF quote & invoice output':                 FileText,
  'Branded email delivery to clients':                       Mail,
  'Client management':                                       Users,
  'Cost builder with price book':                            BookOpen,
  'Deposit & final invoice splitting (SARS-compliant VAT)':  Receipt,
  'Option groups (A/B alternatives on quotes)':              GitBranch,
  'Team members':                                            Users,
}

function UpgradeManufacturerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentFailed = searchParams.get('payment') === 'failed'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(paymentFailed ? 'Payment was not completed — please try again.' : '')

  async function handleUpgrade() {
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/supplier-portal/paystack/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: MANUFACTURER_PLAN.id }),
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
    <div className="min-h-screen py-12 px-4" style={{ background: S.bg }}>
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ background: 'rgba(27,79,138,0.1)', color: S.accent }}>
            <Zap size={11} /> QuotingHub for Manufacturers
          </div>
          <h1 className="text-3xl font-bold mb-3" style={{ color: S.text }}>
            Upgrade to Manufacturing
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: S.muted }}>
            Add professional quoting, invoicing and client management to your existing supplier account.
            Your price requests and price list stay exactly as they are.
          </p>
        </div>

        {/* Plan card */}
        <div className="rounded-2xl overflow-hidden shadow-lg mb-6"
          style={{ border: `2px solid ${S.accent}`, background: S.card }}>

          {/* Card header */}
          <div className="px-8 py-6 text-center" style={{ background: S.accent }}>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Layers size={22} style={{ color: '#fff' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{MANUFACTURER_PLAN.label}</h2>
            <p className="text-sm text-white/70">{MANUFACTURER_PLAN.tagline}</p>
            <div className="mt-4">
              <span className="text-4xl font-bold text-white">R{MANUFACTURER_PLAN.price.toLocaleString('en-ZA')}</span>
              <span className="text-white/70 text-sm ml-1">/month</span>
            </div>
          </div>

          {/* Features */}
          <div className="px-8 py-6">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: S.muted }}>
              What&apos;s included
            </p>
            <ul className="space-y-3">
              {MANUFACTURER_PLAN.features.map(feature => {
                const Icon = FEATURE_ICONS[feature] ?? Check
                return (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(27,79,138,0.1)' }}>
                      <Icon size={11} style={{ color: S.accent }} />
                    </div>
                    <span className="text-sm" style={{ color: S.text }}>{feature}</span>
                  </li>
                )
              })}
            </ul>

            <div className="mt-5 p-4 rounded-xl text-sm" style={{ background: '#F0F7FF', border: `1px solid rgba(27,79,138,0.15)` }}>
              <p style={{ color: S.accent }}>
                <strong>Your supplier access stays.</strong> Price requests, your price list, and all existing supplier features remain fully accessible after upgrading.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="px-8 pb-8">
            {error && (
              <p className="text-xs px-3 py-2 rounded-lg mb-4" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                {error}
              </p>
            )}
            <button
              onClick={() => void handleUpgrade()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: S.accent }}>
              <Zap size={15} />
              {loading ? 'Redirecting to checkout…' : `Subscribe for R${MANUFACTURER_PLAN.price.toLocaleString('en-ZA')}/month`}
            </button>
            <p className="text-xs text-center mt-3" style={{ color: S.muted }}>
              Secure payment via Paystack · Cancel anytime
            </p>
          </div>
        </div>

        <button onClick={() => router.back()} className="block text-center w-full text-sm" style={{ color: S.muted }}>
          ← Go back
        </button>
      </div>
    </div>
  )
}

export default function UpgradeManufacturerPage() {
  return (
    <Suspense>
      <UpgradeManufacturerContent />
    </Suspense>
  )
}
