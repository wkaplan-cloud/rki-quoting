'use client'
import { useStudioStore, newId } from './store'
import { gridPlacements } from './autoLayout'
import { getMasterContentArea } from './masterThemes'
import { loadImage } from './images'
import type { ImageObject } from './types'

export interface CatalogPiece {
  id: string
  name: string
  description: string | null
  category: string
  item_specs: Record<string, string> | null
  dimensions: string | null
  colour_finish: string | null
  supplier_id: string | null
  supplier_name: string | null
  image_urls: string[]
}

// Place a catalog Piece onto the current slide — image + a spec pre-filled
// from the piece's data. This is a SNAPSHOT copy, not a live link: once
// placed, editing the spec here never writes back to the shared catalog
// record (piece_id stays only as a backreference for the "linked to
// catalog / refresh" affordance in the spec panel).
export async function addPieceToSlide(piece: CatalogPiece, at?: { x: number; y: number }): Promise<void> {
  const imageUrl = piece.image_urls[0]
  if (!imageUrl) throw new Error('This piece has no photo yet — add one before placing it on a board')

  const img = await loadImage(imageUrl)
  const width = img.naturalWidth || 800
  const height = img.naturalHeight || 600
  const area = getMasterContentArea(useStudioStore.getState().masterLayout)
  const [p] = gridPlacements([{ width, height }], area)

  const objectId = newId()
  const obj: ImageObject = {
    id: objectId,
    type: 'image',
    x: at ? at.x - p.width / 2 : p.x,
    y: at ? at.y - p.height / 2 : p.y,
    width: p.width,
    height: p.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    url: imageUrl,
    naturalWidth: width,
    naturalHeight: height,
  }
  useStudioStore.getState().addObjects([obj])

  useStudioStore.getState().updateSpec(objectId, {
    specName: piece.name,
    description: piece.description ?? '',
    notes: piece.dimensions ? `Dimensions: ${piece.dimensions}` : '',
    category: piece.category || 'general',
    itemSpecs: piece.item_specs ?? {},
    supplierId: piece.supplier_id,
    supplierName: piece.supplier_name ?? '',
    pieceId: piece.id,
    status: 'draft',
  })
}
