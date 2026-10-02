'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { EditorShellProps } from '@/components/studio/EditorShell'
import { StudioEditorLoader } from '../board/[boardId]/StudioEditorLoader'
import { getBoardSnapshot } from '@/lib/studio/offlineDb'
import { ensureBoardCreated, getPendingBoard } from '@/lib/studio/offlineBoards'
import { DEFAULT_MASTER_LAYOUT, type SpecSupplierOption } from '@/lib/studio/types'

type OrgProps = Pick<
  EditorShellProps,
  'orgId' | 'userId' | 'userName' | 'businessName' | 'logoUrl' | 'studioLogoUrl' | 'orgLogoUrl' | 'activePriceListIds'
> & { orgId: string; suppliers: SpecSupplierOption[] }

export function OfflineBoardLoader(org: OrgProps) {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'missing' | EditorShellProps>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState('loading')
      const boardId = decodeURIComponent(window.location.hash.slice(1))
      const pending = boardId ? getPendingBoard(boardId) : null
      if (!pending || pending.orgId !== org.orgId) {
        setState('missing')
        return
      }

      // With signal, the board goes up first and opens in the normal editor,
      // which picks up anything unsynced from this device on its own
      if (navigator.onLine && (await ensureBoardCreated(boardId))) {
        if (!cancelled) router.replace(`/studio/board/${boardId}`)
        return
      }

      const snap = await getBoardSnapshot(boardId)
      if (cancelled) return
      setState({
        boardId,
        projectId: null,
        orgId: org.orgId,
        userId: org.userId,
        userName: org.userName,
        clientId: pending.clientId,
        clientName: pending.clientName,
        boardName: pending.boardName,
        businessName: org.businessName,
        logoUrl: org.logoUrl,
        studioLogoUrl: org.studioLogoUrl,
        orgLogoUrl: org.orgLogoUrl,
        slides: snap?.slides.length ? snap.slides : pending.initialSlides,
        // Photos added here sit in the upload queue and join the library as
        // they land; nothing else can be in it before the board reaches the server
        assets: [],
        specs: Object.values(snap?.specs ?? {}),
        suppliers: org.suppliers,
        activePriceListIds: org.activePriceListIds,
        masterLayout: snap?.masterLayout ?? DEFAULT_MASTER_LAYOUT,
        lastState: null,
      })
    }

    void load()
    window.addEventListener('hashchange', load)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', load)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#F5F2EC]">
        <div className="flex items-center gap-2 text-sm text-[#8A877F]">
          <Loader2 size={16} className="animate-spin" /> Opening Studio…
        </div>
      </div>
    )
  }

  if (state === 'missing') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#F5F2EC] p-6">
        <div className="max-w-sm text-center">
          <p className="text-sm text-[#2C2C2A]">This board isn&apos;t saved on this device.</p>
          <p className="text-xs text-[#8A877F] mt-1.5">
            Boards created offline open only on the device they were made on, until it next has signal.
          </p>
          <Link
            href="/studio"
            className="inline-block mt-4 text-xs font-medium px-4 py-2.5 rounded-lg bg-[#1A1A18] text-white hover:bg-[#9A7B4F] active:bg-[#7A5F3A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B4F]"
          >
            Back to Studio
          </Link>
        </div>
      </div>
    )
  }

  return <StudioEditorLoader key={state.boardId} {...state} />
}
