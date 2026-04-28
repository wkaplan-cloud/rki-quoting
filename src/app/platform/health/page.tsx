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
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/70 font-mono">{name}</span>
      <div className="flex items-center gap-2">
        {ok ? (
          <>
            <span className="text-xs text-white/30">set</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </>
        ) : (
          <>
            <span className="text-xs text-red-400">missing</span>
            <XCircle size={14} className="text-red-400" />
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
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Activity size={18} className="text-[#C4A46B]" />
          <h1 className="font-serif text-3xl text-white">System Health</h1>
        </div>
        <p className="text-sm text-white/40">Environment, table counts &amp; activity pulse</p>
      </div>

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-8 border ${
        allEnvsOk
          ? 'bg-emerald-500/10 border-emerald-500/20'
          : 'bg-amber-500/10 border-amber-500/20'
      }`}>
        {allEnvsOk
          ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          : <AlertCircle size={15} className="text-amber-400 shrink-0" />
        }
        <p className="text-sm font-medium" style={{ color: allEnvsOk ? '#34D399' : '#F59E0B' }}>
          {allEnvsOk ? 'All systems operational' : 'One or more environment variables are missing'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Env vars */}
        <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
          <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Environment Variables</h2>
          <div>
            {envVars.map(k => (
              <EnvCheck key={k} name={k} value={process.env[k]} />
            ))}
          </div>
        </div>

        {/* Table counts */}
        <div className="space-y-4">
          <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Table Row Counts</h2>
            <div className="space-y-2">
              {tableCounts.map(({ label, count }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{label}</span>
                  <span className="text-sm font-semibold text-white tabular-nums">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Recent Activity</h2>
            <div className="space-y-2.5">
              {activityChecks.map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-white/30">{label}</p>
                  <p className="text-sm text-white/70 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
