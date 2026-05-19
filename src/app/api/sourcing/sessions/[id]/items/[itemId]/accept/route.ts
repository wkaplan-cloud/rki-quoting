import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions/[id]/items/[itemId]/accept
// Body: { assignment_id } — accept a specific supplier's response for this item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { id: sessionId, itemId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data: session } = await supabase
      .from('sourcing_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { assignment_id } = await req.json() as { assignment_id: string }
    if (!assignment_id) return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 })

    const now = new Date().toISOString()

    // Fetch all assignments, the session item, and the winning assignment's supplier + price in parallel
    const [{ data: assignments }, { data: item }, { data: winning }] = await Promise.all([
      supabase.from('sourcing_item_assignments').select('id').eq('item_id', itemId),
      supabase.from('sourcing_session_items')
        .select('piece_id, title, specifications, category, work_type, dimensions, colour_finish, item_specs, ref_image_urls')
        .eq('id', itemId)
        .single(),
      supabase.from('sourcing_item_assignments')
        .select('id, session_supplier:sourcing_session_suppliers(supplier_id, supplier_name), response:sourcing_item_responses(unit_price)')
        .eq('id', assignment_id)
        .single(),
    ])

    if (!assignments?.length) return NextResponse.json({ error: 'No assignments found' }, { status: 404 })

    await Promise.all([
      supabase.from('sourcing_item_assignments')
        .update({ status: 'accepted', accepted_at: now })
        .eq('id', assignment_id),
      supabase.from('sourcing_item_assignments')
        .update({ status: 'declined' })
        .eq('item_id', itemId)
        .neq('id', assignment_id),
      supabase.from('sourcing_session_items')
        .update({ status: 'accepted' })
        .eq('id', itemId),
    ])

    // Resolve accepted price and supplier from the winning assignment
    const sessionSupplier = winning?.session_supplier
      ? (Array.isArray(winning.session_supplier) ? winning.session_supplier[0] : winning.session_supplier)
      : null
    const response = winning?.response
      ? (Array.isArray(winning.response) ? winning.response[0] : winning.response)
      : null

    const acceptedPrice: number | null = response?.unit_price ?? null
    const acceptedSupplierId: string | null = sessionSupplier?.supplier_id ?? null
    const acceptedSupplierName: string | null = sessionSupplier?.supplier_name ?? null

    let pieceResult: { updated: boolean; created: boolean; piece_id: string | null } = {
      updated: false, created: false, piece_id: null,
    }

    if (item) {
      const piecePayload = {
        base_price: acceptedPrice,
        supplier_id: acceptedSupplierId,
        supplier_name: acceptedSupplierName,
        last_priced_at: now,
        updated_at: now,
      }

      if (item.piece_id) {
        // Re-pricing an existing piece — update price and supplier in-place
        await supabase.from('pieces').update(piecePayload).eq('id', item.piece_id)
        pieceResult = { updated: true, created: false, piece_id: item.piece_id }
      } else if (acceptedPrice !== null) {
        // New item — create a piece from the session item's specs
        const { data: orgId } = await supabase.rpc('get_current_org_id')
        if (orgId) {
          const { data: newPiece } = await supabase.from('pieces').insert({
            org_id: orgId,
            user_id: user.id,
            name: item.title,
            description: item.specifications ?? null,
            category: item.category ?? 'general',
            work_type: item.work_type ?? null,
            dimensions: item.dimensions ?? null,
            colour_finish: item.colour_finish ?? null,
            item_specs: item.item_specs ?? null,
            image_urls: item.ref_image_urls ?? [],
            base_price: acceptedPrice,
            supplier_id: acceptedSupplierId,
            supplier_name: acceptedSupplierName,
            last_priced_at: now,
          }).select('id').single()

          if (newPiece) {
            // Link the session item back to the new piece
            await supabase.from('sourcing_session_items').update({ piece_id: newPiece.id }).eq('id', itemId)
            pieceResult = { updated: false, created: true, piece_id: newPiece.id }
          }
        }
      }
    }

    // Audit log — designer accepted a supplier's quote for this item
    const { data: sessionForAudit } = await supabase
      .from('sourcing_sessions')
      .select('org_id, project_id')
      .eq('id', sessionId)
      .maybeSingle()
    if (sessionForAudit) {
      await supabase.from('audit_logs').insert({
        org_id: (sessionForAudit as any).org_id,
        project_id: (sessionForAudit as any).project_id ?? null,
        user_email: user.email ?? null,
        action: 'accepted',
        table_name: 'sourcing_item_assignments',
        record_id: assignment_id,
        old_data: null,
        new_data: {
          item_title: item?.title ?? null,
          supplier_name: acceptedSupplierName,
          unit_price: acceptedPrice,
        },
      })
    }

    return NextResponse.json({ success: true, piece: pieceResult })
  } catch (e) {
    return apiError(e)
  }
}
