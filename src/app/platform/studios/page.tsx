export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Building2, Users, FolderOpen, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default async function StudiosPage() {
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })

  // For each org, get member count and project count
  const enriched = await Promise.all(
    (orgs ?? []).map(async (org) => {
      const [{ count: memberCount }, { data: adminMember }] = await Promise.all([
        supabaseAdmin.from('org_members').select('*', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'active'),
        supabaseAdmin.from('org_members').select('user_id, full_name, invited_email').eq('org_id', org.id).eq('role', 'admin').eq('status', 'active').maybeSingle(),
      ])

      // Get project count via admin user_id
      let projectCount = 0
      if (adminMember?.user_id) {
        const { count } = await supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', adminMember.user_id)
        projectCount = count ?? 0
      }

      // Get settings (business name)
      let businessName = org.name
      if (adminMember?.user_id) {
        const { data: settings } = await supabaseAdmin.from('settings').select('business_name').eq('user_id', adminMember.user_id).maybeSingle()
        if (settings?.business_name) businessName = settings.business_name
      }

      return {
        ...org,
        businessName,
        memberCount: memberCount ?? 0,
        projectCount,
        adminName: adminMember?.full_name || adminMember?.invited_email || '—',
      }
    })
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white mb-1">Studios</h1>
        <p className="text-sm text-white/40">{enriched.length} studio{enriched.length !== 1 ? 's' : ''} registered</p>
      </div>

      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Studio / Business</th>
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Admin</th>
              <th className="text-center px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">
                <div className="flex items-center justify-center gap-1"><Users size={11} /> Members</div>
              </th>
              <th className="text-center px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">
                <div className="flex items-center justify-center gap-1"><FolderOpen size={11} /> Projects</div>
              </th>
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {enriched.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-white/30 text-sm">No studios yet</td>
              </tr>
            )}
            {enriched.map(studio => (
              <tr key={studio.id} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-white font-medium">{studio.businessName}</p>
                  {studio.businessName !== studio.name && (
                    <p className="text-xs text-white/30 mt-0.5">{studio.name}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-white/60">{studio.adminName}</td>
                <td className="px-5 py-3.5 text-center text-white/60">{studio.memberCount}</td>
                <td className="px-5 py-3.5 text-center text-white/60">{studio.projectCount}</td>
                <td className="px-5 py-3.5 text-white/40 text-xs">
                  {new Date(studio.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-3.5">
                  <Link href={`/platform/studios/${studio.id}`} className="flex items-center gap-1 text-xs text-[#C4A46B] hover:underline">
                    View <ChevronRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
