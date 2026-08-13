'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { todaySA } from '@/lib/dates'
const NO_SPINNER = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getNextProjectNumber } from '@/lib/projectNumber'
import { computeLineItems, computeTotals, formatZAR } from '@/lib/quoting'
import type { Project, LineItem, ProjectStages } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { LineItemsTable } from './LineItemsTable'
import { ProjectHeader } from './ProjectHeader'
import toast from 'react-hot-toast'
import { Download, Send, Copy, ChevronDown, RefreshCw, Upload, FileText, Printer, Mail, ThumbsUp, ThumbsDown } from 'lucide-react'
import confetti from 'canvas-confetti'

interface SageCustomer { id: string; name: string; reference?: string }
interface SageInvoice { id: string; reference: string; customerName: string; total: number; status: string; date: string }
interface EmailLog { id: string; type: string; sent_to: string; sent_at: string; supplier_name?: string | null }
interface ApprovalLog { id: string; decision: 'approved' | 'declined'; comment: string | null; client_name: string | null; submitted_at: string }

interface Props {
  project: Project & { client: { client_name: string; company: string | null; email: string | null } | null }
  initialLineItems: LineItem[]
  clients: { id: string; client_name: string; company: string | null }[]
  suppliers: { id: string; supplier_name: string; markup_percentage: number; delivery_address: string | null; delivery_contact_name: string | null; delivery_contact_number: string | null; is_platform: boolean; price_list_id: string | null; email: string | null }[]
  items: { id: string; item_name: string }[]
  officeAddress: { name: string; address: string }
  businessName: string
  vatRate: number
  depositPct: number
  initialStages: ProjectStages | null
  initialEmailLogs: EmailLog[]
  initialApprovalLogs: ApprovalLog[]
  quoteApproval: { decision: string | null; comment: string | null; submitted_at: string | null; client_name: string | null } | null
  emailTemplateQuote: string | null
  emailTemplateInvoice: string | null
  productionSheetEmail: string | null
  sageConnected: boolean
  xeroConnected: boolean
  activePriceListIds: string[]
  plan: string
  members: { user_id: string; label: string }[]
  isAdmin: boolean
  createdByName: string | null
}

export function ProjectDetail({ project: initial, initialLineItems, clients, suppliers: initialSuppliers, items, officeAddress, businessName, vatRate: initialVatRate, depositPct: initialDepositPct, initialStages, initialEmailLogs, initialApprovalLogs, quoteApproval, emailTemplateQuote, emailTemplateInvoice, productionSheetEmail: initialProductionSheetEmail, sageConnected, xeroConnected, activePriceListIds, plan, members, isAdmin, createdByName }: Props) {
  const [project, setProject] = useState(initial)
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems)
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [stages, setStages] = useState<ProjectStages | null>(initialStages)
  const [declineBannerDismissed, setDeclineBannerDismissed] = useState(false)
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
  const [sageModalTab, setSageModalTab] = useState<'push' | 'link'>('push')
  const [sageCustomers, setSageCustomers] = useState<SageCustomer[]>([])
  const [sageCustomersLoading, setSageCustomersLoading] = useState(false)
  const [sageCustomerSearch, setSageCustomerSearch] = useState('')
  const [sageSelectedCustomer, setSageSelectedCustomer] = useState<SageCustomer | null>(null)
  const [sageInvoices, setSageInvoices] = useState<SageInvoice[]>([])
  const [sageInvoicesLoading, setSageInvoicesLoading] = useState(false)
  const [sageInvoiceSearch, setSageInvoiceSearch] = useState('')
  const [sageSelectedInvoice, setSageSelectedInvoice] = useState<SageInvoice | null>(null)
  const [sageLinking, setSageLinking] = useState(false)
  const [sagePushing, setSagePushing] = useState(false)
  const [sageSyncing, setSageSyncing] = useState(false)
  const [sageUnlinking, setSageUnlinking] = useState(false)
  const [sageInvoiceId, setSageInvoiceId] = useState(initial.sage_invoice_id ?? null)
  const [sageInvoiceStatus, setSageInvoiceStatus] = useState(initial.sage_invoice_status ?? null)
  const [sageLinkedCustomer, setSageLinkedCustomer] = useState<SageCustomer | null>(
    initial.sage_customer_id ? { id: initial.sage_customer_id, name: initial.sage_customer_name ?? '' } : null
  )
  const [depositAmountReceived, setDepositAmountReceived] = useState<number | null>(initial.deposit_amount_received ?? null)
  const [depositDraft, setDepositDraft] = useState(initial.deposit_amount_received != null ? String(initial.deposit_amount_received) : '')
  const [invoiceDepositModalOpen, setInvoiceDepositModalOpen] = useState(false)
  // Xero state
  const [pushingXero, setPushingXero] = useState(false)
  const [xeroInvoiceId, setXeroInvoiceId] = useState((initial as unknown as Record<string, unknown>).xero_invoice_id as string | null ?? null)
  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailModalType, setEmailModalType] = useState<'quote' | 'invoice'>('quote')
  const [emailInput, setEmailInput] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailBody, setEmailBody] = useState('')
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(initialEmailLogs)
  const [approvalLogs] = useState<ApprovalLog[]>(initialApprovalLogs)
  const [emailHistoryOpen, setEmailHistoryOpen] = useState(false)
  // Production sheet email modal state
  const [prodSheetModalOpen, setProdSheetModalOpen] = useState(false)
  const [prodSheetEmailInput, setProdSheetEmailInput] = useState('')
  const [prodSheetSending, setProdSheetSending] = useState(false)
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

  // Keep the editable deposit field in step with the saved amount (Sage sync can change it)
  useEffect(() => {
    setDepositDraft(depositAmountReceived != null ? String(depositAmountReceived) : '')
  }, [depositAmountReceived])

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
        if (data.deposit_amount_received != null) {
          setDepositAmountReceived(data.deposit_amount_received)
        }
        if (data.deposit_received_auto) {
          const now = new Date().toISOString()
          setStages(prev => prev ? {
            ...prev,
            deposit_received: true,
            deposit_received_at: prev.deposit_received_at ?? now,
            ...(!prev.client_approved ? { client_approved: true, client_approved_at: now } : {}),
          } : prev)
          toast.success('Deposit detected in Sage — stage updated')
        }
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
  // Live preview of what an invoice would print while the deposit field is being edited
  const depositPreview = Math.min(Math.max(parseFloat(depositDraft) || 0, 0), totals.grand_total)
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

  // The deposit actually paid, in rands, is what invoices print. When a Sage invoice is linked
  // Sage owns that figure (written on sync); otherwise the designer enters it by hand here.
  const depositManual = !sageInvoiceId

  const handleDepositReceivedSave = useCallback(async (raw: string) => {
    const parsed = parseFloat(raw)
    const amount = raw.trim() === '' || isNaN(parsed) || parsed <= 0 ? null : Math.round(parsed * 100) / 100
    if (amount === depositAmountReceived) return

    const prevAmount = depositAmountReceived
    setDepositAmountReceived(amount)

    const { error } = await supabase.from('projects').update({ deposit_amount_received: amount }).eq('id', project.id)
    if (error) {
      setDepositAmountReceived(prevAmount)
      toast.error('Failed to save deposit amount')
      return
    }

    // Keep the Deposit Received stage in step with the amount
    const shouldTick = amount != null
    if (shouldTick !== !!stages?.deposit_received) {
      const now = new Date().toISOString()
      const update: Record<string, boolean | string | null> = shouldTick
        ? { deposit_received: true, deposit_received_at: now }
        : { deposit_received: false, deposit_received_at: null }
      // Ticking deposit_received ON also auto-ticks client_approved, same as the stage checkbox
      if (shouldTick && !stages?.client_approved) {
        update.client_approved = true
        update.client_approved_at = now
      }
      const res = await fetch('/api/stages/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, update }),
      })
      const result = await res.json().catch(() => ({}))
      if (res.ok) {
        setStages(prev => prev ? { ...prev, ...update } as unknown as ProjectStages : (result.stages ?? prev))
        if (result.newStatus && project.status !== 'Cancelled') {
          setProject(p => ({ ...p, status: result.newStatus }))
        }
      }
    }

    toast.success(amount != null ? `Deposit of ${formatZAR(amount)} recorded` : 'Deposit amount cleared')
  }, [depositAmountReceived, stages, project.id, project.status, supabase])

  const handleDuplicate = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    const nextNumber = await getNextProjectNumber(supabase)
    const { data: newProject, error } = await supabase.from('projects').insert({
      user_id: user!.id,
      org_id: orgId,
      project_number: nextNumber ?? project.project_number + '-COPY',
      project_name: project.project_name + ' (Copy)',
      client_id: project.client_id,
      date: todaySA(),
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

  const handleGeneratePDF = useCallback(async (type: 'quote' | 'invoice' | 'po' | 'production' | 'installation', supplierIdParam?: string, print = false) => {
    if ((type === 'quote' || type === 'invoice') && !project.client?.client_name) {
      toast.error('Please add a client to this project before generating a document.')
      return
    }
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
    if (print) {
      window.open(objectUrl, '_blank')
      return
    }
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

  // Invoices ask for the deposit paid first — unless Sage owns the figure, or the job is already settled
  const handleStartInvoicePDF = useCallback(() => {
    if (!depositManual || isPaid) { handleGeneratePDF('invoice'); return }
    if (!project.client?.client_name) {
      toast.error('Please add a client to this project before generating a document.')
      return
    }
    setInvoiceDepositModalOpen(true)
  }, [depositManual, isPaid, handleGeneratePDF, project.client])

  const handleConfirmInvoicePDF = useCallback(async () => {
    await handleDepositReceivedSave(depositDraft)
    setInvoiceDepositModalOpen(false)
    await handleGeneratePDF('invoice')
  }, [depositDraft, handleDepositReceivedSave, handleGeneratePDF])

  const resolveTemplate = useCallback((template: string | null, type: 'quote' | 'invoice') => {
    const defaults = `Dear {{client_name}},\n\nPlease find attached your ${type === 'quote' ? 'quotation' : 'invoice'} for {{project_name}}.\n\nKind regards,\n{{studio_name}}`
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
    if (!project.client?.client_name) {
      toast.error('Please add a client to this project before sending a document.')
      return
    }
    setEmailModalType(type)
    setEmailInput(project.client?.email ?? '')
    setDepositDraft(depositAmountReceived != null ? String(depositAmountReceived) : '')
    const template = type === 'quote' ? emailTemplateQuote : emailTemplateInvoice
    setEmailBody(resolveTemplate(template, type))
    setEmailModalOpen(true)
  }, [project.client, project, emailTemplateQuote, emailTemplateInvoice, resolveTemplate, depositAmountReceived])

  // Closing without sending must not leave an unsaved deposit sitting in the totals panel
  const handleCloseEmailModal = useCallback(() => {
    setDepositDraft(depositAmountReceived != null ? String(depositAmountReceived) : '')
    setEmailModalOpen(false)
  }, [depositAmountReceived])

  const handleConfirmSend = useCallback(async () => {
    if (!emailInput.trim()) { toast.error('Please enter an email address'); return }
    setEmailSending(true)
    try {
      // If email changed or was missing, save it to the client record
      if (emailInput.trim() !== (project.client?.email ?? '') && project.client_id) {
        const { error } = await supabase.from('clients').update({ email: emailInput.trim() }).eq('id', project.client_id)
        if (error) { toast.error('Failed to save email'); setEmailSending(false); return }
      }
      // The PDF is built server-side from the project row, so persist the deposit before sending
      if (emailModalType === 'invoice' && depositManual && !isPaid) {
        await handleDepositReceivedSave(depositDraft)
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
      if (emailModalType === 'quote') {
        const now = new Date().toISOString()
        setStages(prev => prev ? { ...prev, quote_sent: true, quote_sent_at: prev.quote_sent_at ?? now } : prev)
        setProject(prev => prev.status === 'Draft' ? { ...prev, status: 'Quote' } : prev)
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.65 }, colors: ['#9A7B4F', '#C4A46B', '#EDE9E1', '#ffffff'] })
      }
      setEmailModalOpen(false)
    } finally {
      setEmailSending(false)
    }
  }, [emailInput, emailModalType, emailBody, project.client, project.client_id, project.id, supabase, depositManual, isPaid, depositDraft, handleDepositReceivedSave])

  const handleOpenProdSheetModal = useCallback(() => {
    setProdSheetEmailInput(initialProductionSheetEmail ?? '')
    setProdSheetModalOpen(true)
  }, [initialProductionSheetEmail])

  const handleSendProdSheet = useCallback(async () => {
    if (!prodSheetEmailInput.trim()) { toast.error('Please enter an email address'); return }
    setProdSheetSending(true)
    try {
      // Save updated email to studio settings if it changed
      if (prodSheetEmailInput.trim() !== (initialProductionSheetEmail ?? '')) {
        const { data: settingsRow } = await supabase.from('settings').select('id').maybeSingle()
        if (settingsRow?.id) {
          await supabase.from('settings').update({ production_sheet_email: prodSheetEmailInput.trim() }).eq('id', settingsRow.id)
        }
      }
      const res = await fetch('/api/email/production-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, toEmail: prodSheetEmailInput.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to send job cost sheet')
        return
      }
      toast.success(`Production sheet sent to ${prodSheetEmailInput.trim()}`)
      setProdSheetModalOpen(false)
    } finally {
      setProdSheetSending(false)
    }
  }, [prodSheetEmailInput, initialProductionSheetEmail, project.id, supabase])

  const openSageModal = useCallback(() => {
    setSageModalOpen(true)
    setSageModalTab('push')
    setSageSelectedInvoice(null)
    setSageInvoiceSearch('')
    setSageInvoices([])

    if (sageLinkedCustomer) {
      setSageSelectedCustomer(sageLinkedCustomer)
      setSageCustomerSearch(sageLinkedCustomer.name)
      setSageCustomers([sageLinkedCustomer])
    } else {
      setSageSelectedCustomer(null)
      setSageCustomerSearch('')
      setSageCustomers([])
    }
  }, [sageLinkedCustomer])

  // Debounced customer search — fires 350ms after the user stops typing (2+ chars)
  useEffect(() => {
    const q = sageCustomerSearch.trim()
    if (q.length < 2) {
      setSageCustomers([])
      return
    }
    const timer = setTimeout(async () => {
      setSageCustomersLoading(true)
      try {
        const res = await fetch(`/api/sage/customers?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setSageCustomers(Array.isArray(data) ? data : [])
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to search Sage customers')
      } finally {
        setSageCustomersLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [sageCustomerSearch])

  const loadSageInvoices = useCallback(async () => {
    setSageInvoicesLoading(true)
    try {
      const res = await fetch('/api/sage/invoices')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSageInvoices(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load Sage invoices')
    } finally {
      setSageInvoicesLoading(false)
    }
  }, [])

  const handleLinkSageInvoice = useCallback(async () => {
    if (!sageSelectedInvoice) return
    setSageLinking(true)
    try {
      const res = await fetch('/api/sage/link-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, sageInvoiceId: sageSelectedInvoice.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSageInvoiceId(sageSelectedInvoice.id)
      setSageInvoiceStatus(data.status)
      setSageModalOpen(false)
      if (data.deposit_received_auto) {
        const now = new Date().toISOString()
        setStages(prev => prev ? {
          ...prev,
          deposit_received: true,
          deposit_received_at: prev.deposit_received_at ?? now,
          ...(!prev.client_approved ? { client_approved: true, client_approved_at: now } : {}),
        } : prev)
        toast.success('Invoice linked — deposit payment detected and stage updated')
      } else {
        toast.success('Invoice linked — status synced from Sage')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to link invoice')
    } finally {
      setSageLinking(false)
    }
  }, [project.id, sageSelectedInvoice])

  const handlePushToSage = useCallback(async () => {
    if (!sageSelectedCustomer) return
    setSagePushing(true)
    try {
      const res = await fetch('/api/sage/push-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, sageContactId: sageSelectedCustomer.id, sageCustomerName: sageSelectedCustomer.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSageInvoiceId(data.sage_invoice_id)
      setSageInvoiceStatus(data.status ?? 'DRAFT')
      setSageLinkedCustomer(sageSelectedCustomer)
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
      if (data.deposit_amount_received != null) {
        setDepositAmountReceived(data.deposit_amount_received)
      }
      if (data.deposit_received_auto) {
        const now = new Date().toISOString()
        setStages(prev => prev ? {
          ...prev,
          deposit_received: true,
          deposit_received_at: prev.deposit_received_at ?? now,
          ...(!prev.client_approved ? { client_approved: true, client_approved_at: now } : {}),
        } : prev)
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.65 }, colors: ['#9A7B4F', '#C4A46B', '#EDE9E1', '#ffffff'] })
        toast.success('Deposit detected in Sage — stage updated')
      } else if ((data.status ?? '').toUpperCase() === 'PAID') {
        toast.success('Invoice marked as paid — stages updated')
        router.refresh()
      } else {
        // Ensure local stages reflect deposit_received if Sage already shows partial/full payment
        const isPartial = /partial/i.test(data.status ?? '')
        if (isPartial) {
          const now = new Date().toISOString()
          setStages(prev => prev ? {
            ...prev,
            deposit_received: true,
            deposit_received_at: prev.deposit_received_at ?? now,
            ...(!prev.client_approved ? { client_approved: true, client_approved_at: now } : {}),
          } : prev)
        }
        toast.success(`Sage status: ${data.status}`)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to sync')
    } finally {
      setSageSyncing(false)
    }
  }, [project.id, router])

  const handleUnlinkSageInvoice = useCallback(async () => {
    if (!window.confirm('Unlink the Sage invoice and unlock this project for editing? The invoice in Sage will not be deleted.')) return
    setSageUnlinking(true)
    try {
      const res = await fetch('/api/sage/unlink-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSageInvoiceId(null)
      setSageInvoiceStatus(null)
      setStages(prev => prev ? { ...prev, final_invoice_paid: false, final_invoice_paid_at: null } : prev)
      toast.success('Sage invoice unlinked — project unlocked')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to unlink')
    } finally {
      setSageUnlinking(false)
    }
  }, [project.id, router])

  const handlePushToXero = useCallback(async () => {
    setPushingXero(true)
    try {
      const res = await fetch('/api/xero/push-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to push to Xero'); return }
      setXeroInvoiceId(data.xero_invoice_id)
      toast.success(
        <span>
          Pushed to Xero —{' '}
          <a href={data.xero_url} target="_blank" rel="noopener noreferrer" className="underline">
            View invoice ↗
          </a>
        </span>
      )
    } catch {
      toast.error('Failed to push to Xero')
    } finally {
      setPushingXero(false)
    }
  }, [project.id])

  const filteredSageInvoices = sageInvoices.filter(inv =>
    inv.reference.toLowerCase().includes(sageInvoiceSearch.toLowerCase()) ||
    inv.customerName.toLowerCase().includes(sageInvoiceSearch.toLowerCase())
  )

  // Results are already filtered server-side; alias for use in JSX
  const filteredSageCustomers = sageCustomers

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
        xeroConnected={xeroConnected}
        members={members}
        isAdmin={isAdmin}
        createdByName={createdByName}
      />

      {/* Client approved — show comment if they left one */}
      {quoteApproval?.decision === 'approved' && quoteApproval.comment && (
        <div className="mx-4 mt-3 flex items-start gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
          <span className="text-lg leading-none mt-0.5">✓</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#166534' }}>
              {quoteApproval.client_name ? `${quoteApproval.client_name}'s note` : 'Client note'}
            </p>
            <p className="text-sm mt-0.5 leading-relaxed" style={{ color: '#15803D' }}>{quoteApproval.comment}</p>
          </div>
        </div>
      )}

      {/* Client declined banner */}
      {quoteApproval?.decision === 'declined' && !declineBannerDismissed && (
        <div className="mx-4 mt-3 flex items-start gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
          <span className="text-lg leading-none mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#92400E' }}>
              {quoteApproval.client_name ? `${quoteApproval.client_name} declined` : 'Client declined'} the quote
            </p>
            {quoteApproval.comment && (
              <p className="text-sm mt-0.5 leading-relaxed" style={{ color: '#B45309' }}>{quoteApproval.comment}</p>
            )}
          </div>
          <button
            onClick={() => setDeclineBannerDismissed(true)}
            className="text-xs shrink-0 mt-0.5 hover:opacity-70 transition-opacity"
            style={{ color: '#B45309' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action bar — desktop only */}
      {(() => {
        const poSupplierIds = [...new Set(
          lineItems.filter(i => i.row_type !== 'section' && i.supplier_id).map(i => i.supplier_id!)
        )]
        const poSuppliers = poSupplierIds.map(id => suppliers.find(s => s.id === id)).filter(Boolean) as typeof suppliers

        return (
          <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-2.5 border-b border-[#D8D3C8] bg-[#F5F2EC]">

            {/* ── Save / Download dropdown ── */}
            <div className="relative" ref={poMenuRef}>
              <button
                onClick={() => { setPoMenuOpen(v => !v); setSendPoMenuOpen(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8D3C8] bg-white text-sm text-[#2C2C2A] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors font-medium cursor-pointer"
              >
                <Download size={13} /> Download <ChevronDown size={12} className={`transition-transform ${poMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {poMenuOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[#D8D3C8] rounded-lg shadow-lg min-w-[200px] py-1">
                  <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-[#8A877F] uppercase tracking-wider">Client Documents</p>
                  <button onClick={() => { handleGeneratePDF('quote'); setPoMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                    <FileText size={13} className="text-[#9A7B4F] flex-shrink-0" /> Quote PDF
                  </button>
                  <button onClick={() => { handleStartInvoicePDF(); setPoMenuOpen(false) }}
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
                  <div className="border-t border-[#EDE9E1] my-1" />
                  <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-[#8A877F] uppercase tracking-wider">Internal</p>
                  {plan !== 'solo' ? (
                    <>
                      <button onClick={() => { handleGeneratePDF('production'); setPoMenuOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                        <Printer size={13} className="text-[#9A7B4F] flex-shrink-0" /> Job Cost Sheet
                      </button>
                      <button onClick={() => { handleGeneratePDF('installation'); setPoMenuOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                        <Printer size={13} className="text-[#9A7B4F] flex-shrink-0" /> Installation Sheet
                      </button>
                      <button onClick={() => { handleOpenProdSheetModal(); setPoMenuOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-[#2C2C2A] hover:bg-[#F5F2EC] flex items-center gap-2.5">
                        <Mail size={13} className="text-[#9A7B4F] flex-shrink-0" /> Email Job Cost Sheet
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2 flex items-center gap-2.5 opacity-40 cursor-default select-none">
                        <Printer size={13} className="flex-shrink-0" /> Job Cost Sheet
                        <span className="ml-auto text-[10px] text-[#9A7B4F] font-medium">Studio</span>
                      </div>
                      <div className="px-3 py-2 flex items-center gap-2.5 opacity-40 cursor-default select-none">
                        <Printer size={13} className="flex-shrink-0" /> Installation Sheet
                        <span className="ml-auto text-[10px] text-[#9A7B4F] font-medium">Studio</span>
                      </div>
                    </>
                  )}
                  {plan !== 'agency' && (
                    <div className="px-3 py-2 flex items-center gap-2.5 opacity-40 cursor-default select-none">
                      <FileText size={13} className="flex-shrink-0" /> Custom Branded PDFs
                      <span className="ml-auto text-[10px] text-[#9A7B4F] font-medium">Agency</span>
                    </div>
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
                <Send size={13} /> Email <ChevronDown size={12} className={`transition-transform ${sendPoMenuOpen ? 'rotate-180' : ''}`} />
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

            {/* Xero */}
            {xeroConnected && (
              xeroInvoiceId ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">Xero: Pushed</span>
                  <a href={`https://go.xero.com/AccountsReceivable/View.aspx?invoiceID=${xeroInvoiceId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 text-xs text-[#8A877F] border border-[#D8D3C8] rounded hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors">
                    View ↗
                  </a>
                </div>
              ) : (
                <button onClick={handlePushToXero} disabled={pushingXero}
                  title="Create an invoice in Xero from this project"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8D3C8] bg-white text-sm text-[#2C2C2A] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer">
                  <Upload size={13} /> {pushingXero ? 'Pushing…' : 'Push to Xero'}
                </button>
              )
            )}

            {/* Sage */}
            {sageInvoiceId ? (
              <div className="flex items-center gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  Sage: {sageInvoiceStatus ?? 'Pushed'}
                </span>
                {sageConnected && !isPaid && (
                  <button onClick={handleSyncSageStatus} disabled={sageSyncing}
                    title="Checks Sage for the latest payment status — use this after the accountant records a deposit or payment in Sage"
                    className="flex items-center gap-1 px-2 py-1 text-xs text-[#8A877F] border border-[#D8D3C8] rounded hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer">
                    <RefreshCw size={11} className={sageSyncing ? 'animate-spin' : ''} />
                    {sageSyncing ? 'Syncing…' : 'Sync'}
                  </button>
                )}
                {sageConnected && !isPaid && !stages?.deposit_received && (
                  <button onClick={openSageModal}
                    title="Overwrites the Sage invoice line items with the current QuotingHub figures — use this if the quote changed after the invoice was pushed"
                    className="flex items-center gap-1 px-2 py-1 text-xs text-[#8A877F] border border-[#D8D3C8] rounded hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors cursor-pointer">
                    <Upload size={11} /> Update Lines
                  </button>
                )}
                {isAdmin && isPaid && (
                  <button onClick={handleUnlinkSageInvoice} disabled={sageUnlinking}
                    title="Admin: unlink this Sage invoice and unlock the project for editing (use when an invoice was voided/cancelled in Sage)"
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-50 cursor-pointer">
                    {sageUnlinking ? 'Unlinking…' : 'Unlink'}
                  </button>
                )}
              </div>
            ) : (sageConnected && stages?.quote_sent) ? (
              <button onClick={openSageModal}
                title="Create an invoice in Sage Business Cloud Accounting from this project"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8D3C8] bg-white text-sm text-[#2C2C2A] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors cursor-pointer">
                <Upload size={13} /> Push to Sage
              </button>
            ) : null}

            <div className="flex-1" />
            <button onClick={() => handleGeneratePDF('quote', undefined, true)}
              title="Print quote"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
              <Printer size={16} />
            </button>
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
                <div key={item.id} className={`bg-white border rounded-lg px-4 py-3 ${item.highlight_color === 'blue' ? 'border-blue-200 bg-blue-50' : item.highlight_color === 'green' ? 'border-green-200 bg-green-50' : 'border-[#D8D3C8]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2C2C2A] truncate">{item.item_name || '—'}</p>
                      {item.description && <p className="text-xs text-[#8A877F] mt-0.5 line-clamp-2">{item.description}</p>}
                      {item.supplier_name && <p className="text-[10px] text-[#C4A46B] mt-1 truncate">{item.supplier_name}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {item.highlight_color === 'blue' && (
                        <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Received</span>
                      )}
                      {item.highlight_color === 'green' && (
                        <span className="text-[10px] font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded">Received</span>
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
          {depositAmountReceived != null && (
            <>
              <div className="flex justify-between text-sm text-green-700">
                <span>Deposit Received</span>
                <span className="font-medium">{formatZAR(depositAmountReceived)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-[#2C2C2A]">
                <span>Amount Due</span>
                <span>{formatZAR(Math.max(0, totals.grand_total - depositAmountReceived))}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body — desktop only */}
      <div className="hidden md:block flex-1 p-8 overflow-auto">
        {isPaid && (
          <div className="mb-4 flex items-center gap-2.5 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <span className="text-base">🔒</span>
            <span><strong>Invoice paid in full.</strong> This project is locked — no edits can be made after payment.{isAdmin && ' Use the Unlink button above to unlock if this invoice was voided or cancelled in Sage.'}</span>
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
          depositReceived={stages?.deposit_received ?? false}
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
                  className={`w-8 text-center text-sm text-[#2C2C2A] border-b border-dashed border-[#D8D3C8] focus:border-[#9A7B4F] outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed ${NO_SPINNER}`}
                />
                %)
              </span>
              <span className="font-medium text-[#2C2C2A]">{formatZAR(totals.design_fee)}</span>
            </div>
            {/* VAT — admin-only editable % */}
            <div className="flex justify-between text-sm text-[#8A877F] items-center">
              <span className="flex items-center gap-0.5">
                VAT (
                {isAdmin && !isPaid ? (
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={vatRate}
                    onChange={e => handleVatRateChange(parseFloat(e.target.value) || 0)}
                    className={`w-8 text-center text-sm text-[#2C2C2A] border-b border-dashed border-[#D8D3C8] focus:border-[#9A7B4F] outline-none bg-transparent ${NO_SPINNER}`}
                  />
                ) : (
                  <span className="text-sm text-[#2C2C2A]">{vatRate}</span>
                )}
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
                  className={`w-8 text-center text-sm text-[#9A7B4F] border-b border-dashed border-[#9A7B4F]/40 focus:border-[#9A7B4F] outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed ${NO_SPINNER}`}
                />
                %)
              </span>
              <span className="font-medium">{formatZAR(totals.deposit)}</span>
            </div>
            {/* Deposit actually received — this is what the invoice PDF prints */}
            {depositManual ? (
              <div className="flex justify-between text-sm text-green-700 items-center">
                <label htmlFor="deposit-received-amount" className="cursor-text">Deposit Received (R)</label>
                <input
                  id="deposit-received-amount"
                  type="number" min="0" step="0.01"
                  value={depositDraft}
                  onChange={e => setDepositDraft(e.target.value)}
                  onBlur={e => handleDepositReceivedSave(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  disabled={isPaid}
                  aria-label="Deposit received in rands"
                  className={`w-24 text-right text-sm text-green-700 font-medium border-b border-dashed border-green-700/40 focus:border-green-700 outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed ${NO_SPINNER}`}
                />
              </div>
            ) : depositAmountReceived != null ? (
              <div className="flex justify-between text-sm text-green-700">
                <span>Deposit Received</span>
                <span className="font-medium">{formatZAR(depositAmountReceived)}</span>
              </div>
            ) : null}
            {depositAmountReceived != null ? (
              <div className="flex justify-between text-sm font-semibold text-[#2C2C2A]">
                <span>Amount Due</span>
                <span>{formatZAR(Math.max(0, totals.grand_total - depositAmountReceived))}</span>
              </div>
            ) : stages?.deposit_received ? (
              <div className="flex justify-between text-sm text-[#8A877F]">
                <span>{100 - depositPct}% Balance</span>
                <span className="font-medium">{formatZAR(totals.balance_due)}</span>
              </div>
            ) : null}
            {!depositManual && (
              <p className="text-[11px] text-[#8A877F]">Deposit amount is synced from Sage.</p>
            )}
          </div>
        </div>
      </div>

      {/* Email + approval history */}
      {(emailLogs.length > 0 || approvalLogs.length > 0) && (() => {
        type MergedEntry =
          | { kind: 'email'; log: EmailLog }
          | { kind: 'approval'; log: ApprovalLog }
        const merged: MergedEntry[] = [
          ...emailLogs.map(l => ({ kind: 'email' as const, log: l, ts: new Date(l.sent_at).getTime() })),
          ...approvalLogs.map(l => ({ kind: 'approval' as const, log: l, ts: new Date(l.submitted_at).getTime() })),
        ].sort((a, b) => b.ts - a.ts)

        return (
          <div className="px-8 mt-6 border-t border-[#EDE9E1] pt-6">
            <button
              onClick={() => setEmailHistoryOpen(v => !v)}
              className="flex items-center gap-2 text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3 hover:text-[#2C2C2A] transition-colors cursor-pointer w-full"
            >
              <Mail size={13} /> History
              <span className="ml-1 bg-[#EDE9E1] text-[#8A877F] rounded-full px-1.5 py-0.5 normal-case tracking-normal font-normal">{merged.length}</span>
              <ChevronDown size={12} className={`ml-auto transition-transform ${emailHistoryOpen ? 'rotate-180' : ''}`} />
            </button>
            {emailHistoryOpen && (
              <div className="space-y-1">
                {merged.map(entry => {
                  if (entry.kind === 'approval') {
                    const a = entry.log
                    const isApproved = a.decision === 'approved'
                    return (
                      <div key={`approval-${a.id}`} className="flex items-start gap-3 px-4 py-2.5 bg-white border border-[#EDE9E1] rounded text-sm">
                        <span className={`mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                          isApproved ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {isApproved ? <ThumbsUp size={10} /> : <ThumbsDown size={10} />}
                          {isApproved ? 'Client Approved' : 'Client Declined'}
                        </span>
                        <div className="flex-1 min-w-0">
                          {a.client_name && (
                            <span className="text-[#2C2C2A]">{a.client_name}</span>
                          )}
                          {a.comment && (
                            <p className="text-xs text-[#5C5A55] mt-0.5 leading-relaxed italic">"{a.comment}"</p>
                          )}
                        </div>
                        <span className="text-[#C4BFB5] text-xs shrink-0">
                          {new Date(a.submitted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' '}
                          {new Date(a.submitted_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  }
                  const log = entry.log
                  return (
                    <div key={`email-${log.id}`} className="flex items-center justify-between px-4 py-2.5 bg-white border border-[#EDE9E1] rounded text-sm">
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
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Email send modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleCloseEmailModal}>
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
            {emailModalType === 'invoice' && depositManual && !isPaid && (
              <div className="mt-4">
                <label htmlFor="email-deposit-received" className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">
                  Deposit Already Paid (R)
                </label>
                <input
                  id="email-deposit-received"
                  type="number" min="0" step="0.01"
                  value={depositDraft}
                  onChange={e => setDepositDraft(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors ${NO_SPINNER}`}
                />
                <p className="text-xs text-[#8A877F] mt-1.5">
                  {depositPreview > 0
                    ? `Invoice will show ${formatZAR(depositPreview)} received and ${formatZAR(Math.max(0, totals.grand_total - depositPreview))} due.`
                    : 'Leave empty if no deposit has been paid — the invoice will show the full amount due.'}
                </p>
              </div>
            )}
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
              <button onClick={handleCloseEmailModal} className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer">
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

      {/* Invoice deposit modal — asks what has actually been paid before building the PDF */}
      {invoiceDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setInvoiceDepositModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-[#1A1A18] mb-1">Deposit on this invoice</h2>
            <p className="text-sm text-[#8A877F] mb-5">
              Has any deposit been paid towards this total? Enter the exact amount received so the invoice balances.
            </p>
            <label htmlFor="invoice-deposit-received" className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">
              Deposit Received (R)
            </label>
            <input
              id="invoice-deposit-received"
              type="number" min="0" step="0.01"
              value={depositDraft}
              onChange={e => setDepositDraft(e.target.value)}
              autoFocus
              className={`w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors ${NO_SPINNER}`}
            />
            <div className="mt-4 rounded-lg bg-[#F5F2EC] border border-[#EDE9E1] px-3.5 py-3 space-y-1.5">
              <div className="flex justify-between text-sm text-[#8A877F]">
                <span>Total</span>
                <span className="font-medium text-[#2C2C2A]">{formatZAR(totals.grand_total)}</span>
              </div>
              {depositPreview > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Deposit Received</span>
                  <span className="font-medium">-{formatZAR(depositPreview)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-[#1A1A18] border-t border-[#D8D3C8] pt-1.5">
                <span>Amount Due</span>
                <span>{formatZAR(Math.max(0, totals.grand_total - depositPreview))}</span>
              </div>
            </div>
            <p className="text-xs text-[#8A877F] mt-3">
              Leave empty if no deposit has been paid. Entering an amount also ticks the Deposit Received stage.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setDepositDraft(depositAmountReceived != null ? String(depositAmountReceived) : ''); setInvoiceDepositModalOpen(false) }}
                className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmInvoicePDF}
                className="px-5 py-2 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#2C2C2A] transition-colors cursor-pointer font-medium"
              >
                Download Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Production sheet email modal */}
      {prodSheetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setProdSheetModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[440px] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#2C2C2A] mb-1">Email Job Cost Sheet</h3>
            <p className="text-sm text-[#8A877F] mb-4">The job cost sheet PDF will be attached and sent to the address below. This email is saved as your studio default.</p>
            <div>
              <label className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">Send To</label>
              <input
                type="email"
                autoFocus
                placeholder="production@studio.co.za"
                value={prodSheetEmailInput}
                onChange={e => setProdSheetEmailInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendProdSheet() }}
                className="w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors"
              />
              {prodSheetEmailInput.trim() !== (initialProductionSheetEmail ?? '') && prodSheetEmailInput.trim() && (
                <p className="text-xs text-[#9A7B4F] mt-1.5">This email will be saved as your studio default for job cost sheets.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setProdSheetModalOpen(false)} className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleSendProdSheet}
                disabled={prodSheetSending || !prodSheetEmailInput.trim()}
                className="px-5 py-2 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#2C2C2A] transition-colors disabled:opacity-50 cursor-pointer font-medium"
              >
                {prodSheetSending ? 'Sending…' : 'Send'}
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
          <div className="bg-white rounded-lg shadow-xl w-[440px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#EDE9E1]">
              <h2 className="text-sm font-semibold text-[#1A1A18]">Sage Invoice</h2>
            </div>

            {!sageInvoiceId && (
              <div className="flex border-b border-[#EDE9E1]">
                <button
                  onClick={() => setSageModalTab('push')}
                  className={`flex-1 px-5 py-2.5 text-xs font-medium transition-colors ${sageModalTab === 'push' ? 'text-[#9A7B4F] border-b-2 border-[#9A7B4F]' : 'text-[#8A877F] hover:text-[#2C2C2A]'}`}
                >
                  Push New Invoice
                </button>
                <button
                  onClick={() => { setSageModalTab('link'); if (sageInvoices.length === 0 && !sageInvoicesLoading) loadSageInvoices() }}
                  className={`flex-1 px-5 py-2.5 text-xs font-medium transition-colors ${sageModalTab === 'link' ? 'text-[#9A7B4F] border-b-2 border-[#9A7B4F]' : 'text-[#8A877F] hover:text-[#2C2C2A]'}`}
                >
                  Link Existing Invoice
                </button>
              </div>
            )}

            {sageModalTab === 'push' ? (
              <>
                {sageInvoiceId && (
                  <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
                    <p className="text-xs text-amber-800 font-medium">This will overwrite the existing Sage invoice</p>
                    <p className="text-xs text-amber-700 mt-0.5">All line items in Sage will be replaced with the current QuotingHub figures. Any changes made directly in Sage will be lost.</p>
                  </div>
                )}
                <div className="px-5 py-3 border-b border-[#EDE9E1]">
                  <p className="text-xs text-[#8A877F] mb-2">Select the Sage customer to attach this invoice to</p>
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
                    <p className="text-xs text-[#8A877F] text-center py-6">Searching…</p>
                  ) : sageCustomerSearch.trim().length < 2 ? (
                    <p className="text-xs text-[#8A877F] text-center py-6">Type at least 2 characters to search</p>
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
                  <Button size="sm" onClick={handlePushToSage} disabled={!sageSelectedCustomer || sagePushing}>
                    {sagePushing ? 'Pushing…' : sageInvoiceId ? 'Overwrite Invoice' : 'Push Invoice'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-[#EDE9E1]">
                  <p className="text-xs text-[#8A877F] mb-2">Link an invoice the accounts team already created in Sage — it won&apos;t be modified</p>
                  <input
                    type="text"
                    placeholder="Search by reference or customer…"
                    value={sageInvoiceSearch}
                    onChange={e => setSageInvoiceSearch(e.target.value)}
                    className="w-full text-sm border border-[#D8D3C8] rounded px-3 py-1.5 outline-none focus:border-[#9A7B4F]"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {sageInvoicesLoading ? (
                    <p className="text-xs text-[#8A877F] text-center py-6">Loading invoices…</p>
                  ) : sageInvoices.length === 0 ? (
                    <p className="text-xs text-[#8A877F] text-center py-6">No open invoices found in Sage</p>
                  ) : filteredSageInvoices.length === 0 ? (
                    <p className="text-xs text-[#8A877F] text-center py-6">No invoices match</p>
                  ) : (
                    filteredSageInvoices.map(inv => (
                      <button
                        key={inv.id}
                        onClick={() => setSageSelectedInvoice(inv)}
                        className={`w-full text-left px-5 py-2.5 border-b border-[#F5F2EC] hover:bg-[#F5F2EC] transition-colors ${sageSelectedInvoice?.id === inv.id ? 'bg-[#F5F2EC]' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-sm font-medium ${sageSelectedInvoice?.id === inv.id ? 'text-[#9A7B4F]' : 'text-[#2C2C2A]'}`}>
                            {inv.reference || `Invoice #${inv.id}`}
                          </span>
                          <span className={`text-sm font-semibold flex-shrink-0 ${sageSelectedInvoice?.id === inv.id ? 'text-[#9A7B4F]' : 'text-[#2C2C2A]'}`}>
                            R {Number(inv.total).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <p className="text-xs text-[#8A877F] mt-0.5">{inv.customerName}</p>
                      </button>
                    ))
                  )}
                </div>
                <div className="px-5 py-3 border-t border-[#EDE9E1] flex items-center justify-between">
                  <button onClick={() => setSageModalOpen(false)} className="text-sm text-[#8A877F] hover:text-[#2C2C2A]">Cancel</button>
                  <Button size="sm" onClick={handleLinkSageInvoice} disabled={!sageSelectedInvoice || sageLinking}>
                    {sageLinking ? 'Linking…' : 'Link Invoice'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
