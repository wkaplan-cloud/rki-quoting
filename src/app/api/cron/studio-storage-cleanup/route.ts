import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { STORAGE_BUCKET } from '@/lib/studio/constants'

export const maxDuration = 300

// Moodboard image retention. Scope is deliberately narrow: the studio-images
// bucket only. Quote/PO/branding artwork lives in other buckets and is never
// touched here.
//
// An image survives while ANY of these still point at it:
//   1. an object on a live slide, on ANY board (boards get duplicated —
//      a copy references the ORIGINAL board's folder, so the scan must be
//      global, never per-folder)
//   2. a board's asset library row
//   3. a slide revision newer than RETENTION_DAYS
//   4. a spec material image, or the studio logo
//
// Rule 3 is the whole point: it keeps "restore a deleted image" working for
// 30 days, then lets the bytes go. Revisions past the window are pruned in
// the same pass so history never outlives the files it references.
const RETENTION_DAYS = 30

// A wrong keep-set is unrecoverable, so refuse to run away with the bucket.
// Tripping this means the reference scan broke, not that the bucket is dirty.
const MAX_DELETE_FRACTION = 0.5

const PAGE = 1000

// Paged so a board with thousands of revisions can't silently truncate at
// PostgREST's default row cap — a truncated scan would read as "unreferenced".
async function allRows(table: string, columns: string, since?: string): Promise<unknown[]> {
  const out: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const base = supabaseAdmin.from(table).select(columns).range(from, from + PAGE - 1)
    const { data, error } = await (since ? base.gte('created_at', since) : base)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

// Every studio-images path mentioned anywhere in these rows. Matching on the
// full path (not a bare uuid) is what keeps the non-uuid logo — studio-logo/
// logo.png — out of the delete set. Stored URLs carry a ?v= cache-buster.
function pathsIn(rows: unknown[]): Set<string> {
  const found = new Set<string>()
  for (const row of rows) {
    const hits = JSON.stringify(row)?.match(new RegExp(`${STORAGE_BUCKET}/([^"'\\s\\\\)]+)`, 'g')) ?? []
    for (const hit of hits) {
      const raw = hit.slice(STORAGE_BUCKET.length + 1).split('?')[0]
      try {
        found.add(decodeURIComponent(raw))
      } catch {
        found.add(raw)
      }
    }
  }
  return found
}

interface StoredFile {
  path: string
  size: number
}

// Storage has no recursive list: bg-removed/ sits a level below the board
// folder, and studio-logo/ a level below the org, so the walk must descend.
async function walk(prefix: string, depth = 0): Promise<StoredFile[]> {
  if (depth > 4) return []
  const entries: { name: string; id: string | null; metadata: { size?: number } | null }[] = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .list(prefix, { limit: 100, offset })
    if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`)
    entries.push(...(data ?? []))
    if (!data || data.length < 100) break
  }

  const files: StoredFile[] = []
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    // Storage marks folders with a null id
    if (entry.id) files.push({ path, size: entry.metadata?.size ?? 0 })
    else files.push(...(await walk(path, depth + 1)))
  }
  return files
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  const force = req.nextUrl.searchParams.get('force') === '1'
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString()

  try {
    const [files, slides, assets, specs, settings, freshRevisions] = await Promise.all([
      walk(''),
      allRows('studio_slides', 'objects'),
      allRows('studio_assets', 'url'),
      allRows('studio_specs', 'materials'),
      allRows('settings', 'studio_logo_url'),
      allRows('studio_slide_revisions', 'objects', cutoff),
    ])

    const keep = new Set<string>([
      ...pathsIn(slides),
      ...pathsIn(assets),
      ...pathsIn(specs),
      ...pathsIn(settings),
      ...pathsIn(freshRevisions),
    ])

    const doomed = files.filter(f => !keep.has(f.path))
    const bytes = doomed.reduce((sum, f) => sum + f.size, 0)
    const summary = {
      retentionDays: RETENTION_DAYS,
      dryRun,
      scanned: files.length,
      scannedBytes: files.reduce((sum, f) => sum + f.size, 0),
      kept: files.length - doomed.length,
      deletable: doomed.length,
      deletableBytes: bytes,
    }

    if (!doomed.length) {
      return NextResponse.json({ ...summary, deleted: 0, revisionsPruned: 0 })
    }

    if (doomed.length / files.length > MAX_DELETE_FRACTION && !force) {
      return NextResponse.json(
        {
          ...summary,
          aborted: true,
          reason: `Would remove ${Math.round((100 * doomed.length) / files.length)}% of the bucket — refusing without ?force=1. Check the reference scan before overriding.`,
          sample: doomed.slice(0, 20).map(f => f.path),
        },
        { status: 409 }
      )
    }

    if (dryRun) {
      return NextResponse.json({ ...summary, deleted: 0, revisionsPruned: 0, sample: doomed.slice(0, 50).map(f => f.path) })
    }

    let deleted = 0
    for (let i = 0; i < doomed.length; i += 100) {
      const batch = doomed.slice(i, i + 100).map(f => f.path)
      const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(batch)
      if (error) throw new Error(`remove: ${error.message}`)
      deleted += batch.length
    }

    // Only once the files are gone — a failed delete above must not leave
    // history pointing at images it can no longer restore.
    const { count, error: pruneErr } = await supabaseAdmin
      .from('studio_slide_revisions')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)
    if (pruneErr) throw new Error(`prune revisions: ${pruneErr.message}`)

    return NextResponse.json({ ...summary, deleted, deletedBytes: bytes, revisionsPruned: count ?? 0 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
