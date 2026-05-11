export type ThemeKey = 'warm' | 'navy' | 'slate' | 'forest' | 'charcoal'

export interface PdfTheme {
  primary: string
  accent: string
  border: string
  surface: string
  text: string
  muted: string
  headerBg: string
  headerText: string
}

export const THEMES: Record<ThemeKey, PdfTheme> = {
  warm: {
    primary: '#1A1A18',
    accent: '#9A7B4F',
    border: '#D8D3C8',
    surface: '#F5F2EC',
    text: '#2C2C2A',
    muted: '#8A877F',
    headerBg: '#2C2C2A',
    headerText: '#F5F2EC',
  },
  navy: {
    primary: '#1B3A5C',
    accent: '#2E6DA4',
    border: '#C5D5E8',
    surface: '#EFF4FA',
    text: '#1B3A5C',
    muted: '#6B8DAF',
    headerBg: '#1B3A5C',
    headerText: '#FFFFFF',
  },
  slate: {
    primary: '#2D3748',
    accent: '#718096',
    border: '#CBD5E0',
    surface: '#F7FAFC',
    text: '#2D3748',
    muted: '#718096',
    headerBg: '#2D3748',
    headerText: '#FFFFFF',
  },
  forest: {
    primary: '#1E3A2F',
    accent: '#2D6A4F',
    border: '#C3D9CC',
    surface: '#EDF5EF',
    text: '#1E3A2F',
    muted: '#6B9E7E',
    headerBg: '#1E3A2F',
    headerText: '#FFFFFF',
  },
  charcoal: {
    primary: '#1C1C1C',
    accent: '#555555',
    border: '#CCCCCC',
    surface: '#F5F5F5',
    text: '#1C1C1C',
    muted: '#777777',
    headerBg: '#1C1C1C',
    headerText: '#FFFFFF',
  },
}

export const THEME_LABELS: Record<ThemeKey, string> = {
  warm: 'Warm',
  navy: 'Navy',
  slate: 'Slate',
  forest: 'Forest',
  charcoal: 'Charcoal',
}

export function resolveTheme(key?: string | null): PdfTheme {
  return THEMES[(key as ThemeKey) ?? 'warm'] ?? THEMES.warm
}
