'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, ShieldCheck, User, Ban, Clock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StudioSettingsForm } from './StudioSettingsForm'

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

interface Props {
  members: Member[]
  auditLogs: AuditLog[]
  isAdmin: boolean
  settings: Record<string, unknown> | null
}

const ACTION_COLOR: Record<string, string> = {
  created: 'text-green-600 bg-green-50',
  updated: 'text-blue-600 bg-blue-50',
  deleted: 'text-red-600 bg-red-50',
}

export function AdminPanel({ members: initial, auditLogs, isAdmin, settings }: Props) {
  const [members, setMembers] = useState(initial)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('designer')
  const [inviting, setInviting] = useState(false)
  const [tab, setTab] = useState<'users' | 'studio' | 'audit'>('users')

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
      const { error } = await res.json()
      toast.error(error ?? 'Failed to send invite')
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

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#D8D3C8] mb-6">
        {(['users', 'studio', 'audit'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${tab === t ? 'border-b-2 border-[#9A7B4F] text-[#9A7B4F]' : 'text-[#8A877F] hover:text-[#2C2C2A]'}`}
          >
            {t === 'users' ? 'Team Members' : t === 'studio' ? 'Studio Settings' : 'Audit Log'}
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
        <StudioSettingsForm settings={settings as any} />
      )}

      {tab === 'audit' && (
        <div className="bg-white border border-[#D8D3C8] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC] text-xs text-[#8A877F] uppercase tracking-wider">
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Table</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-[#8A877F]">No activity yet</td></tr>
              )}
              {auditLogs.map(log => (
                <tr key={log.id} className="border-b border-[#EDE9E1] last:border-0 hover:bg-[#FDFCF9]">
                  <td className="px-4 py-2.5 text-xs text-[#8A877F] whitespace-nowrap">{fmt(log.created_at)}</td>
                  <td className="px-4 py-2.5 text-xs text-[#2C2C2A]">{log.user_email ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLOR[log.action] ?? 'text-[#8A877F] bg-[#F5F2EC]'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#8A877F] font-mono">{log.table_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
