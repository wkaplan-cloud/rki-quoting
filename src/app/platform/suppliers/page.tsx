export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Store, Globe, Phone, MapPin } from 'lucide-react'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function PlatformSuppliersPage() {
  const { data: accounts } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, company_name, phone, website, address, categories, description, created_at')
    .order('created_at', { ascending: false })

  const rows = accounts ?? []

  // Count active (have responded or completed at least one session)
  const { data: activeSuppliersData } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('email')
    .not('status', 'eq', 'pending')

  const activeEmails = new Set((activeSuppliersData ?? []).map((s: any) => s.email?.toLowerCase()))
  const activeCount = rows.filter(r => activeEmails.has(r.email?.toLowerCase())).length

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Store size={18} className="text-[#C4A46B]" />
          <h1 className="font-serif text-3xl text-white">Registered Suppliers</h1>
        </div>
        <p className="text-sm text-white/40">Supplier portal accounts and their profile details</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total registered', value: rows.length.toString() },
          { label: 'Active (responded)', value: activeCount.toString() },
          { label: 'New this month', value: rows.filter(r => {
            if (!r.created_at) return false
            const d = new Date(r.created_at)
            const now = new Date()
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          }).length.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
            <span className="text-xs text-white/40 uppercase tracking-wider block mb-3">{label}</span>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Supplier table */}
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
                  {['Company', 'Email', 'Categories', 'Contact', 'Registered', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map(row => {
                  const isActive = activeEmails.has(row.email?.toLowerCase())
                  const cats: string[] = Array.isArray(row.categories) ? row.categories : []
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
                      <td className="px-4 py-3 text-white/40 whitespace-nowrap text-xs">
                        {row.created_at ? fmtDate(row.created_at) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-white/5 text-white/30'
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
