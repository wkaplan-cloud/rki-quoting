import { marketingFooter } from './email'

/**
 * Trial nudge — sent from the platform Studios page to studios that are still
 * in their trial or whose trial has run out.
 *
 * Two variants off one template, because the ask is different: a studio still
 * in trial is being asked to choose a plan before the clock runs out, while an
 * expired one is being asked to come back and needs reassuring that nothing
 * was deleted.
 *
 * This is lifecycle marketing, not transactional — send it with bulkPayload()
 * so it carries one-click unsubscribe headers, and check the suppression list
 * before sending.
 */

const SUBSCRIBE_URL = 'https://www.quotinghub.co.za/subscribe'

/** Entry price per plan, kept in step with subscribe/SubscribeClient.tsx. */
const PRICE_LINE = 'Plans start at R699/month for solo, R1,499/month for a studio.'

/**
 * First name for the greeting, from a full name that may be missing or badly
 * cased. Falls back to "there", fixes an all-lowercase or SHOUTING name, and
 * leaves anything already mixed-case alone so "McDonald" survives intact.
 */
function greetingName(fullName: string | null | undefined): string {
  const first = fullName?.trim().split(/\s+/)[0]
  if (!first) return 'there'
  if (first === first.toUpperCase() || first === first.toLowerCase()) {
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
  }
  return first
}

/**
 * Days left on the trial, from the org's trial_ends_at. 0 means the trial is
 * over (or the date is missing, which we treat as over rather than as an
 * infinite trial).
 */
export function trialDaysLeft(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
}

/** "ends in 6 days" / "ends tomorrow" / "ends today" — used in body and subject. */
function endsPhrase(days: number): string {
  if (days <= 0) return 'has ended'
  if (days === 1) return 'ends today'
  if (days === 2) return 'ends tomorrow'
  return `ends in ${days} days`
}

export function trialNudgeSubject(days: number): string {
  return days > 0
    ? `Your QuotingHub trial ${endsPhrase(days)}`
    : 'Your QuotingHub trial has ended'
}

export function trialNudgePreheader(days: number): string {
  return days > 0
    ? 'Pick a plan and keep everything you have set up.'
    : 'Your quotes and projects are safe — pick a plan to pick up where you left off.'
}

export function trialNudgeHtml(
  fullName: string | null | undefined,
  recipient: string,
  days: number,
): string {
  const firstName = greetingName(fullName)
  const expired = days <= 0

  const heading = expired
    ? 'Your trial has ended'
    : `Your trial ${endsPhrase(days)}`

  const body = expired
    ? `<p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 16px;">Your QuotingHub trial has ended, so your studio is on hold for now.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 16px;"><strong style="color: #2C2C2A;">Nothing has been deleted.</strong> Your quotes, projects, clients and price lists are exactly as you left them, and they come straight back the moment you choose a plan.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 28px;">${PRICE_LINE} Change or cancel at any time.</p>`
    : `<p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 16px;">Your QuotingHub trial ${endsPhrase(days)}.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 16px;">Everything you have set up — your quotes, projects, clients and price lists — stays exactly as it is when you pick a plan. Nothing needs to be rebuilt.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 28px;">${PRICE_LINE} You can change or cancel at any time.</p>`

  const cta = expired ? 'Reactivate your studio →' : 'Choose your plan →'

  const signoff = expired
    ? 'And if something did not work for you during the trial, reply and tell us — we would genuinely like to know what was missing.'
    : 'If you have questions, or you would like a quick walkthrough before you decide, just reply to this email — we are happy to help.'

  return `<div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #2C2C2A;">
  <img src="https://www.quotinghub.co.za/logo-email.png" alt="QuotingHub" width="48" height="48" style="height: 48px; width: 48px; object-fit: contain; margin-bottom: 32px; display: block; border: 0;" />
  <h1 style="font-size: 24px; font-weight: normal; color: #1A1A18; margin: 0 0 12px;">Hi ${firstName} — ${heading}</h1>
  ${body}
  <a href="${SUBSCRIBE_URL}" style="display: inline-block; background-color: #9A7B4F; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-size: 14px; font-family: Arial, sans-serif; font-weight: 600;">${cta}</a>
  <p style="font-size: 13px; color: #8A877F; margin: 32px 0 0; line-height: 1.6;">${signoff}</p>
  ${marketingFooter(recipient)}
</div>`
}

export function trialNudgeText(fullName: string | null | undefined, days: number): string {
  const firstName = greetingName(fullName)

  if (days <= 0) {
    return `Hi ${firstName},

Your QuotingHub trial has ended, so your studio is on hold for now.

Nothing has been deleted. Your quotes, projects, clients and price lists are exactly as you left them, and they come straight back the moment you choose a plan.

${PRICE_LINE} Change or cancel at any time.

Reactivate your studio here:
${SUBSCRIBE_URL}

And if something did not work for you during the trial, reply and tell us — we would genuinely like to know what was missing.

— The QuotingHub Team
quotinghub.co.za`
  }

  return `Hi ${firstName},

Your QuotingHub trial ${endsPhrase(days)}.

Everything you have set up — your quotes, projects, clients and price lists — stays exactly as it is when you pick a plan. Nothing needs to be rebuilt.

${PRICE_LINE} You can change or cancel at any time.

Choose your plan here:
${SUBSCRIBE_URL}

If you have questions, or you would like a quick walkthrough before you decide, just reply to this email — we are happy to help.

— The QuotingHub Team
quotinghub.co.za`
}
