export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Activity, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

function fmtDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function EnvCheck({ name, value }: { name: string; value: string | undefined }) {
  const ok = !!value
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#EAE5DB] last:border-0">
      <span className="text-sm text-[#3F3D38] font-mono">{name}</span>
      <div className="flex items-center gap-2">
        {ok ? (
          <>
            <span className="text-xs text-[#6E6B63]">set</span>
            <CheckCircle2 size={14} className="text-[#047857]" />
          </>
        ) : (
          <>
            <span className="text-xs text-[#B91C1C]">missing</span>
            <XCircle size={14} className="text-[#B91C1C]" />
          </>
        )}
      </div>
    </div>
  )
}

export default async function PlatformHealthPage() {
  const [
    { count: orgCount },
    { count: projectCount },
    { count: supplierCount },
    { count: sessionCount },
    { count: assignmentCount },
    { count: supplierAccountCount },
    { data: lastProject },
    { data: lastSession },
    { data: lastAssignment },
    { data: lastSupplierAccount },
  ] = await Promise.all([
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('suppliers').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('sourcing_sessions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('sourcing_item_assignments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('supplier_portal_accounts').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('projects').select('created_at').order('created_at', { ascending: false }).limit(1),
    supabaseAdmin.from('sourcing_sessions').select('created_at').order('created_at', { ascending: false }).limit(1),
    supabaseAdmin.from('sourcing_item_assignments').select('accepted_at').order('accepted_at', { ascending: false }).limit(1),
    supabaseAdmin.from('supplier_portal_accounts').select('created_at').order('created_at', { ascending: false }).limit(1),
  ])

  const envVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PLATFORM_ADMIN_EMAIL',
    'RESEND_API_KEY',
    'TURNSTILE_SECRET_KEY',
  ]

  const tableCounts = [
    { label: 'Organizations (studios)', count: orgCount ?? 0 },
    { label: 'Projects', count: projectCount ?? 0 },
    { label: 'Supplier records', count: supplierCount ?? 0 },
    { label: 'Sourcing sessions', count: sessionCount ?? 0 },
    { label: 'Item assignments', count: assignmentCount ?? 0 },
    { label: 'Supplier portal accounts', count: supplierAccountCount ?? 0 },
  ]

  const activityChecks = [
    { label: 'Last project created', value: fmtDate(lastProject?.[0]?.created_at ?? null) },
    { label: 'Last sourcing session', value: fmtDate(lastSession?.[0]?.created_at ?? null) },
    { label: 'Last item accepted', value: fmtDate(lastAssignment?.[0]?.accepted_at ?? null) },
    { label: 'Last supplier registered', value: fmtDate(lastSupplierAccount?.[0]?.created_at ?? null) },
  ]

  const allEnvsOk = envVars.every(k => !!process.env[k])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Activity size={18} className="text-[#7E6036]" />
          <h1 className="font-serif text-3xl text-[#1A1A18]">System Health</h1>
        </div>
        <p className="text-sm text-[#6E6B63]">Environment, table counts &amp; activity pulse</p>
      </div>

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-8 border ${
        allEnvsOk
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        {allEnvsOk
          ? <CheckCircle2 size={15} className="text-[#047857] shrink-0" />
          : <AlertCircle size={15} className="text-[#8F5706] shrink-0" />
        }
        <p className="text-sm font-medium" style={{ color: allEnvsOk ? '#047857' : '#8F5706' }}>
          {allEnvsOk ? 'All systems operational' : 'One or more environment variables are missing'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Env vars */}
        <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5">
          <h2 className="text-xs font-medium text-[#6E6B63] uppercase tracking-wider mb-4">Environment Variables</h2>
          <div>
            {envVars.map(k => (
              <EnvCheck key={k} name={k} value={process.env[k]} />
            ))}
          </div>
        </div>

        {/* Table counts */}
        <div className="space-y-4">
          <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5">
            <h2 className="text-xs font-medium text-[#6E6B63] uppercase tracking-wider mb-4">Table Row Counts</h2>
            <div className="space-y-2">
              {tableCounts.map(({ label, count }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-[#3F3D38]">{label}</span>
                  <span className="text-sm font-semibold text-[#1A1A18] tabular-nums">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5">
            <h2 className="text-xs font-medium text-[#6E6B63] uppercase tracking-wider mb-4">Recent Activity</h2>
            <div className="space-y-2.5">
              {activityChecks.map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-[#6E6B63]">{label}</p>
                  <p className="text-sm text-[#3F3D38] mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
