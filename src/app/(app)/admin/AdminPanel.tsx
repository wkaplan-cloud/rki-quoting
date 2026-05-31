'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  UserPlus, ShieldCheck, User, Ban, Clock, Trash2, ArrowRight, X,
  Palette, Package, Zap, FileText, Users, Store, List, ExternalLink,
  CheckCircle, AlertCircle, Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StudioSettingsForm } from './StudioSettingsForm'
import { SettingsForm } from '../settings/SettingsForm'
import { StorageWidget } from './StorageWidget'
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

interface SourcingSession {
  id: string
  title: string | null
  status: string
  created_at: string
  item_count: number
  supplier_count: number
  request_number: number | null
  project_name: string | null
}

interface PortalAccount {
  id: string
  company_name: string
  email: string
  supplier_category: string | null
  plan: string | null
  subscription_status: string | null
}

interface PriceListSummary {
  id: string
  name: string
  supplier_name: string | null
  item_count: number | null
  is_global: boolean
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
  pipelineProjects: CompletedProject[]
  pipelineLineItems: LineItemRow[]
  userProfile: { fullName: string; email: string; phone: string; jobTitle: string }
  sourcingSessions: SourcingSession[]
  connectedSuppliers: PortalAccount[]
  electricianAccounts: PortalAccount[]
  priceLists: PriceListSummary[]
}

const ACTION_COLOR: Record<string, string> = {
  created:   'text-green-600 bg-green-50',
  updated:   'text-blue-600 bg-blue-50',
  deleted:   'text-red-600 bg-red-50',
  sent:      'text-purple-600 bg-purple-50',
  responded: 'text-amber-600 bg-amber-50',
  accepted:  'text-emerald-600 bg-emerald-50',
}

const TABLE_LABEL: Record<string, string> = {
  projects: 'Project',
  clients: 'Client',
  suppliers: 'Supplier',
  line_items: 'Line Item',
  settings: 'Settings',
  price_lists: 'Price List',
  price_list_items: 'Price List Item',
  sourcing_sessions: 'Price Request',
  sourcing_session_items: 'Request Item',
  sourcing_item_assignments: 'Quote',
  sourcing_item_responses: 'Supplier Quote',
}

const SESSION_STATUS: Record<string, { label: string; color: string }> = {
  draft:       { label: 'Draft',       color: 'bg-[#F5F2EC] text-[#8A877F]' },
  sent:        { label: 'Sent',        color: 'bg-blue-50 text-blue-600' },
  in_progress: { label: 'In Progress', color: 'bg-amber-50 text-amber-600' },
  completed:   { label: 'Completed',   color: 'bg-emerald-50 text-emerald-600' },
  archived:    { label: 'Archived',    color: 'bg-[#F5F2EC] text-[#8A877F]' },
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  trades: 'Trades',
  trades_pro: 'Trades Pro',
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
    case 'sourcing_sessions':
      return (d.session_title as string) || '—'
    case 'sourcing_session_items':
      return (d.title as string) || (d.item_title as string) || '—'
    case 'sourcing_item_assignments':
      return [(d.item_title as string), (d.supplier_name as string)].filter(Boolean).join(' → ') || '—'
    case 'sourcing_item_responses':
      return [(d.item_title as string), (d.supplier_name as string)].filter(Boolean).join(' — ') || '—'
    default:
      return '—'
  }
}

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

type Portal = 'designer' | 'supplier' | 'electrician'
type DesignerTab = 'profile' | 'users' | 'studio' | 'profit' | 'audit'
type SupplierTab = 'requests' | 'suppliers' | 'pricelists'
type ElectricianTab = 'contractors'

export function AdminPanel({
  members: initial,
  auditLogs,
  isAdmin,
  settings,
  plan,
  subscriptionStatus,
  completedProjects,
  completedLineItems,
  pipelineProjects,
  pipelineLineItems,
  userProfile,
  sourcingSessions,
  connectedSuppliers,
  electricianAccounts,
  priceLists,
}: Props) {
  const isSoloActive = plan === 'solo' && subscriptionStatus === 'active'
  const [members, setMembers] = useState(initial)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('designer')
  const [inviting, setInviting] = useState(false)
  const [upgradeAgencyOpen, setUpgradeAgencyOpen] = useState(false)
  const [upgradingAgency, setUpgradingAgency] = useState(false)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [portal, setPortal] = useState<Portal>('designer')
  const [designerTab, setDesignerTab] = useState<DesignerTab>(isAdmin ? 'users' : 'profile')
  const [supplierTab, setSupplierTab] = useState<SupplierTab>('requests')
  const [electricianTab, setElectricianTab] = useState<ElectricianTab>('contractors')
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    body: string
    confirmLabel: string
    danger?: boolean
    onConfirm: () => Promise<void>
  } | null>(null)

  // Profit calculations
  const pipelineProfit = pipelineProjects.reduce((total, p) => {
    const items = pipelineLineItems.filter(li => li.project_id === p.id)
    const computed = computeLineItems(items as any)
    const lineProfit = computed.reduce((sum, i) => sum + i.profit, 0)
    const designFeeAmount = computed.reduce((sum, i) => sum + i.total_price, 0) * ((p.design_fee ?? 0) / 100)
    return total + lineProfit + designFeeAmount
  }, 0)

  const profitByProject = completedProjects.map(p => {
    const items = completedLineItems.filter(li => li.project_id === p.id)
    const computed = computeLineItems(items as any)
    const profit = computed.reduce((sum, i) => sum + i.profit, 0)
    const designFeeAmount = computed.reduce((sum, i) => sum + i.total_price, 0) * ((p.design_fee ?? 0) / 100)
    return { ...p, profitExVat: profit + designFeeAmount }
  })

  const byYear: Record<string, typeof profitByProject> = {}
  for (const p of profitByProject) {
    const year = new Date(p.date).getFullYear().toString()
    if (!byYear[year]) byYear[year] = []
    byYear[year].push(p)
  }
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a))

  const fmtZAR = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

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
      if (data.trial) {
        window.location.href = '/subscribe'
      } else if (data.upgrade && plan === 'studio') {
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

  function handleDeactivate(id: string) {
    setConfirmModal({
      title: 'Deactivate user?',
      body: 'They will lose access immediately and cannot log in until reactivated.',
      confirmLabel: 'Deactivate',
      danger: true,
      onConfirm: async () => {
        const res = await fetch('/api/admin/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'inactive' }) })
        if (!res.ok) { const { error } = await res.json(); toast.error(error ?? 'Failed'); return }
        setMembers(m => m.map(mem => mem.id === id ? { ...mem, status: 'inactive' } : mem))
        toast.success('User deactivated')
      },
    })
  }

  function handleDelete(id: string, email: string) {
    setConfirmModal({
      title: 'Cancel invite?',
      body: `The invite sent to ${email} will no longer work.`,
      confirmLabel: 'Cancel invite',
      danger: true,
      onConfirm: async () => {
        const res = await fetch('/api/admin/members', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
        if (!res.ok) { const { error } = await res.json(); toast.error(error ?? 'Failed'); return }
        setMembers(m => m.filter(mem => mem.id !== id))
        toast.success('Invite cancelled')
      },
    })
  }

  async function handleReactivate(id: string) {
    setReactivatingId(id)
    const res = await fetch('/api/admin/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'active' }) })
    setReactivatingId(null)
    if (!res.ok) { const { error } = await res.json(); toast.error(error ?? 'Failed'); return }
    setMembers(m => m.map(mem => mem.id === id ? { ...mem, status: 'active' } : mem))
    toast.success('User reactivated')
  }

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

  const PORTALS: { key: Portal; label: string; icon: React.ReactNode; subtitle: string; accentColor: string }[] = [
    {
      key: 'designer',
      label: 'Designer Portal',
      icon: <Palette size={18} />,
      subtitle: 'Team, settings & profits',
      accentColor: '#9A7B4F',
    },
    {
      key: 'supplier',
      label: 'Supplier Portal',
      icon: <Package size={18} />,
      subtitle: 'Price requests & suppliers',
      accentColor: '#2E6DA4',
    },
    {
      key: 'electrician',
      label: 'Electrician Portal',
      icon: <Zap size={18} />,
      subtitle: 'Contractors & job activity',
      accentColor: '#B45309',
    },
  ]

  return (
    <>
      <div className="space-y-6">

        {/* ── Portal Switcher ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {PORTALS.map(p => {
            const active = portal === p.key
            return (
              <button
                key={p.key}
                onClick={() => setPortal(p.key)}
                style={active ? { borderColor: p.accentColor, background: `${p.accentColor}08` } : undefined}
                className={`text-left px-5 py-4 rounded-xl border-2 transition-all cursor-pointer ${
                  active
                    ? 'shadow-sm'
                    : 'border-[#D8D3C8] bg-white hover:border-[#C4BFB5]'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span style={active ? { color: p.accentColor } : undefined} className={active ? '' : 'text-[#8A877F]'}>
                    {p.icon}
                  </span>
                  <span
                    style={active ? { color: p.accentColor } : undefined}
                    className={`text-sm font-semibold ${active ? '' : 'text-[#2C2C2A]'}`}
                  >
                    {p.label}
                  </span>
                </div>
                <p className="text-xs text-[#8A877F] pl-[26px]">{p.subtitle}</p>
              </button>
            )
          })}
        </div>

        {/* ── Designer Portal ─────────────────────────────────────────── */}
        {portal === 'designer' && (
          <div>
            <div className="flex gap-1 border-b border-[#D8D3C8] mb-6">
              {(isAdmin
                ? (['users', 'studio', 'profit', 'audit', 'profile'] as const)
                : (['profile'] as const)
              ).map(t => (
                <button
                  key={t}
                  onClick={() => setDesignerTab(t)}
                  className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${designerTab === t ? 'border-b-2 border-[#9A7B4F] text-[#9A7B4F]' : 'text-[#8A877F] hover:text-[#2C2C2A]'}`}
                >
                  {t === 'users' ? 'Team Members' : t === 'studio' ? 'Studio Settings' : t === 'profit' ? 'Profit' : t === 'audit' ? 'Audit Log' : 'My Profile'}
                </button>
              ))}
            </div>

            {/* Team Members */}
            {designerTab === 'users' && (
              <div className="space-y-6">
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
                        <Link href="/subscribe" className="flex items-center gap-1.5 px-3 py-2 bg-[#9A7B4F] text-white text-xs font-medium rounded-lg hover:bg-[#B8956A] transition-colors flex-shrink-0 ml-4">
                          Upgrade <ArrowRight size={12} />
                        </Link>
                      </div>
                    ) : (
                      <>
                        <form onSubmit={handleInvite} className="flex gap-3">
                          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@studio.co.za" required className="flex-1 px-3 py-2 border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F] bg-white" />
                          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="px-3 py-2 border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F] bg-white">
                            <option value="designer">Designer</option>
                            <option value="admin">Admin</option>
                          </select>
                          <Button type="submit" disabled={inviting}>{inviting ? 'Sending…' : 'Send Invite'}</Button>
                        </form>
                        {subscriptionStatus === 'trialing' && (() => {
                          const used = members.filter(m => m.status === 'active' || m.status === 'pending').length
                          const remaining = Math.max(0, 4 - used)
                          return remaining === 0 ? (
                            <div className="flex items-center justify-between bg-[#9A7B4F]/8 border border-[#9A7B4F]/25 rounded-lg px-4 py-3 mt-2">
                              <div>
                                <p className="text-sm font-medium text-[#2C2C2A]">Trial limit reached — 4 members</p>
                                <p className="text-xs text-[#8A877F] mt-0.5">Subscribe to add more team members.</p>
                              </div>
                              <Link href="/subscribe" className="flex items-center gap-1.5 px-3 py-2 bg-[#9A7B4F] text-white text-xs font-medium rounded-lg hover:bg-[#B8956A] transition-colors flex-shrink-0 ml-4">
                                Subscribe <ArrowRight size={12} />
                              </Link>
                            </div>
                          ) : (
                            <p className="text-xs text-[#8A877F] mt-2">
                              Trial plan — {remaining} invite slot{remaining !== 1 ? 's' : ''} remaining.{' '}
                              <Link href="/subscribe" className="text-[#9A7B4F] hover:underline">Subscribe to add more members.</Link>
                            </p>
                          )
                        })()}
                      </>
                    )}
                  </div>
                )}
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
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-green-50 text-green-700' : m.status === 'pending' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
                              {m.status === 'pending' && <Clock size={11} />}
                              {m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#8A877F] text-xs">{m.joined_at ? fmt(m.joined_at) : '—'}</td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              {m.status === 'active' && <button onClick={() => handleDeactivate(m.id)} className="text-xs text-[#8A877F] hover:text-red-500 transition-colors flex items-center gap-1 ml-auto cursor-pointer"><Ban size={12} /> Deactivate</button>}
                              {m.status === 'pending' && <button onClick={() => handleDelete(m.id, m.invited_email)} className="text-xs text-[#8A877F] hover:text-red-500 transition-colors flex items-center gap-1 ml-auto cursor-pointer"><Trash2 size={12} /> Cancel</button>}
                              {m.status === 'inactive' && <button onClick={() => void handleReactivate(m.id)} disabled={reactivatingId === m.id} className="text-xs text-[#8A877F] hover:text-green-600 transition-colors ml-auto cursor-pointer disabled:opacity-50">{reactivatingId === m.id ? 'Reactivating…' : 'Reactivate'}</button>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Studio Settings */}
            {designerTab === 'studio' && (
              <div className="space-y-6">
                <StudioSettingsForm settings={settings as any} plan={plan} isAdmin={isAdmin} />
                <StorageWidget />
              </div>
            )}

            {/* Profit */}
            {designerTab === 'profit' && (
              <div className="space-y-8">
                <div className="bg-white border border-dashed border-[#C4A46B] rounded-xl px-6 py-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#9A7B4F] uppercase tracking-wider mb-1">Projected Pipeline Profit</p>
                    <p className="text-2xl font-semibold text-[#2C2C2A]">{fmtZAR(pipelineProfit)}</p>
                    <p className="text-xs text-[#8A877F] mt-1">{pipelineProjects.length} active project{pipelineProjects.length !== 1 ? 's' : ''} · excl. VAT · not yet invoiced</p>
                  </div>
                </div>
                {completedProjects.length === 0 ? (
                  <p className="text-sm text-[#8A877F] py-10 text-center">No projects with a paid final invoice yet.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {years.slice(0, 4).map(year => {
                        const total = byYear[year]!.reduce((s, p) => s + p.profitExVat, 0)
                        return (
                          <div key={year} className="bg-white border border-[#D8D3C8] rounded-xl px-5 py-4">
                            <p className="text-xs text-[#8A877F] mb-1">{year}</p>
                            <p className="text-lg font-semibold text-[#2C2C2A]">{fmtZAR(total)}</p>
                            <p className="text-xs text-[#8A877F] mt-0.5">{byYear[year]!.length} project{byYear[year]!.length !== 1 ? 's' : ''} · fully paid</p>
                          </div>
                        )
                      })}
                    </div>
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
                                  <td className="px-5 py-3 text-[#8A877F] text-xs">{new Date(p.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                  <td className={`px-5 py-3 text-right font-semibold tabular-nums ${p.profitExVat >= 0 ? 'text-[#2C2C2A]' : 'text-red-500'}`}>{fmtZAR(p.profitExVat)}</td>
                                </tr>
                              ))}
                              <tr className="bg-[#F5F2EC] border-t border-[#D8D3C8]">
                                <td colSpan={3} className="px-5 py-2.5 text-xs font-semibold text-[#8A877F] uppercase tracking-wider">{year} Total</td>
                                <td className="px-5 py-2.5 text-right font-bold text-[#2C2C2A] tabular-nums">{fmtZAR(byYear[year]!.reduce((s, p) => s + p.profitExVat, 0))}</td>
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

            {/* Audit Log */}
            {designerTab === 'audit' && (
              <div className="space-y-3">
                <p className="text-xs text-[#8A877F]">Showing activity from the last 90 days.</p>
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
                      {auditLogs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[#8A877F]">No activity yet</td></tr>}
                      {auditLogs.map(log => {
                        const changes = getChanges(log)
                        return (
                          <tr key={log.id} className="border-b border-[#EDE9E1] last:border-0 hover:bg-[#FDFCF9]">
                            <td className="px-4 py-2.5 text-xs text-[#8A877F] whitespace-nowrap">{fmt(log.created_at)}</td>
                            <td className="px-4 py-2.5 text-xs text-[#2C2C2A]">{log.user_email ?? '—'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLOR[log.action] ?? 'text-[#8A877F] bg-[#F5F2EC]'}`}>{log.action}</span>
                              <span className="ml-1.5 text-xs text-[#8A877F]">{TABLE_LABEL[log.table_name] ?? log.table_name}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-[#2C2C2A] font-medium">{getRecordLabel(log)}</td>
                            <td className="px-4 py-2.5">
                              {changes.length > 0 ? (
                                <div className="space-y-0.5">
                                  {changes.map(c => (
                                    <div key={c.field} className="text-xs text-[#8A877F]">
                                      <span className="font-medium text-[#2C2C2A] capitalize">{c.field}:</span>{' '}
                                      <span className="line-through text-[#C4BFB5]">{c.from}</span>{' → '}
                                      <span className="text-[#2C2C2A]">{c.to}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : <span className="text-xs text-[#C4BFB5]">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* My Profile */}
            {designerTab === 'profile' && (
              <div className="max-w-lg">
                <SettingsForm
                  currentFullName={userProfile.fullName}
                  email={userProfile.email}
                  currentPhone={userProfile.phone}
                  currentJobTitle={userProfile.jobTitle}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Supplier Portal ─────────────────────────────────────────── */}
        {portal === 'supplier' && (
          <div>
            <div className="flex gap-1 border-b border-[#D8D3C8] mb-6">
              {(['requests', 'suppliers', 'pricelists'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSupplierTab(t)}
                  className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${supplierTab === t ? 'border-b-2 border-[#2E6DA4] text-[#2E6DA4]' : 'text-[#8A877F] hover:text-[#2C2C2A]'}`}
                >
                  {t === 'requests' ? 'Price Requests' : t === 'suppliers' ? 'Connected Suppliers' : 'Price Lists'}
                </button>
              ))}
            </div>

            {/* Price Requests */}
            {supplierTab === 'requests' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#8A877F]">{sourcingSessions.length} price request{sourcingSessions.length !== 1 ? 's' : ''} total</p>
                  <Link href="/sourcing" className="flex items-center gap-1.5 text-xs text-[#2E6DA4] hover:underline">
                    Open Price Requests <ExternalLink size={11} />
                  </Link>
                </div>
                {sourcingSessions.length === 0 ? (
                  <div className="bg-white border border-[#D8D3C8] rounded-xl px-6 py-12 text-center">
                    <FileText size={28} className="mx-auto text-[#C4BFB5] mb-3" />
                    <p className="text-sm font-medium text-[#2C2C2A] mb-1">No price requests yet</p>
                    <p className="text-xs text-[#8A877F] mb-4">Create a price request to send items to suppliers for quoting.</p>
                    <Link href="/sourcing" className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2E6DA4] text-white text-xs font-medium rounded-lg hover:bg-[#1E5A8C] transition-colors">
                      Go to Price Requests <ArrowRight size={12} />
                    </Link>
                  </div>
                ) : (
                  <div className="bg-white border border-[#D8D3C8] rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC] text-xs text-[#8A877F] uppercase tracking-wider">
                          <th className="text-left px-4 py-3">Request</th>
                          <th className="text-left px-4 py-3">Project</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="text-left px-4 py-3">Items</th>
                          <th className="text-left px-4 py-3">Suppliers</th>
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="w-8 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {sourcingSessions.map(s => {
                          const statusInfo = SESSION_STATUS[s.status] ?? { label: s.status, color: 'bg-[#F5F2EC] text-[#8A877F]' }
                          return (
                            <tr key={s.id} className="border-b border-[#EDE9E1] last:border-0 hover:bg-[#FDFCF9]">
                              <td className="px-4 py-3 text-[#2C2C2A] font-medium">
                                {s.title ?? <span className="text-[#C4BFB5] italic text-xs">Untitled</span>}
                                {s.request_number && <span className="ml-2 text-xs text-[#C4BFB5]">#{s.request_number}</span>}
                              </td>
                              <td className="px-4 py-3 text-[#8A877F] text-xs">{s.project_name ?? '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                              </td>
                              <td className="px-4 py-3 text-[#8A877F] text-xs tabular-nums">{s.item_count}</td>
                              <td className="px-4 py-3 text-[#8A877F] text-xs tabular-nums">{s.supplier_count}</td>
                              <td className="px-4 py-3 text-[#8A877F] text-xs whitespace-nowrap">{fmtDate(s.created_at)}</td>
                              <td className="px-4 py-3">
                                <Link href={`/sourcing/${s.id}`} className="text-[#8A877F] hover:text-[#2E6DA4] transition-colors">
                                  <ExternalLink size={13} />
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Connected Suppliers */}
            {supplierTab === 'suppliers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#8A877F]">{connectedSuppliers.length} supplier{connectedSuppliers.length !== 1 ? 's' : ''} with portal access</p>
                  <Link href="/suppliers" className="flex items-center gap-1.5 text-xs text-[#2E6DA4] hover:underline">
                    Manage Suppliers <ExternalLink size={11} />
                  </Link>
                </div>
                {connectedSuppliers.length === 0 ? (
                  <div className="bg-white border border-[#D8D3C8] rounded-xl px-6 py-12 text-center">
                    <Store size={28} className="mx-auto text-[#C4BFB5] mb-3" />
                    <p className="text-sm font-medium text-[#2C2C2A] mb-1">No connected suppliers yet</p>
                    <p className="text-xs text-[#8A877F] mb-4">Suppliers will appear here once they've registered on the supplier portal and responded to a price request.</p>
                    <Link href="/sourcing" className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2E6DA4] text-white text-xs font-medium rounded-lg hover:bg-[#1E5A8C] transition-colors">
                      Create a Price Request <ArrowRight size={12} />
                    </Link>
                  </div>
                ) : (
                  <div className="bg-white border border-[#D8D3C8] rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC] text-xs text-[#8A877F] uppercase tracking-wider">
                          <th className="text-left px-4 py-3">Company</th>
                          <th className="text-left px-4 py-3">Email</th>
                          <th className="text-left px-4 py-3">Category</th>
                          <th className="text-left px-4 py-3">Plan</th>
                          <th className="text-left px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {connectedSuppliers.map(s => (
                          <tr key={s.id} className="border-b border-[#EDE9E1] last:border-0 hover:bg-[#FDFCF9]">
                            <td className="px-4 py-3 text-[#2C2C2A] font-medium">
                              <div className="flex items-center gap-2">
                                <Building2 size={13} className="text-[#C4BFB5] flex-shrink-0" />
                                {s.company_name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[#8A877F] text-xs">{s.email}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#F5F2EC] text-[#8A877F]">{s.supplier_category ?? 'General'}</span>
                            </td>
                            <td className="px-4 py-3 text-[#8A877F] text-xs capitalize">{s.plan ? PLAN_LABEL[s.plan] ?? s.plan : '—'}</td>
                            <td className="px-4 py-3">
                              {s.subscription_status === 'active' ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                                  <CheckCircle size={10} /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#F5F2EC] text-[#8A877F]">
                                  <AlertCircle size={10} /> {s.subscription_status ?? 'Free'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Price Lists */}
            {supplierTab === 'pricelists' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#8A877F]">{priceLists.length} price list{priceLists.length !== 1 ? 's' : ''} available</p>
                  <Link href="/price-lists" className="flex items-center gap-1.5 text-xs text-[#2E6DA4] hover:underline">
                    Manage Price Lists <ExternalLink size={11} />
                  </Link>
                </div>
                {priceLists.length === 0 ? (
                  <div className="bg-white border border-[#D8D3C8] rounded-xl px-6 py-12 text-center">
                    <List size={28} className="mx-auto text-[#C4BFB5] mb-3" />
                    <p className="text-sm font-medium text-[#2C2C2A] mb-1">No price lists yet</p>
                    <p className="text-xs text-[#8A877F] mb-4">Add supplier price lists to quickly add items to your projects.</p>
                    <Link href="/price-lists" className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2E6DA4] text-white text-xs font-medium rounded-lg hover:bg-[#1E5A8C] transition-colors">
                      View Price Lists <ArrowRight size={12} />
                    </Link>
                  </div>
                ) : (
                  <div className="bg-white border border-[#D8D3C8] rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC] text-xs text-[#8A877F] uppercase tracking-wider">
                          <th className="text-left px-4 py-3">Name</th>
                          <th className="text-left px-4 py-3">Supplier</th>
                          <th className="text-left px-4 py-3">Items</th>
                          <th className="text-left px-4 py-3">Type</th>
                          <th className="w-8 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {priceLists.map(pl => (
                          <tr key={pl.id} className="border-b border-[#EDE9E1] last:border-0 hover:bg-[#FDFCF9]">
                            <td className="px-4 py-3 text-[#2C2C2A] font-medium">{pl.name}</td>
                            <td className="px-4 py-3 text-[#8A877F] text-xs">{pl.supplier_name ?? '—'}</td>
                            <td className="px-4 py-3 text-[#8A877F] text-xs tabular-nums">{pl.item_count ?? 0}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${pl.is_global ? 'bg-blue-50 text-blue-600' : 'bg-[#F5F2EC] text-[#8A877F]'}`}>
                                {pl.is_global ? 'Platform' : 'Studio'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/price-lists/${pl.id}`} className="text-[#8A877F] hover:text-[#2E6DA4] transition-colors">
                                <ExternalLink size={13} />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Electrician Portal ──────────────────────────────────────── */}
        {portal === 'electrician' && (
          <div>
            <div className="flex gap-1 border-b border-[#D8D3C8] mb-6">
              {(['contractors'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setElectricianTab(t)}
                  className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${electricianTab === t ? 'border-b-2 border-[#B45309] text-[#B45309]' : 'text-[#8A877F] hover:text-[#2C2C2A]'}`}
                >
                  Linked Contractors
                </button>
              ))}
            </div>

            {/* Linked Contractors */}
            {electricianTab === 'contractors' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#8A877F]">{electricianAccounts.length} contractor{electricianAccounts.length !== 1 ? 's' : ''} with portal access</p>
                  <Link href="/supplier-portal" className="flex items-center gap-1.5 text-xs text-[#B45309] hover:underline" target="_blank" rel="noopener">
                    Electrician Portal <ExternalLink size={11} />
                  </Link>
                </div>

                {electricianAccounts.length === 0 ? (
                  <div className="bg-white border border-[#D8D3C8] rounded-xl px-6 py-12 text-center">
                    <Zap size={28} className="mx-auto text-[#C4BFB5] mb-3" />
                    <p className="text-sm font-medium text-[#2C2C2A] mb-1">No linked electricians yet</p>
                    <p className="text-xs text-[#8A877F] mb-4 max-w-xs mx-auto">
                      Electricians and trade contractors linked to your studio through the Electrician Portal will appear here.
                      They use the portal to manage job cards, quotes, claims, and certificates of completion.
                    </p>
                    <div className="bg-[#FEF3C7] border border-amber-200 rounded-lg px-4 py-3 max-w-sm mx-auto text-left">
                      <p className="text-xs font-medium text-amber-800 mb-1">How to link an electrician</p>
                      <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                        <li>Ask your electrician to sign up at <span className="font-mono">/supplier-portal/register</span></li>
                        <li>They select <strong>Trades</strong> as their category</li>
                        <li>Once registered, they appear in this section</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-white border border-[#D8D3C8] rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC] text-xs text-[#8A877F] uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Company</th>
                            <th className="text-left px-4 py-3">Email</th>
                            <th className="text-left px-4 py-3">Plan</th>
                            <th className="text-left px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {electricianAccounts.map(a => (
                            <tr key={a.id} className="border-b border-[#EDE9E1] last:border-0 hover:bg-[#FDFCF9]">
                              <td className="px-4 py-3 text-[#2C2C2A] font-medium">
                                <div className="flex items-center gap-2">
                                  <Zap size={13} className="text-amber-500 flex-shrink-0" />
                                  {a.company_name}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[#8A877F] text-xs">{a.email}</td>
                              <td className="px-4 py-3 text-[#8A877F] text-xs capitalize">{a.plan ? PLAN_LABEL[a.plan] ?? a.plan : '—'}</td>
                              <td className="px-4 py-3">
                                {a.subscription_status === 'active' ? (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                                    <CheckCircle size={10} /> Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#F5F2EC] text-[#8A877F]">
                                    <AlertCircle size={10} /> {a.subscription_status ?? 'Free'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
                      <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
                        <Zap size={12} /> Electrician Portal Features
                      </p>
                      <p className="text-xs text-amber-700 mb-2">Each linked contractor manages the following through their portal:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                        {['Quotes & Contracts', 'Job Cards', 'Certificate of Completion', 'Variations & Claims', 'Snag Lists', 'Staff & Schedule'].map(f => (
                          <div key={f} className="flex items-center gap-1.5 text-xs text-amber-700">
                            <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                            {f}
                          </div>
                        ))}
                      </div>
                      <Link
                        href="/supplier-portal"
                        target="_blank"
                        rel="noopener"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 hover:text-amber-900 transition-colors"
                      >
                        Visit Electrician Portal <ExternalLink size={11} />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generic confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setConfirmModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-[360px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#1A1A18]">{confirmModal.title}</h2>
              <button onClick={() => setConfirmModal(null)} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"><X size={16} /></button>
            </div>
            <p className="text-sm text-[#8A877F] leading-relaxed mb-5">{confirmModal.body}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmModal(null)} className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">Cancel</button>
              <button
                onClick={async () => { const fn = confirmModal.onConfirm; setConfirmModal(null); await fn() }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${confirmModal.danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[#9A7B4F] text-white hover:bg-[#B8956A]'}`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade to Agency modal */}
      {upgradeAgencyOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setUpgradeAgencyOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[380px] p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#1A1A18]">Team limit reached</h2>
              <button onClick={() => setUpgradeAgencyOpen(false)} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"><X size={16} /></button>
            </div>
            <p className="text-sm text-[#8A877F] leading-relaxed mb-5">
              Studio supports up to 5 team members. Upgrade to Agency for <strong className="text-[#2C2C2A]">up to 10 members</strong>, Sage integration, and custom branded PDFs — charged at <strong className="text-[#2C2C2A]">R2,499/month</strong>.
            </p>
            <ul className="space-y-2 mb-6">
              {['Unlimited team members', 'Sage Business Cloud Accounting integration', 'Custom branded PDFs — we match your letterhead'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#2C2C2A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9A7B4F] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <button onClick={handleUpgradeAgency} disabled={upgradingAgency} className="w-full py-3 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer font-medium">
                {upgradingAgency ? 'Redirecting…' : 'Upgrade to Agency →'}
              </button>
              <button onClick={() => setUpgradeAgencyOpen(false)} className="w-full py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
