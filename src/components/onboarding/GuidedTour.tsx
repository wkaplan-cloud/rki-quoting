'use client'
import { useEffect } from 'react'
import 'driver.js/dist/driver.css'
import { createClient } from '@/lib/supabase/client'

const WELCOME_KEY = 'qh-welcome-seen'
const TOUR_KEY = 'qh-tour-seen'

/**
 * The onboarding flags live on the account (user_metadata.onboarding_seen), not
 * just in localStorage — iPad Safari drops site storage between sign-ins, which
 * replayed the welcome + tour on every login. localStorage stays as a fast cache.
 */
export function markOnboardingSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, '1')
    localStorage.setItem(TOUR_KEY, '1')
  } catch {}
  createClient().auth.updateUser({ data: { onboarding_seen: true } }).catch(() => {})
}

const STEPS = [
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: 'Your navigation',
      description: 'Everything in QuotingHub lives here — clients, suppliers, projects, and settings.',
      side: 'right' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="nav-clients"]',
    popover: {
      title: 'Clients',
      description: 'Start by adding your clients — the people you design for. You\'ll select them when creating a project.',
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-suppliers"]',
    popover: {
      title: 'Suppliers',
      description: 'Add your suppliers and set a default markup per supplier. QuotingHub applies it automatically on every line item.',
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="nav-projects"]',
    popover: {
      title: 'Projects',
      description: 'Each job gets its own project. Projects hold your line items, quotes, invoices, and pipeline stages.',
      side: 'right' as const,
    },
  },
  {
    element: '[data-tour="new-project"]',
    popover: {
      title: 'Create a project',
      description: 'When you\'re ready to start a job, click here. Select a client, give it a name, and you\'re in.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="dashboard-cards"]',
    popover: {
      title: 'Your pipeline at a glance',
      description: 'These cards show the live state of your business — quotes out, deposits awaited, and invoices outstanding.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="checklist"]',
    popover: {
      title: 'Your getting started checklist',
      description: 'These 4 steps will get you fully set up. They tick off automatically as you complete them.',
      side: 'top' as const,
    },
  },
]

export async function startTour() {
  if (typeof window === 'undefined' || window.innerWidth < 768) return

  const { driver } = await import('driver.js')

  const driverObj = driver({
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Done ✓',
    steps: STEPS,
    onDestroyed: markOnboardingSeen,
  })

  driverObj.drive()
}

export function GuidedTour({ accountSeen = false }: { accountSeen?: boolean }) {
  useEffect(() => {
    if (accountSeen) return
    let welcomeSeen: string | null = null
    let tourSeen: string | null = null
    try {
      welcomeSeen = localStorage.getItem(WELCOME_KEY)
      tourSeen = localStorage.getItem(TOUR_KEY)
    } catch {}
    // Finished on this device before the flag moved to the account — carry it over.
    if (tourSeen) {
      markOnboardingSeen()
      return
    }
    // Auto-resume if welcome was dismissed but tour not yet completed (handles page refresh mid-tour)
    if (welcomeSeen) setTimeout(startTour, 400)
  }, [accountSeen])

  return null
}
