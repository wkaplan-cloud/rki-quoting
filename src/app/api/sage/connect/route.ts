import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'OAuth not used for Sage One SA — configure credentials in Settings' }, { status: 410 })
}
