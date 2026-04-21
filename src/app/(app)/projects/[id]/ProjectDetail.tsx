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
import { Download, Send, Copy, ChevronDown, RefreshCw, Upload, FileText, Printer, Mail } from 'lucide-react'

interface SageCustomer { id: string; name: string; reference?: string }
interface EmailLog { id: string; type: string; sent_to: string; sent_at: string; supplier_name?: string | null }

interface Props {
  project: Project & { client: { client_name: string; company: string | null; email: string | null } | null }
  initialLineItems: LineItem[]
  clients: { id: string; client_name: string; company: string | null }[]
  suppliers: { id: string; supplier_name: string; markup_percentage: number; delivery_address: string | null; is_platform: boolean; price_list_id: string | null; email: string | null }[]
  items: { id: string; item_name: string }[]
  officeAddress: { name: string; address: string }
  businessName: string
  vatRate: number
  depositPct: number
  initialStages: ProjectStages | null
  initialEmailLogs: EmailLog[]
  emailTemplateQuote: string | null
  emailTemplateInvoice: string | null
  sageConnected: boolean
  activePriceListIds: string[]
  plan: string
}

export function ProjectDetail({ project: initial, initialLineItems, clients, suppliers: initialSuppliers, items, officeAddress, businessName, vatRate: initialVatRate, depositPct: initialDepositPct, initialStages, initialEmailLogs, emailTemplateQuote, emailTemplateInvoice, sageConnected, activePriceListIds, plan }: Props) {
  const [project, setProject] = useState(initial)
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems)
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [stages, setStages] = useState<ProjectStages | null>(initialStages)
  const [designFeePct, setDesignFeePct] = useState(initial.design_fee)
  const [vatRate, setVatRate] = useState(initialVatRate)
  const [depositPct, setDepositPct] = useState(initialDepositPct)
  const [poMenuOpen, setPoMenuOpen] = useState(false)
  const poMenuRef = useRef<HTMLDivElement>(null)
  const [sendPoMenuOpen, setSendPoMenuOpen] = useState(false)
  const sendPoMenuRef = useRef<HTMLDivElement>(null)
  const [sendPoSending, setSendPoSending] = useState(false)
  const [addEmailModal, setAddEmailModal] = useState<{ supplierId: string; supplierName: string; email: string } | null>(null)
  // Sage state
  const [sageModalOpen, setSageModalOpen] = useState(false)
  const [sageCustomers, setSageCustomers] = useState<SageCustomer[]>([])
  const [sageCustomersLoading, setSageCustomersLoading] = useState(false)
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
  const [emailHistoryOpen, setEmailHistoryOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (poMenuRef.current && !poMenuRef.current.contains(e.target as Node)) setPoMenuOpen(false)
      if (sendPoMenuRef.current && !sendPoMenuRef.current.contains(e.target as Node)) setSendPoMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Auto-sync Sage payment status on project open (silent — only toast if status changes)
  useEffect(() => {
    if (!sageConnected || !initial.sage_invoice_id || (initial.sage_invoice_status ?? '').toUpperCase() === 'PAID') return
    fetch('/api/sage/sync-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: initial.id }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.status && data.status !== initial.sage_invoice_status) {
          setSageInvoiceStatus(data.status)
          if ((data.status ?? '').toUpperCase() === 'PAID') {
            toast.success('Invoice marked as paid in Sage — project locked')
            router.refresh()
          }
        }
      })
      .catch(() => { /* silent */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const computed = computeLineItems(lineItems)
  const totals = computeTotals(lineItems, designFeePct, vatRate, depositPct)
  const isPaid = sageConnected && (sageInvoiceStatus ?? '').toUpperCase() === 'PAID'

  const handleDesignFeeChange = useCallback(async (pct: number) => {
    setDesignFeePct(pct)
    await supabase.from('projects').update({ design_fee: pct }).eq('id', project.id)
  }, [project.id, supabase])

  const handleVatRateChange = useCallback(async (rate: number) => {
    setVatRate(rate)
    await supabase.from('projects').update({ vat_rate: rate }).eq('id', project.id)
  }, [project.id, supabase])

  const handleDepositPctChange = useCallback(async (pct: number) => {
    setDepositPct(pct)
    await supabase.from('projects').update({ deposit_percentage: pct }).eq('id', project.id)
  }, [project.id, supabase])

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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'PDF generation failed')
      return
    }
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    if (type === 'po' && supplierIdParam) {
      const supplier = suppliers.find(s => s.id === supplierIdParam)
      a.download = `${slug(project.project_number)}_PO_${slug(supplier?.supplier_name ?? 'supplier')}.pdf`
    } else if (type === 'po') {
      a.download = `${slug(project.project_number)}_PO_all.pdf`
    } else {
      const clientPart = project.client?.client_name ? `${slug(project.client.client_name)}_` : ''
      a.download = `${clientPart}${slug(project.project_number)}_${type}.pdf`
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

  const handleSendPO = useCallback(async (supplierIdParam?: string) => {
    setSendPoSending(true)
    setSendPoMenuOpen(false)
    try {
      const res = await fetch('/api/email/po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, supplierId: supplierIdParam }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 207) {
        toast.error(data.error ?? 'Failed to send PO')
        return
      }
      const results: { supplierName: string; success: boolean; error?: string }[] = data.results ?? []
      const failed = results.filter(r => !r.success)
      const succeeded = results.filter(r => r.success)
      if (succeeded.length > 0) {
        toast.success(succeeded.length === 1 ? `PO sent to ${succeeded[0].supplierName}` : `POs sent to ${succeeded.length} suppliers`)
      }
      if (failed.length > 0) {
        failed.forEach(f => toast.error(`${f.supplierName}: ${f.error}`))
      }
    } catch {
      toast.error('Failed to send PO')
    } finally {
      setSendPoSending(false)
    }
  }, [project.id])

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
        supplier_name: null,
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
    setSageCustomersLoading(true)
    try {
      const res = await fetch('/api/sage/customers')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSageCustomers(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : 'Failed to load Sage customers'))
      setSageModalOpen(false)
    } finally {
      setSageCustomersLoading(false)
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
      toast.success(sageInvoiceId ? 'Invoice updated in Sage' : 'Invoice pushed to Sage')
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
        sageConnected={sageConnected}
        sageInvoicePaid={isPaid}
      />

      {/* Action bar — desktop only */}
      {(() => {
        const poSupplierIds = [...new Set(
          lineItems.filter(i => i.row_type !== 'section' && i.supplier_id).map(i => i.supplier_id!)
        )]
        const poSuppliers = poSupplierIds.map(id => suppliers.find(s => s.id === id)).filter(Boolean) as typeof suppliers

        return (
          <div className="hidden md:flex items-center gap-2 px-6 py-2.5 border-b border-[#D8D3C8] bg-[#F5F2EC]">

            {/* ── Save / Download dropdown ── */}
            <div className="relative" ref={poMenuRef}>
              <button
                onClick={() => { setPoMenuOpen(v => !v); setSendPoMenuOpen(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8D3C8] bg-white text-sm text-[#2C2C2A] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors font-medium cursor-pointer"
              >
                <Download size={13} /> Save PDF <ChevronDown size={12} className={`transition-transform ${poMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {poMenuOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[#D8D3C8] rounded-lg shadow-lg min-w-[200px] py-1">
                  <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-[#8A877F] uppercase tracking-wider">Client Documents</p>
                  <button onClick={() => { handleGeneratePDF('quote'); setPoMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                    <FileText size={13} className="text-[#9A7B4F] flex-shrink-0" /> Quote PDF
                  </button>
                  <button onClick={() => { handleGeneratePDF('invoice'); setPoMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                    <FileText size={13} className="text-[#9A7B4F] flex-shrink-0" /> Invoice PDF
                  </button>
                  <div className="border-t border-[#EDE9E1] my-1" />
                  <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-[#8A877F] uppercase tracking-wider">Purchase Orders</p>
                  {poSuppliers.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-[#C4BFB5] italic">No suppliers on line items</p>
                  ) : (
                    <>
                      {poSuppliers.length > 1 && (
                        <button onClick={() => { handleGeneratePDF('po'); setPoMenuOpen(false) }}
                          className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5 font-medium">
                          <FileText size={13} className="text-[#9A7B4F] flex-shrink-0" /> All POs (combined)
                        </button>
                      )}
                      {poSuppliers.map(s => (
                        <button key={s.id} onClick={() => { handleGeneratePDF('po', s.id); setPoMenuOpen(false) }}
                          className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                          <FileText size={13} className="text-[#9A7B4F] flex-shrink-0" /> PO – {s.supplier_name}
                        </button>
                      ))}
                    </>
                  )}
                  {plan !== 'solo' && (
                    <>
                      <div className="border-t border-[#EDE9E1] my-1" />
                      <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-[#8A877F] uppercase tracking-wider">Internal</p>
                      <button onClick={() => { handleGeneratePDF('production'); setPoMenuOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                        <Printer size={13} className="text-[#9A7B4F] flex-shrink-0" /> Production Sheet
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Send dropdown ── */}
            <div className="relative" ref={sendPoMenuRef}>
              <button
                onClick={() => { setSendPoMenuOpen(v => !v); setPoMenuOpen(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9A7B4F] text-white text-sm hover:bg-[#7d6340] transition-colors font-medium cursor-pointer"
              >
                <Send size={13} /> Send <ChevronDown size={12} className={`transition-transform ${sendPoMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {sendPoMenuOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[#D8D3C8] rounded-lg shadow-lg min-w-[210px] py-1">
                  <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-[#8A877F] uppercase tracking-wider">Email to Client</p>
                  <button onClick={() => { handleOpenEmailModal('quote'); setSendPoMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                    <Send size={13} className="text-[#9A7B4F] flex-shrink-0" /> Send Quote
                  </button>
                  <button onClick={() => { handleOpenEmailModal('invoice'); setSendPoMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                    <Send size={13} className="text-[#9A7B4F] flex-shrink-0" /> Send Invoice
                  </button>
                  {poSuppliers.length > 0 && (
                    <>
                      <div className="border-t border-[#EDE9E1] my-1" />
                      <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-[#8A877F] uppercase tracking-wider">Email to Suppliers</p>
                      {sendPoSending ? (
                        <p className="px-3 py-2 text-xs text-[#8A877F]">Sending…</p>
                      ) : (
                        <>
                          {poSuppliers.length > 1 && (
                            <button onClick={() => { handleSendPO(); setSendPoMenuOpen(false) }}
                              className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5 font-medium">
                              <Send size={13} className="text-[#9A7B4F] flex-shrink-0" /> Send All POs
                            </button>
                          )}
                          {poSuppliers.map(s => {
                            if (s.email) {
                              return (
                                <button key={s.id} onClick={() => { handleSendPO(s.id); setSendPoMenuOpen(false) }}
                                  className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                                  <Send size={13} className="text-[#9A7B4F] flex-shrink-0" /> PO – {s.supplier_name}
                                </button>
                              )
                            }
                            return (
                              <button key={s.id} onClick={() => { setSendPoMenuOpen(false); setAddEmailModal({ supplierId: s.id, supplierName: s.supplier_name, email: '' }) }}
                                className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                                <Mail size={13} className="text-[#C4BFB5] flex-shrink-0" />
                                <span>PO – {s.supplier_name} <span className="text-[10px] text-[#C4A46B] ml-1">no email</span></span>
                              </button>
                            )
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-[#D8D3C8] mx-1" />

            {/* Sage */}
            {sageConnected && (
              sageInvoiceId ? (
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    Sage: {sageInvoiceStatus ?? 'Pushed'}
                  </span>
                  {!isPaid && (
                    <button onClick={openSageModal}
                      title="Push updated line items and amounts to the existing Sage invoice"
                      className="flex items-center gap-1 px-2 py-1 text-xs text-[#8A877F] border border-[#D8D3C8] rounded hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors cursor-pointer">
                      <Upload size={11} /> Update
                    </button>
                  )}
                  {!isPaid && (
                    <button onClick={handleSyncSageStatus} disabled={sageSyncing}
                      title="Check Sage for the latest payment status on this invoice"
                      className="flex items-center gap-1 px-2 py-1 text-xs text-[#8A877F] border border-[#D8D3C8] rounded hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer">
                      <RefreshCw size={11} className={sageSyncing ? 'animate-spin' : ''} />
                      {sageSyncing ? 'Syncing…' : 'Sync'}
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={openSageModal}
                  title="Create an invoice in Sage Business Cloud Accounting from this project"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8D3C8] bg-white text-sm text-[#2C2C2A] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors cursor-pointer">
                  <Upload size={13} /> Push to Sage
                </button>
              )
            )}

            <div className="flex-1" />
            <button onClick={handleDuplicate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
              <Copy size={13} /> Duplicate
            </button>
          </div>
        )
      })()}

      {/* Mobile read-only view */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {/* Line items */}
        <div className="px-4 py-4 space-y-2">
          {lineItems.filter(i => i.row_type !== 'section').length === 0 ? (
            <p className="text-sm text-[#8A877F] text-center py-8">No items yet</p>
          ) : (
            lineItems.map(item => {
              if (item.row_type === 'section') {
                return (
                  <div key={item.id} className="pt-3 pb-1">
                    <p className="text-[10px] font-semibold text-[#5A5750] uppercase tracking-widest flex items-center gap-2">
                      <span className="w-0.5 h-3 bg-[#9A7B4F] rounded-full inline-block" />
                      {item.item_name || 'Section'}
                    </p>
                  </div>
                )
              }
              const c = computed.find(x => x.id === item.id)
              return (
                <div key={item.id} className={`bg-white border rounded-lg px-4 py-3 ${item.received ? 'border-blue-200 bg-blue-50' : 'border-[#D8D3C8]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2C2C2A] truncate">{item.item_name || '—'}</p>
                      {item.description && <p className="text-xs text-[#8A877F] mt-0.5 line-clamp-2">{item.description}</p>}
                      {item.supplier_name && <p className="text-[10px] text-[#C4A46B] mt-1 truncate">{item.supplier_name}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {item.received && (
                        <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Received</span>
                      )}
                      <p className="text-sm font-semibold text-[#2C2C2A]">{formatZAR(c?.total_price ?? 0)}</p>
                      <p className="text-[10px] text-[#8A877F]">qty {item.quantity ?? 1}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Totals summary */}
        <div className="mx-4 mb-6 bg-white border border-[#D8D3C8] rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm text-[#8A877F]">
            <span>Subtotal</span>
            <span className="font-medium text-[#2C2C2A]">{formatZAR(totals.subtotal)}</span>
          </div>
          {totals.design_fee > 0 && (
            <div className="flex justify-between text-sm text-[#8A877F]">
              <span>Design Fee ({designFeePct}%)</span>
              <span className="font-medium text-[#2C2C2A]">{formatZAR(totals.design_fee)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-[#8A877F]">
            <span>VAT ({vatRate}%)</span>
            <span className="font-medium text-[#2C2C2A]">{formatZAR(totals.vat_amount)}</span>
          </div>
          <div className="border-t border-[#D8D3C8] pt-2 flex justify-between font-semibold text-[#2C2C2A]">
            <span>Total</span>
            <span>{formatZAR(totals.grand_total)}</span>
          </div>
          <div className="flex justify-between text-sm text-[#9A7B4F]">
            <span>{depositPct}% Deposit</span>
            <span className="font-medium">{formatZAR(totals.deposit)}</span>
          </div>
        </div>
      </div>

      {/* Body — desktop only */}
      <div className="hidden md:block flex-1 p-8 overflow-auto">
        {isPaid && (
          <div className="mb-4 flex items-center gap-2.5 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <span className="text-base">🔒</span>
            <span><strong>Invoice paid in full.</strong> This project is locked — no edits can be made after payment.</span>
          </div>
        )}
        <LineItemsTable
          projectId={project.id}
          lineItems={lineItems}
          suppliers={suppliers}
          items={items}
          officeAddress={officeAddress}
          onChange={setLineItems}
          onSupplierCreated={s => setSuppliers(prev => [...prev, s])}
          activePriceListIds={activePriceListIds}
          locked={isPaid}
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
                  disabled={isPaid}
                  className="w-8 text-center text-sm text-[#2C2C2A] border-b border-dashed border-[#D8D3C8] focus:border-[#9A7B4F] outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isPaid}
                  className="w-8 text-center text-sm text-[#2C2C2A] border-b border-dashed border-[#D8D3C8] focus:border-[#9A7B4F] outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                %)
              </span>
              <span className="font-medium text-[#2C2C2A]">{formatZAR(totals.vat_amount)}</span>
            </div>
            <div className="border-t border-[#D8D3C8] pt-2 flex justify-between font-semibold text-[#2C2C2A]">
              <span>Total</span>
              <span>{formatZAR(totals.grand_total)}</span>
            </div>
            <div className="flex justify-between text-sm text-[#9A7B4F] items-center">
              <span className="flex items-center gap-0.5">
                Deposit (
                <input
                  type="number" min="0" max="100" step="1"
                  value={depositPct}
                  onChange={e => handleDepositPctChange(parseFloat(e.target.value) || 0)}
                  disabled={isPaid}
                  className="w-8 text-center text-sm text-[#9A7B4F] border-b border-dashed border-[#9A7B4F]/40 focus:border-[#9A7B4F] outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                %)
              </span>
              <span className="font-medium">{formatZAR(totals.deposit)}</span>
            </div>
            {stages?.deposit_received && (
              <div className="flex justify-between text-sm text-[#8A877F]">
                <span>{100 - depositPct}% Balance</span>
                <span className="font-medium">{formatZAR(totals.balance_due)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email log */}
      {emailLogs.length > 0 && (
        <div className="px-8 mt-6 border-t border-[#EDE9E1] pt-6">
          <button
            onClick={() => setEmailHistoryOpen(v => !v)}
            className="flex items-center gap-2 text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3 hover:text-[#2C2C2A] transition-colors cursor-pointer w-full"
          >
            <Mail size={13} /> Email History
            <span className="ml-1 bg-[#EDE9E1] text-[#8A877F] rounded-full px-1.5 py-0.5 normal-case tracking-normal font-normal">{emailLogs.length}</span>
            <ChevronDown size={12} className={`ml-auto transition-transform ${emailHistoryOpen ? 'rotate-180' : ''}`} />
          </button>
          {emailHistoryOpen && (
          <div className="space-y-1">
            {emailLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between px-4 py-2.5 bg-white border border-[#EDE9E1] rounded text-sm">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                    log.type === 'po' ? 'bg-blue-50 text-blue-600' :
                    log.type === 'invoice' ? 'bg-amber-50 text-amber-600' :
                    'bg-[#9A7B4F]/10 text-[#9A7B4F]'
                  }`}>
                    {log.type === 'po' ? 'Purchase Order' : log.type}
                  </span>
                  <span className="text-[#2C2C2A]">
                    {log.type === 'po' && log.supplier_name ? log.supplier_name : log.sent_to}
                  </span>
                  {log.type === 'po' && log.sent_to && (
                    <span className="text-[#C4BFB5] text-xs">{log.sent_to}</span>
                  )}
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
          )}
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

      {/* Add supplier email modal */}
      {addEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAddEmailModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#2C2C2A] mb-1">Add email for {addEmailModal.supplierName}</h3>
            <p className="text-xs text-[#8A877F] mb-4">This email will be saved to the supplier and used to send the PO.</p>
            <input
              type="email"
              autoFocus
              placeholder="supplier@example.com"
              value={addEmailModal.email}
              onChange={e => setAddEmailModal(prev => prev ? { ...prev, email: e.target.value } : null)}
              onKeyDown={async e => {
                if (e.key === 'Enter' && addEmailModal.email) {
                  const { supplierId, email } = addEmailModal
                  setAddEmailModal(null)
                  await fetch(`/api/suppliers/${supplierId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
                  setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, email } : s))
                  handleSendPO(supplierId)
                }
              }}
              className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg focus:outline-none focus:border-[#9A7B4F] mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAddEmailModal(null)}
                className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors">
                Cancel
              </button>
              <button
                disabled={!addEmailModal.email}
                onClick={async () => {
                  const { supplierId, email } = addEmailModal
                  setAddEmailModal(null)
                  await fetch(`/api/suppliers/${supplierId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
                  setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, email } : s))
                  handleSendPO(supplierId)
                }}
                className="px-4 py-2 text-sm bg-[#9A7B4F] text-white rounded-lg hover:bg-[#7d6340] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium">
                Save &amp; Send PO
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
              {sageCustomersLoading ? (
                <p className="text-xs text-[#8A877F] text-center py-6">Loading customers…</p>
              ) : sageCustomers.length === 0 ? (
                <p className="text-xs text-[#8A877F] text-center py-6">No customers found in Sage — add one in your Sage account first</p>
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
