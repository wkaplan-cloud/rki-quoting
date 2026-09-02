import { marketingFooter } from './email'

/**
 * "Complete your setup" onboarding nudge.
 *
 * Sent both manually (platform admin) and automatically (cron), so the copy
 * lives here rather than being duplicated in both routes.
 *
 * This is lifecycle marketing, not transactional — send it with bulkPayload()
 * so it carries one-click unsubscribe headers, and check the suppression list
 * before sending.
 */

const ONBOARDING_URL = 'https://www.quotinghub.co.za/onboarding'

export function nudgeHtml(firstName: string, recipient: string): string {
  return `<div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #2C2C2A;">
  <img src="https://quotinghub.co.za/logo.png" alt="QuotingHub" style="height: 48px; width: auto; object-fit: contain; margin-bottom: 32px; display: block;" />
  <h1 style="font-size: 24px; font-weight: normal; color: #1A1A18; margin: 0 0 12px;">You are almost set up, ${firstName}!</h1>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 16px;">You confirmed your account but your studio setup is not quite finished yet. Add your business details and you will be ready to start quoting straight away.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5A5751; margin: 0 0 28px;">It only takes about 2 minutes.</p>
  <a href="${ONBOARDING_URL}" style="display: inline-block; background-color: #9A7B4F; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-size: 14px; font-family: Arial, sans-serif; font-weight: 600;">Complete your setup →</a>
  <p style="font-size: 13px; color: #8A877F; margin: 32px 0 0; line-height: 1.6;">If you have any questions or run into any issues, just reply to this email — we are happy to help.</p>
  ${marketingFooter(recipient)}
</div>`
}

export function nudgeText(firstName: string): string {
  return `Hi ${firstName},

You confirmed your QuotingHub account but your studio setup is not quite finished yet.

It only takes about 2 minutes — just add your business details and you will be ready to start quoting.

Complete your setup here:
${ONBOARDING_URL}

If you have any questions, just reply to this email — we are happy to help.

— The QuotingHub Team
quotinghub.co.za`
}
