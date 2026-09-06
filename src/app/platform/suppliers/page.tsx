export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Store, Globe, Phone, MapPin, BarChart3 } from 'lucide-react'
import { PortalAccountLinker } from './PortalAccountLinker'
import { SupplierCategoryBadge } from './SupplierCategoryBadge'
import { one, type Embedded } from '@/lib/supabase/embed'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Mirrors the supplier_portal_accounts select below. */
interface SupplierAccountRow {
  id: string
  email: string
  company_name: string | null
  contact_name: string | null
  phone: string | null
  website: string | null
  address: string | null
  categories: string[] | null
  description: string | null
  created_at: string
  linked_portal_account_id: string | null
  supplier_category: string | null
  plan: string | null
  subscription_status: string | null
  trial_ends_at: string | null
}

export default async function PlatformSuppliersPage() {
  const { data: accounts } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, company_name, contact_name, phone, website, address, categories, description, created_at, linked_portal_account_id, supplier_category, plan, subscription_status, trial_ends_at')
    .order('created_at', { ascending: false })

  const rows = (accounts ?? []) as SupplierAccountRow[]

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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Store size={18} className="text-[#7E6036]" />
          <h1 className="font-serif text-3xl text-[#1A1A18]">All Accounts</h1>
        </div>
        <p className="text-sm text-[#6E6B63]">Every supplier, manufacturer and contractor on the portal &mdash; plus the account type toggle and usage analytics</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total registered', value: rows.length.toString() },
          { label: 'Active (responded)', value: activeCount.toString() },
          { label: 'On free trial', value: rows.filter(r => {
            return r.subscription_status === 'trialing' && r.trial_ends_at && new Date(r.trial_ends_at) > new Date()
          }).length.toString(), highlight: true },
          { label: 'New this month', value: rows.filter(r => {
            if (!r.created_at) return false
            const d = new Date(r.created_at)
            const now = new Date()
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          }).length.toString() },
        ].map(({ label, value, highlight }) => (
          <div key={label} className={`border rounded-xl p-5 ${highlight ? 'bg-[#F7F0E2] border-[#7E6036]/30' : 'bg-[#FDFCF9] border-[#DED8CC]'}`}>
            <span className={`text-xs uppercase tracking-wider block mb-3 ${highlight ? 'text-[#7E6036]' : 'text-[#6E6B63]'}`}>{label}</span>
            <p className={`text-2xl font-semibold ${highlight ? 'text-[#7E6036]' : 'text-[#1A1A18]'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Studio ↔ Supplier analytics */}
      {topSuppliers.length > 0 && (
        <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-[#DED8CC] flex items-center gap-2">
            <BarChart3 size={14} className="text-[#7E6036]" />
            <h2 className="text-sm font-medium text-[#1A1A18]">Supplier Usage Analytics</h2>
            <p className="text-xs text-[#6E6B63] ml-2">Top suppliers by accepted items across all studios</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[40rem]">
              <thead>
                <tr className="border-b border-[#EAE5DB]">
                  {['Supplier', 'Studios', 'Contacted', 'Responded', 'Items accepted', 'Registered'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#6E6B63] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE3]">
                {topSuppliers.map(s => (
                  <tr key={s.email} className="hover:bg-[#EFEBE3] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-[#1A1A18] font-medium">{s.name}</p>
                      <p className="text-[#6E6B63] text-xs">{s.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.studios.slice(0, 3).map(studio => (
                          <span key={studio} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EFEBE3] text-[#5C5A54] whitespace-nowrap">{studio}</span>
                        ))}
                        {s.studios.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EFEBE3] text-[#6E6B63] whitespace-nowrap">+{s.studios.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#3F3D38] whitespace-nowrap tabular-nums">{s.contactCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      <span className="text-[#3F3D38]">{s.respondedCount}</span>
                      {s.contactCount > 0 && (
                        <span className="text-[#6E6B63] text-xs ml-1">({Math.round(s.respondedCount / s.contactCount * 100)}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[#7E6036] font-semibold tabular-nums">{s.acceptedCount}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.registered ? 'bg-emerald-950 text-[#047857]' : 'bg-[#EFEBE3] text-[#6E6B63]'}`}>
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
        contact_name: r.contact_name ?? null,
        linked_portal_account_id: r.linked_portal_account_id ?? null,
      }))} />

      {/* Supplier accounts table */}
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#DED8CC]">
          <h2 className="text-sm font-medium text-[#1A1A18]">Supplier Accounts</h2>
          <p className="text-xs text-[#6E6B63] mt-0.5">All companies registered on the supplier portal</p>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-sm text-[#6E6B63] text-center">No registered suppliers yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[58rem]">
              <thead>
                <tr className="border-b border-[#DED8CC]">
                  {['Company', 'Email', 'Type', 'Subscription', 'Categories', 'Contact', 'Requests', 'Registered', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#6E6B63] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE3]">
                {rows.map(row => {
                  const isActive = activeEmails.has(row.email?.toLowerCase())
                  const cats: string[] = Array.isArray(row.categories) ? row.categories : []
                  const stats = supplierStats[row.email?.toLowerCase()] ?? { contactCount: 0, respondedCount: 0, acceptedCount: 0 }
                  return (
                    <tr key={row.id} className="hover:bg-[#EFEBE3] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#2A2A28] flex items-center justify-center text-xs font-bold text-[#7E6036] shrink-0">
                            {(row.company_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[#1A1A18] font-medium">{row.company_name ?? '—'}</p>
                            {row.address && (
                              <p className="text-[#6E6B63] text-xs flex items-center gap-1 mt-0.5">
                                <MapPin size={10} /> {row.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#3F3D38] whitespace-nowrap text-xs">{row.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SupplierCategoryBadge accountId={row.id} initial={row.supplier_category ?? 'manufacturer'} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const status = row.subscription_status
                          const trialEnd = row.trial_ends_at ? new Date(row.trial_ends_at) : null
                          const now = new Date()
                          if (status === 'active') {
                            return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-[#047857]">Active</span>
                          }
                          if (status === 'trialing' && trialEnd) {
                            const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000))
                            if (daysLeft > 0) {
                              return (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#7E6036]/10 text-[#7E6036]">
                                  Trial · {daysLeft}d left
                                </span>
                              )
                            }
                            return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-950 text-[#B91C1C]">Trial expired</span>
                          }
                          if (status === 'cancelled') {
                            return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFEBE3] text-[#6E6B63]">Cancelled</span>
                          }
                          return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFEBE3] text-[#8A877F]">Free</span>
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {cats.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {cats.map(c => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EFEBE3] text-[#5C5A54] whitespace-nowrap">{c}</span>
                            ))}
                          </div>
                        ) : <span className="text-[#8A877F] text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {row.phone && (
                            <p className="text-[#5C5A54] text-xs flex items-center gap-1"><Phone size={10} /> {row.phone}</p>
                          )}
                          {row.website && (
                            <p className="text-[#5C5A54] text-xs flex items-center gap-1">
                              <Globe size={10} />
                              <a href={row.website} target="_blank" rel="noreferrer" className="hover:text-[#7E6036] transition-colors truncate max-w-[140px] inline-block">
                                {row.website.replace(/^https?:\/\//, '')}
                              </a>
                            </p>
                          )}
                          {!row.phone && !row.website && <span className="text-[#8A877F] text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-[#5C5A54] tabular-nums">
                        {stats.contactCount > 0 ? (
                          <span>{stats.contactCount} sent · {stats.acceptedCount} accepted</span>
                        ) : <span className="text-[#8A877F]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#6E6B63] whitespace-nowrap text-xs">
                        {row.created_at ? fmtDate(row.created_at) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-emerald-950 text-[#047857]' : 'bg-[#EFEBE3] text-[#6E6B63]'
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
