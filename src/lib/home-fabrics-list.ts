import type { SupabaseClient } from '@supabase/supabase-js'

// The Twinbru catalogue/price crons feed ONLY the Home Fabrics platform list.
// Other global lists (Hertex etc.) share price_list_items, so every cron read,
// write and delete must be scoped to this list id — matching on product_id
// alone reaches into other suppliers' rows.
export async function getHomeFabricsListId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('price_lists')
    .select('id')
    .eq('is_global', true)
    .eq('supplier_name', 'Home Fabrics')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}
