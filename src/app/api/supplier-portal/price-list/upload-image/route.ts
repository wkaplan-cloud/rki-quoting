import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MAX_BYTES = 5 * 1024 * 1024

// POST /api/supplier-portal/price-list/upload-image — upload image for a price list item
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${portalAccount.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('supplier-price-list-images')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('supplier-price-list-images')
    .getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
