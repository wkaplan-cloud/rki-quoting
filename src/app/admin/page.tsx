export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminPanel } from './AdminPanel'

export default async function AdminPage() {
  // Simple password check via cookie/query
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all users' project counts via admin service role (optional — uses anon here for safety)
  // In production, use SUPABASE_SERVICE_ROLE_KEY in a separate server action
  const { data: projects } = await supabase.from('projects').select('id, user_id, status, created_at')
  const { data: lineItemCount } = await supabase.from('line_items').select('id', { count: 'exact', head: true })

  const totalProjects = projects?.length ?? 0
  const openQuotes = projects?.filter(p => p.status === 'Quote').length ?? 0
  const completed = projects?.filter(p => p.status === 'Completed').length ?? 0

  return (
    <AdminPanel
      currentUserEmail={user.email ?? ''}
      stats={{ totalProjects, openQuotes, completed, lineItems: (lineItemCount as any) ?? 0 }}
    />
  )
}
