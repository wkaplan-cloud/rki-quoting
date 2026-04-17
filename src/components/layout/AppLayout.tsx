'use client'
import { useState } from 'react'
import { Menu, AlertTriangle } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { SessionGuard } from '@/components/auth/SessionGuard'
import { FeedbackModal } from '@/components/FeedbackModal'
import Link from 'next/link'

export function AppLayout({
  children,
  isAdmin,
  businessName,
  sourcingEnabled,
  userEmail,
  userName,
  plan,
  subscriptionStatus,
  trialDaysLeft,
  trialExpired,
  graceDaysLeft,
}: {
  children: React.ReactNode
  isAdmin: boolean
  businessName: string
  sourcingEnabled: boolean
  userEmail: string
  userName: string
  plan: string
  subscriptionStatus: string
  trialDaysLeft: number | null
  trialExpired: boolean
  graceDaysLeft: number | null
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // Show red grace-period banner when trial has expired but account still accessible
  const showGraceBanner = trialExpired && graceDaysLeft !== null

  return (
    <div className="flex min-h-screen bg-[#F5F2EC]">
      <SessionGuard />
      <Sidebar
        isAdmin={isAdmin}
        businessName={businessName}
        sourcingEnabled={sourcingEnabled}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onContactClick={() => setFeedbackOpen(true)}
        plan={plan}
        subscriptionStatus={subscriptionStatus}
        trialDaysLeft={trialDaysLeft}
      />
      {feedbackOpen && (
        <FeedbackModal
          userEmail={userEmail}
          userName={userName}
          companyName={businessName}
          onClose={() => setFeedbackOpen(false)}
        />
      )}

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#1A1A18] px-4 py-2 flex items-center gap-3 h-16">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-white/70 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="QuotingHub" className="h-10 object-contain" style={{ filter: 'invert(1)' }} />
        <div className="flex-1" />
        {businessName && (
          <span className="text-[10px] font-medium text-[#C4A46B] uppercase tracking-widest truncate">
            {businessName}
          </span>
        )}
      </div>

      <main className="md:ml-12 flex-1 flex flex-col min-h-screen min-w-0 overflow-x-clip pt-16 md:pt-0">
        {/* ── Grace-period banner ── shown when trial has expired, before account is locked */}
        {showGraceBanner && (
          <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-center gap-3 text-sm flex-wrap">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>
              Your free trial has ended.{' '}
              <strong>
                {graceDaysLeft === 0
                  ? 'Your account will be paused today'
                  : `You have ${graceDaysLeft} day${graceDaysLeft !== 1 ? 's' : ''} before your account is paused`}
              </strong>{' '}
              — subscribe now to keep working without interruption.
            </span>
            <Link
              href="/subscribe"
              className="flex-shrink-0 bg-white text-red-600 font-semibold text-xs px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors"
            >
              Subscribe now →
            </Link>
          </div>
        )}

        {children}
      </main>
    </div>
  )
}
