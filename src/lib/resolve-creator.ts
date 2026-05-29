import { supabaseAdmin } from './supabase/admin'

export async function resolveCreatorName(userId: string): Promise<string | null> {
  // Staff member
  const { data: staff } = await supabaseAdmin
    .from('elec_staff').select('name').eq('auth_user_id', userId).maybeSingle()
  if (staff) return staff.name

  // Account owner
  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts').select('contact_name, company_name').eq('auth_user_id', userId).maybeSingle()
  if (account) return (account.contact_name as string | null) || account.company_name || null

  // Org member (team / invited admin)
  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('name, email').eq('auth_user_id', userId).maybeSingle()
  if (mem) return (mem.name as string | null) || (mem.email as string | null) || null

  return null
}
