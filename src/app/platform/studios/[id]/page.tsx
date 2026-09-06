export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { ArrowLeft, Users, FolderOpen, ArrowLeftRight, Clock } from 'lucide-react'
import Link from 'next/link'
import { SubscriptionPanel } from './SubscriptionPanel'
import { ArchiveStudioButton, RestoreStudioButton, DeleteStudioButton } from './DeleteStudioButton'
import { StudioNotes } from './StudioNotes'
import { BrandingPanel } from './BrandingPanel'
import { FeatureTogglesPanel } from './FeatureTogglesPanel'
import { ImpersonateButton } from './ImpersonateButton'
import { one, type Embedded } from '@/lib/supabase/embed'

// `organizations` and `settings` are selected with `*`, so the client infers no
// columns for them; these name the fields this page actually reads.
interface OrgDetailRow {
  is_internal?: boolean | null
  platform_notes?: string | null
}
interface SettingsDetailRow {
  letterhead_url?: string | null
  letterhead_filename?: string | null
}
interface SourcingSessionListRow {
  id: string
  title: string | null
  status: string | null
  created_at: string
}

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

  const [{ data: settings }, { data: projects }, { data: sourcingSessions }, { data: lastProjectRow }] = await Promise.all([
    supabaseAdmin.from('settings').select('*').eq('org_id', id).maybeSingle(),
    supabaseAdmin.from('projects').select('id, project_name, project_number, status, created_at').eq('org_id', id).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('sourcing_sessions').select('id, title, status, created_at').eq('org_id', id).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('projects').select('created_at').eq('org_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // Sourcing fee for this studio
  let studioTotalFee = 0
  let studioAcceptedCount = 0
  if (sourcingSessions && sourcingSessions.length > 0) {
    const sessionIds = (sourcingSessions as SourcingSessionListRow[]).map(s => s.id)
    const { data: itemsInSessions } = await supabaseAdmin
      .from('sourcing_session_items')
      .select('id')
      .in('session_id', sessionIds)
    const itemIds = ((itemsInSessions ?? []) as { id: string }[]).map(i => i.id)
    if (itemIds.length > 0) {
      const { data: accepted } = await supabaseAdmin
        .from('sourcing_item_assignments')
        .select('response:sourcing_item_responses(unit_price)')
        .in('item_id', itemIds)
        .eq('status', 'accepted')
      studioAcceptedCount = (accepted ?? []).length
      for (const a of accepted ?? []) {
        const response = one((a as { response?: Embedded<{ unit_price: number | null }> }).response)
        studioTotalFee += (response?.unit_price ?? 0) * 0.01
      }
    }
  }

  function fmtFee(n: number) {
    return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const statusColour: Record<string, string> = {
    Quote: 'bg-teal-50 text-[#0F766E]',
    Invoice: 'bg-amber-50 text-[#8F5706]',
    Completed: 'bg-emerald-50 text-[#047857]',
    Cancelled: 'bg-red-50 text-[#B91C1C]',
  }

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/platform/studios" className="inline-flex items-center gap-1.5 text-sm text-[#6E6B63] hover:text-[#1A1A18] transition-colors mb-6">
        <ArrowLeft size={14} /> All studios
      </Link>

      {org.status === 'archived' && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-[#8F5706] text-xs font-medium">Archived</span>
          <span className="text-[#6E6B63] text-xs">·</span>
          <span className="text-[#6E6B63] text-xs">
            {org.archived_at ? `Archived on ${new Date(org.archived_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'This studio has been archived'}
          </span>
          <span className="text-[#8A877F] text-xs ml-1">· Data deleted after 24 months</span>
        </div>
      )}

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[#1A1A18] mb-1">{settings?.business_name || org.name}</h1>
          <p className="text-sm text-[#6E6B63]">
            Joined {new Date(org.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {org.status !== 'archived' && (
            <ImpersonateButton orgId={id} studioName={settings?.business_name || org.name} adminEmail={adminMember?.invited_email ?? null} />
          )}
          {org.status === 'archived' ? (
            <>
              <RestoreStudioButton orgId={id} studioName={settings?.business_name || org.name} />
              <DeleteStudioButton orgId={id} studioName={settings?.business_name || org.name} />
            </>
          ) : (
            <ArchiveStudioButton orgId={id} studioName={settings?.business_name || org.name} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Studio Settings */}
        <div className="lg:col-span-2 bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5">
          <h2 className="text-xs text-[#6E6B63] uppercase tracking-wider mb-4">Studio Details</h2>
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
                <dt className="text-xs text-[#6E6B63] w-36 flex-shrink-0 pt-0.5">{label}</dt>
                <dd className="text-sm text-[#2C2C2A]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Quick stats */}
        <div className="space-y-3">
          <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#7E6036]/10 flex items-center justify-center">
              <Users size={16} className="text-[#7E6036]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#1A1A18]">{members?.filter(m => m.status === 'active').length ?? 0}</p>
              <p className="text-xs text-[#6E6B63]">Active members</p>
            </div>
          </div>
          <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FolderOpen size={16} className="text-[#047857]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#1A1A18]">{projects?.length ?? 0}</p>
              <p className="text-xs text-[#6E6B63]">Projects</p>
            </div>
          </div>
          <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#7E6036]/10 flex items-center justify-center">
              <ArrowLeftRight size={16} className="text-[#7E6036]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#1A1A18]">{sourcingSessions?.length ?? 0}</p>
              <p className="text-xs text-[#6E6B63]">Sourcing sessions</p>
            </div>
          </div>
          <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Clock size={16} className="text-[#0F766E]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A1A18]">
                {lastProjectRow?.created_at
                  ? new Date(lastProjectRow.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Never'}
              </p>
              <p className="text-xs text-[#6E6B63]">Last project created</p>
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
        isInternal={(org as OrgDetailRow).is_internal ?? false}
      />

      {/* Branding & PDF Template */}
      {adminMember?.user_id && (
        <BrandingPanel
          orgId={id}
          adminUserId={adminMember.user_id}
          logoUrl={settings?.logo_url ?? null}
          letterheadUrl={(settings as SettingsDetailRow | null)?.letterhead_url ?? null}
          letterheadFilename={(settings as SettingsDetailRow | null)?.letterhead_filename ?? null}
          currentTemplate={settings?.pdf_template ?? null}
          currentTheme={settings?.pdf_color_theme ?? null}
        />
      )}

      {/* Feature toggles */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <FeatureTogglesPanel orgId={id} studioEnabled={(settings as any)?.studio_enabled ?? false} lineItemImagesEnabled={(settings as any)?.line_item_images_enabled ?? false} />

      {/* Internal notes */}
      <StudioNotes orgId={id} initial={(org as OrgDetailRow).platform_notes ?? null} />

      {/* Members */}
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-[#DED8CC]">
          <h2 className="text-sm font-medium text-[#1A1A18] flex items-center gap-2"><Users size={14} className="text-[#7E6036]" /> Team members</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#EAE5DB]">
              <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Name</th>
              <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Email</th>
              <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Role</th>
              <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFEBE3]">
            {members?.map(m => (
              <tr key={m.id}>
                <td className="px-5 py-3 text-[#2C2C2A]">{m.full_name || '—'}</td>
                <td className="px-5 py-3 text-[#5C5A54]">{m.invited_email || '—'}</td>
                <td className="px-5 py-3 text-[#5C5A54] capitalize">{m.role}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-emerald-50 text-[#047857]' : 'bg-[#EFEBE3] text-[#6E6B63]'}`}>
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent projects */}
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-[#DED8CC]">
          <h2 className="text-sm font-medium text-[#1A1A18] flex items-center gap-2"><FolderOpen size={14} className="text-[#7E6036]" /> Recent projects</h2>
        </div>
        {!projects?.length ? (
          <p className="px-5 py-8 text-sm text-[#6E6B63] text-center">No projects yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EAE5DB]">
                <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Project</th>
                <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Number</th>
                <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Status</th>
                <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE3]">
              {projects.map(p => (
                <tr key={p.id}>
                  <td className="px-5 py-3 text-[#2C2C2A]">{p.project_name}</td>
                  <td className="px-5 py-3 text-[#6E6B63]">{p.project_number}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColour[p.status] ?? 'bg-[#EFEBE3] text-[#6E6B63]'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#6E6B63] text-xs">
                    {new Date(p.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sourcing activity */}
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DED8CC] flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#1A1A18] flex items-center gap-2">
              <ArrowLeftRight size={14} className="text-[#7E6036]" /> Sourcing activity
            </h2>
            <div className="flex items-center gap-4 text-xs text-[#6E6B63]">
              <span>{sourcingSessions?.length ?? 0} sessions</span>
              <span>{studioAcceptedCount} items accepted</span>
              <span className="text-[#7E6036] font-semibold">{fmtFee(studioTotalFee)} fees generated</span>
            </div>
          </div>
          {!sourcingSessions?.length ? (
            <p className="px-5 py-8 text-sm text-[#6E6B63] text-center">No sourcing sessions yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EAE5DB]">
                  <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Session</th>
                  <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Status</th>
                  <th className="text-left px-5 py-2.5 text-xs text-[#6E6B63] font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE3]">
                {((sourcingSessions ?? []) as SourcingSessionListRow[]).map(s => {
                  const statusColor: Record<string, string> = {
                    draft: '#5C5A54', sent: '#0369A1', in_progress: '#8F5706',
                    completed: '#047857', archived: '#6E6B63',
                  }
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-3 text-[#2C2C2A]">{s.title}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium capitalize" style={{ color: statusColor[s.status ?? ''] ?? '#5C5A54' }}>
                          {(s.status ?? 'unknown').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#6E6B63] text-xs">
                        {new Date(s.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
    </div>
  )
}
