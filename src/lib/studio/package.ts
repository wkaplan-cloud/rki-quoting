// Studio project packaging — a board serialised as one complete, versioned
// document: slides + objects + assets + master layout. This is the foundation
// for duplication, export, backup and sharing in later phases. Keep this
// format additive: bump `version` on breaking changes.
import type { StudioSlide, StudioAsset, MasterLayoutConfig } from './types'

export const STUDIO_PACKAGE_FORMAT = 'quotinghub-studio-board'
export const STUDIO_PACKAGE_VERSION = 1

export interface StudioPackage {
  format: typeof STUDIO_PACKAGE_FORMAT
  version: number
  exportedAt: string
  board: {
    id: string
    name: string
    clientId: string
    projectId: string | null
    masterLayout: MasterLayoutConfig
  }
  slides: StudioSlide[]
  assets: StudioAsset[]
}

export function buildStudioPackage(input: {
  board: StudioPackage['board']
  slides: StudioSlide[]
  assets: StudioAsset[]
}): StudioPackage {
  return {
    format: STUDIO_PACKAGE_FORMAT,
    version: STUDIO_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    board: input.board,
    slides: [...input.slides].sort((a, b) => a.sortOrder - b.sortOrder),
    assets: input.assets,
  }
}

export function isStudioPackage(value: unknown): value is StudioPackage {
  const v = value as StudioPackage
  return (
    !!v &&
    v.format === STUDIO_PACKAGE_FORMAT &&
    typeof v.version === 'number' &&
    !!v.board &&
    Array.isArray(v.slides) &&
    Array.isArray(v.assets)
  )
}
