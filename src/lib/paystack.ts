/**
 * Cancel a Paystack subscription.
 *
 * Disabling needs the per-subscription email token, which only the subscription
 * endpoint hands back, so this is always two calls. Never throws — a failed
 * cancellation must not block the payment flow that calls it.
 *
 * Returns true only when Paystack accepted the disable.
 */
export async function disablePaystackSubscription(code: string, secretKey: string): Promise<boolean> {
  try {
    const subRes = await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(code)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const subData = await subRes.json()
    const emailToken = subData?.data?.email_token
    if (!emailToken) return false

    const disableRes = await fetch('https://api.paystack.co/subscription/disable', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, token: emailToken }),
    })
    return disableRes.ok
  } catch {
    return false
  }
}
