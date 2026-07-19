'use client'
import { useEffect, useMemo, useState } from 'react'
import { Images, Search, X, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStudioStore } from '@/lib/studio/store'
import { addAssetToSlide } from '@/lib/studio/images'
import { createClient } from '@/lib/supabase/client'
import { assetFromRow, type StudioAsset, type StudioAssetRow } from '@/lib/studio/types'

export const ASSET_DRAG_TYPE = 'application/x-studio-asset'

interface CrossBoardResult {
  asset: StudioAsset
  boardId: string
  boardName: string
  clientName: string
}

// Project asset library: every image imported into this board, newest first.
// Drag a thumbnail onto the canvas (or double-click) to reuse it on the
// current slide — no re-upload, duplicates are already collapsed by hash.
// Naming is optional (never blocks import) but is what makes the search
// below actually find things — search runs ORG-WIDE, across every board and
// client, since designers routinely reuse a piece ("same sofa, different
// fabric") from one client's board on another's.
export function AssetPanel() {
  const assets = useStudioStore(s => s.assets)
  const slides = useStudioStore(s => s.slides)
  const [query, setQuery] = useState('')

  // Every image URL currently placed on any slide of this board, including
  // the inactive background-removal variant — an asset with none of its
  // variants placed gets the "not placed" badge (and is safe to remove)
  const usedUrls = useMemo(() => {
    const used = new Set<string>()
    for (const slide of slides) {
      for (const obj of slide.objects) {
        if (obj.type !== 'image') continue
        used.add(obj.url)
        if (obj.originalUrl) used.add(obj.originalUrl)
        if (obj.processedUrl) used.add(obj.processedUrl)
      }
    }
    return used
  }, [slides])
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<CrossBoardResult[]>([])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      const { boardId } = useStudioStore.getState()
      const supabase = createClient()
      const { data } = await supabase
        .from('studio_assets')
        .select(
          'id, board_id, org_id, url, hash, natural_width, natural_height, file_size, created_at, label, studio_boards(name, clients(client_name))'
        )
        .ilike('label', `%${q}%`)
        .neq('board_id', boardId)
        .order('created_at', { ascending: false })
        .limit(40)
      if (cancelled) return
      const rows = (data ?? []) as unknown as Array<
        StudioAssetRow & { studio_boards: { name: string; clients: { client_name: string } | { client_name: string }[] } | { name: string; clients: { client_name: string } | { client_name: string }[] }[] }
      >
      const mapped: CrossBoardResult[] = rows.map(row => {
        // Supabase FK joins come back as an array even for a to-one relation
        const board = Array.isArray(row.studio_boards) ? row.studio_boards[0] : row.studio_boards
        const client = board ? (Array.isArray(board.clients) ? board.clients[0] : board.clients) : undefined
        return {
          asset: assetFromRow(row),
          boardId: row.board_id,
          boardName: board?.name ?? 'Untitled board',
          clientName: client?.client_name ?? '',
        }
      })
      setResults(mapped)
      setSearching(false)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  async function pullIntoThisBoard(result: CrossBoardResult) {
    const store = useStudioStore.getState()
    const supabase = createClient()
    try {
      // Already imported into this board before? Reuse it, don't duplicate
      const { data: existing } = await supabase
        .from('studio_assets')
        .select('*')
        .eq('board_id', store.boardId)
        .eq('hash', result.asset.hash)
        .maybeSingle()
      let asset: StudioAsset
      if (existing) {
        asset = assetFromRow(existing as StudioAssetRow)
      } else {
        const { data, error } = await supabase
          .from('studio_assets')
          .insert({
            org_id: store.orgId,
            board_id: store.boardId,
            url: result.asset.url,
            hash: result.asset.hash,
            natural_width: result.asset.naturalWidth,
            natural_height: result.asset.naturalHeight,
            file_size: result.asset.fileSize,
            label: result.asset.label,
          })
          .select('*')
          .single()
        if (error) throw new Error(error.message)
        asset = assetFromRow(data as StudioAssetRow)
      }
      store.addAsset(asset)
      addAssetToSlide(asset)
      toast.success(`Added "${asset.label}" to this board`)
    } catch (e) {
      toast.error((e as Error).message || 'Could not add to this board')
    }
  }

  const searchMode = query.trim().length > 0

  return (
    <div className="flex-shrink-0 w-[196px] h-full flex flex-col bg-[#F5F2EC] border-l border-[#D8D3C8]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#D8D3C8]">
        <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
          Assets · {assets.length}
        </span>
      </div>

      <div className="p-2 border-b border-[#D8D3C8]">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#8A877F]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search all boards…"
            className="w-full pl-6 pr-6 py-1.5 text-[11px] rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              title="Clear"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {searchMode ? (
        searching ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-[#8A877F]" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
            <Search size={22} className="text-[#D8D3C8] mb-2" />
            <p className="text-[11px] text-[#8A877F] leading-relaxed">No named assets match &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
            {results.map(r => (
              <CrossBoardThumb key={r.asset.id} result={r} onAdd={() => void pullIntoThisBoard(r)} />
            ))}
          </div>
        )
      ) : assets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <Images size={22} className="text-[#D8D3C8] mb-2" />
          <p className="text-[11px] text-[#8A877F] leading-relaxed">
            Images you import appear here — drag them back onto any slide
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
          {assets.map(asset => (
            <AssetThumb key={asset.id} asset={asset} used={usedUrls.has(asset.url)} />
          ))}
        </div>
      )}
    </div>
  )
}

function CrossBoardThumb({ result, onAdd }: { result: CrossBoardResult; onAdd: () => void }) {
  const { asset, boardName, clientName } = result
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        title="Click to add to this board"
        onClick={onAdd}
        className="relative aspect-square rounded-md overflow-hidden border border-[#D8D3C8] bg-white cursor-pointer hover:border-[#9A7B4F] transition-colors focus-visible:outline-2 focus-visible:outline-[#9A7B4F]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt=""
          loading="lazy"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      </button>
      <span className="text-[10px] text-[#2C2C2A] truncate px-0.5">{asset.label}</span>
      <span className="text-[9px] text-[#8A877F] truncate px-0.5 -mt-1">
        {clientName ? `${clientName} · ${boardName}` : boardName}
      </span>
    </div>
  )
}

function AssetThumb({ asset, used }: { asset: StudioAsset; used: boolean }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(asset.label ?? '')
  const [labels, setLabels] = useState<string[]>([])

  async function remove() {
    const name = asset.label ? `"${asset.label}"` : 'this image'
    const message = used
      ? `${name} is still placed on a slide — the placed copies stay, but it will leave this board's asset library. Remove it?`
      : `Remove ${name} from this board's asset library?`
    if (!confirm(message)) return
    const store = useStudioStore.getState()
    store.removeAsset(asset.id)
    // Only this board's library row is deleted — the stored image file is
    // shared by hash across boards (and by placed copies), so it stays.
    const supabase = createClient()
    const { error } = await supabase.from('studio_assets').delete().eq('id', asset.id)
    if (error) {
      store.addAsset(asset)
      toast.error('Could not remove — please try again')
    }
  }

  async function startRename() {
    setValue(asset.label ?? '')
    setEditing(true)
    // Fresh each time, org-wide — the whole point is a shared, consistent
    // vocabulary across every board, not just this one
    const supabase = createClient()
    const { data } = await supabase.from('studio_assets').select('label').not('label', 'is', null)
    const unique = Array.from(new Set((data ?? []).map(d => (d.label as string).trim()).filter(Boolean)))
    setLabels(unique.sort((a, b) => a.localeCompare(b)))
  }

  async function commit() {
    setEditing(false)
    const trimmed = value.trim()
    const next = trimmed || null
    if (next === asset.label) return
    const prevLabel = asset.label
    const store = useStudioStore.getState()
    store.renameAsset(asset.id, next)
    const supabase = createClient()
    const { error } = await supabase.from('studio_assets').update({ label: next }).eq('id', asset.id)
    if (error) {
      store.renameAsset(asset.id, prevLabel)
      toast.error('Could not save name — please try again')
      return
    }

    // Push the same name onto any spec that already exists for an object
    // using this exact image, so the two never drift apart (the reverse of
    // what SpecsPanel.tsx does when a spec name is edited)
    for (const slide of store.slides) {
      for (const obj of slide.objects) {
        if (obj.type === 'image' && obj.url === asset.url && store.specs[obj.id]) {
          store.updateSpec(obj.id, { specName: next ?? '' })
        }
      }
    }
  }

  return (
    <div className="flex flex-col gap-1 group relative">
      <button
        type="button"
        draggable
        title="Drag onto a slide, or double-click to add"
        onDragStart={e => {
          e.dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(asset))
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onDoubleClick={() => addAssetToSlide(asset)}
        className="relative aspect-square rounded-md overflow-hidden border border-[#D8D3C8] bg-white cursor-grab active:cursor-grabbing hover:border-[#9A7B4F] transition-colors focus-visible:outline-2 focus-visible:outline-[#9A7B4F]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt=""
          loading="lazy"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
        {!used && (
          <span
            title="Not placed on any slide — safe to remove"
            className="absolute bottom-1 left-1 px-1 py-px rounded bg-white/90 text-[8px] uppercase tracking-wider text-amber-600 pointer-events-none"
          >
            Not placed
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => void remove()}
        title="Remove from this board's asset library"
        className="absolute top-1 right-1 w-5 h-5 hidden group-hover:flex items-center justify-center rounded bg-white/90 text-[#8A877F] hover:text-red-600 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#9A7B4F]"
      >
        <Trash2 size={11} />
      </button>

      {editing ? (
        <>
          <input
            autoFocus
            list={`asset-labels-${asset.id}`}
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
              if (e.key === 'Escape') {
                setValue(asset.label ?? '')
                setEditing(false)
              }
            }}
            placeholder="Name it…"
            className="w-full text-[10px] px-1 py-0.5 rounded border border-[#9A7B4F] bg-white outline-none text-[#2C2C2A]"
          />
          <datalist id={`asset-labels-${asset.id}`}>
            {labels.map(l => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void startRename()}
          title="Name this asset — makes it searchable across every board"
          className={`text-[10px] px-0.5 truncate text-left cursor-pointer hover:underline ${
            asset.label ? 'text-[#2C2C2A]' : 'text-amber-600 italic'
          }`}
        >
          {asset.label ?? 'Unnamed'}
        </button>
      )}
    </div>
  )
}
