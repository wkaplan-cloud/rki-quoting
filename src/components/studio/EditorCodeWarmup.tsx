'use client'
import dynamic from 'next/dynamic'
import { useEffect } from 'react'

// Loads the board editor's code without rendering the editor. The editor is
// split out of every page and fetched on demand, so its files appear in no
// HTML — "Make available offline" needs them on the device all the same, and
// collects them from what this page has loaded once they are in.
//
// It has to be next/dynamic with ssr:false, exactly like StudioEditorLoader: a
// plain import() drags the editor into server rendering, where its PDF
// library cannot load at all.

let markReady: () => void = () => {}
export const editorCodeReady = new Promise<void>(resolve => {
  markReady = resolve
})

function EditorCodeLoaded() {
  useEffect(() => markReady(), [])
  return null
}

export const EditorCodeWarmup = dynamic(
  () => import('@/components/studio/EditorShell').then(() => EditorCodeLoaded),
  { ssr: false }
)
