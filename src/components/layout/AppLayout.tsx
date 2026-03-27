'use client'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { SessionGuard } from '@/components/auth/SessionGuard'
import { FeedbackModal } from '@/components/FeedbackModal'

export function AppLayout({ children, isAdmin, businessName, userEmail, userName }: {
  children: React.ReactNode
  isAdmin: boolean
  businessName: string
  userEmail: string
  userName: string
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#F5F2EC]">
      <SessionGuard />
      <Sidebar
        isAdmin={isAdmin}
        businessName={businessName}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onContactClick={() => setFeedbackOpen(true)}
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

      <main className="md:ml-44 flex-1 flex flex-col min-h-screen min-w-0 overflow-x-clip pt-16 md:pt-0">
        {children}
      </main>
    </div>
  )
}
