// Plan tier hierarchy
// 'quoting' is the legacy plan — treated as 'business'
// starter < professional < business
// 'manufacturer' is a separate single-tier plan for the manufacturing module

export type QuotingTier = 'starter' | 'professional' | 'business' | 'quoting' | 'manufacturer'

const TIER_RANK: Record<string, number> = {
  starter:      1,
  professional: 2,
  business:     3,
  quoting:      3, // legacy — same as business
  manufacturer: 1, // single tier — unlocks the full manufacturing module
}

export function planRank(plan: string | null | undefined): number {
  if (!plan) return 0
  return TIER_RANK[plan] ?? 0
}

export function hasClocking(plan: string | null | undefined)      { return planRank(plan) >= 1 }
export function hasJobCards(plan: string | null | undefined)      { return planRank(plan) >= 2 }
export function hasProjects(plan: string | null | undefined)      { return planRank(plan) >= 3 }

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
