import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * The platform runs four portals whose events live in unrelated tables. The
 * dashboard shows one merged timeline, so each source is normalised into this
 * shape and the lot is sorted by `at` before rendering.
 */
export type ActivityKind =
  | 'studio'
  | 'project'
  | 'sourcing'
  | 'message'
  | 'price-list'
  | 'supplier'
  | 'contractor'
  | 'manufacturer'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  /** What happened, in the platform's own words. */
  title: string
  /** Who or which account it happened to. */
  subject: string | null
  at: string
  href: string | null
}

const PER_SOURCE = 12

/** Newest platform-wide events across every portal, newest first. */
export async function getPlatformActivity(limit = 18): Promise<ActivityEvent[]> {
  const [
    { data: studios },
    { data: projects },
    { data: sourcing },
    { data: messages },
    { data: accessRequests },
    { data: portalAccounts },
  ] = await Promise.all([
    supabaseAdmin.from('organizations')
      .select('id, name, created_at').order('created_at', { ascending: false }).limit(PER_SOURCE),
    supabaseAdmin.from('projects')
      .select('id, name, org_id, created_at').order('created_at', { ascending: false }).limit(PER_SOURCE),
    supabaseAdmin.from('sourcing_sessions')
      .select('id, org_id, created_at').order('created_at', { ascending: false }).limit(PER_SOURCE),
    supabaseAdmin.from('contact_submissions')
      .select('id, name, type, created_at').order('created_at', { ascending: false }).limit(PER_SOURCE),
    supabaseAdmin.from('price_list_access')
      .select('id, org_id, status, requested_at').order('requested_at', { ascending: false }).limit(PER_SOURCE),
    supabaseAdmin.from('supplier_portal_accounts')
      .select('id, company_name, email, supplier_category, plan_category, created_at').order('created_at', { ascending: false }).limit(PER_SOURCE),
  ])

  // Org names are needed by three of the six sources — resolve them in one pass.
  const orgIds = new Set<string>()
  for (const p of projects ?? []) if (p.org_id) orgIds.add(p.org_id)
  for (const s of sourcing ?? []) if (s.org_id) orgIds.add(s.org_id)
  for (const a of accessRequests ?? []) if (a.org_id) orgIds.add(a.org_id)

  const { data: orgRows } = orgIds.size > 0
    ? await supabaseAdmin.from('organizations').select('id, name').in('id', [...orgIds])
    : { data: [] as { id: string; name: string | null }[] }
  const orgName = new Map((orgRows ?? []).map(o => [o.id, o.name ?? 'Unnamed studio']))

  const events: ActivityEvent[] = []

  for (const s of studios ?? []) {
    events.push({
      id: `studio-${s.id}`,
      kind: 'studio',
      title: 'Studio joined',
      subject: s.name ?? 'Unnamed studio',
      at: s.created_at,
      href: `/platform/studios/${s.id}`,
    })
  }

  for (const p of projects ?? []) {
    events.push({
      id: `project-${p.id}`,
      kind: 'project',
      title: 'Project created',
      subject: [p.name, p.org_id ? orgName.get(p.org_id) : null].filter(Boolean).join(' · ') || null,
      at: p.created_at,
      href: p.org_id ? `/platform/studios/${p.org_id}` : null,
    })
  }

  for (const s of sourcing ?? []) {
    events.push({
      id: `sourcing-${s.id}`,
      kind: 'sourcing',
      title: 'Price request sent',
      subject: s.org_id ? orgName.get(s.org_id) ?? null : null,
      at: s.created_at,
      href: '/platform/sourcing',
    })
  }

  for (const m of messages ?? []) {
    events.push({
      id: `message-${m.id}`,
      kind: 'message',
      title: m.type ? `Message · ${m.type}` : 'Message received',
      subject: m.name ?? null,
      at: m.created_at,
      href: '/platform/messages',
    })
  }

  for (const a of accessRequests ?? []) {
    if (!a.requested_at) continue
    events.push({
      id: `access-${a.id}`,
      kind: 'price-list',
      title: a.status === 'pending' ? 'Price-list access requested' : `Price-list access ${a.status}`,
      subject: a.org_id ? orgName.get(a.org_id) ?? null : null,
      at: a.requested_at,
      href: '/platform/price-lists',
    })
  }

  for (const acc of portalAccounts ?? []) {
    const trades = acc.supplier_category === 'trades'
    events.push({
      id: `account-${acc.id}`,
      kind: trades ? 'contractor' : acc.plan_category === 'manufacturer' ? 'manufacturer' : 'supplier',
      title: trades ? 'Contractor registered' : 'Supplier registered',
      subject: acc.company_name || acc.email || null,
      at: acc.created_at,
      href: trades ? '/platform/electricians' : '/platform/suppliers',
    })
  }

  return events
    .filter(e => !!e.at)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}
