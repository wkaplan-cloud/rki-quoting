import { createClient } from '@/lib/supabase/client'

// Increment the last run of digits in a project number, ignoring any trailing
// non-digit suffix (e.g. "RKI045-COPY" -> "RKI046").
function incrementProjectNumber(value: string): string | null {
  const match = value.match(/^(.*?)(\d+)\D*$/)
  if (!match) return null
  const [, prefix, digits] = match
  const next = String(parseInt(digits, 10) + 1).padStart(digits.length, '0')
  return prefix + next
}

const MAX_ATTEMPTS = 50

export async function getNextProjectNumber(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await supabase
    .from('projects')
    .select('project_number')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.project_number) return null

  let candidate = data.project_number
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const next = incrementProjectNumber(candidate)
    if (!next) return null
    candidate = next

    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('project_number', candidate)
      .maybeSingle()
    if (!existing) return candidate
  }
  return candidate
}
