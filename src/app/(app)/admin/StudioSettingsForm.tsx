'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Upload, X, CheckCircle, KeyRound, Zap, Maximize2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSearchParams, useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compressImage'
import { THEMES } from '@/lib/pdf/themes'
import type { ThemeKey, PdfTheme } from '@/lib/pdf/themes'

// ─── Template preview helpers ─────────────────────────────────────────────────

const PREVIEW_ROWS = [
  ['Dining Table', '1', 'R 24,500'],
  ['Lounge Chairs', '2', 'R 8,400'],
  ['Side Cabinet', '1', 'R 12,800'],
]

function ClassicDoc({ t }: { t: PdfTheme }) {
  return (
    <div style={{ padding: 48, height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Helvetica, Arial, sans-serif', color: t.text, backgroundColor: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ width: 90, height: 16, backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: 2, marginBottom: 6 }} />
          <div style={{ fontSize: 7, color: t.muted, lineHeight: 1.4 }}>123 Studio Lane, Cape Town</div>
          <div style={{ fontSize: 7, color: t.muted }}>VAT: 4123456789</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.primary, letterSpacing: 1 }}>QUOTATION</div>
          <div style={{ fontSize: 8, color: t.muted, marginTop: 4 }}>#QT-2024-042</div>
          <div style={{ fontSize: 8, color: t.muted, marginTop: 3 }}>11 May 2026</div>
        </div>
      </div>
      <div style={{ display: 'flex', borderBottom: `0.5px solid ${t.border}`, paddingBottom: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 7, color: t.accent, borderBottom: `0.5px solid ${t.border}`, paddingBottom: 3, marginBottom: 5 }}>CLIENT</div>
          <div style={{ fontSize: 9, fontWeight: 700 }}>Sarah &amp; James Nkosi</div>
          <div style={{ fontSize: 8, color: t.muted }}>Sandton, Johannesburg</div>
        </div>
        <div style={{ flex: 1, paddingLeft: 24 }}>
          <div style={{ fontSize: 7, color: t.accent, borderBottom: `0.5px solid ${t.border}`, paddingBottom: 3, marginBottom: 5 }}>PROJECT</div>
          <div style={{ fontSize: 9, fontWeight: 700 }}>Nkosi Residence</div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', backgroundColor: t.surface, padding: '6px 4px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ flex: 1, fontSize: 8, color: t.muted, fontWeight: 700 }}>ITEM</div>
          <div style={{ width: 44, fontSize: 8, color: t.muted, fontWeight: 700, textAlign: 'right', paddingRight: 8 }}>QTY</div>
          <div style={{ width: 80, fontSize: 8, color: t.muted, fontWeight: 700, textAlign: 'right' }}>TOTAL</div>
        </div>
        {PREVIEW_ROWS.map((r, i) => (
          <div key={i} style={{ display: 'flex', padding: '5px 4px', borderBottom: `0.5px solid ${t.border}`, backgroundColor: i % 2 === 1 ? t.surface : 'white' }}>
            <div style={{ flex: 1, fontSize: 9 }}>{r[0]}</div>
            <div style={{ width: 44, fontSize: 9, textAlign: 'right', paddingRight: 8 }}>{r[1]}</div>
            <div style={{ width: 80, fontSize: 9, textAlign: 'right', fontWeight: 700 }}>{r[2]}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <div style={{ width: 200, border: `1px solid ${t.border}`, borderRadius: 4, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 8, color: t.muted }}>Subtotal</span><span style={{ fontSize: 8 }}>R 45,700</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 8, color: t.muted }}>Design Fee (15%)</span><span style={{ fontSize: 8 }}>R 6,855</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 8, color: t.muted }}>VAT (15%)</span><span style={{ fontSize: 8 }}>R 7,883</span></div>
          <div style={{ borderTop: `0.5px solid ${t.border}`, margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.primary }}>TOTAL</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.primary }}>R 60,438</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 8, color: t.accent }}>50% Deposit</span>
            <span style={{ fontSize: 8, color: t.accent, fontWeight: 700 }}>R 30,219</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 'auto', borderTop: `0.5px solid ${t.border}`, paddingTop: 8, textAlign: 'center' }}>
        <div style={{ fontSize: 8, color: t.muted }}>Thank you for your business.</div>
      </div>
    </div>
  )
}

function BoldDoc({ t }: { t: PdfTheme }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Helvetica, Arial, sans-serif', color: t.text, backgroundColor: 'white' }}>
      <div style={{ backgroundColor: t.headerBg, padding: '28px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: 100, height: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: t.headerText, letterSpacing: 2 }}>QUOTATION</div>
          <div style={{ fontSize: 11, color: t.accent === t.headerBg ? t.headerText : t.accent, marginTop: 4 }}>#QT-2024-042</div>
        </div>
      </div>
      <div style={{ padding: '24px 48px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 7.5, color: t.muted, lineHeight: 1.6 }}>123 Studio Lane, Cape Town<br />VAT: 4123456789</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 7.5, color: t.muted }}>Date Issued</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.text, marginTop: 2 }}>11 May 2026</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1, backgroundColor: t.surface, borderRadius: 4, padding: 14 }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: t.accent, letterSpacing: 1, marginBottom: 6 }}>BILLED TO</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.primary }}>Sarah &amp; James Nkosi</div>
            <div style={{ fontSize: 8, color: t.muted, marginTop: 2 }}>Sandton, Johannesburg</div>
          </div>
          <div style={{ flex: 1, backgroundColor: t.surface, borderRadius: 4, padding: 14 }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: t.accent, letterSpacing: 1, marginBottom: 6 }}>PROJECT</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.primary }}>Nkosi Residence</div>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', backgroundColor: t.primary, padding: '8px 6px', borderRadius: 3 }}>
            <div style={{ flex: 1, fontSize: 8, color: t.headerText, fontWeight: 700 }}>ITEM</div>
            <div style={{ width: 44, fontSize: 8, color: t.headerText, fontWeight: 700, textAlign: 'right', paddingRight: 8 }}>QTY</div>
            <div style={{ width: 80, fontSize: 8, color: t.headerText, fontWeight: 700, textAlign: 'right' }}>TOTAL</div>
          </div>
          {PREVIEW_ROWS.map((r, i) => (
            <div key={i} style={{ display: 'flex', padding: '6px 6px', borderBottom: `0.5px solid ${t.border}`, backgroundColor: i % 2 === 1 ? t.surface : 'white' }}>
              <div style={{ flex: 1, fontSize: 9 }}>{r[0]}</div>
              <div style={{ width: 44, fontSize: 9, textAlign: 'right', paddingRight: 8 }}>{r[1]}</div>
              <div style={{ width: 80, fontSize: 9, textAlign: 'right', fontWeight: 700, color: t.primary }}>{r[2]}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <div style={{ width: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ fontSize: 8, color: t.muted }}>Subtotal</span><span style={{ fontSize: 8 }}>R 45,700</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ fontSize: 8, color: t.muted }}>VAT (15%)</span><span style={{ fontSize: 8 }}>R 7,883</span></div>
            <div style={{ backgroundColor: t.primary, borderRadius: 3, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.headerText }}>TOTAL</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.headerText }}>R 60,438</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 8, color: t.accent }}>50% Deposit</span>
              <span style={{ fontSize: 8, color: t.accent, fontWeight: 700 }}>R 30,219</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ backgroundColor: t.surface, padding: '10px 48px', borderTop: `1px solid ${t.border}`, textAlign: 'center' }}>
        <div style={{ fontSize: 8, color: t.muted }}>Thank you for your business.</div>
      </div>
    </div>
  )
}

function MinimalDoc({ t }: { t: PdfTheme }) {
  return (
    <div style={{ padding: 56, height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Helvetica, Arial, sans-serif', color: t.text, backgroundColor: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div style={{ width: 100, height: 18, backgroundColor: t.surface, borderRadius: 2, border: `1px solid ${t.border}` }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: t.accent, letterSpacing: 2 }}>QUOTATION</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.primary, marginTop: 2 }}>#QT-042</div>
        </div>
      </div>
      <div style={{ borderTop: `1.5px solid ${t.primary}`, marginBottom: 24 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 7, color: t.muted, letterSpacing: 1.5, marginBottom: 8 }}>BILLED TO</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.primary }}>Sarah &amp; James Nkosi</div>
          <div style={{ fontSize: 8, color: t.muted, marginTop: 2 }}>Sandton, Johannesburg</div>
        </div>
        <div style={{ width: 160, textAlign: 'right' }}>
          <div style={{ fontSize: 7, color: t.muted, letterSpacing: 1.5, marginBottom: 8 }}>DETAILS</div>
          <div style={{ fontSize: 8, color: t.text }}>11 May 2026</div>
          <div style={{ fontSize: 8, color: t.text, marginTop: 2 }}>Nkosi Residence</div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', borderBottom: `1px solid ${t.primary}`, paddingBottom: 7 }}>
          <div style={{ flex: 1, fontSize: 7.5, color: t.muted, letterSpacing: 1 }}>ITEM</div>
          <div style={{ width: 44, fontSize: 7.5, color: t.muted, letterSpacing: 1, textAlign: 'right', paddingRight: 8 }}>QTY</div>
          <div style={{ width: 80, fontSize: 7.5, color: t.muted, letterSpacing: 1, textAlign: 'right' }}>TOTAL</div>
        </div>
        {PREVIEW_ROWS.map((r, i) => (
          <div key={i} style={{ display: 'flex', padding: '8px 0', borderBottom: `0.5px solid ${t.border}` }}>
            <div style={{ flex: 1, fontSize: 9 }}>{r[0]}</div>
            <div style={{ width: 44, fontSize: 9, textAlign: 'right', paddingRight: 8, color: t.muted }}>{r[1]}</div>
            <div style={{ width: 80, fontSize: 9, textAlign: 'right', fontWeight: 700 }}>{r[2]}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <div style={{ width: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ fontSize: 8, color: t.muted }}>Subtotal</span><span style={{ fontSize: 8 }}>R 45,700</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ fontSize: 8, color: t.muted }}>VAT (15%)</span><span style={{ fontSize: 8 }}>R 7,883</span></div>
          <div style={{ borderTop: `1px solid ${t.primary}`, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.primary, letterSpacing: 0.5 }}>TOTAL</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.primary }}>R 60,438</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 8, color: t.accent }}>50% Deposit</span>
            <span style={{ fontSize: 8, color: t.accent }}>R 30,219</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 'auto', borderTop: `0.5px solid ${t.border}`, paddingTop: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 8, color: t.muted, letterSpacing: 0.5 }}>Thank you for your business.</div>
      </div>
    </div>
  )
}

// Renders the correct doc preview inside a scaled container
const DOC_W = 595
const DOC_H = 842
const CARD_W = 158
const CARD_H = Math.round(CARD_W * DOC_H / DOC_W)  // ~223
const MODAL_W = 496
const MODAL_H = Math.round(MODAL_W * DOC_H / DOC_W) // ~702

function TemplateFrame({ template, theme, size }: { template: string; theme: PdfTheme; size: 'card' | 'modal' }) {
  const outerW = size === 'card' ? CARD_W : MODAL_W
  const outerH = size === 'card' ? CARD_H : MODAL_H
  const scale  = outerW / DOC_W
  const Doc = template === 'bold' ? BoldDoc : template === 'minimal' ? MinimalDoc : ClassicDoc
  return (
    <div style={{ width: outerW, height: outerH, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
      <div style={{ width: DOC_W, height: DOC_H, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
        <Doc t={theme} />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Settings {
  id?: string
  sage_access_token?: string | null
  sage_refresh_token?: string | null
  sage_token_expires_at?: string | null
  sage_company_id?: string | null
  sage_username?: string | null
  sage_item_id?: number | null
  xero_access_token?: string | null
  xero_tenant_id?: string | null
  xero_tenant_name?: string | null
  sourcing_enabled?: boolean | null
  business_name?: string | null
  business_address?: string | null
  vat_number?: string | null
  phone?: string | null
  email_from?: string | null
  logo_url?: string | null
  bank_name?: string | null
  bank_account_number?: string | null
  bank_branch_code?: string | null
  vat_rate?: number | null
  deposit_percentage?: number | null
  footer_text?: string | null
  terms_conditions?: string | null
  company_registration?: string | null
  quote_validity_days?: number | null
  payment_terms?: string | null
  lead_time?: string | null
  email_template_quote?: string | null
  email_template_invoice?: string | null
  accounts_email?: string | null
  production_sheet_email?: string | null
  pdf_template?: string | null
  pdf_color_theme?: string | null
  sage_invoice_message?: string | null
}

type Tab = 'general' | 'branding' | 'accounting'

const TABS: { key: Tab; label: string }[] = [
  { key: 'general',    label: 'General' },
  { key: 'branding',  label: 'Branding' },
  { key: 'accounting', label: 'Accounting' },
]

export function StudioSettingsForm({ settings, plan, isAdmin }: { settings: Settings | null; plan?: string; isAdmin?: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [previewModal, setPreviewModal] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()

  const [sageConnected, setSageConnected] = useState(!!(settings?.sage_access_token || settings?.sage_username))
  const [sageCompanyId, setSageCompanyId] = useState(settings?.sage_company_id ?? '')
  const [xeroConnected, setXeroConnected] = useState(!!(settings?.xero_access_token && settings?.xero_tenant_id))
  const [xeroTenantName, setXeroTenantName] = useState(settings?.xero_tenant_name ?? '')
  const [disconnectingXero, setDisconnectingXero] = useState(false)
  const [fetchingCompanyId, setFetchingCompanyId] = useState(false)
  const [sageItems, setSageItems] = useState<{ id: number; label: string; code: string }[]>([])
  const [fetchingItems, setFetchingItems] = useState(false)
  const [showItemDropdown, setShowItemDropdown] = useState(false)
  const [selectedItemLabel, setSelectedItemLabel] = useState<string | null>(null)
  const [savedItemId, setSavedItemId] = useState(settings?.sage_item_id ? String(settings.sage_item_id) : '')
  const [showBasicForm, setShowBasicForm] = useState(false)
  const [basicEmail, setBasicEmail] = useState('')
  const [basicPassword, setBasicPassword] = useState('')
  const [connectingBasic, setConnectingBasic] = useState(false)

  type SessionInfo = { id: string; created_at: string; last_active_at: string; expires_at: string | null; is_current: boolean }
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [signingOutOthers, setSigningOutOthers] = useState(false)

  async function loadSessions() {
    setSessionsLoading(true)
    try {
      const res = await fetch('/api/account/sessions')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to load sessions'); return }
      setSessions(data.sessions ?? [])
      setSessionsLoaded(true)
    } catch { toast.error('Failed to load sessions') }
    finally { setSessionsLoading(false) }
  }

  async function signOutOthers() {
    if (!confirm('Sign out all other sessions? Any other devices will be logged out immediately.')) return
    setSigningOutOthers(true)
    try {
      await supabase.auth.signOut({ scope: 'others' })
      setSessions(s => s.filter(x => x.is_current))
      toast.success('All other sessions signed out')
    } catch { toast.error('Failed to sign out other sessions') }
    finally { setSigningOutOthers(false) }
  }

  async function fetchCompanyId() {
    setFetchingCompanyId(true)
    try {
      const res = await fetch('/api/sage/fetch-company-id', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to fetch company ID'); return }
      setSageCompanyId(data.company_id)
      setSageConnected(true)
      toast.success(`Company found: ${data.company_name} (ID: ${data.company_id})`)
    } catch { toast.error('Failed to fetch company ID') }
    finally { setFetchingCompanyId(false) }
  }

  async function fetchSageItems() {
    setFetchingItems(true)
    try {
      const res = await fetch('/api/sage/items')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to fetch Sage items'); return }
      setSageItems(data.items ?? [])
      setShowItemDropdown(true)
    } catch { toast.error('Failed to fetch Sage items') }
    finally { setFetchingItems(false) }
  }

  async function selectItem(item: { id: number; label: string; code: string }) {
    setShowItemDropdown(false)
    setSavedItemId(String(item.id))
    setSelectedItemLabel(item.label)
    set('sage_item_id', String(item.id))
    const { error } = await supabase.from('settings').update({ sage_item_id: item.id }).eq('id', settings!.id)
    if (error) { toast.error('Failed to save item: ' + error.message) }
    else { toast.success(`Sage item set to "${item.label}"`) }
  }

  async function connectBasic() {
    setConnectingBasic(true)
    try {
      const res = await fetch('/api/sage/connect-basic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: basicEmail, password: basicPassword }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to connect to Sage'); return }
      setSageConnected(true)
      setSageCompanyId(data.company_id)
      setShowBasicForm(false)
      setBasicEmail('')
      setBasicPassword('')
      toast.success(`Connected to Sage — ${data.company_name} (ID: ${data.company_id})`)
    } catch { toast.error('Failed to connect to Sage') }
    finally { setConnectingBasic(false) }
  }

  async function disconnectXero() {
    if (!confirm('Disconnect Xero? You will need to reconnect to push invoices.')) return
    setDisconnectingXero(true)
    const res = await fetch('/api/xero/disconnect', { method: 'POST' })
    if (res.ok) { setXeroConnected(false); setXeroTenantName(''); toast.success('Xero disconnected') }
    else { toast.error('Failed to disconnect Xero') }
    setDisconnectingXero(false)
  }

  async function disconnectSage() {
    if (!confirm('Disconnect Sage? You will need to reconnect to push invoices.')) return
    setDisconnecting(true)
    const res = await fetch('/api/sage/disconnect', { method: 'POST' })
    if (res.ok) { setSageConnected(false); toast.success('Sage disconnected') }
    else { toast.error('Failed to disconnect Sage') }
    setDisconnecting(false)
  }

  useEffect(() => {
    if (searchParams.get('sage_connected') === '1') {
      toast.success('Sage connected successfully')
      setSageConnected(true)
      setActiveTab('accounting')
      router.replace('/admin')
    }
    const err = searchParams.get('sage_error')
    if (err) {
      const messages: Record<string, string> = {
        invalid_state: 'Security check failed — please try connecting again',
        token_exchange_failed: 'Sage rejected the authorisation — please try again',
        no_code: 'No authorisation code returned from Sage',
        unknown: 'Something went wrong connecting to Sage',
      }
      toast.error(messages[err] ?? `Sage error: ${err}`)
      router.replace('/admin')
    }
    if (searchParams.get('xero_connected') === '1') {
      const tenant = searchParams.get('xero_tenant') ?? ''
      toast.success(tenant ? `Xero connected — ${tenant}` : 'Xero connected successfully')
      setXeroConnected(true)
      if (tenant) setXeroTenantName(tenant)
      setActiveTab('accounting')
      router.replace('/admin')
    }
    const xeroErr = searchParams.get('xero_error')
    if (xeroErr) {
      const messages: Record<string, string> = {
        invalid_state: 'Security check failed — please try connecting again',
        token_exchange_failed: 'Xero rejected the authorisation — please try again',
        no_code: 'No authorisation code returned from Xero',
        no_tenant: 'No Xero organisation found on this account — make sure you have a Xero company set up',
        unknown: 'Something went wrong connecting to Xero',
      }
      toast.error(messages[xeroErr] ?? `Xero error: ${xeroErr}`)
      router.replace('/admin')
    }
  }, [searchParams, router])

  const [form, setForm] = useState({
    business_name:          settings?.business_name ?? '',
    business_address:       settings?.business_address ?? '',
    vat_number:             settings?.vat_number ?? '',
    phone:                  settings?.phone ?? '',
    email_from:             settings?.email_from ?? '',
    logo_url:               settings?.logo_url ?? '',
    bank_name:              settings?.bank_name ?? '',
    bank_account_number:    settings?.bank_account_number ?? '',
    bank_branch_code:       settings?.bank_branch_code ?? '',
    vat_rate:               String(settings?.vat_rate ?? 15),
    deposit_percentage:     String(settings?.deposit_percentage ?? 50),
    footer_text:            settings?.footer_text ?? 'Thank you for your business.',
    terms_conditions:       settings?.terms_conditions ?? '',
    company_registration:   settings?.company_registration ?? '',
    email_template_quote:   settings?.email_template_quote ?? `Dear {{client_name}},\n\nPlease find attached your quotation for {{project_name}}.\n\nPlease don't hesitate to contact us should you have any questions or require any amendments.\n\nKind regards,\n{{studio_name}}`,
    email_template_invoice: settings?.email_template_invoice ?? `Dear {{client_name}},\n\nPlease find attached your invoice for {{project_name}}.\n\nKindly arrange payment at your earliest convenience.\n\nKind regards,\n{{studio_name}}`,
    accounts_email:         settings?.accounts_email ?? '',
    production_sheet_email: settings?.production_sheet_email ?? '',
    sage_item_id:           String(settings?.sage_item_id ?? ''),
    quote_validity_days:    String(settings?.quote_validity_days ?? 30),
    payment_terms:          settings?.payment_terms ?? '',
    lead_time:              settings?.lead_time ?? '',
    pdf_template:           settings?.pdf_template ?? 'minimal',
    pdf_color_theme:        settings?.pdf_color_theme ?? 'warm',
    sage_invoice_message:   settings?.sage_invoice_message ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Derive the live theme object from whatever colour theme is currently selected
  const currentTheme = THEMES[(form.pdf_color_theme as ThemeKey)] ?? THEMES.warm

  async function uploadLogo(file: File) {
    setUploading(true)
    let compressed: File
    try { compressed = await compressImage(file) } catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed'); setUploading(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Not authenticated'); setUploading(false); return }
    const ext = compressed.name.split('.').pop()
    const path = `studios/${user.id}/logo.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload(path, compressed, { upsert: true, contentType: compressed.type })
    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploading(false); return }
    const { data } = supabase.storage.from('branding').getPublicUrl(path)
    const publicUrl = data.publicUrl + '?t=' + Date.now()
    set('logo_url', publicUrl)
    if (settings?.id) {
      await supabase.from('settings').update({ logo_url: publicUrl }).eq('id', settings.id)
    }
    toast.success('Logo uploaded')
    setUploading(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('settings').update({
      ...form,
      vat_rate: parseFloat(form.vat_rate),
      deposit_percentage: parseFloat(form.deposit_percentage),
      sage_item_id: form.sage_item_id ? parseInt(form.sage_item_id) : null,
      quote_validity_days: form.quote_validity_days ? parseInt(form.quote_validity_days) : 30,
    }).eq('id', settings!.id)
    if (error) { toast.error(error.message) } else { toast.success('Settings saved') }
    setSaving(false)
  }

  const displayItemId = savedItemId
  const displayItemLabel = selectedItemLabel

  const TEMPLATE_OPTIONS = [
    { key: 'classic', label: 'Classic', desc: 'Clean, bordered layout' },
    { key: 'bold',    label: 'Bold',    desc: 'Dark header, strong type' },
    { key: 'minimal', label: 'Minimal', desc: 'Open, typographic' },
  ] as const

  const THEME_OPTIONS = [
    { key: 'warm',     label: 'Warm',     primary: '#1A1A18', accent: '#9A7B4F' },
    { key: 'navy',     label: 'Navy',     primary: '#1B3A5C', accent: '#2E6DA4' },
    { key: 'slate',    label: 'Slate',    primary: '#2D3748', accent: '#718096' },
    { key: 'forest',   label: 'Forest',   primary: '#1E3A2F', accent: '#2D6A4F' },
    { key: 'charcoal', label: 'Charcoal', primary: '#1C1C1C', accent: '#555555' },
  ] as const

  return (
    <div className="space-y-0">

      {/* Tab bar */}
      <div className="flex border-b border-[#EDE9E1] mb-8">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-[#9A7B4F] text-[#9A7B4F]'
                : 'border-transparent text-[#8A877F] hover:text-[#2C2C2A]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── GENERAL TAB ── */}
      {activeTab === 'general' && (
        <form id="settings-form" onSubmit={save} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="space-y-4">
              <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Business Details</h2>
              <Input label="Studio / Business Name" value={form.business_name} onChange={e => set('business_name', e.target.value)} />
              <Textarea label="Business Address" value={form.business_address} onChange={e => set('business_address', e.target.value)} rows={3} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="VAT Number" value={form.vat_number} onChange={e => set('vat_number', e.target.value)} />
                <Input label="Company Registration" value={form.company_registration} onChange={e => set('company_registration', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-[#8A877F]">Reply-to Email</label>
                    <button
                      type="button"
                      onClick={() => set('email_from', form.email_from ? '' : ' ')}
                      className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none ${form.email_from?.trim() ? 'bg-[#9A7B4F]' : 'bg-[#D8D3C8]'}`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${form.email_from?.trim() ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {form.email_from?.trim() ? (
                    <Input type="email" value={form.email_from} onChange={e => set('email_from', e.target.value)} placeholder="override@studio.co.za" />
                  ) : (
                    <p className="text-xs text-[#8A877F] py-2">Clients reply to the sender&apos;s own email</p>
                  )}
                </div>
              </div>
              <Input label="Accounts Email (BCC on all POs)" type="email" value={form.accounts_email} onChange={e => set('accounts_email', e.target.value)} />
              <Input label="Job Cost Sheet Email (default recipient)" type="email" value={form.production_sheet_email} onChange={e => set('production_sheet_email', e.target.value)} placeholder="e.g. production@studio.co.za" />
            </section>
            <section className="space-y-4">
              <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Banking Details</h2>
              <Input label="Bank Name" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Account Number" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} />
                <Input label="Branch Code" value={form.bank_branch_code} onChange={e => set('bank_branch_code', e.target.value)} />
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-[#EDE9E1] pt-8">
            <section className="space-y-4">
              <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Quote Defaults</h2>
              <div className="grid grid-cols-3 gap-4">
                <Input label="VAT Rate (%)" type="number" min="0" step="0.1" value={form.vat_rate} onChange={e => set('vat_rate', e.target.value)} />
                <Input label="Deposit (%)" type="number" min="0" max="100" step="1" value={form.deposit_percentage} onChange={e => set('deposit_percentage', e.target.value)} />
                <Input label="Quote Valid For (days)" type="number" min="1" step="1" value={form.quote_validity_days} onChange={e => set('quote_validity_days', e.target.value)} />
              </div>
              <Textarea label="Payment Terms (shown on quote PDF)" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} rows={2} placeholder="e.g. 50% deposit on order confirmation, balance payable before delivery." />
              <Input label="Estimated Lead Time (shown on quote PDF)" value={form.lead_time} onChange={e => set('lead_time', e.target.value)} placeholder="e.g. 6–8 weeks from deposit confirmation" />
              <Textarea label="Quote / Invoice Footer Text" value={form.footer_text} onChange={e => set('footer_text', e.target.value)} rows={3} />
              <Textarea label="Terms & Conditions (shown on quote PDF)" value={form.terms_conditions} onChange={e => set('terms_conditions', e.target.value)} rows={7} />
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Email Templates</h2>
                <p className="text-xs text-[#8A877F] mt-1">Use <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{client_name}}'}</span>, <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{project_name}}'}</span>, <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{project_number}}'}</span>, <span className="font-mono bg-[#F5F2EC] px-1 rounded">{'{{studio_name}}'}</span> as placeholders.</p>
              </div>
              <Textarea label="Quote Email Body" value={form.email_template_quote} onChange={e => set('email_template_quote', e.target.value)} rows={7} />
              <Textarea label="Invoice Email Body" value={form.email_template_invoice} onChange={e => set('email_template_invoice', e.target.value)} rows={7} />
            </section>
          </div>

          {isAdmin && (
            <section className="space-y-4 border-t border-[#EDE9E1] pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Active Sessions</h2>
                  <p className="text-xs text-[#8A877F] mt-0.5">Devices currently signed in to your account.</p>
                </div>
                {!sessionsLoaded && (
                  <button type="button" onClick={loadSessions} disabled={sessionsLoading} className="text-xs text-[#9A7B4F] hover:underline disabled:opacity-50 cursor-pointer">
                    {sessionsLoading ? 'Loading…' : 'Show sessions →'}
                  </button>
                )}
              </div>
              {sessionsLoaded && (
                <>
                  <div className="space-y-2">
                    {sessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#2C2C2A]">{s.is_current ? 'This device' : 'Other session'}</span>
                            {s.is_current && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">current</span>}
                          </div>
                          <p className="text-xs text-[#8A877F] mt-0.5">
                            Started {new Date(s.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}Last active {new Date(s.last_active_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {sessions.filter(s => !s.is_current).length > 0 && (
                    <button type="button" onClick={signOutOthers} disabled={signingOutOthers} className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50 cursor-pointer">
                      {signingOutOthers ? 'Signing out…' : `Sign out ${sessions.filter(s => !s.is_current).length} other session${sessions.filter(s => !s.is_current).length > 1 ? 's' : ''}`}
                    </button>
                  )}
                  {sessions.filter(s => !s.is_current).length === 0 && <p className="text-xs text-[#8A877F]">No other active sessions.</p>}
                </>
              )}
            </section>
          )}

          <div className="border-t border-[#EDE9E1] pt-6">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
          </div>
        </form>
      )}

      {/* ── BRANDING TAB ── */}
      {activeTab === 'branding' && (
        <form id="settings-form" onSubmit={save} className="space-y-8 max-w-2xl">

          {/* Logo */}
          <section className="space-y-4">
            <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Logo</h2>
            <div className="flex items-center gap-4">
              {form.logo_url && (
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logo_url} alt="Logo" className="h-14 max-w-[180px] object-contain rounded border border-[#D8D3C8] p-2 bg-white" />
                  <button
                    type="button"
                    onClick={() => set('logo_url', '')}
                    className="absolute -top-1.5 -right-1.5 bg-white border border-[#D8D3C8] rounded-full p-0.5 text-[#8A877F] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#D8D3C8] rounded text-sm text-[#8A877F] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Upload size={14} />
                  {uploading ? 'Uploading…' : form.logo_url ? 'Replace logo' : 'Upload logo'}
                </button>
                <p className="text-xs text-[#8A877F] mt-1.5">PNG, JPG, or SVG — recommended min. 400px wide</p>
              </div>
            </div>
          </section>

          {/* Document Style */}
          <section className="space-y-6 border-t border-[#EDE9E1] pt-8">
            <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Document Style</h2>

            {/* Colour theme picker — above templates so preview updates before you click */}
            <div>
              <label className="text-xs font-medium text-[#8A877F] block mb-3">Colour Theme</label>
              <div className="flex gap-2 flex-wrap">
                {THEME_OPTIONS.map(th => (
                  <button
                    key={th.key}
                    type="button"
                    onClick={() => set('pdf_color_theme', th.key)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${form.pdf_color_theme === th.key ? 'border-[#9A7B4F] bg-[#FAF8F5] text-[#9A7B4F] font-medium' : 'border-[#D8D3C8] bg-white text-[#2C2C2A] hover:border-[#9A7B4F]'}`}
                  >
                    <span className="flex gap-1">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: th.primary }} />
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: th.accent }} />
                    </span>
                    {th.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template picker — visual preview cards */}
            <div>
              <label className="text-xs font-medium text-[#8A877F] block mb-4">Template</label>
              <div className="flex gap-5">
                {TEMPLATE_OPTIONS.map(t => {
                  const isSelected = form.pdf_template === t.key
                  return (
                    <div key={t.key} className="flex flex-col gap-2.5">
                      {/* Card: outer div is relative anchor; selection button + enlarge button are siblings */}
                      <div className="relative group">
                        <button
                          type="button"
                          onClick={() => set('pdf_template', t.key)}
                          className={`block rounded-lg overflow-hidden cursor-pointer transition-all ${isSelected ? 'ring-2 ring-[#9A7B4F] ring-offset-2 shadow-md' : 'ring-1 ring-[#D8D3C8] hover:ring-[#9A7B4F] hover:shadow-sm'}`}
                          aria-label={`Select ${t.label} template`}
                        >
                          <TemplateFrame template={t.key} theme={currentTheme} size="card" />
                        </button>
                        {/* Enlarge button — sibling, positioned absolute so it floats over the card */}
                        <button
                          type="button"
                          onClick={() => setPreviewModal(t.key)}
                          className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/95 border border-[#D8D3C8] text-[#8A877F] hover:text-[#2C2C2A] hover:border-[#9A7B4F] rounded px-2 py-1 text-[10px] font-medium transition-all cursor-pointer opacity-0 group-hover:opacity-100 shadow-sm z-10"
                          aria-label={`Enlarge ${t.label} preview`}
                        >
                          <Maximize2 size={10} />
                          Enlarge
                        </button>
                      </div>
                      <div className="flex items-center justify-between px-0.5">
                        <span className={`text-xs font-medium ${isSelected ? 'text-[#9A7B4F]' : 'text-[#8A877F]'}`}>{t.label}</span>
                        <span className="text-[10px] text-[#C4BFB5]">{t.desc}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Custom Branded PDFs — agency only */}
          {plan === 'agency' && (
            <section className="space-y-4 border-t border-[#EDE9E1] pt-8">
              <div>
                <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Custom Branded PDFs</h2>
                <p className="text-xs text-[#8A877F] mt-1">Upload your current invoice or letterhead and we will match it on your QuotingHub PDFs.</p>
              </div>
              <label className="flex items-center gap-2 px-4 py-3 bg-[#F5F2EC] border border-dashed border-[#D8D3C8] rounded cursor-pointer hover:border-[#9A7B4F] transition-colors w-fit">
                <Upload size={14} className="text-[#8A877F]" />
                <span className="text-sm text-[#8A877F]">{uploading ? 'Uploading…' : 'Upload file (PDF or image)'}</span>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploading(true)
                    let compressed: File
                    try { compressed = await compressImage(file) } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); setUploading(false); e.target.value = ''; return }
                    const { data: { user: lhUser } } = await supabase.auth.getUser()
                    if (!lhUser) { toast.error('Not authenticated'); setUploading(false); e.target.value = ''; return }
                    const ext = compressed.name.split('.').pop()
                    const path = `studios/${lhUser.id}/letterhead.${ext}`
                    const { error: uploadError } = await supabase.storage
                      .from('branding')
                      .upload(path, compressed, { upsert: true, contentType: compressed.type })
                    if (uploadError) { toast.error('Upload failed: ' + uploadError.message) }
                    else toast.success("Letterhead uploaded — we'll be in touch to apply your branding.")
                    setUploading(false)
                    e.target.value = ''
                  }}
                />
              </label>
            </section>
          )}

          <div className="border-t border-[#EDE9E1] pt-6">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Branding'}</Button>
          </div>
        </form>
      )}

      {/* ── ACCOUNTING TAB ── */}
      {activeTab === 'accounting' && (
        <div className="space-y-8 max-w-2xl">
          {plan !== 'agency' ? (
            <div className="px-6 py-8 bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg text-center">
              <p className="text-sm font-medium text-[#2C2C2A]">Accounting integrations are available on the Agency plan.</p>
              <p className="text-xs text-[#8A877F] mt-1">Upgrade to connect Sage or Xero and push invoices directly.</p>
            </div>
          ) : (
            <>
              {!xeroConnected && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Sage Business Cloud</h2>
                      <p className="text-xs text-[#8A877F] mt-0.5">Push invoices and sync payment status directly from QuotingHub.</p>
                    </div>
                    {sageConnected && (
                      <div className="flex items-center gap-2">
                        <CheckCircle size={13} className="text-green-600" />
                        <span className="text-xs text-green-700 font-medium">Connected</span>
                      </div>
                    )}
                  </div>
                  {sageConnected ? (
                    <>
                      <div className="flex items-center justify-between bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg px-5 py-4">
                        <div>
                          <p className="text-sm font-medium text-[#2C2C2A]">Your Sage account is connected</p>
                          <p className="text-xs text-[#8A877F] mt-0.5">
                            Invoices can be pushed from any project. Payment status syncs automatically.
                            {sageCompanyId && <span className="ml-1 font-mono">Company ID: {sageCompanyId}</span>}
                          </p>
                          {!sageCompanyId && (
                            <button type="button" onClick={fetchCompanyId} disabled={fetchingCompanyId} className="mt-2 text-xs text-[#9A7B4F] hover:underline disabled:opacity-50 cursor-pointer">
                              {fetchingCompanyId ? 'Fetching…' : 'Fetch Company ID from Sage →'}
                            </button>
                          )}
                        </div>
                        <button type="button" onClick={disconnectSage} disabled={disconnecting} className="ml-6 flex-shrink-0 text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50 cursor-pointer">
                          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                      <div className="max-w-xs space-y-2">
                        <label className="text-xs font-medium text-[#8A877F] block">Sage Item (used on invoice lines)</label>
                        {displayItemId ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2 bg-[#F5F2EC] border border-[#D8D3C8] rounded text-sm text-[#2C2C2A]">
                              {displayItemLabel ? `${displayItemLabel} (ID: ${displayItemId})` : `ID: ${displayItemId}`}
                            </div>
                            <button type="button" onClick={fetchSageItems} disabled={fetchingItems} className="text-xs text-[#9A7B4F] hover:underline disabled:opacity-50 whitespace-nowrap cursor-pointer">
                              {fetchingItems ? 'Loading…' : 'Change'}
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={fetchSageItems} disabled={fetchingItems} className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#D8D3C8] rounded text-sm text-[#8A877F] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer">
                            {fetchingItems ? 'Fetching items…' : 'Select item from Sage →'}
                          </button>
                        )}
                        {showItemDropdown && sageItems.length > 0 && (
                          <div className="border border-[#D8D3C8] rounded bg-white shadow-sm max-h-48 overflow-y-auto">
                            {sageItems.map(item => (
                              <button key={item.id} type="button" onClick={() => selectItem(item)} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F2EC] text-[#2C2C2A] border-b border-[#EDE9E1] last:border-0 cursor-pointer">
                                <span className="font-medium">{item.label}</span>
                                {item.code && <span className="ml-2 text-xs text-[#8A877F]">{item.code}</span>}
                                <span className="ml-2 text-xs text-[#8A877F] font-mono">ID: {item.id}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {showItemDropdown && sageItems.length === 0 && !fetchingItems && <p className="text-xs text-[#8A877F]">No items found in Sage.</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-[#8A877F] block">Default Invoice Message</label>
                        <p className="text-xs text-[#8A877F]">Paste the message from your Sage invoice settings here — it will be included on every invoice pushed to Sage.</p>
                        <Textarea
                          value={form.sage_invoice_message}
                          onChange={e => set('sage_invoice_message', e.target.value)}
                          rows={4}
                          placeholder="e.g. Thank you for your business. Please make payment within 30 days."
                        />
                        <Button type="button" onClick={async () => {
                          const { error } = await supabase.from('settings').update({ sage_invoice_message: form.sage_invoice_message }).eq('id', settings!.id)
                          if (error) toast.error(error.message)
                          else toast.success('Invoice message saved')
                        }}>Save message</Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-[#8A877F]">Connect your Sage account to push invoices directly — no double-entry, no copy-paste.</p>
                      <div className="bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg px-5 py-4 flex flex-col gap-3 max-w-sm">
                        {!showBasicForm ? (
                          <button type="button" onClick={() => setShowBasicForm(true)} className="self-start flex items-center gap-2 px-4 py-2 bg-[#1A1A18] text-white text-xs rounded hover:bg-[#2C2C2A] transition-colors cursor-pointer">
                            <KeyRound size={12} />
                            Connect Sage
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <Input label="Sage email" type="email" value={basicEmail} onChange={e => setBasicEmail(e.target.value)} />
                            <Input label="Sage password" type="password" value={basicPassword} onChange={e => setBasicPassword(e.target.value)} />
                            <div className="flex items-center gap-2 pt-1">
                              <button type="button" onClick={connectBasic} disabled={connectingBasic || !basicEmail || !basicPassword} className="flex items-center gap-2 px-4 py-2 bg-[#1A1A18] text-white text-xs rounded hover:bg-[#2C2C2A] transition-colors disabled:opacity-50 cursor-pointer">
                                {connectingBasic ? 'Connecting…' : 'Connect'}
                              </button>
                              <button type="button" onClick={() => { setShowBasicForm(false); setBasicEmail(''); setBasicPassword('') }} className="text-xs text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {!sageConnected && (
                <section className={`space-y-4 ${!xeroConnected ? 'border-t border-[#EDE9E1] pt-8' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Xero Accounting</h2>
                      <p className="text-xs text-[#8A877F] mt-0.5">Push invoices to Xero as drafts directly from any project.</p>
                    </div>
                    {xeroConnected && (
                      <div className="flex items-center gap-2">
                        <CheckCircle size={13} className="text-green-600" />
                        <span className="text-xs text-green-700 font-medium">Connected</span>
                      </div>
                    )}
                  </div>
                  {xeroConnected ? (
                    <div className="flex items-center justify-between bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-[#2C2C2A]">{xeroTenantName ? `Connected to ${xeroTenantName}` : 'Your Xero account is connected'}</p>
                        <p className="text-xs text-[#8A877F] mt-0.5">Invoices can be pushed to Xero from any project as a draft.</p>
                      </div>
                      <button type="button" onClick={disconnectXero} disabled={disconnectingXero} className="ml-6 flex-shrink-0 text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50 cursor-pointer">
                        {disconnectingXero ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-[#8A877F]">Connect your Xero account to push invoices directly from any project — no double-entry.</p>
                      <div className="bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg px-5 py-4 flex flex-col gap-3 w-fit">
                        <div>
                          <p className="text-sm font-medium text-[#2C2C2A]">Connect via Xero</p>
                          <p className="text-xs text-[#8A877F] mt-0.5">Redirects to Xero to authorise QuotingHub.</p>
                        </div>
                        <a href="/api/xero/connect" className="self-start flex items-center gap-2 px-4 py-2 bg-[#1A1A18] text-white text-xs rounded hover:bg-[#2C2C2A] transition-colors">
                          <Zap size={12} />
                          Connect Xero
                        </a>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Template preview modal ── */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EDE9E1]">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[#2C2C2A] capitalize">{previewModal} Template</span>
                <span className="text-xs text-[#C4BFB5]">·</span>
                <span className="text-xs text-[#8A877F] capitalize">{form.pdf_color_theme} theme</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer ml-6"
              >
                <X size={16} />
              </button>
            </div>
            {/* Preview */}
            <div className="p-4">
              <div className="rounded-lg overflow-hidden border border-[#D8D3C8] shadow-inner">
                <TemplateFrame template={previewModal} theme={currentTheme} size="modal" />
              </div>
            </div>
            {/* Footer — select button */}
            {form.pdf_template !== previewModal && (
              <div className="px-5 pb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => { set('pdf_template', previewModal); setPreviewModal(null) }}
                  className="px-4 py-2 bg-[#9A7B4F] text-white text-sm rounded-lg hover:bg-[#7d6340] transition-colors cursor-pointer font-medium"
                >
                  Use {previewModal.charAt(0).toUpperCase() + previewModal.slice(1)} template
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
