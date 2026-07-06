import { createClient } from '@/lib/supabase/client'

export async function getNextProjectNumber(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await supabase
    .from('projects')
    .select('project_number')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.project_number) return null

  // Match the last run of digits, ignoring any trailing non-digit suffix (e.g. "-COPY")
  const match = data.project_number.match(/^(.*?)(\d+)\D*$/)
  if (!match) return null

  const [, prefix, digits] = match
  const next = String(parseInt(digits, 10) + 1).padStart(digits.length, '0')
  return prefix + next
}
