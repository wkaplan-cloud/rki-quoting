export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { ArrowLeft, Users, FolderOpen, Mail, Phone, MapPin, Calendar } from 'lucide-react'
import Link from 'next/link'
import { SubscriptionPanel } from './SubscriptionPanel'

export default async function StudioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: org } = await supabaseAdmin.from('organizations').select('*').eq('id', id).maybeSingle()
  if (!org) notFound()

  const { data: members } = await supabaseAdmin
    .from('org_members')
    .select('*')
    .eq('org_id', id)
    .order('invited_at')

  const adminMember = members?.find(m => m.role === 'admin' && m.status === 'active')

  const [{ data: settings }, { data: projects }] = await Promise.all([
    adminMember?.user_id
      ? supabaseAdmin.from('settings').select('*').eq('user_id', adminMember.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    adminMember?.user_id
      ? supabaseAdmin.from('projects').select('id, project_name, project_number, status, created_at').eq('user_id', adminMember.user_id).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ])

  const statusColour: Record<string, string> = {
    Quote: 'bg-blue-500/10 text-blue-400',
    Invoice: 'bg-amber-500/10 text-amber-400',
    Completed: 'bg-emerald-500/10 text-emerald-400',
    Cancelled: 'bg-red-500/10 text-red-400',
  }

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/platform/studios" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-6">
        <ArrowLeft size={14} /> All studios
      </Link>

      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white mb-1">{settings?.business_name || org.name}</h1>
        <p className="text-sm text-white/40">
          Joined {new Date(org.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Studio Settings */}
        <div className="lg:col-span-2 bg-[#1A1A18] border border-white/10 rounded-xl p-5">
          <h2 className="text-xs text-white/40 uppercase tracking-wider mb-4">Studio Details</h2>
          <dl className="space-y-3">
            {[
              { label: 'Business name', value: settings?.business_name },
              { label: 'Business address', value: settings?.business_address },
              { label: 'VAT number', value: settings?.vat_number },
              { label: 'Company registration', value: settings?.company_registration },
              { label: 'Bank name', value: settings?.bank_name },
              { label: 'Bank account', value: settings?.bank_account_number },
              { label: 'Bank branch code', value: settings?.bank_branch_code },
              { label: 'Email from', value: settings?.email_from },
              { label: 'VAT rate', value: settings?.vat_rate != null ? `${settings.vat_rate}%` : undefined },
              { label: 'Deposit %', value: settings?.deposit_percentage != null ? `${settings.deposit_percentage}%` : undefined },
            ].filter(r => r.value).map(({ label, value }) => (
              <div key={label} className="flex gap-4">
                <dt className="text-xs text-white/30 w-36 flex-shrink-0 pt-0.5">{label}</dt>
                <dd className="text-sm text-white/80">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Quick stats */}
        <div className="space-y-3">
          <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#C4A46B]/10 flex items-center justify-center">
              <Users size={16} className="text-[#C4A46B]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{members?.filter(m => m.status === 'active').length ?? 0}</p>
              <p className="text-xs text-white/40">Active members</p>
            </div>
          </div>
          <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <FolderOpen size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{projects?.length ?? 0}</p>
              <p className="text-xs text-white/40">Projects</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription management */}
      <SubscriptionPanel
        orgId={id}
        plan={org.plan ?? 'trial'}
        status={org.subscription_status ?? 'trialing'}
        trialEndsAt={org.trial_ends_at ?? null}
      />

      {/* Members */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white flex items-center gap-2"><Users size={14} className="text-[#C4A46B]" /> Team members</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Name</th>
              <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Email</th>
              <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Role</th>
              <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {members?.map(m => (
              <tr key={m.id}>
                <td className="px-5 py-3 text-white/80">{m.full_name || '—'}</td>
                <td className="px-5 py-3 text-white/50">{m.invited_email || '—'}</td>
                <td className="px-5 py-3 text-white/50 capitalize">{m.role}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent projects */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white flex items-center gap-2"><FolderOpen size={14} className="text-[#C4A46B]" /> Recent projects</h2>
        </div>
        {!projects?.length ? (
          <p className="px-5 py-8 text-sm text-white/30 text-center">No projects yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Project</th>
                <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Number</th>
                <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Status</th>
                <th className="text-left px-5 py-2.5 text-xs text-white/30 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {projects.map(p => (
                <tr key={p.id}>
                  <td className="px-5 py-3 text-white/80">{p.project_name}</td>
                  <td className="px-5 py-3 text-white/40">{p.project_number}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColour[p.status] ?? 'bg-white/5 text-white/40'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-white/40 text-xs">
                    {new Date(p.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
