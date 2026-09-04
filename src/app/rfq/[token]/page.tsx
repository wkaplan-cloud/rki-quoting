import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  normalizeMaterial,
  normalizeScatter,
  normalizeSpecImage,
  type StudioSpecRow,
  type StudioSlideRow,
} from '@/lib/studio/types'
import { RfqPricingForm, type RfqFormItem, type RfqFormImage } from './RfqPricingForm'
import { CATEGORY_FIELDS, categoryLabel, type CategoryKey } from '@/lib/sourcing-categories'
import { Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RfqPricingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: request } = await supabaseAdmin
    .from('rfq_requests')
    .select('id, org_id, board_id, supplier_name, object_ids, message, expires_at, submitted_at, submission_message')
    .eq('token', token)
    .maybeSingle()

  if (!request) notFound()

  const objectIds = (request.object_ids as string[]) ?? []
  // Server component: renders once per request, so reading the clock here is stable by construction.
  // eslint-disable-next-line react-hooks/purity
  const expired = new Date(request.expires_at).getTime() < Date.now()

  const [{ data: settings }, { data: board }, { data: specRows }, { data: slideRows }, { data: existing }] =
    await Promise.all([
      supabaseAdmin.from('settings').select('business_name, logo_url').eq('org_id', request.org_id).maybeSingle(),
      supabaseAdmin.from('studio_boards').select('name').eq('id', request.board_id).eq('org_id', request.org_id).maybeSingle(),
      supabaseAdmin.from('studio_specs').select('*').eq('org_id', request.org_id).eq('board_id', request.board_id).in('object_id', objectIds),
      supabaseAdmin.from('studio_slides').select('id, name, heading, sort_order, objects').eq('org_id', request.org_id).eq('board_id', request.board_id).order('sort_order'),
      supabaseAdmin.from('spec_quotes').select('studio_spec_id, price, lead_time, notes, unable_to_quote').eq('org_id', request.org_id).eq('rfq_request_id', request.id),
    ])

  const businessName = settings?.business_name ?? 'The studio'
  const logoUrl = settings?.logo_url ?? null

  // Image + room/area for each object, from the slide it sits on. Also gives
  // us a stable display order (slide order, then position on the slide).
  // The board image carries its crop: what the designer framed on the slide is
  // the brief, so the supplier is shown that framing, never the wider original.
  const imageByObject = new Map<string, RfqFormImage>()
  const areaByObject = new Map<string, string>()
  const orderByObject = new Map<string, number>()
  let seq = 0
  for (const slide of (slideRows ?? []) as StudioSlideRow[]) {
    const area = (slide.heading || slide.name || '').trim()
    for (const obj of Array.isArray(slide.objects) ? slide.objects : []) {
      if (obj.type === 'image') {
        imageByObject.set(obj.id, {
          url: obj.url,
          crop: obj.crop ?? null,
          naturalWidth: obj.naturalWidth,
          naturalHeight: obj.naturalHeight,
        })
      }
      areaByObject.set(obj.id, area)
      if (!orderByObject.has(obj.id)) orderByObject.set(obj.id, seq++)
    }
  }

  const prefillBySpec = new Map(
    ((existing ?? []) as { studio_spec_id: string; price: number | null; lead_time: string; notes: string; unable_to_quote: boolean }[])
      .map(r => [r.studio_spec_id, r])
  )

  const items: RfqFormItem[] = ((specRows ?? []) as StudioSpecRow[])
    .map(spec => {
      const pre = prefillBySpec.get(spec.id)
      return {
        specId: spec.id,
        name: spec.spec_name || 'Untitled item',
        area: areaByObject.get(spec.object_id) ?? '',
        images: [
          imageByObject.get(spec.object_id),
          // Extra views added on the spec — stored whole, no crop of their own
          ...(Array.isArray(spec.images) ? spec.images.map(normalizeSpecImage) : []).map(img => ({
            url: img.url,
            crop: null,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          })),
        ].filter((img): img is RfqFormImage => !!img),
        category: categoryLabel(spec.category),
        description: spec.description ?? '',
        quantity: spec.quantity ?? '',
        unit: spec.unit ?? '',
        dimensions: [spec.width, spec.depth, spec.height].map(v => (v ?? '').trim()).filter(Boolean).join(' × '),
        materials: (Array.isArray(spec.materials) ? spec.materials.map(normalizeMaterial) : [])
          .map(m =>
            [m.type, m.description, m.colour, m.supplierName ? `via ${m.supplierName}` : '']
              .map(v => (v ?? '').trim())
              .filter(Boolean)
              .join(' · ')
          )
          .filter(Boolean),
        scatters: (Array.isArray(spec.scatters) ? spec.scatters.map(normalizeScatter) : [])
          .map(sc =>
            [
              sc.quantity.trim() ? `${sc.quantity.trim()} ×` : '',
              sc.size,
              [sc.fabric.trim(), sc.fabricSupplierName.trim()].filter(Boolean).join(' — '),
              sc.colour,
              sc.details,
              sc.supplierName ? `via ${sc.supplierName}` : '',
            ]
              .map(v => (v ?? '').trim())
              .filter(Boolean)
              .join(' · ')
          )
          .filter(Boolean),
        // Resolved to labels + units here, not in the form — the supplier must
        // read "Overall Width 1800 mm", never the raw "overall_width" key.
        itemSpecs: (CATEGORY_FIELDS[spec.category as CategoryKey] ?? [])
          .filter(f => (spec.item_specs?.[f.key] ?? '').trim())
          .map(f => ({
            label: f.label,
            value: `${spec.item_specs![f.key].trim()}${f.unit ? ` ${f.unit}` : ''}`,
          })),
        specNotes: spec.notes ?? '',
        prefill: {
          price: pre?.price ?? null,
          leadTime: pre?.lead_time ?? '',
          note: pre?.notes ?? '',
          unableToQuote: pre?.unable_to_quote ?? false,
        },
        sort: orderByObject.get(spec.object_id) ?? 9999,
      }
    })
    .sort((a, b) => a.sort - b.sort)

  const expiryLabel = new Date(request.expires_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F2EC' }}>
      <header style={{ backgroundColor: '#4A4A47' }}>
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={businessName} className="h-8 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          )}
          <div>
            <p className="font-semibold text-sm leading-tight" style={{ color: '#F5F2EC' }}>{businessName}</p>
            <p className="text-xs mt-0.5" style={{ color: '#C4A46B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Request for quote</p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 sm:py-8">
        {expired ? (
          <div className="rounded-2xl bg-white border px-6 py-10 text-center" style={{ borderColor: '#EDE9E1' }}>
            <Clock size={40} className="mx-auto mb-4" style={{ color: '#C4A46B' }} />
            <h1 className="text-lg font-semibold mb-1" style={{ color: '#2C2C2A' }}>This pricing link has expired</h1>
            <p className="text-sm" style={{ color: '#8A877F' }}>
              It was valid until {expiryLabel}. Please reply to {businessName}&apos;s email and they&apos;ll send a fresh link.
            </p>
          </div>
        ) : (
          <RfqPricingForm
            token={token}
            businessName={businessName}
            boardName={board?.name ?? ''}
            supplierName={request.supplier_name ?? ''}
            message={request.message ?? ''}
            items={items}
            initialSubmissionMessage={request.submission_message ?? ''}
            alreadySubmitted={!!request.submitted_at}
            expiryLabel={expiryLabel}
          />
        )}

        <p className="text-center text-xs mt-6" style={{ color: '#C4BFB5' }}>
          Powered by <span style={{ color: '#8A877F' }}>QuotingHub</span>
        </p>
      </main>
    </div>
  )
}
