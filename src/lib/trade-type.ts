import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isTradeType, type TradeType } from '@/lib/portal-theme'

/**
 * The trade of a trades-portal account.
 *
 * Read on its own rather than added to resolvePortalAccount's select: that
 * select runs on every authenticated request, so a missing column there would
 * lock everyone out. Here a missing column or row just means "electrician",
 * which is what every account was before installers existed.
 */
export const getTradeType = cache(async (portalAccountId: string): Promise<TradeType> => {
  const { data, error } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('trade_type')
    .eq('id', portalAccountId)
    .maybeSingle()

  if (error || !data) return 'electrician'
  const trade = (data as { trade_type?: unknown }).trade_type
  return isTradeType(trade) ? trade : 'electrician'
})
