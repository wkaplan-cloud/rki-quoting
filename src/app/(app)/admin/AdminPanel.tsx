'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, ShieldCheck, User, Ban, Clock, Trash2, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StudioSettingsForm } from './StudioSettingsForm'
import Link from 'next/link'
import { computeLineItems } from '@/lib/quoting'

interface Member {
  id: string
  user_id: string | null
  invited_email: string
  full_name: string | null
  role: string
  status: string
  invited_at: string
  joined_at: string | null
}

interface AuditLog {
  id: string
  user_email: string | null
  action: string
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

interface CompletedProject {
  id: string
  project_name: string
  project_number: string
  date: string
  design_fee: number
  vat_rate: number | null
  client: { client_name: string } | { client_name: string }[] | null
  stages?: { final_invoice_paid: boolean } | { final_invoice_paid: boolean }[] | null
}

interface LineItemRow {
  project_id: string
  cost_price: number
  markup_percentage: number
  quantity: number
  row_type: string | null
}

interface Props {
  members: Member[]
  auditLogs: AuditLog[]
  isAdmin: boolean
  settings: Record<string, unknown> | null
  plan: string
  subscriptionStatus: string
  completedProjects: CompletedProject[]
  completedLineItems: LineItemRow[]
}

const ACTION_COLOR: Record<string, string> = {
  created: 'text-green-600 bg-green-50',
  updated: 'text-blue-600 bg-blue-50',
  deleted: 'text-red-600 bg-red-50',
}

const TABLE_LABEL: Record<string, string> = {
  projects: 'Project',
  clients: 'Client',
  suppliers: 'Supplier',
  line_items: 'Line Item',
  settings: 'Settings',
  price_lists: 'Price List',
  price_list_items: 'Price List Item',
}

function getRecordLabel(log: AuditLog): string {
  const d = log.new_data ?? log.old_data
  if (!d) return '—'
  switch (log.table_name) {
    case 'projects':
      return [d.project_number, d.project_name].filter(Boolean).join(' — ') || '—'
    case 'clients':
      return (d.client_name as string) || '—'
    case 'suppliers':
      return (d.supplier_name as string) || '—'
    case 'line_items':
      return (d.item_name as string) || '—'
    case 'settings':
      return 'Studio settings'
    case 'price_lists':
      return (d.name as string) || '—'
    case 'price_list_items':
      return (d.fabric_name as string) || '—'
    default:
      return '—'
  }
}

// For updates, show key field changes that are meaningful to the user
const TRACKED_FIELDS: Record<string, string[]> = {
  projects: ['status', 'project_name', 'project_number', 'client_id'],
  clients: ['client_name', 'company', 'contact_number', 'email'],
  suppliers: ['supplier_name', 'category', 'markup_percentage'],
  line_items: ['item_name', 'quantity', 'cost_price', 'markup_percentage'],
  settings: ['business_name', 'vat_rate', 'deposit_percentage', 'email_from'],
}

function getChanges(log: AuditLog): { field: string; from: string; to: string }[] {
  if (log.action !== 'updated' || !log.old_data || !log.new_data) return []
  const fields = TRACKED_FIELDS[log.table_name] ?? []
  return fields
    .filter(f => String(log.old_data![f] ?? '') !== String(log.new_data![f] ?? ''))
    .map(f => ({
      field: f.replace(/_/g, ' '),
      from: String(log.old_data![f] ?? '—'),
      to: String(log.new_data![f] ?? '—'),
    }))
}

export function AdminPanel({ members: initial, auditLogs, isAdmin, settings, plan, subscriptionStatus, completedProjects, completedLineItems }: Props) {
  const isSoloActive = plan === 'solo' && subscriptionStatus === 'active'
  const [members, setMembers] = useState(initial)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('designer')
  const [inviting, setInviting] = useState(false)
  const [upgradeAgencyOpen, setUpgradeAgencyOpen] = useState(false)
  const [upgradingAgency, setUpgradingAgency] = useState(false)
  const [tab, setTab] = useState<'users' | 'studio' | 'profit' | 'audit'>('users')

  // Compute profit per completed project
  const profitByProject = completedProjects.map(p => {
    const items = completedLineItems.filter(li => li.project_id === p.id)
    const computed = computeLineItems(items as any)
    const profit = computed.reduce((sum, i) => sum + i.profit, 0)
    const designFeeAmount = computed.reduce((sum, i) => sum + i.total_price, 0) * ((p.design_fee ?? 0) / 100)
    return { ...p, profitExVat: profit + designFeeAmount }
  })

  // Group by year
  const byYear: Record<string, typeof profitByProject> = {}
  for (const p of profitByProject) {
    const year = new Date(p.date).getFullYear().toString()
    if (!byYear[year]) byYear[year] = []
    byYear[year].push(p)
  }
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a))

  const fmtZAR = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    })
    if (!res.ok) {
      const data = await res.json()
      if (data.upgrade && plan === 'studio') {
        setUpgradeAgencyOpen(true)
      } else {
        toast.error(data.error ?? 'Failed to send invite')
      }
    } else {
      toast.success(`Invite sent to ${inviteEmail}`)
      setMembers(m => [...m, {
        id: crypto.randomUUID(),
        user_id: null,
        invited_email: inviteEmail.trim(),
        full_name: null,
        role: inviteRole,
        status: 'pending',
        invited_at: new Date().toISOString(),
        joined_at: null,
      }])
      setInviteEmail('')
    }
    setInviting(false)
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Deactivate this user? They will lose access immediately.')) return
    const res = await fetch('/api/admin/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'inactive' }) })
    if (!res.ok) { const { error } = await res.json(); toast.error(error ?? 'Failed'); return }
    setMembers(m => m.map(mem => mem.id === id ? { ...mem, status: 'inactive' } : mem))
    toast.success('User deactivated')
  }

  async function handleDelete(id: string) {
    if (!confirm('Cancel this invite? The invite link will no longer work.')) return
    const res = await fetch('/api/admin/members', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) { const { error } = await res.json(); toast.error(error ?? 'Failed'); return }
    setMembers(m => m.filter(mem => mem.id !== id))
    toast.success('Invite cancelled')
  }

  async function handleReactivate(id: string) {
    const res = await fetch('/api/admin/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'active' }) })
    if (!res.ok) { const { error } = await res.json(); toast.error(error ?? 'Failed'); return }
    setMembers(m => m.map(mem => mem.id === id ? { ...mem, status: 'active' } : mem))
    toast.success('User reactivated')
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  async function handleUpgradeAgency() {
    setUpgradingAgency(true)
    try {
      const res = await fetch('/api/paystack/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'agency' }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Something went wrong'); return }
      window.location.href = data.authorization_url
    } finally {
      setUpgradingAgency(false)
    }
  }

  return (
    <>
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#D8D3C8] mb-6">
        {(['users', 'studio', 'profit', 'audit'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${tab === t ? 'border-b-2 border-[#9A7B4F] text-[#9A7B4F]' : 'text-[#8A877F] hover:text-[#2C2C2A]'}`}
          >
            {t === 'users' ? 'Team Members' : t === 'studio' ? 'Studio Settings' : t === 'profit' ? 'Profit' : 'Audit Log'}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="space-y-6">
          {/* Invite form */}
          {isAdmin && (
            <div className="bg-white border border-[#D8D3C8] rounded p-5">
              <h3 className="text-sm font-medium text-[#2C2C2A] mb-4 flex items-center gap-2">
                <UserPlus size={15} className="text-[#9A7B4F]" /> Invite a team member
              </h3>
              {isSoloActive ? (
                <div className="flex items-center justify-between bg-[#9A7B4F]/8 border border-[#9A7B4F]/25 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#2C2C2A]">Solo plan — 1 user only</p>
                    <p className="text-xs text-[#8A877F] mt-0.5">Upgrade to Studio or Agency to add team members.</p>
                  </div>
                  <Link
                    href="/subscribe"
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#9A7B4F] text-white text-xs font-medium rounded-lg hover:bg-[#B8956A] transition-colors flex-shrink-0 ml-4"
                  >
                    Upgrade <ArrowRight size={12} />
                  </Link>
                </div>
              ) : (
              <form onSubmit={handleInvite} className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@studio.co.za"
                  required
                  className="flex-1 px-3 py-2 border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F] bg-white"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="px-3 py-2 border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F] bg-white"
                >
                  <option value="designer">Designer</option>
                  <option value="admin">Admin</option>
                </select>
                <Button type="submit" disabled={inviting}>
                  {inviting ? 'Sending…' : 'Send Invite'}
                </Button>
              </form>
              )}
            </div>
          )}

          {/* Members list */}
          <div className="bg-white border border-[#D8D3C8] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC] text-xs text-[#8A877F] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Joined</th>
                  {isAdmin && <th className="w-24 px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-b border-[#EDE9E1] last:border-0 hover:bg-[#FDFCF9]">
                    <td className="px-4 py-3 text-[#2C2C2A] font-medium">{m.full_name ?? <span className="text-[#C4BFB5] italic text-xs">Not set</span>}</td>
                    <td className="px-4 py-3 text-[#8A877F]">{m.invited_email}</td>
                    <td className="px-4 py-3">
                      {isAdmin && m.status !== 'pending' ? (
                        <select
                          value={m.role}
                          onChange={async e => {
                            const role = e.target.value
                            const res = await fetch('/api/admin/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, role }) })
                            if (!res.ok) { const { error } = await res.json(); toast.error(error ?? 'Failed'); return }
                            setMembers(prev => prev.map(mem => mem.id === m.id ? { ...mem, role } : mem))
                          }}
                          className="text-xs border border-[#D8D3C8] rounded px-2 py-0.5 bg-white outline-none focus:border-[#9A7B4F] cursor-pointer"
                        >
                          <option value="designer">Designer</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${m.role === 'admin' ? 'bg-[#9A7B4F]/10 text-[#9A7B4F]' : 'bg-[#F5F2EC] text-[#8A877F]'}`}>
                          {m.role === 'admin' ? <ShieldCheck size={11} /> : <User size={11} />}
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                        m.status === 'active' ? 'bg-green-50 text-green-700' :
                        m.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {m.status === 'pending' && <Clock size={11} />}
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#8A877F] text-xs">
                      {m.joined_at ? fmt(m.joined_at) : '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {m.status === 'active' && (
                          <button onClick={() => handleDeactivate(m.id)} className="text-xs text-[#8A877F] hover:text-red-500 transition-colors flex items-center gap-1 ml-auto cursor-pointer">
                            <Ban size={12} /> Deactivate
                          </button>
                        )}
                        {m.status === 'pending' && (
                          <button onClick={() => handleDelete(m.id)} className="text-xs text-[#8A877F] hover:text-red-500 transition-colors flex items-center gap-1 ml-auto cursor-pointer">
                            <Trash2 size={12} /> Cancel
                          </button>
                        )}
                        {m.status === 'inactive' && (
                          <button onClick={() => handleReactivate(m.id)} className="text-xs text-[#8A877F] hover:text-green-600 transition-colors ml-auto cursor-pointer">
                            Reactivate
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'studio' && (
        <StudioSettingsForm settings={settings as any} plan={plan} />
      )}

      {tab === 'profit' && (
        <div className="space-y-8">
          {completedProjects.length === 0 ? (
            <p className="text-sm text-[#8A877F] py-10 text-center">No projects with a paid final invoice yet.</p>
          ) : (
            <>
              {/* Year totals summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {years.slice(0, 4).map(year => {
                  const total = byYear[year]!.reduce((s, p) => s + p.profitExVat, 0)
                  return (
                    <div key={year} className="bg-white border border-[#D8D3C8] rounded-xl px-5 py-4">
                      <p className="text-xs text-[#8A877F] mb-1">{year}</p>
                      <p className="text-lg font-semibold text-[#2C2C2A]">{fmtZAR(total)}</p>
                      <p className="text-xs text-[#8A877F] mt-0.5">{byYear[year]!.length} project{byYear[year]!.length !== 1 ? 's' : ''}</p>
                    </div>
                  )
                })}
              </div>

              {/* Per-year project list */}
              {years.map(year => (
                <div key={year}>
                  <h3 className="text-xs font-semibold text-[#8A877F] uppercase tracking-wider mb-3">{year}</h3>
                  <div className="bg-white border border-[#D8D3C8] rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#EDE9E1] bg-[#F5F2EC] text-xs text-[#8A877F] uppercase tracking-wider">
                          <th className="text-left px-5 py-2.5">Client</th>
                          <th className="text-left px-5 py-2.5">Project</th>
                          <th className="text-left px-5 py-2.5">Date</th>
                          <th className="text-right px-5 py-2.5">Profit ex VAT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EDE9E1]">
                        {byYear[year]!.map(p => (
                          <tr key={p.id} className="hover:bg-[#FDFCF9]">
                            <td className="px-5 py-3 text-[#2C2C2A] font-medium">{(Array.isArray(p.client) ? p.client[0]?.client_name : p.client?.client_name) ?? <span className="text-[#C4BFB5] italic text-xs">No client</span>}</td>
                            <td className="px-5 py-3 text-[#8A877F]">
                              <Link href={`/projects/${p.id}`} className="hover:text-[#9A7B4F] hover:underline transition-colors">
                                {p.project_name}
                                <span className="ml-2 text-xs text-[#C4BFB5]">{p.project_number}</span>
                              </Link>
                            </td>
                            <td className="px-5 py-3 text-[#8A877F] text-xs">
                              {new Date(p.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className={`px-5 py-3 text-right font-semibold tabular-nums ${p.profitExVat >= 0 ? 'text-[#2C2C2A]' : 'text-red-500'}`}>
                              {fmtZAR(p.profitExVat)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-[#F5F2EC] border-t border-[#D8D3C8]">
                          <td colSpan={3} className="px-5 py-2.5 text-xs font-semibold text-[#8A877F] uppercase tracking-wider">{year} Total</td>
                          <td className="px-5 py-2.5 text-right font-bold text-[#2C2C2A] tabular-nums">
                            {fmtZAR(byYear[year]!.reduce((s, p) => s + p.profitExVat, 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white border border-[#D8D3C8] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC] text-xs text-[#8A877F] uppercase tracking-wider">
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Record</th>
                <th className="text-left px-4 py-3">Changes</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[#8A877F]">No activity yet</td></tr>
              )}
              {auditLogs.map(log => {
                const changes = getChanges(log)
                return (
                  <tr key={log.id} className="border-b border-[#EDE9E1] last:border-0 hover:bg-[#FDFCF9]">
                    <td className="px-4 py-2.5 text-xs text-[#8A877F] whitespace-nowrap">{fmt(log.created_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#2C2C2A]">{log.user_email ?? '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLOR[log.action] ?? 'text-[#8A877F] bg-[#F5F2EC]'}`}>
                        {log.action}
                      </span>
                      <span className="ml-1.5 text-xs text-[#8A877F]">{TABLE_LABEL[log.table_name] ?? log.table_name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#2C2C2A] font-medium">{getRecordLabel(log)}</td>
                    <td className="px-4 py-2.5">
                      {changes.length > 0 ? (
                        <div className="space-y-0.5">
                          {changes.map(c => (
                            <div key={c.field} className="text-xs text-[#8A877F]">
                              <span className="font-medium text-[#2C2C2A] capitalize">{c.field}:</span>{' '}
                              <span className="line-through text-[#C4BFB5]">{c.from}</span>
                              {' → '}
                              <span className="text-[#2C2C2A]">{c.to}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[#C4BFB5]">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

      {/* Upgrade to Agency modal — triggered when studio hits 5-member cap */}
      {upgradeAgencyOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setUpgradeAgencyOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[380px] p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#1A1A18]">Team limit reached</h2>
              <button onClick={() => setUpgradeAgencyOpen(false)} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-[#8A877F] leading-relaxed mb-5">
              Studio supports up to 5 team members. Upgrade to Agency for <strong className="text-[#2C2C2A]">unlimited members</strong>, Sage integration, and custom branded PDFs — charged at <strong className="text-[#2C2C2A]">R2,499/month</strong>.
            </p>
            <ul className="space-y-2 mb-6">
              {['Unlimited team members', 'Sage Business Cloud Accounting integration', 'Custom branded PDFs — we match your letterhead'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#2C2C2A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9A7B4F] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setUpgradeAgencyOpen(false)} className="flex-1 py-2.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleUpgradeAgency}
                disabled={upgradingAgency}
                className="flex-1 py-2.5 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer font-medium"
              >
                {upgradingAgency ? 'Redirecting…' : 'Upgrade to Agency →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
