'use client'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { EditorShellProps } from '@/components/studio/EditorShell'

// Konva touches `window` at import time, so the editor must never render on
// the server. `ssr: false` is only allowed inside a Client Component — that is
// this file's whole job.
const EditorShell = dynamic(() => import('@/components/studio/EditorShell'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#F5F2EC]">
      <div className="flex items-center gap-2 text-sm text-[#8A877F]">
        <Loader2 size={16} className="animate-spin" /> Opening Studio…
      </div>
    </div>
  ),
})

export function StudioEditorLoader(props: EditorShellProps) {
  return <EditorShell {...props} />
}
