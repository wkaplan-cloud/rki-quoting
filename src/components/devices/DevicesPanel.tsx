'use client'
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Check, AlertCircle, Loader2, KeyRound, Eye, EyeOff, ScanLine, Router, ShieldCheck, ShieldAlert } from 'lucide-react'
import type { ElecDevice, ElecDeviceInput } from '@/lib/elec-types'
import { DEVICE_CATEGORIES, warrantyState } from '@/lib/device-categories'
import { todaySA } from '@/lib/dates'
import { BarcodeScanner } from '@/components/BarcodeScanner'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: 'var(--qh-accent)',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A', gold: '#B7862F',
}

const WARRANTY_STYLE = {
  ok:      { color: S.green,  bg: 'rgba(22,163,74,0.1)',  label: (d: string) => `Warranty to ${d}` },
  soon:    { color: S.gold,   bg: 'rgba(217,164,65,0.14)', label: (d: string) => `Warranty ends ${d}` },
  expired: { color: S.danger, bg: 'rgba(220,38,38,0.08)', label: (d: string) => `Warranty ended ${d}` },
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** One device, as a card — reads the same on a desktop tab and a phone. */
export function DeviceCard({ device, onEdit, onDelete, showClient = false }: {
  device: ElecDevice
  onEdit?: () => void
  onDelete?: () => void
  showClient?: boolean
}) {
  const [password, setPassword] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const title = [device.brand, device.model].filter(Boolean).join(' ') || device.description || 'Device'
  const ws = warrantyState(device.warranty_until, todaySA())

  async function reveal() {
    if (password !== null) { setPassword(null); return }
    setRevealing(true)
    const res = await fetch(`/api/supplier-portal/quoting/devices/${device.id}/secret`)
    const d = await res.json() as { password?: string | null }
    setRevealing(false)
    setPassword(d.password ?? '')
  }

  const facts = [
    device.serial_number && ['S/N', device.serial_number],
    device.mac_address && ['MAC', device.mac_address],
    device.ip_address && ['IP', device.ip_address],
    device.firmware && ['FW', device.firmware],
  ].filter(Boolean) as [string, string][]

  return (
    <div className="rounded-xl p-3.5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(var(--qh-accent-rgb),0.1)' }}>
          <Router size={15} style={{ color: S.accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: S.text }}>{title}</p>
          <p className="text-xs" style={{ color: S.muted }}>
            {[showClient ? device.client?.client_name : null, device.category, device.brand && device.model && device.description ? device.description : null]
              .filter(Boolean).join(' · ')}
          </p>
          {facts.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
              {facts.map(([k, v]) => (
                <span key={k} className="text-xs font-mono" style={{ color: S.text }}>
                  <span style={{ color: S.muted }}>{k} </span>{v}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {ws !== 'none' && device.warranty_until && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: WARRANTY_STYLE[ws].bg, color: WARRANTY_STYLE[ws].color }}>
                {ws === 'ok' ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                {WARRANTY_STYLE[ws].label(fmtDate(device.warranty_until))}
              </span>
            )}
            {(device.username || device.has_password) && (
              <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full" style={{ background: S.bg, color: S.text }}>
                <KeyRound size={11} style={{ color: S.muted }} />
                {device.username && <span className="font-mono">{device.username}</span>}
                {device.has_password && (
                  <>
                    <span className="font-mono">{password !== null ? (password || '(empty)') : '••••••'}</span>
                    <button onClick={() => void reveal()} aria-label={password !== null ? 'Hide password' : 'Show password'}
                      className="flex items-center" style={{ color: S.accent }}>
                      {revealing ? <Loader2 size={11} className="animate-spin" /> : password !== null ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </>
                )}
              </span>
            )}
            {device.quote && showClient && (
              <span className="text-[11px]" style={{ color: S.muted }}>{device.quote.quote_number}</span>
            )}
          </div>
          {device.notes && <p className="text-xs mt-1.5 italic" style={{ color: S.muted }}>{device.notes}</p>}
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onEdit && (
              <button onClick={onEdit} className="p-1.5 rounded-lg" style={{ color: S.muted }} aria-label={`Edit ${title}`}>
                <Pencil size={13} />
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="p-1.5 rounded-lg" style={{ color: S.muted }} aria-label={`Remove ${title}`}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Editor ───────────────────────────────────────────────────────────────────

type Form = Record<'room' | 'category' | 'brand' | 'model' | 'description' | 'serial_number' | 'mac_address' | 'ip_address' | 'firmware' | 'installed_on' | 'warranty_until' | 'username' | 'notes', string>

function formFrom(d: ElecDevice | null, defaults: { room?: string }): Form {
  return {
    room: d?.room ?? defaults.room ?? '', category: d?.category ?? '', brand: d?.brand ?? '', model: d?.model ?? '',
    description: d?.description ?? '', serial_number: d?.serial_number ?? '', mac_address: d?.mac_address ?? '',
    ip_address: d?.ip_address ?? '', firmware: d?.firmware ?? '',
    installed_on: d?.installed_on ?? (d ? '' : todaySA()), warranty_until: d?.warranty_until ?? '',
    username: d?.username ?? '', notes: d?.notes ?? '',
  }
}

function addYears(iso: string, years: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

export function DeviceEditor({ device, quoteId, clientId, clients, rooms, onClose, onSaved }: {
  device: ElecDevice | null
  quoteId?: string | null
  clientId?: string | null
  /** Offered when the device isn't being added from a client's own screen. */
  clients?: { id: string; client_name: string }[]
  rooms: string[]
  onClose: () => void
  onSaved: (d: ElecDevice) => void
}) {
  const [form, setForm] = useState<Form>(() => formFrom(device, { room: rooms[rooms.length - 1] }))
  const [pickedClient, setPickedClient] = useState(device?.client_id ?? clientId ?? '')
  const [password, setPassword] = useState('')
  const [clearPassword, setClearPassword] = useState(false)
  const [scanFor, setScanFor] = useState<'serial_number' | 'mac_address' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }))

  function onScan(text: string) {
    if (scanFor) set(scanFor, text)
    setScanFor(null)
  }

  async function save() {
    setSaving(true); setError('')
    const body: ElecDeviceInput = {
      ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null])),
      ...(device ? {} : { quote_id: quoteId ?? null }),
      ...(clients ? { client_id: pickedClient || null } : device ? {} : { client_id: clientId ?? null }),
      ...(password ? { password } : clearPassword ? { password: null } : {}),
    }
    const res = await fetch(device ? `/api/supplier-portal/quoting/devices/${device.id}` : '/api/supplier-portal/quoting/devices', {
      method: device ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => ({})) as { device?: ElecDevice; error?: string }
    setSaving(false)
    if (!res.ok || !d.device) { setError(d.error ?? 'Could not save the device'); return }
    onSaved(d.device)
  }

  const label = 'block text-[10px] font-semibold uppercase tracking-wider mb-1'
  const input = 'w-full px-3 py-2.5 text-sm rounded-xl outline-none'
  const inputStyle = { background: S.input, border: `1px solid ${S.border}`, color: S.text }
  const field = (k: keyof Form, text: string, opts: { mono?: boolean; type?: string } = {}) => (
    <div>
      <label htmlFor={`dev-${k}`} className={label} style={{ color: S.muted }}>{text}</label>
      <input id={`dev-${k}`} type={opts.type ?? 'text'} value={form[k]} onChange={e => set(k, e.target.value)}
        className={`${input}${opts.mono ? ' font-mono' : ''}`} style={inputStyle} />
    </div>
  )
  const scanField = (k: 'serial_number' | 'mac_address', text: string) => (
    <div>
      <label htmlFor={`dev-${k}`} className={label} style={{ color: S.muted }}>{text}</label>
      <div className="flex gap-2">
        <input id={`dev-${k}`} value={form[k]} onChange={e => set(k, e.target.value)}
          className={`${input} font-mono flex-1 min-w-0`} style={inputStyle} />
        <button type="button" onClick={() => setScanFor(k)} aria-label={`Scan ${text}`}
          className="px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold flex-shrink-0"
          style={{ background: 'rgba(var(--qh-accent-rgb),0.1)', color: S.accent }}>
          <ScanLine size={14} /> Scan
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="w-full sm:max-w-xl max-h-[94vh] flex flex-col rounded-t-2xl sm:rounded-2xl" style={{ background: S.card, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
          <h2 className="font-bold text-sm" style={{ color: S.text }}>{device ? 'Edit device' : 'Add device'}</h2>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg" style={{ color: S.muted }} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto">
          {clients && (
            <div>
              <label htmlFor="dev-client" className={label} style={{ color: S.muted }}>Client / site *</label>
              <select id="dev-client" value={pickedClient} onChange={e => setPickedClient(e.target.value)} className={input} style={inputStyle}>
                <option value="">Choose a client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="dev-room" className={label} style={{ color: S.muted }}>Room / location</label>
              <input id="dev-room" list="dev-rooms" value={form.room} onChange={e => set('room', e.target.value)} className={input} style={inputStyle} />
              <datalist id="dev-rooms">{rooms.map(r => <option key={r} value={r} />)}</datalist>
            </div>
            <div>
              <label htmlFor="dev-category" className={label} style={{ color: S.muted }}>Type</label>
              <select id="dev-category" value={form.category} onChange={e => set('category', e.target.value)} className={input} style={inputStyle}>
                <option value="">—</option>
                {DEVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('brand', 'Brand')}
            {field('model', 'Model')}
          </div>
          {field('description', 'Description')}
          {scanField('serial_number', 'Serial number')}
          {scanField('mac_address', 'MAC address')}
          <div className="grid grid-cols-2 gap-3">
            {field('ip_address', 'IP address', { mono: true })}
            {field('firmware', 'Firmware')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('installed_on', 'Installed on', { type: 'date' })}
            <div>
              {field('warranty_until', 'Warranty until', { type: 'date' })}
              {form.installed_on && (
                <div className="flex gap-1.5 mt-1.5">
                  {[1, 2, 3, 5].map(y => (
                    <button key={y} type="button" onClick={() => set('warranty_until', addYears(form.installed_on, y))}
                      className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: S.bg, color: S.muted }}>
                      +{y}y
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl p-3 space-y-3" style={{ background: S.bg }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: S.muted }}>
              <KeyRound size={11} /> Device login
            </p>
            <div className="grid grid-cols-2 gap-3">
              {field('username', 'Username', { mono: true })}
              <div>
                <label htmlFor="dev-password" className={label} style={{ color: S.muted }}>
                  {device?.has_password && !clearPassword ? 'New password' : 'Password'}
                </label>
                <input id="dev-password" type="password" autoComplete="new-password" value={password}
                  onChange={e => { setPassword(e.target.value); setClearPassword(false) }}
                  className={`${input} font-mono`} style={{ ...inputStyle, background: '#fff' }} />
              </div>
            </div>
            <p className="text-[11px]" style={{ color: S.muted }}>
              Stored encrypted and only shown when someone clicks to reveal it.
              {device?.has_password && !password && (
                clearPassword
                  ? <> The saved password will be removed. <button type="button" className="underline" onClick={() => setClearPassword(false)}>Keep it</button></>
                  : <> A password is saved — leave this blank to keep it, or <button type="button" className="underline" onClick={() => setClearPassword(true)}>remove it</button>.</>
              )}
            </p>
          </div>

          <div>
            <label htmlFor="dev-notes" className={label} style={{ color: S.muted }}>Notes</label>
            <textarea id="dev-notes" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className={`${input} resize-none`} style={inputStyle} />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: '#FEF2F2', color: S.danger }}>
              <AlertCircle size={13} />{error}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4" style={{ borderTop: `1px solid ${S.border}` }}>
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted, background: S.input }}>Cancel</button>
          <button onClick={() => void save()} disabled={saving || (!!clients && !pickedClient)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: S.accent }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : device ? 'Save device' : 'Add device'}
          </button>
        </div>
      </div>

      {scanFor && <BarcodeScanner onResult={onScan} onClose={() => setScanFor(null)} />}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

/**
 * Every device on a project (quoteId) or at a site (clientId), grouped by room,
 * with add / edit / remove. Loads its own data so any screen can drop it in.
 */
export function DevicesPanel({ quoteId = null, clientId = null, canEdit = true, title = 'Devices', emptyText }: {
  quoteId?: string | null
  clientId?: string | null
  canEdit?: boolean
  title?: string
  emptyText?: string
}) {
  const [devices, setDevices] = useState<ElecDevice[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ElecDevice | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ElecDevice | null>(null)

  useEffect(() => {
    const qs = quoteId ? `quote_id=${quoteId}` : clientId ? `client_id=${clientId}` : ''
    if (!qs) return
    let cancelled = false
    fetch(`/api/supplier-portal/quoting/devices?${qs}`)
      .then(r => r.json())
      .then((d: { devices?: ElecDevice[]; error?: string }) => {
        if (cancelled) return
        if (d.devices) setDevices(d.devices)
        else setError(d.error ?? 'Could not load devices')
      })
      .catch(() => { if (!cancelled) setError('Could not load devices') })
    return () => { cancelled = true }
  }, [quoteId, clientId])

  async function remove(d: ElecDevice) {
    const res = await fetch(`/api/supplier-portal/quoting/devices/${d.id}`, { method: 'DELETE' })
    if (res.ok) setDevices(ds => (ds ?? []).filter(x => x.id !== d.id))
    setDeleting(null)
  }

  const rooms = [...new Set((devices ?? []).map(d => d.room).filter((r): r is string => !!r))]
  const groups = new Map<string, ElecDevice[]>()
  for (const d of devices ?? []) {
    const key = d.room || 'No room set'
    groups.set(key, [...(groups.get(key) ?? []), d])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: S.muted }}>
          {title}{devices && devices.length > 0 ? ` (${devices.length})` : ''}
        </h3>
        {canEdit && (
          <button onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: S.accent }}>
            <Plus size={12} /> Add device
          </button>
        )}
      </div>

      {devices === null && !error && <div className="py-6 flex justify-center"><Loader2 size={18} className="animate-spin" style={{ color: S.accent }} /></div>}
      {error && <p className="text-sm" style={{ color: S.danger }}>{error}</p>}
      {devices && devices.length === 0 && (
        <div className="rounded-xl py-8 px-4 text-center" style={{ background: S.card, border: `1px dashed ${S.border}` }}>
          <Router size={24} className="mx-auto mb-2" style={{ color: S.border }} />
          <p className="text-sm" style={{ color: S.muted }}>
            {emptyText ?? 'No devices yet. Add each controller, access point, camera and recorder as it goes in — serial, MAC and login — so the next support call starts with the answers.'}
          </p>
        </div>
      )}
      {devices && devices.length > 0 && (
        <div className="space-y-4">
          {[...groups.entries()].map(([room, list]) => (
            <div key={room}>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.accent }}>{room}</p>
              <div className="space-y-2">
                {list.map(d => (
                  <DeviceCard key={d.id} device={d}
                    onEdit={canEdit ? () => setEditing(d) : undefined}
                    onDelete={canEdit ? () => setDeleting(d) : undefined} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <DeviceEditor
          device={editing === 'new' ? null : editing}
          quoteId={quoteId}
          clientId={clientId}
          rooms={rooms}
          onClose={() => setEditing(null)}
          onSaved={saved => {
            setDevices(ds => {
              const list = ds ?? []
              return list.some(x => x.id === saved.id) ? list.map(x => x.id === saved.id ? saved : x) : [...list, saved]
            })
            setEditing(null)
          }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: S.card, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <h3 className="font-bold text-sm mb-2" style={{ color: S.text }}>Remove this device?</h3>
            <p className="text-sm mb-5" style={{ color: S.muted }}>It comes off the register and the handover pack. Its saved login goes with it.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted, background: S.input }}>Cancel</button>
              <button onClick={() => void remove(deleting)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: S.danger }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
