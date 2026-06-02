import { supabaseAdmin } from '@/lib/supabase/admin'
import CapitalPortalClient from './CapitalPortalClient'

const ORG_ID = process.env.CAPITAL_HOTEL_ORG_ID

export default async function CapitalPortalPage() {
  let rkilogoUrl: string | null = null
  let businessName = 'R Kaplan Interiors'

  if (ORG_ID) {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('logo_url, business_name')
      .eq('org_id', ORG_ID)
      .maybeSingle()

    rkilogoUrl = data?.logo_url ?? null
    businessName = data?.business_name ?? businessName
  }

  return <CapitalPortalClient rkilogoUrl={rkilogoUrl} businessName={businessName} />
}
