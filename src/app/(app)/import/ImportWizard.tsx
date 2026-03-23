'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import toast from 'react-hot-toast'
import { Upload, Check, AlertTriangle, X } from 'lucide-react'

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const norm = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < norm.length; i++) {
    const ch = norm[i]
    const next = norm[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { field += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(field.trim()); field = '' }
      else if (ch === '\n') {
        row.push(field.trim()); field = ''
        if (row.some(c => c !== '')) rows.push(row)
        row = []
      } else { field += ch }
    }
  }
  if (field.trim() || row.length) { row.push(field.trim()); if (row.some(c => c !== '')) rows.push(row) }
  return rows
}

function findHeaderRow(rows: string[][], keyword: string): number {
  return rows.findIndex(r => r.some(c => c.toLowerCase().trim() === keyword.toLowerCase()))
}

function colIdx(headers: string[], ...names: string[]): number {
  for (const name of names) {
    const i = headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase())
    if (i >= 0) return i
  }
  return -1
}

function parsePct(val: string): number {
  const raw = parseFloat(val.replace('%', '').trim())
  return Math.round((raw || 40) * 100) / 100
}

const toTitleCase = (s: string) => s.trim().replace(/\b\w/g, c => c.toUpperCase())

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  projects: { id: string; project_name: string; project_number: string }[]
  existingSuppliers: { id: string; supplier_name: string; markup_percentage: number }[]
  existingClients: { id: string; client_name: string }[]
  existingItems: { id: string; item_name: string }[]
}

type Tab = 'suppliers' | 'clients' | 'items' | 'lines'

// ─── File Upload Button ───────────────────────────────────────────────────────
function FileUpload({ onFile, label }: { onFile: (text: string, name: string) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <input ref={ref} type="file" accept=".csv" className="hidden" onChange={e => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = ev => onFile(ev.target?.result as string, file.name)
        reader.readAsText(file)
        e.target.value = ''
      }} />
      <button
        onClick={() => ref.current?.click()}
        className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-[#D8D3C8] rounded text-sm text-[#8A877F] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors cursor-pointer"
      >
        <Upload size={15} /> {label}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ImportWizard({ projects, existingSuppliers, existingClients, existingItems }: Props) {
  const [tab, setTab] = useState<Tab>('suppliers')
  const supabase = createClient()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'clients', label: 'Clients' },
    { key: 'items', label: 'Items' },
    { key: 'lines', label: 'Quote Lines' },
  ]

  return (
    <div className="max-w-5xl">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#D8D3C8] mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer
              ${tab === t.key ? 'border-b-2 border-[#9A7B4F] text-[#9A7B4F]' : 'text-[#8A877F] hover:text-[#2C2C2A]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'suppliers' && <SuppliersImport supabase={supabase} existingSuppliers={existingSuppliers} />}
      {tab === 'clients'  && <ClientsImport  supabase={supabase} existingClients={existingClients} />}
      {tab === 'items'    && <ItemsImport    supabase={supabase} existingItems={existingItems} />}
      {tab === 'lines'    && <LinesImport    supabase={supabase} projects={projects} existingSuppliers={existingSuppliers} existingClients={existingClients} />}
    </div>
  )
}

// ─── Suppliers Import ─────────────────────────────────────────────────────────
function SuppliersImport({ supabase, existingSuppliers }: { supabase: any; existingSuppliers: Props['existingSuppliers'] }) {
  const [rows, setRows] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  function handleFile(text: string) {
    const csv = parseCSV(text)
    const hi = findHeaderRow(csv, 'supplier')
    if (hi < 0) { toast.error('Could not find "Supplier" column header'); return }
    const headers = csv[hi]
    const iName = colIdx(headers, 'supplier')
    const iCat = colIdx(headers, 'category')
    const iContact = colIdx(headers, 'contact person')
    const iContactNum = colIdx(headers, 'contact number')
    const iRep = colIdx(headers, 'rep name')
    const iRepNum = colIdx(headers, 'rep number')
    const iEmail = colIdx(headers, 'email')
    const iDelivery = colIdx(headers, 'delivery address')
    const iPct = colIdx(headers, 'percetage', 'percentage', 'markup', 'percent')

    const existingNames = new Set(existingSuppliers.map(s => s.supplier_name.toLowerCase()))
    const parsed = csv.slice(hi + 1).filter(r => r[iName]).map(r => ({
      supplier_name: r[iName],
      category: iCat >= 0 ? r[iCat] : '',
      contact_person: iContact >= 0 ? r[iContact] : '',
      contact_number: iContactNum >= 0 ? r[iContactNum] : '',
      rep_name: iRep >= 0 ? r[iRep] : '',
      rep_number: iRepNum >= 0 ? r[iRepNum] : '',
      email: iEmail >= 0 ? r[iEmail] : '',
      delivery_address: iDelivery >= 0 ? r[iDelivery] : '',
      markup_percentage: iPct >= 0 ? parsePct(r[iPct]) : 40,
      exists: existingNames.has(r[iName].toLowerCase()),
    }))
    setRows(parsed)
    setDone(null)
  }

  async function doImport() {
    setImporting(true)
    const { data: orgData } = await supabase.rpc('get_current_org_id')
    const { data: { user } } = await supabase.auth.getUser()
    const toInsert = rows.filter(r => !r.exists).map(({ exists: _e, ...r }) => ({ ...r, org_id: orgData, user_id: user.id }))
    if (toInsert.length === 0) { toast.success('Nothing new to import'); setImporting(false); return }
    const { error } = await supabase.from('suppliers').upsert(toInsert, { onConflict: 'org_id,supplier_name', ignoreDuplicates: true })
    if (error) { toast.error(error.message); setImporting(false); return }
    setDone(toInsert.length)
    setRows([])
    toast.success(`Imported ${toInsert.length} suppliers`)
    setImporting(false)
  }

  return (
    <ImportShell
      title="Import Suppliers"
      instructions="Export the SuppliersData tab as CSV (File → Download → Comma Separated Values) then upload below."
      onFile={t => handleFile(t)}
      rows={rows}
      done={done}
      importing={importing}
      onImport={doImport}
      newCount={rows.filter(r => !r.exists).length}
      skipCount={rows.filter(r => r.exists).length}
      headers={['Supplier', 'Category', 'Contact Person', 'Markup %', 'Delivery Address']}
      renderRow={r => [r.supplier_name, r.category, r.contact_person, `${r.markup_percentage}%`, r.delivery_address]}
    />
  )
}

// ─── Clients Import ───────────────────────────────────────────────────────────
function ClientsImport({ supabase, existingClients }: { supabase: any; existingClients: Props['existingClients'] }) {
  const [rows, setRows] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  function handleFile(text: string) {
    const csv = parseCSV(text)
    const hi = findHeaderRow(csv, 'client')
    if (hi < 0) { toast.error('Could not find "Client" column header'); return }
    const headers = csv[hi]
    const iName = colIdx(headers, 'client')
    const iCompany = colIdx(headers, 'company')
    const iVat = colIdx(headers, 'vat no', 'vat number')
    const iPhone = colIdx(headers, 'contact number')
    const iAddress = colIdx(headers, 'address')

    const existingNames = new Set(existingClients.map(c => c.client_name.toLowerCase()))
    const parsed = csv.slice(hi + 1).filter(r => r[iName]).map(r => ({
      client_name: r[iName],
      company: iCompany >= 0 ? r[iCompany] : '',
      vat_number: iVat >= 0 ? r[iVat] : '',
      contact_number: iPhone >= 0 ? r[iPhone] : '',
      address: iAddress >= 0 ? r[iAddress] : '',
      exists: existingNames.has(r[iName].toLowerCase()),
    }))
    setRows(parsed)
    setDone(null)
  }

  async function doImport() {
    setImporting(true)
    const { data: orgData } = await supabase.rpc('get_current_org_id')
    const { data: { user } } = await supabase.auth.getUser()
    const toInsert = rows.filter(r => !r.exists).map(({ exists: _e, ...r }) => ({ ...r, org_id: orgData, user_id: user.id }))
    if (toInsert.length === 0) { toast.success('Nothing new to import'); setImporting(false); return }
    const { error } = await supabase.from('clients').upsert(toInsert, { onConflict: 'org_id,client_name', ignoreDuplicates: true })
    if (error) { toast.error(error.message); setImporting(false); return }
    setDone(toInsert.length)
    setRows([])
    toast.success(`Imported ${toInsert.length} clients`)
    setImporting(false)
  }

  return (
    <ImportShell
      title="Import Clients"
      instructions="Export the ClientsData tab as CSV then upload below."
      onFile={t => handleFile(t)}
      rows={rows}
      done={done}
      importing={importing}
      onImport={doImport}
      newCount={rows.filter(r => !r.exists).length}
      skipCount={rows.filter(r => r.exists).length}
      headers={['Client Name', 'Company', 'VAT No', 'Contact', 'Address']}
      renderRow={r => [r.client_name, r.company, r.vat_number, r.contact_number, r.address]}
    />
  )
}

// ─── Items Import ─────────────────────────────────────────────────────────────
function ItemsImport({ supabase, existingItems }: { supabase: any; existingItems: Props['existingItems'] }) {
  const [rows, setRows] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  function handleFile(text: string) {
    const csv = parseCSV(text)
    const hi = findHeaderRow(csv, 'items')
    if (hi < 0) { toast.error('Could not find "Items" column header'); return }
    const existingNames = new Set(existingItems.map(i => i.item_name.toLowerCase()))
    const parsed = csv.slice(hi + 1).filter(r => r[0]).map(r => ({
      item_name: r[0],
      exists: existingNames.has(r[0].toLowerCase()),
    }))
    setRows(parsed)
    setDone(null)
  }

  async function doImport() {
    setImporting(true)
    const { data: orgData } = await supabase.rpc('get_current_org_id')
    const { data: { user } } = await supabase.auth.getUser()
    const toInsert = rows.filter(r => !r.exists).map(({ exists: _e, ...r }) => ({ ...r, org_id: orgData, user_id: user.id }))
    if (toInsert.length === 0) { toast.success('Nothing new to import'); setImporting(false); return }
    const { error } = await supabase.from('items').upsert(toInsert, { onConflict: 'org_id,item_name', ignoreDuplicates: true })
    if (error) { toast.error(error.message); setImporting(false); return }
    setDone(toInsert.length)
    setRows([])
    toast.success(`Imported ${toInsert.length} items`)
    setImporting(false)
  }

  return (
    <ImportShell
      title="Import Items"
      instructions="Export the Items_list tab as CSV then upload below."
      onFile={t => handleFile(t)}
      rows={rows}
      done={done}
      importing={importing}
      onImport={doImport}
      newCount={rows.filter(r => !r.exists).length}
      skipCount={rows.filter(r => r.exists).length}
      headers={['Item Name', 'Status']}
      renderRow={r => [r.item_name, r.exists ? 'Already exists' : 'New']}
    />
  )
}

// ─── Quote Lines Import ───────────────────────────────────────────────────────
function LinesImport({ supabase, projects: initialProjects, existingSuppliers, existingClients }: {
  supabase: any
  projects: Props['projects']
  existingSuppliers: Props['existingSuppliers']
  existingClients: Props['existingClients']
}) {
  const [projects, setProjects] = useState(initialProjects)
  const [clients, setClients] = useState(existingClients)
  const [projectId, setProjectId] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectForm, setNewProjectForm] = useState({ project_name: '', project_number: '', date: new Date().toISOString().split('T')[0], design_fee: '20' })
  const [newProjectClientId, setNewProjectClientId] = useState('')
  const [newProjectClientName, setNewProjectClientName] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [missingSuppliers, setMissingSuppliers] = useState<{ name: string; markup: number; include: boolean }[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  async function handleCreateClient(name: string) {
    const { data: orgData } = await supabase.rpc('get_current_org_id')
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('clients').insert({ user_id: user.id, org_id: orgData, client_name: name }).select().single()
    if (error) { toast.error('Failed to create client'); return { id: '' } }
    setClients(prev => [...prev, { id: data.id, client_name: data.client_name }])
    toast.success(`Client "${name}" created`)
    return { id: data.id }
  }

  async function handleCreateProject() {
    if (!newProjectForm.project_name.trim()) { toast.error('Project name is required'); return }
    setSavingProject(true)
    const { data: orgData } = await supabase.rpc('get_current_org_id')
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('projects').insert({
      project_name: newProjectForm.project_name,
      project_number: newProjectForm.project_number || newProjectForm.project_name.slice(0, 6).toUpperCase(),
      date: newProjectForm.date,
      status: 'Draft',
      org_id: orgData,
      user_id: user.id,
      design_fee: parseFloat(newProjectForm.design_fee) || 0,
      client_id: newProjectClientId || null,
    }).select('id, project_name, project_number').single()
    if (error) { toast.error(error.message); setSavingProject(false); return }
    setProjects(prev => [data, ...prev])
    setProjectId(data.id)
    setCreatingProject(false)
    setSavingProject(false)
    toast.success('Project created')
  }

  function handleFile(text: string) {
    const csv = parseCSV(text)
    const hi = findHeaderRow(csv, 'items')
    if (hi < 0) { toast.error('Could not find "Items" column header'); return }
    const headers = csv[hi]

    const iItem = colIdx(headers, 'items')
    const iDesc = colIdx(headers, 'description')
    const iQty = colIdx(headers, 'qty', 'quantity')
    const iSupplier = colIdx(headers, 'supplier')
    const iDelivery = colIdx(headers, 'delivery')
    const iCost = colIdx(headers, 'cost price')
    const iMarkup = colIdx(headers, 'mark up', 'markup')
    const iSale = colIdx(headers, 'sale price', 'sell price')

    const supplierMap = new Map(existingSuppliers.map(s => [s.supplier_name.toLowerCase(), s]))
    const missing = new Map<string, number>()

    // Footer/summary keywords — rows containing these in any column are skipped
    const FOOTER_KEYWORDS = ['deposit required', 'balance before', 'profit incl', 'banking detail', 'bank name', 'account', 'branch code', 'subtotal', 'grand total', 'design fee', 'vat 15', 'r.kaplan', 'rkaplan', 'investec', 'fnb', 'nedbank', 'standard bank']
    const isFooter = (r: string[]) => FOOTER_KEYWORDS.some(k => r.some(c => c.toLowerCase().includes(k)))

    // Stop at first completely empty row OR once we hit footer content
    const dataRows: string[][] = []
    for (const r of csv.slice(hi + 1)) {
      if (r.every(c => !c.trim())) break
      if (isFooter(r)) break
      if (r[iItem]) dataRows.push(r)
    }

    const parsed = dataRows.map((r, idx) => {
      const costRaw = iCost >= 0 ? r[iCost] : ''
      const cost = parseFloat(costRaw.replace(/[R,\s]/g, '')) || 0
      const isSection = !cost && costRaw === ''
      const supplierName = iSupplier >= 0 ? r[iSupplier] : ''
      const supplierLower = supplierName.toLowerCase()
      const matchedSupplier = supplierMap.get(supplierLower)

      if (supplierName && !matchedSupplier && !isSection) {
        const markupRaw = iMarkup >= 0 ? r[iMarkup] : ''
        missing.set(supplierLower, parsePct(markupRaw))
      }

      // Back-calculate markup from sale price if available, for exact totals
      let markup = iMarkup >= 0 ? parsePct(r[iMarkup]) : 40
      if (iSale >= 0 && cost > 0) {
        const saleRaw = r[iSale]
        const sale = parseFloat(saleRaw.replace(/[R,\s]/g, '')) || 0
        if (sale > 0) markup = ((sale / cost) - 1) * 100
      }

      return {
        item_name: r[iItem],
        description: iDesc >= 0 ? r[iDesc] : '',
        quantity: iQty >= 0 ? parseFloat(r[iQty]) || 1 : 1,
        supplier_name: supplierName,
        supplier_id: matchedSupplier?.id ?? null,
        delivery_address: iDelivery >= 0 ? r[iDelivery] : '',
        cost_price: cost,
        markup_percentage: markup,
        row_type: isSection ? 'section' : 'item',
        sort_order: idx,
      }
    })

    setRows(parsed)
    setMissingSuppliers([...missing.entries()].map(([name, markup]) => ({
      name: existingSuppliers.find(s => s.supplier_name.toLowerCase() === name)?.supplier_name ?? name,
      markup,
      include: true,
    })))
    setDone(null)
  }

  async function doImport() {
    if (!projectId) { toast.error('Select a project first'); return }
    setImporting(true)

    const { data: orgData } = await supabase.rpc('get_current_org_id')
    const { data: { user } } = await supabase.auth.getUser()

    // Create missing suppliers the user approved (upsert to handle already-existing ones gracefully)
    const toCreate = missingSuppliers.filter(s => s.include)
    if (toCreate.length > 0) {
      const { error } = await supabase.from('suppliers')
        .upsert(toCreate.map(s => ({
          supplier_name: toTitleCase(s.name),
          markup_percentage: s.markup,
          org_id: orgData,
          user_id: user.id,
        })), { onConflict: 'org_id,supplier_name', ignoreDuplicates: true })
      if (error) { toast.error('Failed to create suppliers: ' + error.message); setImporting(false); return }
    }

    // Re-fetch ALL suppliers fresh from DB — captures suppliers imported earlier this session
    const { data: freshSuppliers } = await supabase.from('suppliers').select('id, supplier_name').eq('org_id', orgData)
    const supplierMap = new Map((freshSuppliers ?? []).map((s: any) => [s.supplier_name.toLowerCase(), s.id]))

    // Get max sort_order for this project
    const { data: existing } = await supabase.from('line_items').select('sort_order').eq('project_id', projectId).order('sort_order', { ascending: false }).limit(1)
    const baseOrder = (existing?.[0]?.sort_order ?? -1) + 1

    const lineItems = rows.map((r, i) => {
      const resolvedSupplierId = r.supplier_name ? supplierMap.get(r.supplier_name.toLowerCase()) ?? null : null
      return {
        project_id: projectId,
        row_type: r.row_type,
        item_name: r.item_name,
        description: r.description,
        quantity: r.quantity,
        cost_price: r.cost_price,
        markup_percentage: r.markup_percentage,
        delivery_address: r.delivery_address,
        supplier_id: resolvedSupplierId,
        supplier_name: resolvedSupplierId ? toTitleCase(r.supplier_name) : null,
        sort_order: baseOrder + i,
        indent_level: 0,
      }
    })

    const { error } = await supabase.from('line_items').insert(lineItems)
    if (error) { toast.error(error.message); setImporting(false); return }
    setDone(lineItems.length)
    setRows([])
    setMissingSuppliers([])
    toast.success(`Imported ${lineItems.length} line items`)
    setImporting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-[#2C2C2A] mb-1">Import Quote Lines</h2>
        <p className="text-xs text-[#8A877F]">Export the Quote-Working tab as CSV then upload below. Lines will be added to the selected project.</p>
      </div>

      {/* Project selector */}
      <div>
        <label className="text-xs font-medium text-[#8A877F] uppercase tracking-wider block mb-1.5">Select Project</label>
        {!creatingProject ? (
          <div className="flex items-center gap-3">
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="px-3 py-2 border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F] bg-white w-72"
            >
              <option value="">— Choose a project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_number} – {p.project_name}</option>
              ))}
            </select>
            <button
              onClick={() => setCreatingProject(true)}
              className="text-sm text-[#9A7B4F] hover:underline cursor-pointer"
            >
              + Create new project
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#D8D3C8] rounded p-4 space-y-3 max-w-md">
            <p className="text-xs font-medium text-[#2C2C2A]">New Project</p>
            <input
              placeholder="Project name *"
              value={newProjectForm.project_name}
              onChange={e => setNewProjectForm(f => ({ ...f, project_name: e.target.value }))}
              className="w-full px-3 py-2 border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F]"
            />
            <Combobox
              options={clients.map(c => ({ id: c.id, label: c.client_name }))}
              value={newProjectClientId}
              inputValue={newProjectClientName}
              onChange={(id, label) => { setNewProjectClientId(id); setNewProjectClientName(label) }}
              onCreate={handleCreateClient}
              placeholder="Select or create client…"
            />
            <div className="flex gap-2">
              <input
                placeholder="Project number"
                value={newProjectForm.project_number}
                onChange={e => setNewProjectForm(f => ({ ...f, project_number: e.target.value }))}
                className="flex-1 px-3 py-2 border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F]"
              />
              <input
                type="date"
                value={newProjectForm.date}
                onChange={e => setNewProjectForm(f => ({ ...f, date: e.target.value }))}
                className="flex-1 px-3 py-2 border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F]"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" step="0.5" placeholder="Design fee %"
                value={newProjectForm.design_fee}
                onChange={e => setNewProjectForm(f => ({ ...f, design_fee: e.target.value }))}
                className="w-36 px-3 py-2 border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F]"
              />
              <span className="text-xs text-[#8A877F]">% design fee</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateProject} disabled={savingProject}>
                {savingProject ? 'Creating…' : 'Create & Select'}
              </Button>
              <button onClick={() => setCreatingProject(false)} className="text-sm text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <FileUpload onFile={(t) => handleFile(t)} label="Upload Quote-Working CSV" />

      {/* Missing suppliers confirmation */}
      {missingSuppliers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
            <AlertTriangle size={15} /> These suppliers weren't found — create them?
          </div>
          <div className="space-y-2">
            {missingSuppliers.map((s, i) => (
              <label key={s.name} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={s.include}
                  onChange={e => setMissingSuppliers(prev => prev.map((m, j) => j === i ? { ...m, include: e.target.checked } : m))}
                  className="rounded"
                />
                <span className="text-sm text-[#2C2C2A]">{s.name}</span>
                <span className="text-xs text-[#8A877F]">{s.markup}% markup</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#8A877F]">{rows.length} rows parsed — {rows.filter(r => r.row_type === 'section').length} sections, {rows.filter(r => r.row_type !== 'section').length} items</p>
            <div className="flex gap-2">
              <button onClick={() => { setRows([]); setMissingSuppliers([]) }} className="text-xs text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer">Clear</button>
              <Button onClick={doImport} disabled={importing || !projectId}>
                {importing ? 'Importing…' : `Import ${rows.length} rows`}
              </Button>
            </div>
          </div>

          <div className="bg-white border border-[#D8D3C8] rounded overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#F5F2EC] border-b border-[#D8D3C8]">
                <tr>
                  <th className="text-left px-3 py-2 text-[#8A877F] uppercase tracking-wider">Item</th>
                  <th className="text-left px-3 py-2 text-[#8A877F] uppercase tracking-wider">Supplier</th>
                  <th className="text-left px-3 py-2 text-[#8A877F] uppercase tracking-wider">Qty</th>
                  <th className="text-left px-3 py-2 text-[#8A877F] uppercase tracking-wider">Cost</th>
                  <th className="text-left px-3 py-2 text-[#8A877F] uppercase tracking-wider">Markup</th>
                  <th className="text-left px-3 py-2 text-[#8A877F] uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-[#EDE9E1] last:border-0 ${r.row_type === 'section' ? 'bg-[#F5F2EC]' : ''}`}>
                    <td className={`px-3 py-2 ${r.row_type === 'section' ? 'font-medium text-[#2C2C2A]' : 'text-[#2C2C2A]'}`}>{r.item_name}</td>
                    <td className="px-3 py-2 text-[#8A877F]">
                      {r.supplier_name && !r.supplier_id && <span className="text-amber-600">⚠ {r.supplier_name}</span>}
                      {r.supplier_id && r.supplier_name}
                      {!r.supplier_name && '—'}
                    </td>
                    <td className="px-3 py-2 text-[#8A877F]">{r.row_type === 'section' ? '—' : r.quantity}</td>
                    <td className="px-3 py-2 text-[#8A877F]">{r.row_type === 'section' ? '—' : `R${r.cost_price}`}</td>
                    <td className="px-3 py-2 text-[#8A877F]">{r.row_type === 'section' ? '—' : `${r.markup_percentage}%`}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.row_type === 'section' ? 'bg-[#EDE9E1] text-[#8A877F]' : 'bg-blue-50 text-blue-600'}`}>
                        {r.row_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {done !== null && (
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded px-4 py-3">
          <Check size={15} /> {done} line items imported successfully
        </div>
      )}
    </div>
  )
}

// ─── Shared Import Shell ──────────────────────────────────────────────────────
function ImportShell({ title, instructions, onFile, rows, done, importing, onImport, newCount, skipCount, headers, renderRow }: {
  title: string
  instructions: string
  onFile: (text: string) => void
  rows: any[]
  done: number | null
  importing: boolean
  onImport: () => void
  newCount: number
  skipCount: number
  headers: string[]
  renderRow: (r: any) => string[]
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-[#2C2C2A] mb-1">{title}</h2>
        <p className="text-xs text-[#8A877F]">{instructions}</p>
      </div>

      <FileUpload onFile={(t) => onFile(t)} label="Upload CSV file" />

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-green-600 font-medium">{newCount} new</span>
              {skipCount > 0 && <span className="text-[#8A877F]">{skipCount} already exist (will skip)</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => onFile('')} className="text-xs text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer">Clear</button>
              <Button onClick={onImport} disabled={importing || newCount === 0}>
                {importing ? 'Importing…' : `Import ${newCount} new`}
              </Button>
            </div>
          </div>

          <div className="bg-white border border-[#D8D3C8] rounded overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#F5F2EC] border-b border-[#D8D3C8]">
                <tr>
                  {headers.map(h => <th key={h} className="text-left px-3 py-2 text-[#8A877F] uppercase tracking-wider">{h}</th>)}
                  <th className="px-3 py-2 text-[#8A877F] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-[#EDE9E1] last:border-0 hover:bg-[#FDFCF9]">
                    {renderRow(r).map((cell, j) => (
                      <td key={j} className="px-3 py-2 text-[#2C2C2A] max-w-[200px] truncate">{cell}</td>
                    ))}
                    <td className="px-3 py-2">
                      {r.exists
                        ? <span className="flex items-center gap-1 text-[#8A877F]"><X size={11} /> Skip</span>
                        : <span className="flex items-center gap-1 text-green-600"><Check size={11} /> New</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {done !== null && (
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded px-4 py-3">
          <Check size={15} /> {done} records imported successfully
        </div>
      )}
    </div>
  )
}
