---
version: alpha
name: QuotingHub
description: Quoting and project management software for South African interior designers

colors:
  cream: "#F5F2EC"
  warm: "#EDE9E1"
  sand: "#E5DFD5"
  gold: "#9A7B4F"
  gold-light: "#C4A46B"
  charcoal: "#2C2C2A"
  ink: "#1A1A18"
  muted: "#8A877F"
  border: "#D8D3C8"
  surface: "#FDFCF9"

typography:
  heading:
    fontFamily: "Playfair Display"
    fontWeight: 600
    letterSpacing: normal
  body:
    fontFamily: "Inter"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Inter"
    fontWeight: 500
    fontSize: 0.875rem
  caption:
    fontFamily: "Inter"
    fontWeight: 400
    fontSize: 0.75rem

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px

rounded:
  none: 0
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

components:
  button-primary:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.cream}"
    hover-backgroundColor: "{colors.gold}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.charcoal}"
    hover-backgroundColor: "{colors.warm}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.charcoal}"
    hover-backgroundColor: "{colors.warm}"
    rounded: "{rounded.sm}"
    typography: "{typography.label}"
  button-danger:
    backgroundColor: "#DC2626"
    textColor: "#FFFFFF"
    hover-backgroundColor: "#B91C1C"
    rounded: "{rounded.sm}"
  sidebar:
    backgroundColor: "{colors.ink}"
    width-collapsed: 48px
    width-expanded: 176px
    nav-active-backgroundColor: "rgba(154, 123, 79, 0.2)"
    nav-active-textColor: "#FFFFFF"
    nav-active-iconColor: "{colors.gold-light}"
    nav-inactive-textColor: "rgba(255,255,255,0.7)"
    nav-inactive-hover-backgroundColor: "rgba(255,255,255,0.05)"
  modal:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.xl}"
    shadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
    width: 360px
    padding: 28px
  toast:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.cream}"
    rounded: "{rounded.sm}"
    fontSize: 0.875rem
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.charcoal}"
    border: "1px solid {colors.border}"
    focus-outlineColor: "{colors.gold}"
    rounded: "{rounded.sm}"
---

## Overview

QuotingHub is quoting and project management software for South African interior designers. The visual identity is warm, professional, and craft-oriented — reflecting the interior design industry it serves. The palette draws from natural materials: cream paper, warm linen, aged gold. It should feel like a premium tool, not a generic SaaS product.

The app has two distinct visual contexts: the **app shell** (dark ink sidebar + cream content area) and **public/marketing pages** (cream throughout). Keep these separate.

## Colors

The palette is warm and earthy. Never substitute default Tailwind blue, indigo, or grey.

- `cream` (#F5F2EC) — page background. The base surface everything sits on.
- `warm` (#EDE9E1) — hover states, secondary button background, subtle fills.
- `sand` (#E5DFD5) — tertiary surface, table row alternates.
- `gold` (#9A7B4F) — the primary accent. Use for CTA hover, bullet markers, active states, focus rings. Not for large fills.
- `gold-light` (#C4A46B) — lighter variant. Use for active icons in the dark sidebar, trial status indicators.
- `charcoal` (#2C2C2A) — primary text and primary button background. The default text color for all body content.
- `ink` (#1A1A18) — the darkest value. Reserved for the sidebar background and the strongest headings only.
- `muted` (#8A877F) — secondary text, placeholders, supporting copy.
- `border` (#D8D3C8) — all borders, dividers, input outlines.
- `surface` (#FDFCF9) — elevated cards, modals inner white, input backgrounds.

## Typography

Two fonts only — never mix in a third.

- **Playfair Display** (serif) — headings, modal titles, section labels that need authority. Weights: 400, 500, 600, 700.
- **Inter** (sans-serif) — all body copy, labels, inputs, table data. Weights: 300, 400, 500, 600.

Body line-height is 1.75 — generous for readability. Labels and UI text use 0.875rem (14px). Captions and metadata use 0.75rem (12px).

Never use the same font for both headings and body. Never use a third typeface.

## Layout & Spacing

Spacing uses an 8px base grid: 4, 8, 16, 24, 32, 48px. Do not use arbitrary values unless pixel-precise alignment requires it.

The app shell uses a collapsible sidebar (48px collapsed, 176px expanded on hover) on desktop. On mobile it becomes a full-height drawer with a dark overlay. Content area sits to the right of the sidebar and fills remaining width.

Page headers use `PageHeader` component. Inner pages use consistent 24px padding on all sides.

## Elevation & Depth

Three distinct z-planes:

1. **Base** — page background (`cream`). Most content lives here.
2. **Elevated** — cards, data tables, inner panels (`surface` #FDFCF9 with `border` outline).
3. **Floating** — modals, dropdowns, toasts (white background, `shadow-2xl`, `rounded-xl`).

The sidebar sits outside this system — it has its own `ink` background and is always at the highest z-index in the app shell.

Do not put all surfaces at the same z-plane. Cards should visually lift above the page.

## Shapes

Border radius is conservative — the product is professional, not bubbly.

- Buttons, inputs, badges: 4px (`rounded.sm`)
- Cards, panels: 8px (`rounded.md`)
- Modals, upgrade sheets: 12–16px (`rounded.lg` / `rounded.xl`)
- Status dots, avatars: full circle (`rounded.full`)

## Components

### Button

Four variants: `primary`, `secondary`, `ghost`, `danger`.

- **Primary**: charcoal background, cream text. On hover: transitions to gold. This is the main CTA.
- **Secondary**: cream background, charcoal text, border. For non-destructive secondary actions.
- **Ghost**: transparent, charcoal text. For inline or low-priority actions.
- **Danger**: red-600 background. Destructive actions only (delete, remove).

Two sizes: `sm` (px-3 py-1.5 text-xs) and `md` (px-4 py-2 text-sm). Default is `md`.

All buttons use `transition-colors duration-150`. Never use `transition-all`.

### Sidebar

Dark ink background. Collapses to 48px on desktop (shows only icons), expands to 176px on hover. Labels fade in with `opacity` transition — never slide in with width or transform.

Active nav items: gold-tinted background (`rgba(154,123,79,0.2)`), white text, gold-light icon.
Inactive nav items: 70% white text, 5% white hover background.

### Modal

White background, `rounded-xl`, heavy shadow. Fixed width 360px. Always centered with a `bg-black/50` overlay behind it. Click outside to dismiss.

### Toast

Charcoal background, cream text. 4px radius. Appears top-right. Consistent with the dark sidebar aesthetic — feels like a system notification, not a generic alert.

## Do's and Don'ts

**Do:**
- Use `gold` as an accent only — not as a large fill color
- Use `transition-colors duration-150` on all interactive elements
- Pair Playfair Display headings with Inter body in every component
- Apply `focus-visible` outlines using `gold` at 2px offset
- Keep the sidebar as the only dark surface in the app shell

**Don't:**
- Use default Tailwind blue, indigo, slate, or grey as primary colors
- Use `transition-all` — always specify the property
- Use a third typeface
- Mix the dark sidebar color (`ink`) into content area cards or panels
- Use more than two font weights in a single component
