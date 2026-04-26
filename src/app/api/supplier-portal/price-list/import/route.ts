import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { apiError } from '@/lib/api-error'

// POST /api/supplier-portal/price-list/import — CSV or XLSX bulk import
export async function POST(req: NextRequest) {
  try {
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

  const fileName = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()

  let rows: Record<string, string>[] = []

  if (fileName.endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(buffer)
    const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
    rows = result.data
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
  } else {
    return NextResponse.json({ error: 'Only CSV and Excel (.xlsx/.xls) files are supported' }, { status: 400 })
  }

  if (rows.length === 0) return NextResponse.json({ error: 'No rows found in file' }, { status: 400 })
  if (rows.length > 500) return NextResponse.json({ error: 'Maximum 500 rows per import' }, { status: 400 })

  // Normalise column names (case-insensitive, trim)
  function col(row: Record<string, string>, ...keys: string[]): string {
    for (const key of keys) {
      const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase())
      if (found) return row[found]?.toString().trim() ?? ''
    }
    return ''
  }

  const items = rows
    .map(row => ({
      portal_account_id: portalAccount.id,
      item_name: col(row, 'item_name', 'item name', 'name', 'product'),
      description: col(row, 'description', 'desc') || null,
      sku: col(row, 'sku', 'code', 'product code') || null,
      unit: col(row, 'unit', 'uom') || null,
      price: parseFloat(col(row, 'price', 'unit price', 'cost')) || null,
      lead_time_weeks: parseInt(col(row, 'lead_time_weeks', 'lead time', 'lead_time')) || null,
    }))
    .filter(item => item.item_name.length > 0)

  if (items.length === 0) {
    return NextResponse.json({ error: 'No valid rows found. Make sure your file has an "item_name" column.' }, { status: 400 })
  }

  const { error: insertError } = await supabaseAdmin
    .from('supplier_price_list_items')
    .insert(items)

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ success: true, count: items.length })
  } catch (e) {
    return apiError(e)
  }
}
