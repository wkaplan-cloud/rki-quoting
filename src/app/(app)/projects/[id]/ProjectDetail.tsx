'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeLineItems, computeTotals, formatZAR } from '@/lib/quoting'
import type { Project, LineItem, ProjectStages } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { LineItemsTable } from './LineItemsTable'
import { ProjectHeader } from './ProjectHeader'
import toast from 'react-hot-toast'
import { FileText, Send, Copy, ChevronDown, RefreshCw, Upload, Mail } from 'lucide-react'

interface SageCustomer { id: string; name: string; reference?: string }
interface EmailLog { id: string; type: string; sent_to: string; sent_at: string }

interface Props {
  project: Project & { client: { client_name: string; company: string | null; email: string | null } | null }
  initialLineItems: LineItem[]
  clients: { id: string; client_name: string; company: string | null }[]
  suppliers: { id: string; supplier_name: string; markup_percentage: number; delivery_address: string | null }[]
  items: { id: string; item_name: string }[]
  officeAddress: { name: string; address: string }
  businessName: string
  vatRate: number
  initialStages: ProjectStages | null
  initialEmailLogs: EmailLog[]
  emailTemplateQuote: string | null
  emailTemplateInvoice: string | null
  sageConnected: boolean
}

export function ProjectDetail({ project: initial, initialLineItems, clients, suppliers, items, officeAddress, businessName, vatRate: initialVatRate, initialStages, initialEmailLogs, emailTemplateQuote, emailTemplateInvoice, sageConnected }: Props) {
  const [project, setProject] = useState(initial)
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems)
  const [stages, setStages] = useState<ProjectStages | null>(initialStages)
  const [designFeePct, setDesignFeePct] = useState(initial.design_fee)
  const [vatRate, setVatRate] = useState(initialVatRate)
  const [poMenuOpen, setPoMenuOpen] = useState(false)
  const poMenuRef = useRef<HTMLDivElement>(null)
  // Sage state
  const [sageModalOpen, setSageModalOpen] = useState(false)
  const [sageCustomers, setSageCustomers] = useState<SageCustomer[]>([])
  const [sageCustomerSearch, setSageCustomerSearch] = useState('')
  const [sageSelectedCustomer, setSageSelectedCustomer] = useState<SageCustomer | null>(null)
  const [sagePushing, setSagePushing] = useState(false)
  const [sageSyncing, setSageSyncing] = useState(false)
  const [sageInvoiceId, setSageInvoiceId] = useState(initial.sage_invoice_id ?? null)
  const [sageInvoiceStatus, setSageInvoiceStatus] = useState(initial.sage_invoice_status ?? null)
  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailModalType, setEmailModalType] = useState<'quote' | 'invoice'>('quote')
  const [emailInput, setEmailInput] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailBody, setEmailBody] = useState('')
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(initialEmailLogs)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (poMenuRef.current && !poMenuRef.current.contains(e.target as Node)) setPoMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const computed = computeLineItems(lineItems)
  const totals = computeTotals(lineItems, designFeePct, vatRate)

  const handleDesignFeeChange = useCallback(async (pct: number) => {
    setDesignFeePct(pct)
    await supabase.from('projects').update({ design_fee: pct }).eq('id', project.id)
  }, [project.id, supabase])

  const handleVatRateChange = useCallback(async (rate: number) => {
    setVatRate(rate)
    await supabase.from('settings').update({ vat_rate: rate })
  }, [supabase])

  const handleDuplicate = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    const { data: newProject, error } = await supabase.from('projects').insert({
      user_id: user!.id,
      org_id: orgId,
      project_number: project.project_number + '-COPY',
      project_name: project.project_name + ' (Copy)',
      client_id: project.client_id,
      date: new Date().toISOString().split('T')[0],
      status: 'Quote',
      design_fee: project.design_fee,
      notes: project.notes,
    }).select().single()
    if (error || !newProject) { toast.error('Failed to duplicate'); return }
    if (lineItems.length > 0) {
      await supabase.from('line_items').insert(
        lineItems.map(({ id: _id, project_id: _pid, ...rest }) => ({
          ...rest,
          project_id: newProject.id,
        }))
      )
    }
    toast.success('Project duplicated')
    router.push(`/projects/${newProject.id}`)
  }, [project, lineItems, supabase, router])

  const handleGeneratePDF = useCallback(async (type: 'quote' | 'invoice' | 'po' | 'production', supplierIdParam?: string) => {
    const url = type === 'po'
      ? `/api/pdf/po?projectId=${project.id}${supplierIdParam ? `&supplierId=${supplierIdParam}` : ''}`
      : `/api/pdf/${type}?projectId=${project.id}`
    const res = await fetch(url)
    if (!res.ok) { toast.error('PDF generation failed'); return }
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    if (type === 'po' && supplierIdParam) {
      const supplier = suppliers.find(s => s.id === supplierIdParam)
      a.download = `${slug(project.project_number)}_PO_${slug(supplier?.supplier_name ?? 'supplier')}.pdf`
    } else {
      const clientPart = project.client?.client_name ? `_${slug(project.client.client_name)}` : ''
      a.download = `${slug(businessName)}${clientPart}_${slug(project.project_name)}_${type}.pdf`
    }
    a.click()
  }, [project.id, project.project_number, project.project_name, project.client, businessName, suppliers])

  const resolveTemplate = useCallback((template: string | null, type: 'quote' | 'invoice') => {
    const defaults = `Dear {{client_name}},\n\nPlease find attached your ${type === 'quote' ? 'quotation' : 'invoice'} for {{project_name}}.\n\nReference: {{project_number}}\n\nKind regards,\n{{studio_name}}`
    return (template ?? defaults)
      .replace(/\{\{client_name\}\}/g, project.client?.client_name ?? 'Client')
      .replace(/\{\{project_name\}\}/g, project.project_name)
      .replace(/\{\{project_number\}\}/g, project.project_number)
      .replace(/\{\{studio_name\}\}/g, businessName)
  }, [project, businessName])

  const handleOpenEmailModal = useCallback((type: 'quote' | 'invoice') => {
    setEmailModalType(type)
    setEmailInput(project.client?.email ?? '')
    const template = type === 'quote' ? emailTemplateQuote : emailTemplateInvoice
    setEmailBody(resolveTemplate(template, type))
    setEmailModalOpen(true)
  }, [project.client, project, emailTemplateQuote, emailTemplateInvoice, resolveTemplate])

  const handleConfirmSend = useCallback(async () => {
    if (!emailInput.trim()) { toast.error('Please enter an email address'); return }
    setEmailSending(true)
    try {
      // If email changed or was missing, save it to the client record
      if (emailInput.trim() !== (project.client?.email ?? '') && project.client_id) {
        const { error } = await supabase.from('clients').update({ email: emailInput.trim() }).eq('id', project.client_id)
        if (error) { toast.error('Failed to save email'); setEmailSending(false); return }
      }
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, type: emailModalType, overrideEmail: emailInput.trim(), customBody: emailBody }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to send email')
        return
      }
      toast.success(`${emailModalType === 'quote' ? 'Quote' : 'Invoice'} sent to ${emailInput.trim()}`)
      setEmailLogs(prev => [{
        id: crypto.randomUUID(),
        type: emailModalType,
        sent_to: emailInput.trim(),
        sent_at: new Date().toISOString(),
      }, ...prev])
      setEmailModalOpen(false)
    } finally {
      setEmailSending(false)
    }
  }, [emailInput, emailModalType, project.client, project.client_id, project.id, supabase])

  const openSageModal = useCallback(async () => {
    setSageModalOpen(true)
    setSageSelectedCustomer(null)
    setSageCustomerSearch('')
    setSageCustomers([])
    try {
      const res = await fetch('/api/sage/customers')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSageCustomers(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : 'Failed to load Sage customers'))
      setSageModalOpen(false)
    }
  }, [])

  const handlePushToSage = useCallback(async () => {
    if (!sageSelectedCustomer) return
    setSagePushing(true)
    try {
      const res = await fetch('/api/sage/push-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, sageContactId: sageSelectedCustomer.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSageInvoiceId(data.sage_invoice_id)
      setSageInvoiceStatus(data.status ?? 'DRAFT')
      setSageModalOpen(false)
      toast.success('Invoice pushed to Sage')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to push to Sage')
    } finally {
      setSagePushing(false)
    }
  }, [project.id, sageSelectedCustomer])

  const handleSyncSageStatus = useCallback(async () => {
    setSageSyncing(true)
    try {
      const res = await fetch('/api/sage/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSageInvoiceStatus(data.status)
      if (data.status === 'PAID') {
        toast.success('Invoice marked as paid — stages updated')
        router.refresh()
      } else {
        toast.success(`Sage status: ${data.status}`)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to sync')
    } finally {
      setSageSyncing(false)
    }
  }, [project.id, router])

  const filteredSageCustomers = sageCustomers.filter(c =>
    c.name.toLowerCase().includes(sageCustomerSearch.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ProjectHeader
        project={project}
        clients={clients}
        stages={stages}
        onProjectUpdate={setProject}
        onStagesUpdate={setStages}
      />

      {/* Action bar */}
      <div className="flex items-center gap-2 px-8 py-3 border-b border-[#D8D3C8] bg-[#F5F2EC] flex-wrap justify-between">
        <Button size="sm" variant="secondary" onClick={() => handleGeneratePDF('production')}>
          <FileText size={13} /> Production PDF
        </Button>
        <div className="w-px h-5 bg-[#D8D3C8] mx-1" />
        <Button size="sm" variant="secondary" onClick={() => handleGeneratePDF('quote')}>
          <FileText size={13} /> Quote PDF
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleGeneratePDF('invoice')}>
          <FileText size={13} /> Invoice PDF
        </Button>
        {/* Purchase Orders dropdown */}
        {(() => {
          const poSupplierIds = [...new Set(
            lineItems.filter(i => i.row_type !== 'section' && i.supplier_id).map(i => i.supplier_id!)
          )]
          const poSuppliers = poSupplierIds.map(id => suppliers.find(s => s.id === id)).filter(Boolean) as typeof suppliers
          if (poSuppliers.length === 0) return (
            <Button size="sm" variant="secondary" disabled>
              <FileText size={13} /> Purchase Orders
            </Button>
          )
          if (poSuppliers.length === 1) return (
            <Button size="sm" variant="secondary" onClick={() => handleGeneratePDF('po', poSuppliers[0]!.id)}>
              <FileText size={13} /> PO – {poSuppliers[0]!.supplier_name}
            </Button>
          )
          return (
            <div className="relative" ref={poMenuRef}>
              <Button size="sm" variant="secondary" onClick={() => setPoMenuOpen(v => !v)}>
                <FileText size={13} /> Purchase Orders <ChevronDown size={12} />
              </Button>
              {poMenuOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[#D8D3C8] rounded shadow-lg min-w-[180px]">
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2 border-b border-[#EDE9E1] font-medium"
                    onClick={() => { handleGeneratePDF('po'); setPoMenuOpen(false) }}
                  >
                    <FileText size={12} className="text-[#9A7B4F]" /> All POs (combined)
                  </button>
                  {poSuppliers.map(s => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2"
                      onClick={() => { handleGeneratePDF('po', s.id); setPoMenuOpen(false) }}
                    >
                      <FileText size={12} className="text-[#9A7B4F]" /> {s.supplier_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
        <div className="w-px h-5 bg-[#D8D3C8] mx-1" />
        {/* Sage */}
        {sageConnected && (
          sageInvoiceId ? (
            <div className="flex items-center gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sageInvoiceStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                Sage: {sageInvoiceStatus ?? 'Pushed'}
              </span>
              <Button size="sm" variant="ghost" onClick={handleSyncSageStatus} disabled={sageSyncing}>
                <RefreshCw size={12} className={sageSyncing ? 'animate-spin' : ''} />
                {sageSyncing ? 'Syncing…' : 'Sync'}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={openSageModal}>
              <Upload size={13} /> Push to Sage
            </Button>
          )
        )}
        <div className="w-px h-5 bg-[#D8D3C8] mx-1" />
        <div className="flex-1" />
        <Button size="sm" variant="secondary" onClick={() => handleOpenEmailModal('quote')}>
          <Send size={13} /> Send Quote
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleOpenEmailModal('invoice')}>
          <Send size={13} /> Send Invoice
        </Button>
        <div className="w-px h-5 bg-[#D8D3C8] mx-1" />
        <Button size="sm" variant="ghost" onClick={handleDuplicate}>
          <Copy size={13} /> Duplicate
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 p-8 overflow-auto">
        <LineItemsTable
          projectId={project.id}
          lineItems={lineItems}
          suppliers={suppliers}
          items={items}
          officeAddress={officeAddress}
          onChange={setLineItems}
        />

        {/* Totals */}
        <div className="mt-8 flex justify-end gap-4 items-end">
          {/* Profit box */}
          <div className="bg-green-50 border border-green-200 rounded p-5 text-center">
            <p className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">Gross Profit</p>
            <p className="text-xl font-semibold text-green-700">
              {formatZAR(computed.reduce((sum, i) => sum + i.profit, 0) + totals.design_fee)}
            </p>
            <p className="text-xs text-green-500 mt-1">excl. VAT</p>
          </div>

          <div className="w-80 bg-white border border-[#D8D3C8] rounded p-5 space-y-2">
            <div className="flex justify-between text-sm text-[#8A877F]">
              <span>Subtotal</span>
              <span className="font-medium text-[#2C2C2A]">{formatZAR(totals.subtotal)}</span>
            </div>
            {/* Design fee — editable % */}
            <div className="flex justify-between text-sm text-[#8A877F] items-center">
              <span className="flex items-center gap-0.5">
                Design Fee (
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={designFeePct}
                  onChange={e => handleDesignFeeChange(parseFloat(e.target.value) || 0)}
                  className="w-8 text-center text-sm text-[#2C2C2A] border-b border-dashed border-[#D8D3C8] focus:border-[#9A7B4F] outline-none bg-transparent"
                />
                %)
              </span>
              <span className="font-medium text-[#2C2C2A]">{formatZAR(totals.design_fee)}</span>
            </div>
            {/* VAT — editable % */}
            <div className="flex justify-between text-sm text-[#8A877F] items-center">
              <span className="flex items-center gap-0.5">
                VAT (
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={vatRate}
                  onChange={e => handleVatRateChange(parseFloat(e.target.value) || 0)}
                  className="w-8 text-center text-sm text-[#2C2C2A] border-b border-dashed border-[#D8D3C8] focus:border-[#9A7B4F] outline-none bg-transparent"
                />
                %)
              </span>
              <span className="font-medium text-[#2C2C2A]">{formatZAR(totals.vat_amount)}</span>
            </div>
            <div className="border-t border-[#D8D3C8] pt-2 flex justify-between font-semibold text-[#2C2C2A]">
              <span>Total</span>
              <span>{formatZAR(totals.grand_total)}</span>
            </div>
            <div className="flex justify-between text-sm text-[#9A7B4F]">
              <span>70% Deposit</span>
              <span className="font-medium">{formatZAR(totals.deposit_70)}</span>
            </div>
            {stages?.deposit_received && (
              <div className="flex justify-between text-sm text-[#8A877F]">
                <span>30% Balance</span>
                <span className="font-medium">{formatZAR(totals.balance_due)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email log */}
      {emailLogs.length > 0 && (
        <div className="px-8 mt-6 border-t border-[#EDE9E1] pt-6">
          <h3 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Mail size={13} /> Email History
          </h3>
          <div className="space-y-1">
            {emailLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between px-4 py-2.5 bg-white border border-[#EDE9E1] rounded text-sm">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#9A7B4F]/10 text-[#9A7B4F] text-xs font-medium capitalize">
                    {log.type}
                  </span>
                  <span className="text-[#2C2C2A]">{log.sent_to}</span>
                  <span className="text-[#C4BFB5] text-xs">
                    {new Date(log.sent_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' '}
                    {new Date(log.sent_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const t = log.type as 'quote' | 'invoice'
                    setEmailModalType(t)
                    setEmailInput(log.sent_to)
                    const template = t === 'quote' ? emailTemplateQuote : emailTemplateInvoice
                    setEmailBody(resolveTemplate(template, t))
                    setEmailModalOpen(true)
                  }}
                  className="text-xs text-[#9A7B4F] hover:underline cursor-pointer"
                >
                  Resend
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email send modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEmailModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-[#1A1A18] mb-1">
              Send {emailModalType === 'quote' ? 'Quotation' : 'Invoice'}
            </h2>
            <p className="text-sm text-[#8A877F] mb-5">
              The PDF will be attached and sent to the email address below.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">
                Client Email
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="client@example.com"
                autoFocus
                className="w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white placeholder:text-[#C4BFB5] transition-colors"
              />
              {!project.client?.email && (
                <p className="text-xs text-[#9A7B4F] mt-1.5">This email will be saved to the client record.</p>
              )}
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">Message</label>
              <textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                rows={9}
                className="w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors resize-none leading-relaxed"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEmailModalOpen(false)} className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleConfirmSend}
                disabled={emailSending || !emailInput.trim()}
                className="px-5 py-2 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#2C2C2A] transition-colors disabled:opacity-50 cursor-pointer font-medium"
              >
                {emailSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sage customer selection modal */}
      {sageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSageModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[420px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#EDE9E1]">
              <h2 className="text-sm font-semibold text-[#1A1A18]">Push Invoice to Sage</h2>
              <p className="text-xs text-[#8A877F] mt-0.5">Select the Sage customer to attach this invoice to</p>
            </div>
            <div className="px-5 py-3 border-b border-[#EDE9E1]">
              <input
                type="text"
                placeholder="Search customers…"
                value={sageCustomerSearch}
                onChange={e => setSageCustomerSearch(e.target.value)}
                className="w-full text-sm border border-[#D8D3C8] rounded px-3 py-1.5 outline-none focus:border-[#9A7B4F]"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {sageCustomers.length === 0 ? (
                <p className="text-xs text-[#8A877F] text-center py-6">Loading customers…</p>
              ) : filteredSageCustomers.length === 0 ? (
                <p className="text-xs text-[#8A877F] text-center py-6">No customers match</p>
              ) : (
                filteredSageCustomers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSageSelectedCustomer(c)}
                    className={`w-full text-left px-5 py-2.5 text-sm border-b border-[#F5F2EC] hover:bg-[#F5F2EC] transition-colors ${sageSelectedCustomer?.id === c.id ? 'bg-[#F5F2EC] text-[#9A7B4F] font-medium' : 'text-[#2C2C2A]'}`}
                  >
                    {c.name}
                    {c.reference && <span className="text-xs text-[#8A877F] ml-2">{c.reference}</span>}
                  </button>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-[#EDE9E1] flex items-center justify-between">
              <button onClick={() => setSageModalOpen(false)} className="text-sm text-[#8A877F] hover:text-[#2C2C2A]">Cancel</button>
              <Button
                size="sm"
                onClick={handlePushToSage}
                disabled={!sageSelectedCustomer || sagePushing}
              >
                {sagePushing ? 'Pushing…' : `Push Invoice`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
