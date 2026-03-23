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
import { FileText, Send, Copy, ChevronDown } from 'lucide-react'

interface Props {
  project: Project & { client: { client_name: string; company: string | null } | null }
  initialLineItems: LineItem[]
  clients: { id: string; client_name: string; company: string | null }[]
  suppliers: { id: string; supplier_name: string; markup_percentage: number; delivery_address: string | null }[]
  items: { id: string; item_name: string }[]
  officeAddress: { name: string; address: string }
  businessName: string
  vatRate: number
  initialStages: ProjectStages | null
}

export function ProjectDetail({ project: initial, initialLineItems, clients, suppliers, items, officeAddress, businessName, vatRate: initialVatRate, initialStages }: Props) {
  const [project, setProject] = useState(initial)
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems)
  const [stages, setStages] = useState<ProjectStages | null>(initialStages)
  const [designFeePct, setDesignFeePct] = useState(initial.design_fee)
  const [vatRate, setVatRate] = useState(initialVatRate)
  const [poMenuOpen, setPoMenuOpen] = useState(false)
  const poMenuRef = useRef<HTMLDivElement>(null)
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

  const handleGeneratePDF = useCallback(async (type: 'quote' | 'invoice' | 'po', supplierIdParam?: string) => {
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

  const handleSendEmail = useCallback(async (type: 'quote' | 'invoice') => {
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, type }),
    })
    if (!res.ok) { toast.error('Failed to send email'); return }
    toast.success(`${type === 'quote' ? 'Quote' : 'Invoice'} sent to client`)
  }, [project.id])

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
        <div className="flex-1" />
        <Button size="sm" variant="secondary" onClick={() => handleSendEmail('quote')}>
          <Send size={13} /> Send Quote
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleSendEmail('invoice')}>
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
    </div>
  )
}
