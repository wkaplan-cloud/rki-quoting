// Board-wide font applied to every text object on every slide (overrides
// each object's own font — see MasterThemePanel.tsx "Font" section). Kept
// deliberately short: the 4 most popular free Google Fonts, not a full
// catalogue — this is a brand-consistency choice, not a design toolbox.
export interface ContentFont {
  id: string
  name: string
  cssVar: string
}

export const CONTENT_FONTS: ContentFont[] = [
  { id: 'inter', name: 'Inter', cssVar: '--font-inter' },
  { id: 'roboto', name: 'Roboto', cssVar: '--font-roboto' },
  { id: 'montserrat', name: 'Montserrat', cssVar: '--font-montserrat' },
  { id: 'lato', name: 'Lato', cssVar: '--font-lato' },
]

export function getContentFont(id: string): ContentFont {
  return CONTENT_FONTS.find(f => f.id === id) ?? CONTENT_FONTS[0]
}
