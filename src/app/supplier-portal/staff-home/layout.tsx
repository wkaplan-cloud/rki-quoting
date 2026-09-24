import { NumberInputAutoSelect } from '@/components/NumberInputAutoSelect'
import { SessionExpiredHandler } from '@/components/SessionExpiredHandler'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTradeType } from '@/lib/trade-type'
import type { TradeType } from '@/lib/portal-theme'
import { StaffTradeProvider } from './StaffTradeContext'

export default async function StaffHomeLayout({ children }: { children: React.ReactNode }) {
  // Pages below do their own auth and redirects; this only picks the trade,
  // and falls back to electrician when there is no staff session to read.
  let tradeType: TradeType = 'electrician'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: staff } = await supabaseAdmin
      .from('elec_staff').select('portal_account_id')
      .eq('auth_user_id', user.id).eq('is_active', true).maybeSingle()
    if (staff) tradeType = await getTradeType(staff.portal_account_id)
  }

  return (
    <StaffTradeProvider tradeType={tradeType}>
      <SessionExpiredHandler loginPath="/supplier-portal/login" />
      <NumberInputAutoSelect />
      {children}
    </StaffTradeProvider>
  )
}
