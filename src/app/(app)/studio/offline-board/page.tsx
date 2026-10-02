export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { OfflineBoardLoader } from './OfflineBoardLoader'

// Opens a board straight from this device — one created with no signal, which
// the server has never seen, so /studio/board/[id] cannot render it. The board
// itself (id in the URL hash, slides in IndexedDB) is read in the browser;
// this page supplies only what belongs to the designer and the org, and is
// the same HTML for every board, so one cached copy serves them all offline.
export default async function StudioOfflineBoardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) redirect('/dashboard')

  const [{ data: settings }, { data: member }, { data: supplierRows }, { data: accessRows }] = await Promise.all([
    supabaseAdmin
      .from('settings')
      .select('studio_enabled, logo_url, studio_logo_url, business_name')
      .eq('org_id', orgId)
      .maybeSingle(),
    supabaseAdmin
      .from('org_members')
      .select('full_name')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('suppliers').select('id, supplier_name, is_platform, price_list_id').order('supplier_name'),
    supabaseAdmin.from('price_list_access').select('price_list_id').eq('org_id', orgId).eq('status', 'active'),
  ])

  if (!settings?.studio_enabled) redirect('/dashboard')

  return (
    <OfflineBoardLoader
      orgId={orgId}
      userId={user.id}
      userName={member?.full_name || user.email || null}
      businessName={settings.business_name ?? ''}
      logoUrl={settings.studio_logo_url ?? settings.logo_url ?? null}
      studioLogoUrl={settings.studio_logo_url ?? null}
      orgLogoUrl={settings.logo_url ?? null}
      suppliers={(supplierRows ?? []).map(su => ({
        id: su.id as string,
        name: su.supplier_name as string,
        isPlatform: !!su.is_platform,
        priceListId: (su.price_list_id as string | null) ?? null,
      }))}
      activePriceListIds={(accessRows ?? []).map(a => a.price_list_id as string)}
    />
  )
}
