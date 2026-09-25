import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'
import { getTradeType } from '@/lib/trade-type'
import { tradesPlansFor } from '@/lib/plan-features'
import { UpgradeClient } from './UpgradeClient'

/** Picks the plans this trades account can buy — installer or electrician — and hands them to the screen. */
export default async function UpgradePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const account = user ? await resolvePortalAccount(user.id) : null
  const tradeType = account ? await getTradeType(account.id) : 'electrician'
  const plans = tradesPlansFor(tradeType).map(({ id, label, price, tagline, features }) => ({ id, label, price, tagline, features }))
  return <UpgradeClient plans={plans} installer={tradeType === 'installer'} />
}
