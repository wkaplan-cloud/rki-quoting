'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeLineItems, computeTotals, formatZAR } from '@/lib/quoting'
import type { Project, LineItem, ProjectStatus } from '@/lib/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { LineItemsTable } from './LineItemsTable'
import { ProjectHeader } from './ProjectHeader'
import toast from 'react-hot-toast'
import { FileText, Send, Copy } from 'lucide-react'

interface Props {
  project: Project & { client: { client_name: string; company: string | null } | null }
  initialLineItems: LineItem[]
  clients: { id: string; client_name: string; company: string | null }[]
  suppliers: { id: string; supplier_name: string; markup_percentage: number; delivery_address: string | null }[]
  items: { id: string; item_name: string }[]
  officeAddress: { name: string; address: string }
  businessName: string
}

export function ProjectDetail({ project: initial, initialLineItems, clients, suppliers, items, officeAddress, businessName }: Props) {
  const [project, setProject] = useState(initial)
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems)
  const [designFee, setDesignFee] = useState(initial.design_fee)
  const router = useRouter()
  const supabase = createClient()

  const computed = computeLineItems(lineItems)
  const totals = computeTotals(lineItems, designFee)

  const handleStatusChange = useCallback(async (status: ProjectStatus) => {
    const { error } = await supabase.from('projects').update({ status }).eq('id', project.id)
    if (error) { toast.error('Failed to update status'); return }
    setProject(p => ({ ...p, status }))
    toast.success(`Status updated to ${status}`)
  }, [project.id, supabase])

  const handleDesignFeeChange = useCallback(async (fee: number) => {
    setDesignFee(fee)
    await supabase.from('projects').update({ design_fee: fee }).eq('id', project.id)
  }, [project.id, supabase])

  const handleDuplicate = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: newProject, error } = await supabase.from('projects').insert({
      user_id: user!.id,
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

  const handleGeneratePDF = useCallback(async (type: 'quote' | 'invoice' | 'po') => {
    const res = await fetch(`/api/pdf/${type}?projectId=${project.id}`)
    if (!res.ok) { toast.error('PDF generation failed'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    const clientPart = project.client?.client_name ? `_${slug(project.client.client_name)}` : ''
    a.download = `${slug(businessName)}${clientPart}_${slug(project.project_name)}_${type}.pdf`
    a.click()
  }, [project.id, project.project_name, project.client, businessName])

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
        onStatusChange={handleStatusChange}
        onProjectUpdate={setProject}
      />

      {/* Action bar */}
      <div className="flex items-center gap-2 px-8 py-3 border-b border-[#D8D3C8] bg-[#F5F2EC] flex-wrap">
        <Button size="sm" variant="secondary" onClick={() => handleGeneratePDF('quote')}>
          <FileText size={13} /> Quote PDF
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleGeneratePDF('invoice')}>
          <FileText size={13} /> Invoice PDF
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleGeneratePDF('po')}>
          <FileText size={13} /> Purchase Orders
        </Button>
        <div className="w-px h-5 bg-[#D8D3C8] mx-1" />
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
        <div className="mt-8 flex justify-end">
          <div className="w-80 bg-white border border-[#D8D3C8] rounded p-5 space-y-2">
            <div className="flex justify-between text-sm text-[#8A877F]">
              <span>Subtotal</span>
              <span className="font-medium text-[#2C2C2A]">{formatZAR(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-[#8A877F] items-center">
              <span>Design Fee</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={designFee}
                onChange={e => handleDesignFeeChange(parseFloat(e.target.value) || 0)}
                className="w-32 text-right text-sm font-medium text-[#2C2C2A] border-b border-dashed border-[#D8D3C8] focus:border-[#9A7B4F] outline-none bg-transparent"
              />
            </div>
            <div className="flex justify-between text-sm text-[#8A877F]">
              <span>VAT (15%)</span>
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
            <div className="flex justify-between text-sm text-[#8A877F]">
              <span>Balance Due</span>
              <span className="font-medium">{formatZAR(totals.balance_due)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
