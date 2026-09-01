export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Store, Globe, Phone, MapPin, BarChart3 } from 'lucide-react'
import { PortalAccountLinker } from './PortalAccountLinker'
import { SupplierCategoryBadge } from './SupplierCategoryBadge'
import { one, type Embedded } from '@/lib/supabase/embed'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function PlatformSuppliersPage() {
  const { data: accounts } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, company_name, contact_name, phone, website, address, categories, description, created_at, linked_portal_account_id, supplier_category, plan, subscription_status, trial_ends_at')
    .order('created_at', { ascending: false })

  const rows = accounts ?? []

  // All session-supplier rows for analytics
  const { data: sessionSuppliers } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('email, status, supplier_name, session:sourcing_sessions(org_id)')

  // Build per-email analytics
  const supplierStats: Record<string, {
    contactCount: number
    respondedCount: number
    acceptedCount: number
    studioIds: Set<string>
  }> = {}

  const orgIds = new Set<string>()
  for (const ss of sessionSuppliers ?? []) {
    const email = (ss.email ?? '').toLowerCase()
    if (!supplierStats[email]) {
      supplierStats[email] = { contactCount: 0, respondedCount: 0, acceptedCount: 0, studioIds: new Set() }
    }
    supplierStats[email].contactCount++
    if (['responded', 'completed', 'in_progress'].includes(ss.status)) {
      supplierStats[email].respondedCount++
    }
    const session = Array.isArray(ss.session) ? ss.session[0] : ss.session
    if (session?.org_id) {
      supplierStats[email].studioIds.add(session.org_id)
      orgIds.add(session.org_id)
    }
  }

  // Also track accepted assignments per supplier email
  const { data: acceptedItems } = await supabaseAdmin
    .from('sourcing_item_assignments')
    .select('supplier:sourcing_session_suppliers(email)')
    .eq('status', 'accepted')

  for (const a of acceptedItems ?? []) {
    const supplier = one((a as { supplier?: Embedded<{ email: string | null }> }).supplier)
    const email = (supplier?.email ?? '').toLowerCase()
    if (supplierStats[email]) {
      supplierStats[email].acceptedCount++
    }
  }

  // Studio name map
  const studioMap: Record<string, string> = {}
  if (orgIds.size > 0) {
    const { data: settingsRows } = await supabaseAdmin
      .from('settings')
      .select('org_id, business_name')
      .in('org_id', [...orgIds])
    for (const s of settingsRows ?? []) {
      if (s.org_id) studioMap[s.org_id] = s.business_name ?? '—'
    }
  }

  const activeEmails = new Set(
    Object.entries(supplierStats)
      .filter(([, s]) => s.respondedCount > 0 || s.acceptedCount > 0)
      .map(([email]) => email)
  )
  const activeCount = rows.filter(r => activeEmails.has(r.email?.toLowerCase())).length

  // Top suppliers by accepted items (all, not just registered)
  const topSuppliers = Object.entries(supplierStats)
    .filter(([, s]) => s.acceptedCount > 0)
    .sort((a, b) => b[1].acceptedCount - a[1].acceptedCount)
    .slice(0, 10)
    .map(([email, s]) => {
      const account = rows.find(r => r.email?.toLowerCase() === email)
      return {
        email,
        name: account?.company_name ?? email,
        contactCount: s.contactCount,
        respondedCount: s.respondedCount,
        acceptedCount: s.acceptedCount,
        studioCount: s.studioIds.size,
        studios: [...s.studioIds].map(id => studioMap[id] ?? 'Studio'),
        registered: !!account,
      }
    })

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Store size={18} className="text-[#C4A46B]" />
          <h1 className="font-serif text-3xl text-white">Registered Suppliers</h1>
        </div>
        <p className="text-sm text-white/40">Supplier portal accounts, activity analytics &amp; studio usage</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total registered', value: rows.length.toString() },
          { label: 'Active (responded)', value: activeCount.toString() },
          { label: 'On free trial', value: rows.filter(r => {
            const ra = r as any
            return ra.subscription_status === 'trialing' && ra.trial_ends_at && new Date(ra.trial_ends_at) > new Date()
          }).length.toString(), highlight: true },
          { label: 'New this month', value: rows.filter(r => {
            if (!r.created_at) return false
            const d = new Date(r.created_at)
            const now = new Date()
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          }).length.toString() },
        ].map(({ label, value, highlight }) => (
          <div key={label} className={`border rounded-xl p-5 ${highlight ? 'bg-[#1A1A10] border-[#C4A46B]/30' : 'bg-[#1A1A18] border-white/10'}`}>
            <span className={`text-xs uppercase tracking-wider block mb-3 ${highlight ? 'text-[#C4A46B]/60' : 'text-white/40'}`}>{label}</span>
            <p className={`text-2xl font-semibold ${highlight ? 'text-[#C4A46B]' : 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Studio ↔ Supplier analytics */}
      {topSuppliers.length > 0 && (
        <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
            <BarChart3 size={14} className="text-[#C4A46B]" />
            <h2 className="text-sm font-medium text-white">Supplier Usage Analytics</h2>
            <p className="text-xs text-white/30 ml-2">Top suppliers by accepted items across all studios</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Supplier', 'Studios', 'Contacted', 'Responded', 'Items accepted', 'Registered'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-white/30 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topSuppliers.map(s => (
                  <tr key={s.email} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-white font-medium">{s.name}</p>
                      <p className="text-white/30 text-xs">{s.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.studios.slice(0, 3).map(studio => (
                          <span key={studio} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/50 whitespace-nowrap">{studio}</span>
                        ))}
                        {s.studios.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 whitespace-nowrap">+{s.studios.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/60 whitespace-nowrap tabular-nums">{s.contactCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      <span className="text-white/60">{s.respondedCount}</span>
                      {s.contactCount > 0 && (
                        <span className="text-white/30 text-xs ml-1">({Math.round(s.respondedCount / s.contactCount * 100)}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[#C4A46B] font-semibold tabular-nums">{s.acceptedCount}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.registered ? 'bg-emerald-950 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                        {s.registered ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Portal account linking */}
      <PortalAccountLinker accounts={rows.map(r => ({
        id: r.id,
        email: r.email,
        company_name: r.company_name ?? null,
        contact_name: (r as any).contact_name ?? null,
        linked_portal_account_id: (r as any).linked_portal_account_id ?? null,
      }))} />

      {/* Supplier accounts table */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white">Supplier Accounts</h2>
          <p className="text-xs text-white/30 mt-0.5">All companies registered on the supplier portal</p>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-sm text-white/30 text-center">No registered suppliers yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Company', 'Email', 'Type', 'Subscription', 'Categories', 'Contact', 'Requests', 'Registered', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map(row => {
                  const isActive = activeEmails.has(row.email?.toLowerCase())
                  const cats: string[] = Array.isArray(row.categories) ? row.categories : []
                  const stats = supplierStats[row.email?.toLowerCase()] ?? { contactCount: 0, respondedCount: 0, acceptedCount: 0 }
                  return (
                    <tr key={row.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#2A2A28] flex items-center justify-center text-xs font-bold text-[#C4A46B] shrink-0">
                            {(row.company_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{row.company_name ?? '—'}</p>
                            {row.address && (
                              <p className="text-white/30 text-xs flex items-center gap-1 mt-0.5">
                                <MapPin size={10} /> {row.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap text-xs">{row.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SupplierCategoryBadge accountId={row.id} initial={(row as any).supplier_category ?? 'manufacturer'} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const ra = row as any
                          const status = ra.subscription_status
                          const trialEnd = ra.trial_ends_at ? new Date(ra.trial_ends_at) : null
                          const now = new Date()
                          if (status === 'active') {
                            return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400">Active</span>
                          }
                          if (status === 'trialing' && trialEnd) {
                            const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000))
                            if (daysLeft > 0) {
                              return (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#C4A46B]/10 text-[#C4A46B]">
                                  Trial · {daysLeft}d left
                                </span>
                              )
                            }
                            return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-950 text-red-400">Trial expired</span>
                          }
                          if (status === 'cancelled') {
                            return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-white/30">Cancelled</span>
                          }
                          return <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/20">Free</span>
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {cats.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {cats.map(c => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/50 whitespace-nowrap">{c}</span>
                            ))}
                          </div>
                        ) : <span className="text-white/20 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {row.phone && (
                            <p className="text-white/50 text-xs flex items-center gap-1"><Phone size={10} /> {row.phone}</p>
                          )}
                          {row.website && (
                            <p className="text-white/50 text-xs flex items-center gap-1">
                              <Globe size={10} />
                              <a href={row.website} target="_blank" rel="noreferrer" className="hover:text-[#C4A46B] transition-colors truncate max-w-[140px] inline-block">
                                {row.website.replace(/^https?:\/\//, '')}
                              </a>
                            </p>
                          )}
                          {!row.phone && !row.website && <span className="text-white/20 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-white/50 tabular-nums">
                        {stats.contactCount > 0 ? (
                          <span>{stats.contactCount} sent · {stats.acceptedCount} accepted</span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3 text-white/40 whitespace-nowrap text-xs">
                        {row.created_at ? fmtDate(row.created_at) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-emerald-950 text-emerald-400' : 'bg-white/5 text-white/30'
                        }`}>
                          {isActive ? 'Active' : 'Registered'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
