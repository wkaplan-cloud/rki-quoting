export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { MarkupCalculatorContent } from './MarkupCalculatorContent'

export default async function MarkupCalculatorPage() {
  const supabase = await createClient()

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  const { data: org } = orgId
    ? await supabaseAdmin.from('organizations').select('plan').eq('id', orgId).single()
    : { data: null }
  if (org?.plan === 'solo') redirect('/dashboard')

  return <MarkupCalculatorContent />
}
