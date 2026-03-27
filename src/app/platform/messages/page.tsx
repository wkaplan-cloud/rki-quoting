export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { MessagesClient } from './MessagesClient'

export default async function MessagesPage() {
  const { data: submissions } = await supabaseAdmin
    .from('contact_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white mb-1">Messages</h1>
        <p className="text-sm text-white/40">
          {submissions?.filter(s => !s.read).length ?? 0} unread · {submissions?.length ?? 0} total
        </p>
      </div>
      <MessagesClient submissions={submissions ?? []} />
    </div>
  )
}
