'use client'
import { useEffect } from 'react'
import 'driver.js/dist/driver.css'

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
    onDestroyed: () => {
      localStorage.setItem('qh-tour-seen', '1')
    },
  })

  driverObj.drive()
}

export function GuidedTour() {
  useEffect(() => {
    // Auto-resume if welcome was dismissed but tour not yet completed (handles page refresh mid-tour)
    const welcomeSeen = localStorage.getItem('qh-welcome-seen')
    const tourSeen = localStorage.getItem('qh-tour-seen')
    if (welcomeSeen && !tourSeen) {
      setTimeout(startTour, 400)
    }
  }, [])

  return null
}
