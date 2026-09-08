import { marketingFooter } from './email'

/**
 * Trial nudge for supplier-portal accounts — the manufacturing and
 * electrician/trades products.
 *
 * Same shape as trial-nudge-email.ts (which covers design studios on
 * organizations), but portal accounts live on supplier_portal_accounts, price
 * differently, and land on a different upgrade screen — so the copy names the
 * product the account actually signed up for rather than talking about
 * "your studio".
 *
 * Unlike a studio there is no grace period here: isActivePlan() goes false the
 * moment trial_ends_at passes, so the expired variant is written for someone
 * who is already locked out.
 *
 * This is lifecycle marketing, not transactional — send it with bulkPayload()
 * so it carries one-click unsubscribe headers, and check the suppression list
 * before sending.
 */

const BASE = 'https://www.quotinghub.co.za'

export type PortalProduct = 'manufacturer' | 'electrician'

/**
 * Which product an account is on, from its plan_category / supplier_category.
 * Anything that is not a manufacturer is a trades (electrician) account —
 * plain product suppliers never get a trial, so they never reach this.
 */
export function portalProduct(
  planCategory: string | null | undefined,
  supplierCategory: string | null | undefined,
): PortalProduct {
  return planCategory === 'manufacturer' || supplierCategory === 'manufacturer'
    ? 'manufacturer'
    : 'electrician'
}

/** Per-product copy: what the thing is called, what it holds, what it costs. */
const PRODUCT = {
  manufacturer: {
    name: 'QuotingHub Manufacturing',
    upgradeUrl: `${BASE}/supplier-portal/upgrade-manufacturer`,
    // Matches MANUFACTURER_PLAN in lib/plan-features.ts
    priceLine: 'It is R699/month, and you can cancel at any time.',
    theirWork: 'your quotes, price book, clients and invoices',
    cta: 'Subscribe — R699/month',
  },
  electrician: {
    name: 'the QuotingHub Electrician Portal',
    upgradeUrl: `${BASE}/supplier-portal/upgrade`,
    // Matches PLANS in lib/plan-features.ts
    priceLine: 'Plans start at R999/month, and you can change or cancel at any time.',
    theirWork: 'your quotes, job cards, staff, schedule and COCs',
    cta: 'Choose your plan →',
  },
} as const

/**
 * First name for the greeting, from a contact name that may be missing or
 * badly cased. Falls back to "there", fixes an all-lowercase or SHOUTING name,
 * and leaves anything already mixed-case alone so "McDonald" survives intact.
 */
function greetingName(contactName: string | null | undefined): string {
  const first = contactName?.trim().split(/\s+/)[0]
  if (!first) return 'there'
  if (first === first.toUpperCase() || first === first.toLowerCase()) {
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
  }
  return first
}

/**
 * Days left on the trial. 0 means the trial is over (or trial_ends_at is
 * missing, which is treated as over rather than as an endless trial).
 */
export function portalTrialDaysLeft(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
}

/** "ends in 6 days" / "ends tomorrow" / "ends today" / "has ended". */
function endsPhrase(days: number): string {
  if (days <= 0) return 'has ended'
  if (days === 1) return 'ends today'
  if (days === 2) return 'ends tomorrow'
  return `ends in ${days} days`
}

export function portalTrialNudgeSubject(product: PortalProduct, days: number): string {
  const label = product === 'manufacturer' ? 'Manufacturing' : 'Electrician Portal'
  return days > 0
    ? `Your QuotingHub ${label} trial ${endsPhrase(days)}`
    : `Your QuotingHub ${label} trial has ended`
}

export function portalTrialNudgePreheader(days: number): string {
  return days > 0
    ? 'Pick a plan and keep everything you have set up.'
    : 'Everything you built is still there — pick a plan to get back in.'
}

export function portalTrialNudgeHtml(
  product: PortalProduct,
  contactName: string | null | undefined,
  recipient: string,
  days: number,
): string {
  const firstName = greetingName(contactName)
  const p = PRODUCT[product]
  const expired = days <= 0

  const heading = expired ? 'Your trial has ended' : `Your trial ${endsPhrase(days)}`

  const body = expired
    ? `<p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 16px;">Your trial of ${p.name} has ended, so your account is locked for now.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 16px;"><strong style="color: #2C2C2A;">Nothing has been deleted.</strong> ${p.theirWork.charAt(0).toUpperCase() + p.theirWork.slice(1)} are exactly as you left them, and they come straight back the moment you pick up a plan.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 28px;">${p.priceLine}</p>`
    : `<p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 16px;">Your trial of ${p.name} ${endsPhrase(days)}.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 16px;">Everything you have set up — ${p.theirWork} — carries straight over when you pick a plan. Nothing needs to be rebuilt.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 28px;">${p.priceLine}</p>`

  const cta = expired ? 'Reactivate my account →' : p.cta

  const signoff = expired
    ? 'And if something did not work for you during the trial, reply and tell us — we would genuinely like to know what was missing.'
    : 'If you have questions, or you would like a quick walkthrough before you decide, just reply to this email — we are happy to help.'

  return `<div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #2C2C2A;">
  <img src="${BASE}/logo-email.png" alt="QuotingHub" width="48" height="48" style="height: 48px; width: 48px; object-fit: contain; margin-bottom: 32px; display: block; border: 0;" />
  <h1 style="font-size: 24px; font-weight: normal; color: #1A1A18; margin: 0 0 12px;">Hi ${firstName} — ${heading}</h1>
  ${body}
  <a href="${p.upgradeUrl}" style="display: inline-block; background-color: #9A7B4F; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-size: 14px; font-family: Arial, sans-serif; font-weight: 600;">${cta}</a>
  <p style="font-size: 13px; color: #8A877F; margin: 32px 0 0; line-height: 1.6;">${signoff}</p>
  ${marketingFooter(recipient)}
</div>`
}

export function portalTrialNudgeText(
  product: PortalProduct,
  contactName: string | null | undefined,
  days: number,
): string {
  const firstName = greetingName(contactName)
  const p = PRODUCT[product]
  const work = p.theirWork.charAt(0).toUpperCase() + p.theirWork.slice(1)

  if (days <= 0) {
    return `Hi ${firstName},

Your trial of ${p.name} has ended, so your account is locked for now.

Nothing has been deleted. ${work} are exactly as you left them, and they come straight back the moment you pick up a plan.

${p.priceLine}

Reactivate your account here:
${p.upgradeUrl}

And if something did not work for you during the trial, reply and tell us — we would genuinely like to know what was missing.

— The QuotingHub Team
quotinghub.co.za`
  }

  return `Hi ${firstName},

Your trial of ${p.name} ${endsPhrase(days)}.

Everything you have set up — ${p.theirWork} — carries straight over when you pick a plan. Nothing needs to be rebuilt.

${p.priceLine}

Pick your plan here:
${p.upgradeUrl}

If you have questions, or you would like a quick walkthrough before you decide, just reply to this email — we are happy to help.

— The QuotingHub Team
quotinghub.co.za`
}
