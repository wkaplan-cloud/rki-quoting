'use client'
import { X, Plus, Trash2, ClipboardList } from 'lucide-react'
import { useStudioStore, newId } from '@/lib/studio/store'
import type { StudioSpec, MaterialEntry } from '@/lib/studio/types'

const MATERIAL_TYPES = [
  'Fabric', 'Timber', 'Stone', 'Metal', 'Paint', 'Glass', 'Leather', 'Wallpaper',
  'Laminate', 'Veneer', 'Rattan', 'Marble', 'Ceramic', 'Concrete', 'Other',
]

const EMPTY_SPEC: Omit<StudioSpec, 'id' | 'objectId' | 'slideId'> = {
  specName: '',
  description: '',
  notes: '',
  supplierId: null,
  supplierName: '',
  category: '',
  quantity: '',
  unit: '',
  width: '',
  depth: '',
  height: '',
  materials: [],
  status: 'draft',
}

// Specs Engine panel — slides in from the right when an object's Specs are
// opened. Every change autosaves through the store; no Save button, no modal.
export function SpecsPanel() {
  const objectId = useStudioStore(s => s.specPanelObjectId)
  const specs = useStudioStore(s => s.specs)
  const suppliers = useStudioStore(s => s.suppliers)
  const slides = useStudioStore(s => s.slides)
  const currentSlideId = useStudioStore(s => s.currentSlideId)

  if (!objectId) return null
  // The panel follows its object — if the object left the current slide
  // (deleted, or slide changed), close quietly. Data is already autosaved.
  const slide = slides.find(sl => sl.id === currentSlideId)
  const obj = slide?.objects.find(o => o.id === objectId)
  if (!obj) return null

  const spec: Omit<StudioSpec, 'id' | 'slideId'> & { id?: string } =
    specs[objectId] ?? { ...EMPTY_SPEC, objectId }

  const update = (patch: Partial<StudioSpec>) =>
    useStudioStore.getState().updateSpec(objectId, patch)

  function setSupplier(name: string) {
    const match = suppliers.find(su => su.name.toLowerCase() === name.trim().toLowerCase())
    update({ supplierName: name, supplierId: match?.id ?? null })
  }

  function setMaterial(id: string, patch: Partial<MaterialEntry>) {
    update({ materials: spec.materials.map(m => (m.id === id ? { ...m, ...patch } : m)) })
  }

  return (
    <div className="flex-shrink-0 w-[280px] h-full flex flex-col bg-[#F5F2EC] border-l border-[#D8D3C8]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#D8D3C8]">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
          <ClipboardList size={12} /> Specs
        </span>
        <button
          type="button"
          onClick={() => useStudioStore.getState().openSpecs(null)}
          title="Close"
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Status */}
        <div className="flex rounded-lg border border-[#D8D3C8] overflow-hidden">
          {(['draft', 'approved'] as const).map(sVal => (
            <button
              key={sVal}
              type="button"
              onClick={() => update({ status: sVal })}
              className={`flex-1 py-1.5 text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                spec.status === sVal
                  ? sVal === 'approved'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#2C2C2A] text-white'
                  : 'bg-white text-[#8A877F] hover:text-[#2C2C2A]'
              }`}
            >
              {sVal}
            </button>
          ))}
        </div>

        {/* General */}
        <Section title="General">
          <Field label="Spec name">
            <TextInput value={spec.specName} onChange={v => update({ specName: v })} placeholder="e.g. Lounge armchair" />
          </Field>
          <Field label="Description">
            <TextArea value={spec.description} onChange={v => update({ description: v })} rows={2} />
          </Field>
          <Field label="Notes">
            <TextArea value={spec.notes} onChange={v => update({ notes: v })} rows={2} />
          </Field>
        </Section>

        {/* Supplier */}
        <Section title="Supplier">
          <Field label="Supplier">
            <TextInput
              value={spec.supplierName}
              onChange={setSupplier}
              placeholder="Choose or type…"
              list="studio-spec-suppliers"
            />
            <datalist id="studio-spec-suppliers">
              {suppliers.map(su => (
                <option key={su.id} value={su.name} />
              ))}
            </datalist>
            {spec.supplierId && (
              <p className="text-[10px] text-emerald-700 mt-1">Linked to existing supplier</p>
            )}
          </Field>
        </Section>

        {/* Product */}
        <Section title="Product">
          <Field label="Category">
            <TextInput value={spec.category} onChange={v => update({ category: v })} placeholder="e.g. Seating" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Quantity">
              {/* Number-only: this pulls straight into quote line item quantity */}
              <TextInput
                value={spec.quantity}
                onChange={v => update({ quantity: v.replace(/[^0-9.]/g, '') })}
                placeholder="2"
                inputMode="decimal"
              />
            </Field>
            <Field label="Unit">
              <TextInput value={spec.unit} onChange={v => update({ unit: v })} placeholder="each" />
            </Field>
          </div>
        </Section>

        {/* Dimensions */}
        <Section title="Dimensions">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Width">
              <TextInput value={spec.width} onChange={v => update({ width: v })} placeholder="mm" />
            </Field>
            <Field label="Depth">
              <TextInput value={spec.depth} onChange={v => update({ depth: v })} placeholder="mm" />
            </Field>
            <Field label="Height">
              <TextInput value={spec.height} onChange={v => update({ height: v })} placeholder="mm" />
            </Field>
          </div>
        </Section>

        {/* Materials & Finishes */}
        <Section
          title="Materials & Finishes"
          action={
            <button
              type="button"
              onClick={() =>
                update({ materials: [...spec.materials, { id: newId(), type: 'Fabric', description: '' }] })
              }
              title="Add material"
              className="w-5 h-5 flex items-center justify-center rounded text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
            >
              <Plus size={12} />
            </button>
          }
        >
          {spec.materials.length === 0 ? (
            <p className="text-[11px] text-[#8A877F]">No materials yet — add fabric, timber, stone…</p>
          ) : (
            <div className="space-y-2">
              {spec.materials.map(m => (
                <div key={m.id} className="flex items-start gap-1.5">
                  <input
                    value={m.type}
                    onChange={e => setMaterial(m.id, { type: e.target.value })}
                    list="studio-spec-material-types"
                    placeholder="Type"
                    className="w-[88px] flex-shrink-0 text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
                  />
                  <input
                    value={m.description}
                    onChange={e => setMaterial(m.id, { description: e.target.value })}
                    placeholder="e.g. Romo Linara Pebble"
                    className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
                  />
                  <button
                    type="button"
                    onClick={() => update({ materials: spec.materials.filter(x => x.id !== m.id) })}
                    title="Remove"
                    className="w-6 h-6 mt-0.5 flex-shrink-0 flex items-center justify-center rounded text-[#8A877F] hover:text-red-600 hover:bg-[#EDE9E1] transition-colors cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <datalist id="studio-spec-material-types">
            {MATERIAL_TYPES.map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">{title}</h3>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-[#8A877F] mb-0.5">{label}</span>
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  list,
  inputMode,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  list?: string
  inputMode?: 'decimal'
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      list={list}
      inputMode={inputMode}
      className="w-full text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
    />
  )
}

function TextArea({
  value,
  onChange,
  rows,
}: {
  value: string
  onChange: (v: string) => void
  rows: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className="w-full text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A] resize-y"
    />
  )
}
