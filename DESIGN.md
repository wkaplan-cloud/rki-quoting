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

  # ── Platform admin (/platform) ──────────────────────────────────────────
  # Cream canvas, ink rail. Every text value clears 4.5:1; the "Platform
  # control room" section below says which value goes where.
  pf-panel: "#FDFCF9"
  pf-sunken: "#EFEBE3"
  pf-row: "#F1EDE5"
  pf-row-alt: "#F3EFE8"
  pf-row-faint: "#F7F4EE"
  pf-hover: "#E9E4DA"
  pf-border: "#DED8CC"
  pf-border-soft: "#E2DCD1"
  pf-hairline: "#EAE5DB"
  pf-border-firm: "#CFC7B8"
  pf-rule: "#C5C0B5"
  pf-chevron: "#A8A398"
  pf-text: "#1A1A18"
  pf-text-2: "#3F3D38"
  pf-text-3: "#5C5A54"
  pf-text-4: "#6E6B63"
  pf-designer: "#7E6036"
  pf-designer-dk: "#5F4726"
  pf-supplier: "#0F766E"
  pf-supplier-dk: "#115E59"
  pf-manufacture: "#C2410C"
  pf-trades: "#6D28D9"
  pf-critical: "#B91C1C"
  pf-warning: "#8F5706"
  pf-notice: "#0369A1"
  pf-healthy: "#047857"
  pf-healthy-dk: "#065F46"
  pf-chip-quote: "#DDEDFA"
  pf-chip-approved: "#D6F5E3"
  pf-chip-deposit: "#EAE4FD"
  pf-chip-invoice: "#FBEFD2"
  pf-chip-cancelled: "#FBE0E0"
  pf-rail: "#181816"
  pf-rail-text: "#B4B0A6"
  pf-rail-label: "#8F8B81"
  pf-rail-hover: "#D6D2C8"
  pf-rail-gold: "#D8BA84"
  pf-rail-gold-hi: "#EBD3A6"
  pf-scrim: "rgba(0,0,0,0.7)"
  pf-scrim-strong: "rgba(0,0,0,0.75)"
  pf-danger: "#dc2626"
  pf-danger-bg: "#fef2f2"
  pf-danger-border: "#fecaca"

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
  # Fixed ramp for the dark platform control room. Dense admin surfaces need
  # finer steps than the cream app; these are the only sizes allowed there.
  scale:
    micro: 10px
    meta: 11px
    ui: 12px
    body: 13px
    lead: 15px
    figure: 20px
    display-sm: 28px
    display: 32px
    display-lg: 40px

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

## Platform control room

`/platform/*` is the internal admin. It runs on the house cream canvas — the ink
rail is the only dark surface, exactly as in the app shell. Colour carries
meaning here rather than decoration, and no text value falls below 4.5:1.

**Surfaces**

- `#F5F2EC` — the canvas.
- `#FDFCF9` — panels and cards, `#DED8CC` border, a soft `rgba(44,44,42,0.16)`
  drop shadow at -16px blur. No inset highlights; they are invisible on cream.
- `#EFEBE3` sunken fills, `#E9E4DA` hover, `#EAE5DB` hairline dividers.
- `#181816` — the navigation rail and the command palette. Nothing else.

**Text** runs `#1A1A18` → `#3F3D38` → `#5C5A54` → `#6E6B63`. That last value is
the floor for anything a person reads (4.76:1 on cream); `#8A877F` is permitted
only for rules and decorative icons. On the ink rail the ramp inverts to
`#FFFFFF` → `#B4B0A6` → `#8F8B81`.

**Type** uses the fixed ramp above (10 / 11 / 12 / 13 / 15 / 20 / 28 / 32 / 40px).
No fluid sizing — the admin is viewed at a consistent desk DPI. Every number is
`tabular-nums`. Playfair is reserved for the page title; everything else is Inter.

**Portal accents.** Each portal owns one hue for its section dot, active nav
icon, card rail and activity markers. Each has a cream twin and a rail twin,
because the same hue cannot serve both grounds:

| Portal | On cream | On the ink rail |
|---|---|---|
| Designer | `#7E6036` (5.2:1) | `#D8BA84` (9.6:1) |
| Supplier | `#0F766E` (4.9:1) | `teal-300` (12.0:1) |
| Manufacturing | `#C2410C` (4.6:1) | `orange-300` (10.5:1) |
| Electrical & trades | `#6D28D9` (6.4:1) | `violet-300` (9.6:1) |

**Severity** is separate from portal accent: `#B91C1C` critical, `#8F5706`
warning, `#0369A1` notice, `#047857` healthy — all ≥4.5:1 on cream. A severity
dot carries a `0 0 0 3px` tint of its own hue at 13% so it reads at 6px.

**Status chips** are a light tint of the hue with its AA text on top, never a
dark chip: Draft `#EFEBE3`/`#5C5A54`, Quote `#DDEDFA`/`#0369A1`, Approved and
Paid `#D6F5E3`/`#047857`, Deposit `#EAE4FD`/`#6D28D9`, Invoice `#FBEFD2`/`#8F5706`,
Cancelled `#FBE0E0`/`#B91C1C`.

**Filled buttons** — bronze, red, amber, teal, emerald — always carry white text.

**Active navigation** is a `white/10` fill on the rail plus a 2px `#D8BA84` tab
on the trailing edge and a portal-coloured icon, not a thick left border.

**Nav sections collapse.** A section is open when it holds the current page;
clicking its heading overrides that, and overrides are dropped on navigating
into a different section so the rule reasserts. A collapsed section shows the
sum of its items' badges on the heading, so nothing waiting on you is hidden by
being folded away. Disclosure animates `grid-template-rows` from `0fr` to `1fr`
over 200ms — no magic height — and is disabled under `prefers-reduced-motion`.
Links inside a collapsed section are `tabIndex={-1}` so they leave the tab order.

**Portal Accounts is a container, not a portal.** Its three items each keep
their own hue via `NavItem.accent`, which overrides the section accent.

Motion is limited to `transition-colors duration-150` and one 180ms entrance on
the command palette. The skeleton pulse respects `prefers-reduced-motion`.

**Responsive.** The admin is used on a phone as often as at a desk.

- Page padding steps `p-4 sm:p-6 lg:p-8`. Never a bare `p-8`.
- The rail becomes a drawer below `lg`, capped at `82vw` so it never pins a
  320px handset. Nav rows are `py-2.5` on touch and `py-[7px]` from `lg` up.
- Stat grids start at one or two columns and widen; never a bare `grid-cols-4`.
- **Every table sits in an `overflow-x-auto` wrapper and carries a `min-w-`
  floor sized to its column count** — roughly 34rem at five columns, 40rem at
  six, 52rem at eight, 58rem at nine. Without the floor the table squashes
  instead of scrolling; without the wrapper it drags the page sideways.
- Grid tracks that hold scrollable panels need `min-w-0`, since a grid item
  defaults to `min-width: auto` and will otherwise widen its track.
- `.platform-root` sets `overflow-x: clip` as the backstop. It is a safety net,
  not a licence to skip the wrapper.
