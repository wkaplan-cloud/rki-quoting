// Plan tier hierarchy
// 'quoting' is the legacy plan — treated as 'business'
// Electricians: starter < professional < business
// Installers:   installer (= business, plus the installer tools) < installer_pro
// 'manufacturer' is a separate single-tier plan for the manufacturing module

export type QuotingTier = 'starter' | 'professional' | 'business' | 'quoting' | 'manufacturer' | 'installer' | 'installer_pro'

const TIER_RANK: Record<string, number> = {
  starter:       1,
  professional:  2,
  business:      3,
  quoting:       3, // legacy — same as business
  installer:     3, // everything Business has, for installers
  installer_pro: 4, // + support contracts and recurring invoicing
  manufacturer:  1, // single tier — unlocks the full manufacturing module
}

export function planRank(plan: string | null | undefined): number {
  if (!plan) return 0
  return TIER_RANK[plan] ?? 0
}

/** Rank of a trades plan; 0 for the manufacturer plan, which unlocks none of the trades portal. */
export function tradesPlanRank(plan: string | null | undefined): number {
  return plan === 'manufacturer' ? 0 : planRank(plan)
}

export function hasClocking(plan: string | null | undefined)      { return planRank(plan) >= 1 }
export function hasJobCards(plan: string | null | undefined)      { return planRank(plan) >= 2 }
export function hasProjects(plan: string | null | undefined)      { return planRank(plan) >= 3 }
/** Support contracts with recurring invoicing — Installer Pro. */
export function hasContracts(plan: string | null | undefined)     { return planRank(plan) >= 4 }

export function isActivePlan(
  plan: string | null | undefined,
  status: string | null | undefined,
  trialEndsAt: string | null | undefined,
): boolean {
  if (!plan || !TIER_RANK[plan]) return false
  if (status === 'active') return true
  if (status === 'trialing' && trialEndsAt && new Date(trialEndsAt) > new Date()) return true
  return false
}

export const PLANS = [
  {
    id:       'starter',
    label:    'Starter',
    price:    999,
    tagline:  'Staff clocking + scheduling for up to 20 staff',
    envKey:   'PAYSTACK_PLAN_STARTER',
    features: [
      'Up to 2 admin users',
      'Up to 20 staff (R40/extra staff/month)',
      'Staff clock in & out with GPS',
      'Live schedule & staff location view',
      'Staff time history & reporting',
      'Mobile app for staff',
    ],
  },
  {
    id:       'professional',
    label:    'Professional',
    price:    1999,
    tagline:  'Everything in Starter plus daily job cards',
    envKey:   'PAYSTACK_PLAN_PROFESSIONAL',
    features: [
      'Everything in Starter',
      'Job Cards — callouts, maintenance, repairs',
      'Materials logging & ordering requests',
      'Client signature capture on mobile',
      'Job card PDFs & email delivery',
      'Notifications for all staff activity',
    ],
  },
  {
    id:       'business',
    label:    'Business',
    price:    3199,
    tagline:  'Full project & billing suite for contractors',
    envKey:   'PAYSTACK_PLAN_BUSINESS',
    features: [
      'Everything in Professional',
      'Project quotes with sections & line items',
      'Variation orders & COC tracker',
      'Monthly progress claims & invoicing',
      'As-built quantities & RECON dashboard',
      'Sage Accounting integration',
    ],
  },
] as const

/**
 * Installer plans. Installers need quoting from day one, so there is no
 * clocking-only tier: the entry plan is Business plus the installer tools.
 * Paystack plan codes come from the env keys below — until they're set,
 * checkout for these plans answers "Plan not configured".
 */
export const INSTALLER_PLANS = [
  {
    id:       'installer',
    label:    'Installer',
    price:    2999,
    tagline:  'Quote, install and hand over — the whole job in one place',
    envKey:   'PAYSTACK_PLAN_INSTALLER',
    features: [
      'Room-by-room quotes with kits & price-list import',
      'Good / better / best options, optional extras & deposits',
      'Projects, variation orders, progress claims & Sage',
      'Job cards, scheduling & GPS clocking',
      'Device register & client handover packs',
      'Staff mobile app — up to 20 staff',
    ],
  },
  {
    id:       'installer_pro',
    label:    'Installer Pro',
    price:    4499,
    tagline:  'Everything in Installer, plus recurring support revenue',
    envKey:   'PAYSTACK_PLAN_INSTALLER_PRO',
    features: [
      'Everything in Installer',
      'Support contracts — monthly or annual',
      'Invoices raised and sent automatically each period',
      'Callouts marked covered or chargeable automatically',
      'Renewal reminders 30 days ahead',
      'See which plans pay their way',
    ],
  },
] as const

/** The plans a trades account can buy: installer plans for installers, the electrician tiers otherwise. */
export function tradesPlansFor(tradeType: string | null | undefined) {
  return tradeType === 'installer' ? INSTALLER_PLANS : PLANS
}

export const MANUFACTURER_PLAN = {
  id:      'manufacturer',
  label:   'Manufacturer',
  price:   699,
  tagline: 'Professional quoting & invoicing for manufacturers',
  envKey:  'PAYSTACK_PLAN_MANUFACTURER',
  features: [
    'Unlimited quotes & invoices',
    'Professional PDF quote & invoice output',
    'Branded email delivery to clients',
    'Client management',
    'Cost builder with price book',
    'Deposit & final invoice splitting (SARS-compliant VAT)',
    'Option groups (A/B alternatives on quotes)',
    'Team members',
  ],
} as const
